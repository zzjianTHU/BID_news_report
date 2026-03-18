import Parser from "rss-parser";
import * as cheerio from "cheerio";
import {
  CandidateStatus,
  IngestionTrigger,
  RiskLevel,
  RunStatus,
  SourceType,
  type CandidateItem,
  type Source,
  type WorkflowConfig
} from "@prisma/client";

import { getFeishuDigestChatId, getFeishuReviewChatId } from "@/lib/env";
import { listFeishuSourceRecords } from "@/lib/feishu/bitable";
import { buildDigestCard, buildReviewCard } from "@/lib/feishu/cards";
import { sendFeishuInteractiveMessage, sendFeishuTextMessage } from "@/lib/feishu/client";
import { prisma } from "@/lib/prisma";
import { generateDigestForDate, queueDigestDispatches, dispatchPendingEmailQueue } from "@/lib/services/digest";
import { publishCandidate } from "@/lib/services/publishing";
import { slugify } from "@/lib/utils";

export type WorkerTaskName =
  | "sync-feishu-sources"
  | "run-ingest-cycle"
  | "generate-digest"
  | "dispatch-email";

type SourcePayload = {
  title: string;
  url: string;
  excerpt: string;
  rawContent: string;
  tags?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
};

type IngestCycleResult = {
  dueSources: number;
  processedSources: number;
  publishedCount: number;
  reviewCount: number;
  duplicateCount: number;
  failedSources: number;
};

const FEED_FETCH_LIMIT = 5;
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_AUTO_PUBLISH_MIN_TRUST = 80;
const DEFAULT_RISK_KEYWORDS = ["rumor", "unverified", "匿名", "截图", "未经证实", "小道消息", "转载无来源"];

const rssParser = new Parser();

function normalizeMediaUrl(rawUrl: string | undefined | null, baseUrl?: string) {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("data:") || /\s/.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeMediaReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/,\s*\S+\s+\d+[wx]/i.test(trimmed)) {
    return true;
  }

  if (/\s/.test(trimmed)) {
    return false;
  }

  return (
    /^(https?:)?\/\//i.test(trimmed) ||
    /^(\/|\.\/|\.\.\/)/.test(trimmed) ||
    trimmed.includes("srcset") ||
    trimmed.includes("/") ||
    /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(trimmed)
  );
}

function hasRenderableCover(url: string | undefined | null) {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    return (
      /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(`${pathname}${search}`) ||
      /\/(images?|media|assets?|static|thumbnails?|social|og)\//i.test(pathname) ||
      /(^|\.)(img|image|images|media|cdn)\./i.test(parsed.hostname) ||
      /(img|image|format|fm|width|height|w|h)=/i.test(search)
    );
  } catch {
    return false;
  }
}

function normalizeUrl(rawUrl: string, baseUrl?: string) {
  try {
    const url = new URL(rawUrl, baseUrl);
    url.hash = "";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "spm",
      "ref",
      "source"
    ].forEach((key) => {
      url.searchParams.delete(key);
    });

    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function buildSummary(title: string, rawContent: string) {
  const cleaned = clampText(stripHtml(rawContent), 150);
  const summary = cleaned || title;

  return {
    summary,
    worthReading: `这条更新值得继续跟踪，因为它把“${clampText(title, 28)}”落到了更具体的动作或信号上。`
  };
}

function getWorkflowConfigOrFallback(workflow: WorkflowConfig | null) {
  const riskKeywords = workflow?.riskKeywords
    ?.split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    autoPublishMinTrust: workflow?.autoPublishMinTrust ?? DEFAULT_AUTO_PUBLISH_MIN_TRUST,
    riskKeywords: riskKeywords && riskKeywords.length > 0 ? riskKeywords : DEFAULT_RISK_KEYWORDS
  };
}

function detectRiskLevel(source: Source, workflow: WorkflowConfig | null, payload: SourcePayload) {
  const { autoPublishMinTrust, riskKeywords } = getWorkflowConfigOrFallback(workflow);
  const corpus = `${payload.title} ${payload.excerpt} ${payload.rawContent}`.toLowerCase();
  const hasRiskKeyword = riskKeywords.some((keyword) => corpus.includes(keyword.toLowerCase()));

  if (hasRiskKeyword || source.trustScore < autoPublishMinTrust) {
    return RiskLevel.HIGH;
  }

  return RiskLevel.LOW;
}

function resolvePayloadTags(source: Source, payload: SourcePayload) {
  const normalized = payload.tags
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (normalized && normalized.length > 0) {
    return normalized.join(",");
  }

  return source.tags;
}

function parseSrcset(value: string | undefined | null, baseUrl?: string) {
  if (!value) {
    return null;
  }

  const candidate = value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .find(Boolean);

  return normalizeMediaUrl(candidate, baseUrl);
}

function readImageCandidate(value: unknown, baseUrl?: string): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    if (value.includes("<img")) {
      const $ = cheerio.load(value);
      const image = $("img").first();

      return (
        normalizeMediaUrl(image.attr("src"), baseUrl) ||
        parseSrcset(image.attr("srcset"), baseUrl) ||
        normalizeMediaUrl(image.attr("data-src"), baseUrl)
      );
    }

    if (!looksLikeMediaReference(value)) {
      return null;
    }

    return normalizeMediaUrl(value, baseUrl) || parseSrcset(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = readImageCandidate(entry, baseUrl);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["url", "src", "href", "origin_url", "download_url", "image", "cover"]) {
      const candidate = readImageCandidate(record[key], baseUrl);
      if (candidate) {
        return candidate;
      }
    }

    return readImageCandidate(record.srcset, baseUrl);
  }

  return null;
}

function extractPageImageFromHtml(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const metaImage =
    normalizeMediaUrl($('meta[property="og:image"]').attr("content"), pageUrl) ||
    normalizeMediaUrl($('meta[name="twitter:image"]').attr("content"), pageUrl) ||
    normalizeMediaUrl($('meta[property="twitter:image"]').attr("content"), pageUrl);

  if (metaImage) {
    return {
      url: metaImage,
      alt:
        $('meta[property="og:image:alt"]').attr("content")?.trim() ||
        $('meta[name="twitter:image:alt"]').attr("content")?.trim() ||
        null
    };
  }

  const image = $("article img, main img, img").first();
  const imageUrl =
    normalizeMediaUrl(image.attr("src"), pageUrl) ||
    normalizeMediaUrl(image.attr("data-src"), pageUrl) ||
    parseSrcset(image.attr("srcset"), pageUrl);

  return {
    url: imageUrl,
    alt: image.attr("alt")?.trim() || null
  };
}

async function fetchArticleCover(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BID-News-Worker/1.0"
      }
    });

    if (!response.ok) {
      return {
        coverImageUrl: null,
        coverImageAlt: null
      };
    }

    const html = await response.text();
    const image = extractPageImageFromHtml(html, url);

    return {
      coverImageUrl: image.url,
      coverImageAlt: image.alt
    };
  } catch {
    return {
      coverImageUrl: null,
      coverImageAlt: null
    };
  }
}

function getListingImage(element: cheerio.Cheerio<any>, sourceUrl: string) {
  return (
    normalizeMediaUrl(element.find("img").first().attr("src"), sourceUrl) ||
    normalizeMediaUrl(element.find("img").first().attr("data-src"), sourceUrl) ||
    parseSrcset(element.find("img").first().attr("srcset"), sourceUrl)
  );
}

async function fetchRssItems(source: Source) {
  const feed = await rssParser.parseURL(source.url);
  const items: SourcePayload[] = [];

  for (const item of (feed.items ?? []).slice(0, FEED_FETCH_LIMIT)) {
    const title = item.title?.trim() || feed.title?.trim() || source.name;
    const url = normalizeUrl(item.link || source.url);
    const rawContent = stripHtml(item.content || item.contentSnippet || item.summary || source.description);
    const inlineImage =
      readImageCandidate((item as Record<string, unknown>).enclosure, url) ||
      readImageCandidate((item as Record<string, unknown>)["media:content"], url) ||
      readImageCandidate((item as Record<string, unknown>)["media:thumbnail"], url) ||
      readImageCandidate(item.content, url) ||
      readImageCandidate(item.contentSnippet, url);

    const remoteCover = inlineImage
      ? {
          coverImageUrl: inlineImage,
          coverImageAlt: title
        }
      : await fetchArticleCover(url);

    items.push({
      title,
      url,
      excerpt: clampText(rawContent || source.description, 180),
      rawContent,
      tags: source.tags,
      coverImageUrl: remoteCover.coverImageUrl ?? undefined,
      coverImageAlt: remoteCover.coverImageAlt ?? title
    });
  }

  return items.filter((item) => item.title && item.url);
}

async function fetchWebItems(source: Source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "BID-News-Worker/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: SourcePayload[] = [];

  $("article a[href], main a[href], a[href]").each((_, element) => {
    if (items.length >= FEED_FETCH_LIMIT) {
      return false;
    }

    const href = $(element).attr("href");
    const title = $(element).text().replace(/\s+/g, " ").trim();

    if (!href || title.length < 12) {
      return;
    }

    const url = normalizeUrl(href, source.url);

    if (!url.startsWith("http") || seen.has(url)) {
      return;
    }

    seen.add(url);

    const container = $(element).closest("article, li, div");
    const excerpt = clampText(container.text().replace(/\s+/g, " ").trim(), 180) || source.description;
    const coverImageUrl = getListingImage(container, source.url) || getListingImage($(element), source.url);

    items.push({
      title,
      url,
      excerpt,
      rawContent: excerpt,
      tags: source.tags,
      coverImageUrl: coverImageUrl ?? undefined,
      coverImageAlt: title
    });

    return undefined;
  });

  if (items.length > 0) {
    return Promise.all(
      items.map(async (item) => {
        if (item.coverImageUrl) {
          return item;
        }

        const remoteCover = await fetchArticleCover(item.url);
        return {
          ...item,
          coverImageUrl: remoteCover.coverImageUrl ?? undefined,
          coverImageAlt: remoteCover.coverImageAlt ?? item.title
        };
      })
    );
  }

  const pageTitle = $("title").first().text().trim() || source.name;
  const pageDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    source.description;

  const fallbackCover = extractPageImageFromHtml(html, source.url);

  return [
    {
      title: pageTitle,
      url: normalizeUrl(source.url),
      excerpt: clampText(pageDescription, 180),
      rawContent: pageDescription,
      tags: source.tags,
      coverImageUrl: fallbackCover.url ?? undefined,
      coverImageAlt: fallbackCover.alt ?? pageTitle
    }
  ];
}

async function fetchSourcePayloads(source: Source) {
  if (source.type === SourceType.RSS) {
    return fetchRssItems(source);
  }

  return fetchWebItems(source);
}

async function requestFeishuReview(candidate: CandidateItem & { source: Source }) {
  const chatId = getFeishuReviewChatId();
  if (!chatId) {
    return null;
  }

  const messageId = await sendFeishuInteractiveMessage(chatId, buildReviewCard(candidate, candidate.source));

  await prisma.candidateItem.update({
    where: {
      id: candidate.id
    },
    data: {
      reviewRequestedAt: new Date(),
      reviewMessageId: messageId
    }
  });

  return messageId;
}

async function notifyReviewSummary(result: IngestCycleResult) {
  const chatId = getFeishuReviewChatId();
  if (!chatId) {
    return;
  }

  await sendFeishuTextMessage(
    chatId,
    [
      "抓取轮次已完成",
      `到期源: ${result.dueSources}`,
      `实际处理: ${result.processedSources}`,
      `自动发布: ${result.publishedCount}`,
      `进入飞书审批: ${result.reviewCount}`,
      `重复跳过: ${result.duplicateCount}`,
      `失败源: ${result.failedSources}`
    ].join("\n")
  );
}

async function notifyDigestSummary(digestId: string) {
  const chatId = getFeishuDigestChatId();
  if (!chatId) {
    return;
  }

  const digest = await prisma.digest.findUnique({
    where: {
      id: digestId
    },
    include: {
      entries: {
        orderBy: [
          {
            duration: "asc"
          },
          {
            order: "asc"
          }
        ]
      }
    }
  });

  if (!digest) {
    return;
  }

  await sendFeishuInteractiveMessage(chatId, buildDigestCard(digest, digest.entries));
}

async function notifyDispatchSummary(sentCount: number) {
  const chatId = getFeishuDigestChatId();
  if (!chatId) {
    return;
  }

  await sendFeishuTextMessage(chatId, `邮件分发轮次完成，本次已处理 ${sentCount} 条待发送记录。`);
}

async function claimSource(sourceId: string) {
  const now = new Date();
  const expiredLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const result = await prisma.source.updateMany({
    where: {
      id: sourceId,
      enabled: true,
      OR: [{ lockedAt: null }, { lockedAt: { lt: expiredLock } }]
    },
    data: {
      lockedAt: now
    }
  });

  return result.count === 1;
}

async function releaseSource(
  sourceId: string,
  updates: {
    lastRunAt?: Date;
    nextRunAt?: Date;
    failureCount?: number;
    lastError?: string | null;
  }
) {
  await prisma.source.update({
    where: {
      id: sourceId
    },
    data: {
      ...updates,
      lockedAt: null
    }
  });
}

async function ingestSource(source: Source, workflow: WorkflowConfig | null) {
  const startedAt = new Date();
  const run = await prisma.ingestionRun.create({
    data: {
      sourceId: source.id,
      trigger: IngestionTrigger.SCHEDULED,
      status: RunStatus.RUNNING,
      itemsFound: 0,
      itemsPublished: 0,
      startedAt
    }
  });

  let createdCount = 0;
  let publishedCount = 0;
  let reviewCount = 0;
  let duplicateCount = 0;

  try {
    const payloads = await fetchSourcePayloads(source);

    for (const payload of payloads) {
      const normalizedUrl = normalizeUrl(payload.url, source.url);
      const existing = await prisma.candidateItem.findUnique({
        where: {
          normalizedUrl
        }
      });

      if (existing) {
        if (
          payload.coverImageUrl &&
          (!hasRenderableCover(existing.coverImageUrl) || existing.coverImageUrl !== payload.coverImageUrl)
        ) {
          await prisma.candidateItem.update({
            where: {
              id: existing.id
            },
            data: {
              coverImageUrl: payload.coverImageUrl,
              coverImageAlt: payload.coverImageAlt ?? payload.title
            }
          });
        } else if (existing.coverImageUrl && !hasRenderableCover(existing.coverImageUrl)) {
          await prisma.candidateItem.update({
            where: {
              id: existing.id
            },
            data: {
              coverImageUrl: null,
              coverImageAlt: null
            }
          });
        }
        duplicateCount += 1;
        continue;
      }

      const riskLevel = detectRiskLevel(source, workflow, payload);
      const ai = buildSummary(payload.title, payload.rawContent || payload.excerpt);
      const status =
        riskLevel === RiskLevel.LOW ? CandidateStatus.PUBLISHED : CandidateStatus.REVIEW;

      const candidate = await prisma.candidateItem.create({
        data: {
          sourceId: source.id,
          ingestionRunId: run.id,
          title: clampText(payload.title, 180),
          normalizedUrl,
          excerpt: clampText(payload.excerpt || source.description, 220),
          rawContent: clampText(payload.rawContent || payload.excerpt || source.description, 2400),
          tags: resolvePayloadTags(source, payload),
          coverImageUrl: payload.coverImageUrl,
          coverImageAlt: payload.coverImageAlt ?? payload.title,
          aiSummary: ai.summary,
          worthReading: ai.worthReading,
          aiConfidence: riskLevel === RiskLevel.LOW ? 0.88 : 0.54,
          riskLevel,
          status,
          publishedAt: status === CandidateStatus.PUBLISHED ? new Date() : null
        },
        include: {
          source: true
        }
      });

      createdCount += 1;

      if (status === CandidateStatus.PUBLISHED) {
        await publishCandidate(candidate.id);
        publishedCount += 1;
      } else {
        await requestFeishuReview(candidate);
        reviewCount += 1;
      }
    }

    const finishedAt = new Date();
    const nextRunAt = new Date(finishedAt.getTime() + source.fetchIntervalMinutes * 60 * 1000);
    const status =
      reviewCount > 0 && publishedCount === 0 && createdCount > 0 ? RunStatus.PARTIAL : RunStatus.SUCCESS;

    await prisma.ingestionRun.update({
      where: {
        id: run.id
      },
      data: {
        status,
        itemsFound: createdCount,
        itemsPublished: publishedCount,
        notes:
          reviewCount > 0
            ? `共 ${reviewCount} 条内容进入飞书审批。`
            : "本轮内容已完成自动发布或去重处理。",
        finishedAt
      }
    });

    await releaseSource(source.id, {
      lastRunAt: finishedAt,
      nextRunAt,
      failureCount: 0,
      lastError: null
    });

    return {
      createdCount,
      publishedCount,
      reviewCount,
      duplicateCount
    };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Unknown ingestion failure.";

    await prisma.ingestionRun.update({
      where: {
        id: run.id
      },
      data: {
        status: RunStatus.FAILED,
        itemsFound: createdCount,
        itemsPublished: publishedCount,
        errorSummary: message,
        notes: "抓取轮次失败。",
        finishedAt
      }
    });

    await releaseSource(source.id, {
      lastRunAt: finishedAt,
      nextRunAt: new Date(finishedAt.getTime() + source.fetchIntervalMinutes * 60 * 1000),
      failureCount: source.failureCount + 1,
      lastError: message
    });

    throw error;
  }
}

export async function syncFeishuSources() {
  const now = new Date();
  const records = await listFeishuSourceRecords();
  const recordIds = new Set<string>();

  for (const record of records) {
    recordIds.add(record.recordId);

    const existing = await prisma.source.findFirst({
      where: {
        feishuRecordId: record.recordId
      }
    });

    await prisma.source.upsert({
      where: {
        feishuRecordId: record.recordId
      },
      update: {
        name: record.name,
        slug: existing?.slug ?? record.slug,
        type: record.type,
        url: record.url,
        description: record.description || "飞书多维表格同步的数据源。",
        frequency: record.frequency,
        fetchIntervalMinutes: record.fetchIntervalMinutes,
        priority: record.priority,
        trustScore: record.trustScore,
        enabled: record.enabled,
        tags: record.tags,
        lastSyncedAt: now,
        nextRunAt: existing?.nextRunAt ?? now
      },
      create: {
        feishuRecordId: record.recordId,
        name: record.name,
        slug: record.slug || `${slugify(record.name)}-${record.recordId.slice(-6).toLowerCase()}`,
        type: record.type,
        url: record.url,
        description: record.description || "飞书多维表格同步的数据源。",
        frequency: record.frequency,
        fetchIntervalMinutes: record.fetchIntervalMinutes,
        priority: record.priority,
        trustScore: record.trustScore,
        enabled: record.enabled,
        tags: record.tags,
        lastSyncedAt: now,
        nextRunAt: now
      }
    });
  }

  await prisma.source.updateMany({
    where: {
      feishuRecordId: {
        not: null,
        ...(recordIds.size > 0 ? { notIn: Array.from(recordIds) } : {})
      }
    },
    data: {
      enabled: false,
      lastSyncedAt: now
    }
  });

  return {
    syncedCount: records.length
  };
}

export async function runIngestCycle() {
  const now = new Date();
  const expiredLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const workflow = await prisma.workflowConfig.findFirst({
    where: {
      active: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const dueSources = await prisma.source.findMany({
    where: {
      enabled: true,
      AND: [
        {
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }]
        },
        {
          OR: [{ lockedAt: null }, { lockedAt: { lt: expiredLock } }]
        }
      ]
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "asc" }]
  });

  const result: IngestCycleResult = {
    dueSources: dueSources.length,
    processedSources: 0,
    publishedCount: 0,
    reviewCount: 0,
    duplicateCount: 0,
    failedSources: 0
  };

  for (const source of dueSources) {
    const claimed = await claimSource(source.id);
    if (!claimed) {
      continue;
    }

    result.processedSources += 1;

    try {
      const sourceResult = await ingestSource(source, workflow);
      result.publishedCount += sourceResult.publishedCount;
      result.reviewCount += sourceResult.reviewCount;
      result.duplicateCount += sourceResult.duplicateCount;
    } catch {
      result.failedSources += 1;
    }
  }

  await notifyReviewSummary(result);

  return result;
}

export async function generateDigestTask() {
  const digest = await generateDigestForDate(new Date());

  if (!digest) {
    return {
      digestCreated: false,
      queuedCount: 0
    };
  }

  const queueResult = await queueDigestDispatches(digest.id, new Date());
  await notifyDigestSummary(digest.id);

  return {
    digestCreated: true,
    digestId: digest.id,
    queuedCount: queueResult.queuedCount
  };
}

export async function dispatchEmailTask() {
  const result = await dispatchPendingEmailQueue();
  await notifyDispatchSummary(result.sentCount);

  return result;
}

export async function runWorkerTask(task: WorkerTaskName) {
  switch (task) {
    case "sync-feishu-sources":
      return syncFeishuSources();
    case "run-ingest-cycle":
      return runIngestCycle();
    case "generate-digest":
      return generateDigestTask();
    case "dispatch-email":
      return dispatchEmailTask();
    default:
      throw new Error(`Unsupported worker task: ${task}`);
  }
}

export const workerTasks: WorkerTaskName[] = [
  "sync-feishu-sources",
  "run-ingest-cycle",
  "generate-digest",
  "dispatch-email"
];

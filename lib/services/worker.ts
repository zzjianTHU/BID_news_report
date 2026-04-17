import Parser from "rss-parser";
import * as cheerio from "cheerio";
import {
  CandidateStatus,
  DraftStatus,
  IngestionTrigger,
  type ModelRouteConfig,
  RunStatus,
  SourceType,
  type CandidateItem,
  type Source,
  type WorkflowConfig
} from "@prisma/client";

import { getAppBaseUrl, getFeishuDigestChatId, getFeishuReviewChatId } from "@/lib/env";
import {
  createOrUpdateFeishuDraftRecord,
  listFeishuDraftRecords,
  listFeishuModelRouteRecords,
  listFeishuSourceRecords,
  listFeishuWorkflowRecords
} from "@/lib/feishu/bitable";
import { buildDigestCard, buildReviewCard } from "@/lib/feishu/cards";
import { sendFeishuInteractiveMessage, sendFeishuTextMessage } from "@/lib/feishu/client";
import { prisma } from "@/lib/prisma";
import { type SourcePayload, runSingleContentWorkflow } from "@/lib/services/content-workflow";
import { generateDigestForDate, queueDigestDispatches, dispatchPendingEmailQueue } from "@/lib/services/digest";
import { publishCandidate, rejectCandidate } from "@/lib/services/publishing";
import { slugify } from "@/lib/utils";

export type WorkerTaskName =
  | "sync-feishu-sources"
  | "sync-feishu-control-plane"
  | "run-ingest-cycle"
  | "sync-feishu-draft-decisions"
  | "generate-digest"
  | "dispatch-email";

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
const WEB_NOISE_TITLE_PATTERNS = [
  /^skip to main content$/i,
  /^download press kit$/i,
  /^press kit$/i,
  /^newsletter subscribe$/i,
  /^this story is about ai$/i,
  /^latest updates from mistral ai\.?$/i,
  /^build on ai studio$/i,
  /^official microsoft blog$/i,
  /^microsoft on the issues$/i,
  /^publications$/i,
  /^read more$/i,
  /^learn more$/i,
  /^see all$/i,
  /^view all$/i,
  /^home$/i,
  /^about$/i,
  /^contact$/i,
  /^careers?$/i,
  /^jobs?$/i,
  /^privacy(?: policy)?$/i,
  /^terms(?: of service)?$/i,
  /^cookie(?: policy| settings)?$/i,
  /^sign in$/i,
  /^log in$/i,
  /^menu$/i
];
const WEB_NOISE_URL_PATTERNS = [
  /\/(privacy|terms|cookies?|press-?kit|brand|legal|contact|careers?|jobs?|about)(\/|$)/i
];
const WEB_CHROME_SELECTOR =
  "header, nav, footer, [role='navigation'], [aria-label*='navigation' i], .nav, .menu, .footer, .header, .breadcrumb";
const WEB_TITLE_PREFIX_PATTERNS = [
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2},\s+\d{4}\s*/i,
  /^(?:announcements?|product|research|policy|company|customers?|engineering|events?)\s*/i,
  /^read more about\s*/i
];

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

function normalizeTitleText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sanitizeWebTitle(value: string) {
  let title = value.replace(/\s+/g, " ").trim();
  let previous = "";

  while (title && title !== previous) {
    previous = title;

    for (const pattern of WEB_TITLE_PREFIX_PATTERNS) {
      title = title.replace(pattern, "").trim();
    }
  }

  return title;
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
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

function isLikelyBoilerplateText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized.length < 24 ||
    WEB_NOISE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    /(cookie|privacy|terms|subscribe|newsletter|copyright|all rights reserved|sign in|log in)/i.test(normalized)
  );
}

function extractArticleTextFromHtml(html: string) {
  const $ = cheerio.load(html);
  $(WEB_CHROME_SELECTOR).remove();
  $("script, style, noscript, iframe, svg, form, button").remove();

  const rootSelectors = [
    "article",
    "main article",
    "[role='main'] article",
    "main",
    "[role='main']",
    ".article",
    ".post",
    ".entry-content",
    ".content",
    ".prose"
  ];

  let root = $("body");
  for (const selector of rootSelectors) {
    const candidate = $(selector).first();
    if (candidate.length > 0 && candidate.text().trim().length > root.text().trim().length / 3) {
      root = candidate;
      break;
    }
  }

  const blocks = root
    .find("h1, h2, h3, p, li")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const uniqueBlocks: string[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const normalized = block.toLowerCase();
    if (seen.has(normalized) || isLikelyBoilerplateText(block)) {
      continue;
    }

    seen.add(normalized);
    uniqueBlocks.push(block);
  }

  const excerpt =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    uniqueBlocks.find((block) => block.length >= 40) ||
    uniqueBlocks[0] ||
    "";

  const rawContent = uniqueBlocks.join("\n\n");

  return {
    excerpt: clampText(excerpt, 220),
    rawContent: clampText(rawContent || excerpt, 4200)
  };
}

export function shouldReplaceWithArticleBody(currentRawContent: string, detailedRawContent: string, title: string) {
  const current = currentRawContent.replace(/\s+/g, " ").trim();
  const detailed = detailedRawContent.replace(/\s+/g, " ").trim();
  const normalizedTitle = title.replace(/\s+/g, " ").trim().toLowerCase();

  if (!detailed || detailed.length < 120) {
    return false;
  }

  if (current.length < 120) {
    return true;
  }

  if (current.toLowerCase() === normalizedTitle || current.toLowerCase().startsWith(normalizedTitle)) {
    return true;
  }

  return detailed.length > current.length + 120;
}

export async function fetchArticleDetails(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BID-News-Worker/1.0"
      }
    });

    if (!response.ok) {
      return {
        excerpt: null,
        rawContent: null,
        coverImageUrl: null,
        coverImageAlt: null
      };
    }

    const html = await response.text();
    const image = extractPageImageFromHtml(html, url);
    const article = extractArticleTextFromHtml(html);

    return {
      excerpt: article.excerpt || null,
      rawContent: article.rawContent || null,
      coverImageUrl: image.url,
      coverImageAlt: image.alt
    };
  } catch {
    return {
      excerpt: null,
      rawContent: null,
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

function getListingTitle(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>,
  container: cheerio.Cheerio<any>
) {
  const candidates = [
    element.attr("aria-label"),
    element.attr("title"),
    container.find("h1, h2, h3, h4").first().text(),
    element.find("h1, h2, h3, h4").first().text(),
    element.text()
  ];

  for (const value of candidates) {
    const normalized = sanitizeWebTitle(value ?? "");
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function getListingContainer(element: cheerio.Cheerio<any>) {
  const articleLike = element.closest("article, li");
  if (articleLike.length > 0) {
    return articleLike.first();
  }

  const sectionLike = element.closest("section");
  if (sectionLike.length > 0) {
    const immediateParent = element.parent();
    if (immediateParent.length > 0) {
      return immediateParent.first();
    }
    return sectionLike.first();
  }

  const parent = element.parent();
  if (parent.length > 0) {
    return parent.first();
  }

  return element;
}

function getListingExcerpt(
  element: cheerio.Cheerio<any>,
  container: cheerio.Cheerio<any>,
  fallback: string
) {
  const candidates = [
    container.find("p").first().text(),
    element.find("p").first().text(),
    container.text(),
    element.text()
  ];

  for (const value of candidates) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized) {
      return clampText(normalized, 180);
    }
  }

  return fallback;
}

function isLikelyWebNoiseTitle(title: string) {
  const normalized = normalizeTitleText(title);

  if (!normalized) {
    return true;
  }

  const looksLikeImageAlt =
    normalized === title.trim().toLowerCase() &&
    /\b(image|illustration|logo|people|person|stage|conference|photo|graphic|icon)\b/i.test(normalized);

  if (looksLikeImageAlt) {
    return true;
  }

  return WEB_NOISE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isLikelyWebNoiseUrl(url: string, sourceUrl: string) {
  try {
    const parsedUrl = new URL(url);
    const parsedSourceUrl = new URL(sourceUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return true;
    }

    if (parsedUrl.origin === parsedSourceUrl.origin && parsedUrl.pathname === parsedSourceUrl.pathname) {
      return true;
    }

    return WEB_NOISE_URL_PATTERNS.some((pattern) => pattern.test(parsedUrl.pathname));
  } catch {
    return true;
  }
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
    const article = await fetchArticleDetails(url);
    const enhancedRawContent =
      article.rawContent && shouldReplaceWithArticleBody(rawContent, article.rawContent, title)
        ? article.rawContent
        : rawContent;
    const enhancedExcerpt =
      article.excerpt && article.excerpt.length > 40 ? article.excerpt : enhancedRawContent || source.description;
    const remoteCover = inlineImage
      ? {
          coverImageUrl: inlineImage,
          coverImageAlt: title
        }
      : article;

    items.push({
      title,
      url,
      excerpt: clampText(enhancedExcerpt || source.description, 220),
      rawContent: clampText(enhancedRawContent || enhancedExcerpt || source.description, 4200),
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

    const currentElement = $(element);
    const href = $(element).attr("href");
    const container = getListingContainer(currentElement);
    const title = getListingTitle($, currentElement, container);

    if (!href || title.length < 12) {
      return;
    }

    const url = normalizeUrl(href, source.url);
    const isChromeLink = currentElement.closest(WEB_CHROME_SELECTOR).length > 0;

    if (
      !url.startsWith("http") ||
      seen.has(url) ||
      isChromeLink ||
      isLikelyWebNoiseTitle(title) ||
      isLikelyWebNoiseUrl(url, source.url)
    ) {
      return;
    }

    seen.add(url);

    const excerpt = getListingExcerpt(currentElement, container, source.description);
    const coverImageUrl = getListingImage(container, source.url) || getListingImage(currentElement, source.url);

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
        const article = await fetchArticleDetails(item.url);
        const nextRawContent =
          article.rawContent && shouldReplaceWithArticleBody(item.rawContent, article.rawContent, item.title)
            ? article.rawContent
            : item.rawContent;
        const nextExcerpt =
          article.excerpt && article.excerpt.length > 40 ? article.excerpt : nextRawContent || item.excerpt;

        return {
          ...item,
          excerpt: clampText(nextExcerpt || item.excerpt, 220),
          rawContent: clampText(nextRawContent || nextExcerpt || item.rawContent, 4200),
          coverImageUrl: item.coverImageUrl ?? article.coverImageUrl ?? undefined,
          coverImageAlt: item.coverImageAlt ?? article.coverImageAlt ?? item.title
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
  const pageArticle = extractArticleTextFromHtml(html);

  return [
    {
      title: pageTitle,
      url: normalizeUrl(source.url),
      excerpt: clampText(pageArticle.excerpt || pageDescription, 220),
      rawContent: clampText(pageArticle.rawContent || pageArticle.excerpt || pageDescription, 4200),
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

function serializeJson(value: unknown) {
  if (value == null) {
    return null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

async function getActiveWorkflowMirror() {
  return prisma.workflowConfig.findFirst({
    where: {
      active: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

async function getModelRouteMap() {
  const routes = await prisma.modelRouteConfig.findMany({
    where: {
      enabled: true
    }
  });

  return new Map<string, ModelRouteConfig>(routes.map((route) => [route.routeKey, route]));
}

export async function syncDraftRecord(candidateId: string) {
  const candidate = await prisma.candidateItem.findUnique({
    where: {
      id: candidateId
    },
    include: {
      source: true,
      autoPost: true
    }
  });

  if (!candidate) {
    return null;
  }

  try {
    const appBaseUrl = getAppBaseUrl();
    const draftRecord = await createOrUpdateFeishuDraftRecord(candidate.feishuDraftRecordId, {
      candidateId: candidate.id,
      status: candidate.draftStatus,
      title: candidate.title,
      slug: candidate.autoPost?.slug ?? null,
      sourceName: candidate.source.name,
      sourceUrl: candidate.normalizedUrl,
      tags: candidate.tags,
      riskLevel: candidate.riskLevel,
      qualityScore: candidate.qualityScore,
      workflowVersion: candidate.workflowVersion ?? null,
      summary: candidate.aiSummary,
      worthReading: candidate.worthReading,
      structuredJson: serializeJson(candidate.structuredJson),
      markdownDraft: candidate.draftMarkdown ?? candidate.rawContent,
      coverImageUrl: candidate.coverImageUrl ?? null,
      editorNotes: candidate.editorNotes ?? null,
      previewUrl: `${appBaseUrl}/preview/candidate/${candidate.id}`,
      publicUrl:
        candidate.autoPost?.slug != null
          ? `${appBaseUrl}/posts/${candidate.autoPost.slug}`
          : null,
      publishedAt: candidate.publishedAt?.toISOString() ?? null
    });

    await prisma.candidateItem.update({
      where: {
        id: candidate.id
      },
      data: {
        feishuDraftRecordId: draftRecord.record_id
      }
    });

    return draftRecord.record_id;
  } catch (error) {
    console.warn(
      `Skipping Feishu draft sync for candidate ${candidate.id}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    return null;
  }
}

async function syncPendingDraftsToFeishu() {
  const pendingCandidates = await prisma.candidateItem.findMany({
    where: {
      OR: [
        {
          status: CandidateStatus.REVIEW
        },
        {
          status: CandidateStatus.PUBLISHED
        },
        {
          status: CandidateStatus.REJECTED
        }
      ],
      feishuDraftRecordId: null
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  let syncedCount = 0;

  for (const candidate of pendingCandidates) {
    const recordId = await syncDraftRecord(candidate.id);
    if (recordId) {
      syncedCount += 1;
    }
  }

  return syncedCount;
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

async function ingestSource(
  source: Source,
  workflow: WorkflowConfig | null,
  routesByKey: Map<string, ModelRouteConfig>
) {
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

      const generated = await runSingleContentWorkflow({
        source,
        payload,
        workflow,
        routesByKey
      });
      const status = generated.shouldAutoPublish ? CandidateStatus.PUBLISHED : CandidateStatus.REVIEW;
      const draftStatus = generated.shouldAutoPublish ? DraftStatus.AUTO_PUBLISHED : DraftStatus.PENDING_REVIEW;

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
          aiSummary: generated.summary,
          worthReading: generated.worthReading,
          aiConfidence: generated.qualityScore,
          workflowVersion: generated.workflowVersion,
          qualityScore: generated.qualityScore,
          classificationJson: generated.classificationJson,
          structuredJson: generated.structuredJson,
          draftMarkdown: generated.draftMarkdown,
          draftStatus,
          riskLevel: generated.riskLevel,
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
        await syncDraftRecord(candidate.id);
        publishedCount += 1;
      } else {
        await syncDraftRecord(candidate.id);
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

export async function syncFeishuControlPlane() {
  const now = new Date();
  const [modelRoutes, workflows] = await Promise.all([
    listFeishuModelRouteRecords(),
    listFeishuWorkflowRecords()
  ]);

  const routeKeys = new Set<string>();
  for (const route of modelRoutes) {
    routeKeys.add(route.routeKey);

    await prisma.modelRouteConfig.upsert({
      where: {
        routeKey: route.routeKey
      },
      update: {
        feishuRecordId: route.recordId,
        enabled: route.enabled,
        provider: route.provider,
        baseUrl: route.baseUrl,
        model: route.model,
        apiKeyEnvName: route.apiKeyEnvName,
        temperature: route.temperature,
        maxTokens: route.maxTokens,
        timeoutMs: route.timeoutMs,
        notes: route.notes,
        lastSyncedAt: now
      },
      create: {
        feishuRecordId: route.recordId,
        routeKey: route.routeKey,
        enabled: route.enabled,
        provider: route.provider,
        baseUrl: route.baseUrl,
        model: route.model,
        apiKeyEnvName: route.apiKeyEnvName,
        temperature: route.temperature,
        maxTokens: route.maxTokens,
        timeoutMs: route.timeoutMs,
        notes: route.notes,
        lastSyncedAt: now
      }
    });
  }

  if (routeKeys.size > 0) {
    await prisma.modelRouteConfig.updateMany({
      where: {
        routeKey: {
          notIn: Array.from(routeKeys)
        }
      },
      data: {
        enabled: false,
        lastSyncedAt: now
      }
    });
  }

  const workflowRecordIds = new Set<string>();
  for (const workflow of workflows) {
    workflowRecordIds.add(workflow.recordId);

    await prisma.workflowConfig.upsert({
      where: {
        feishuRecordId: workflow.recordId
      },
      update: {
        name: workflow.name,
        version: workflow.version,
        summaryPrompt: workflow.classificationPrompt,
        highlightPrompt: workflow.structuringPrompt,
        classificationPrompt: workflow.classificationPrompt,
        structuringPrompt: workflow.structuringPrompt,
        detailMarkdownPrompt: workflow.detailMarkdownPrompt,
        riskKeywords: workflow.riskKeywords,
        autoPublishMinTrust: workflow.autoPublishMinTrust,
        autoPublishMinQuality: workflow.autoPublishMinQuality,
        digestRuleThree: workflow.digestThreePrompt,
        digestRuleEight: workflow.digestEightPrompt,
        digestThreePrompt: workflow.digestThreePrompt,
        digestEightPrompt: workflow.digestEightPrompt,
        classificationRouteKey: workflow.classificationRouteKey,
        structuringRouteKey: workflow.structuringRouteKey,
        detailMarkdownRouteKey: workflow.detailMarkdownRouteKey,
        digestThreeRouteKey: workflow.digestThreeRouteKey,
        digestEightRouteKey: workflow.digestEightRouteKey,
        notes: workflow.notes,
        active: workflow.enabled,
        lastSyncedAt: now
      },
      create: {
        feishuRecordId: workflow.recordId,
        name: workflow.name,
        version: workflow.version,
        summaryPrompt: workflow.classificationPrompt,
        highlightPrompt: workflow.structuringPrompt,
        classificationPrompt: workflow.classificationPrompt,
        structuringPrompt: workflow.structuringPrompt,
        detailMarkdownPrompt: workflow.detailMarkdownPrompt,
        riskKeywords: workflow.riskKeywords,
        autoPublishMinTrust: workflow.autoPublishMinTrust,
        autoPublishMinQuality: workflow.autoPublishMinQuality,
        digestRuleThree: workflow.digestThreePrompt,
        digestRuleEight: workflow.digestEightPrompt,
        digestThreePrompt: workflow.digestThreePrompt,
        digestEightPrompt: workflow.digestEightPrompt,
        classificationRouteKey: workflow.classificationRouteKey,
        structuringRouteKey: workflow.structuringRouteKey,
        detailMarkdownRouteKey: workflow.detailMarkdownRouteKey,
        digestThreeRouteKey: workflow.digestThreeRouteKey,
        digestEightRouteKey: workflow.digestEightRouteKey,
        notes: workflow.notes,
        active: workflow.enabled,
        lastSyncedAt: now
      }
    });
  }

  if (workflowRecordIds.size > 0) {
    await prisma.workflowConfig.updateMany({
      where: {
        feishuRecordId: {
          notIn: Array.from(workflowRecordIds)
        }
      },
      data: {
        active: false,
        lastSyncedAt: now
      }
    });
  }

  return {
    modelRouteCount: modelRoutes.length,
    workflowCount: workflows.length
  };
}

export async function syncFeishuDraftDecisions() {
  const pushedCount = await syncPendingDraftsToFeishu();
  const draftRecords = await listFeishuDraftRecords();
  let syncedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const draft of draftRecords) {
    const candidate = await prisma.candidateItem.findUnique({
      where: {
        id: draft.candidateId
      },
      include: {
        autoPost: true
      }
    });

    if (!candidate) {
      continue;
    }

    const needsCandidateUpdate =
      candidate.draftMarkdown !== draft.markdownDraft ||
      candidate.editorNotes !== draft.editorNotes ||
      candidate.aiSummary !== draft.summary ||
      candidate.worthReading !== draft.worthReading ||
      candidate.qualityScore !== draft.qualityScore ||
      candidate.draftStatus !== draft.status;

    if (needsCandidateUpdate) {
      await prisma.candidateItem.update({
        where: {
          id: candidate.id
        },
        data: {
          aiSummary: draft.summary || candidate.aiSummary,
          worthReading: draft.worthReading || candidate.worthReading,
          draftMarkdown: draft.markdownDraft || candidate.draftMarkdown,
          editorNotes: draft.editorNotes,
          qualityScore: draft.qualityScore,
          draftStatus: draft.status
        }
      });
      syncedCount += 1;
    }

    if (draft.status === DraftStatus.APPROVED && candidate.status !== CandidateStatus.PUBLISHED) {
      await publishCandidate(candidate.id, "feishu-draft-sync");
      await syncDraftRecord(candidate.id);
      approvedCount += 1;
      continue;
    }

    if (draft.status === DraftStatus.REJECTED && candidate.status !== CandidateStatus.REJECTED) {
      await rejectCandidate(candidate.id, "feishu-draft-sync");
      await syncDraftRecord(candidate.id);
      rejectedCount += 1;
      continue;
    }

    if (candidate.status === CandidateStatus.PUBLISHED && draft.markdownDraft) {
      await publishCandidate(candidate.id, "feishu-draft-sync");
      await syncDraftRecord(candidate.id);
    }
  }

  return {
    pushedCount,
    syncedCount,
    approvedCount,
    rejectedCount
  };
}

export async function runIngestCycle() {
  const now = new Date();
  const expiredLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const [workflow, routesByKey] = await Promise.all([getActiveWorkflowMirror(), getModelRouteMap()]);

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
      const sourceResult = await ingestSource(source, workflow, routesByKey);
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
  const [workflow, routesByKey] = await Promise.all([getActiveWorkflowMirror(), getModelRouteMap()]);
  const digest = await generateDigestForDate(new Date(), { workflow, routesByKey });

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
    case "sync-feishu-control-plane":
      return syncFeishuControlPlane();
    case "run-ingest-cycle":
      return runIngestCycle();
    case "sync-feishu-draft-decisions":
      return syncFeishuDraftDecisions();
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
  "sync-feishu-control-plane",
  "run-ingest-cycle",
  "sync-feishu-draft-decisions",
  "generate-digest",
  "dispatch-email"
];

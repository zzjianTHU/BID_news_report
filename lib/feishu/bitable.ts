import { DraftStatus, ModelProvider, SourceType } from "@prisma/client";

import {
  getFeishuDraftConfig,
  getFeishuModelRouteConfig,
  getFeishuSourceConfig,
  getFeishuWorkflowConfig
} from "@/lib/env";
import { feishuRequest } from "@/lib/feishu/client";
import { slugify } from "@/lib/utils";

type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

type FeishuRecordPage = {
  items: FeishuRecord[];
  page_token?: string;
  has_more?: boolean;
};

type FeishuTableConfig = {
  appToken: string | null;
  wikiToken?: string | null;
  tableId: string;
};

type WikiNodeResponse = {
  node?: {
    obj_token?: string;
    obj_type?: string;
  };
};

export type FeishuSourceRecord = {
  recordId: string;
  name: string;
  slug: string;
  url: string;
  type: SourceType;
  description: string;
  enabled: boolean;
  tags: string;
  trustScore: number;
  priority: number;
  fetchIntervalMinutes: number;
  frequency: string;
};

export type FeishuModelRouteRecord = {
  recordId: string;
  routeKey: string;
  enabled: boolean;
  provider: ModelProvider;
  baseUrl: string | null;
  model: string;
  apiKeyEnvName: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  notes: string | null;
};

export type FeishuWorkflowRecord = {
  recordId: string;
  name: string;
  version: string;
  enabled: boolean;
  classificationPrompt: string;
  structuringPrompt: string;
  detailMarkdownPrompt: string;
  digestThreePrompt: string;
  digestEightPrompt: string;
  classificationRouteKey: string;
  structuringRouteKey: string;
  detailMarkdownRouteKey: string;
  digestThreeRouteKey: string;
  digestEightRouteKey: string;
  riskKeywords: string;
  autoPublishMinTrust: number;
  autoPublishMinQuality: number;
  notes: string | null;
};

export type FeishuDraftRecord = {
  recordId: string;
  candidateId: string;
  status: DraftStatus;
  title: string;
  slug: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  tags: string;
  riskLevel: string | null;
  qualityScore: number;
  workflowVersion: string | null;
  summary: string;
  worthReading: string;
  structuredJson: string | null;
  markdownDraft: string;
  coverImageUrl: string | null;
  editorNotes: string | null;
  previewUrl: string | null;
  publicUrl: string | null;
  publishedAt: string | null;
};

function pickField(fields: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (alias in fields) {
      return fields[alias];
    }
  }
  return undefined;
}

function readText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => readText(item))
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    if ("text" in value) {
      return readText((value as { text: unknown }).text);
    }
    if ("name" in value) {
      return readText((value as { name: unknown }).name);
    }
    if ("url" in value) {
      return readText((value as { url: unknown }).url);
    }
    if ("value" in value) {
      return readText((value as { value: unknown }).value);
    }
  }

  return "";
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = Number(readText(value));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function readBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = readText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ["true", "1", "yes", "y", "on", "enabled", "是"].includes(normalized);
}

function normalizeSourceType(value: unknown) {
  const normalized = readText(value).toLowerCase();
  if (normalized.includes("web")) {
    return SourceType.WEB;
  }
  return SourceType.RSS;
}

function normalizeModelProvider(value: unknown) {
  const normalized = readText(value).toUpperCase();

  switch (normalized) {
    case "OPENAI":
      return ModelProvider.OPENAI;
    case "ANTHROPIC":
      return ModelProvider.ANTHROPIC;
    case "GEMINI":
      return ModelProvider.GEMINI;
    case "OPENAI_COMPATIBLE":
    default:
      return ModelProvider.OPENAI_COMPATIBLE;
  }
}

function normalizeDraftStatus(value: unknown) {
  const normalized = readText(value).toUpperCase();

  switch (normalized) {
    case "AUTO_PUBLISHED":
      return DraftStatus.AUTO_PUBLISHED;
    case "APPROVED":
      return DraftStatus.APPROVED;
    case "REJECTED":
      return DraftStatus.REJECTED;
    case "NEEDS_REWRITE":
      return DraftStatus.NEEDS_REWRITE;
    case "PENDING_REVIEW":
    default:
      return DraftStatus.PENDING_REVIEW;
  }
}

function normalizeTags(value: unknown) {
  const raw = readText(value);
  return raw
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");
}

function formatInterval(minutes: number) {
  if (minutes % (24 * 60) === 0) {
    return `每 ${minutes / (24 * 60)} 天`;
  }

  if (minutes % 60 === 0) {
    return `每 ${minutes / 60} 小时`;
  }

  return `每 ${minutes} 分钟`;
}

function buildSourceSlug(name: string, recordId: string) {
  const base = slugify(name) || "source";
  return `${base}-${recordId.slice(-6).toLowerCase()}`;
}

async function listFeishuRecords(config: FeishuTableConfig) {
  const appToken = await resolveBitableAppToken(config);
  const items: FeishuRecord[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      page_size: "100"
    });

    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const page = await feishuRequest<FeishuRecordPage>(
      `/bitable/v1/apps/${appToken}/tables/${config.tableId}/records?${query.toString()}`
    );

    items.push(...page.items);
    pageToken = page.has_more ? page.page_token : undefined;
  } while (pageToken);

  return items;
}

async function createFeishuRecord(config: FeishuTableConfig, fields: Record<string, unknown>) {
  const appToken = await resolveBitableAppToken(config);
  const data = await feishuRequest<{ record: FeishuRecord }>(
    `/bitable/v1/apps/${appToken}/tables/${config.tableId}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        fields
      })
    }
  );

  return data.record;
}

async function updateFeishuRecord(
  config: FeishuTableConfig,
  recordId: string,
  fields: Record<string, unknown>
) {
  const appToken = await resolveBitableAppToken(config);
  const data = await feishuRequest<{ record: FeishuRecord }>(
    `/bitable/v1/apps/${appToken}/tables/${config.tableId}/records/${recordId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        fields
      })
    }
  );

  return data.record;
}

const resolvedWikiTokenCache = new Map<string, string>();

async function resolveBitableAppToken(config: FeishuTableConfig) {
  if (config.appToken) {
    return config.appToken;
  }

  if (!config.wikiToken) {
    throw new Error(
      "Missing Feishu bitable token. Set FEISHU_SOURCE_APP_TOKEN or FEISHU_SOURCE_WIKI_TOKEN."
    );
  }

  const cached = resolvedWikiTokenCache.get(config.wikiToken);
  if (cached) {
    return cached;
  }

  const data = await feishuRequest<WikiNodeResponse>(
    `/wiki/v2/spaces/get_node?token=${encodeURIComponent(config.wikiToken)}`
  );

  const objToken = data.node?.obj_token?.trim();
  const objType = data.node?.obj_type?.trim();

  if (!objToken || objType !== "bitable") {
    throw new Error(
      `Failed to resolve wiki token "${config.wikiToken}" into a bitable app token. Resolved type: ${objType ?? "unknown"}.`
    );
  }

  resolvedWikiTokenCache.set(config.wikiToken, objToken);
  return objToken;
}

function mapFeishuSourceRecord(record: FeishuRecord): FeishuSourceRecord | null {
  const name = readText(pickField(record.fields, ["name", "Name", "名称"]));
  const url = readText(pickField(record.fields, ["url", "URL", "链接"]));

  if (!name || !url) {
    return null;
  }

  const fetchIntervalMinutes = Math.max(
    5,
    readNumber(pickField(record.fields, ["fetchIntervalMinutes", "FetchIntervalMinutes", "抓取频率"]), 60)
  );

  return {
    recordId: record.record_id,
    name,
    slug: buildSourceSlug(name, record.record_id),
    url,
    type: normalizeSourceType(pickField(record.fields, ["type", "Type", "类型"])),
    description: readText(pickField(record.fields, ["description", "Description", "描述"])),
    enabled: readBoolean(pickField(record.fields, ["enabled", "Enabled", "启用"]), true),
    tags: normalizeTags(pickField(record.fields, ["tags", "Tags", "标签"])) || "ai",
    trustScore: readNumber(pickField(record.fields, ["trustScore", "TrustScore", "可信度"]), 70),
    priority: readNumber(pickField(record.fields, ["priority", "Priority", "优先级"]), 70),
    fetchIntervalMinutes,
    frequency: formatInterval(fetchIntervalMinutes)
  };
}

function mapFeishuModelRouteRecord(record: FeishuRecord): FeishuModelRouteRecord | null {
  const routeKey = readText(pickField(record.fields, ["routeKey", "RouteKey"]));
  const model = readText(pickField(record.fields, ["model", "Model"]));
  const apiKeyEnvName = readText(pickField(record.fields, ["apiKeyEnvName", "ApiKeyEnvName"]));

  if (!routeKey || !model || !apiKeyEnvName) {
    return null;
  }

  return {
    recordId: record.record_id,
    routeKey,
    enabled: readBoolean(pickField(record.fields, ["enabled", "Enabled"]), true),
    provider: normalizeModelProvider(pickField(record.fields, ["provider", "Provider"])),
    baseUrl: readText(pickField(record.fields, ["baseUrl", "BaseUrl"])) || null,
    model,
    apiKeyEnvName,
    temperature: readNumber(pickField(record.fields, ["temperature", "Temperature"]), 0.2),
    maxTokens: readNumber(pickField(record.fields, ["maxTokens", "MaxTokens"]), 2000),
    timeoutMs: readNumber(pickField(record.fields, ["timeoutMs", "TimeoutMs"]), 30000),
    notes: readText(pickField(record.fields, ["notes", "Notes"])) || null
  };
}

function mapFeishuWorkflowRecord(record: FeishuRecord): FeishuWorkflowRecord | null {
  const name = readText(pickField(record.fields, ["name", "Name"]));
  const classificationPrompt = readText(
    pickField(record.fields, ["classificationPrompt", "ClassificationPrompt"])
  );
  const structuringPrompt = readText(
    pickField(record.fields, ["structuringPrompt", "StructuringPrompt"])
  );
  const detailMarkdownPrompt = readText(
    pickField(record.fields, ["detailMarkdownPrompt", "DetailMarkdownPrompt"])
  );
  const digestThreePrompt = readText(
    pickField(record.fields, ["digestThreePrompt", "DigestThreePrompt"])
  );
  const digestEightPrompt = readText(
    pickField(record.fields, ["digestEightPrompt", "DigestEightPrompt"])
  );

  if (
    !name ||
    !classificationPrompt ||
    !structuringPrompt ||
    !detailMarkdownPrompt ||
    !digestThreePrompt ||
    !digestEightPrompt
  ) {
    return null;
  }

  return {
    recordId: record.record_id,
    name,
    version: readText(pickField(record.fields, ["version", "Version"])) || "v1",
    enabled: readBoolean(pickField(record.fields, ["enabled", "Enabled"]), false),
    classificationPrompt,
    structuringPrompt,
    detailMarkdownPrompt,
    digestThreePrompt,
    digestEightPrompt,
    classificationRouteKey:
      readText(pickField(record.fields, ["classificationRouteKey", "ClassificationRouteKey"])) || "",
    structuringRouteKey:
      readText(pickField(record.fields, ["structuringRouteKey", "StructuringRouteKey"])) || "",
    detailMarkdownRouteKey:
      readText(pickField(record.fields, ["detailMarkdownRouteKey", "DetailMarkdownRouteKey"])) || "",
    digestThreeRouteKey:
      readText(pickField(record.fields, ["digestThreeRouteKey", "DigestThreeRouteKey"])) || "",
    digestEightRouteKey:
      readText(pickField(record.fields, ["digestEightRouteKey", "DigestEightRouteKey"])) || "",
    riskKeywords: readText(pickField(record.fields, ["riskKeywords", "RiskKeywords"])),
    autoPublishMinTrust: readNumber(
      pickField(record.fields, ["autoPublishMinTrust", "AutoPublishMinTrust"]),
      75
    ),
    autoPublishMinQuality: readNumber(
      pickField(record.fields, ["autoPublishMinQuality", "AutoPublishMinQuality"]),
      0.75
    ),
    notes: readText(pickField(record.fields, ["notes", "Notes"])) || null
  };
}

function mapFeishuDraftRecord(record: FeishuRecord): FeishuDraftRecord | null {
  const candidateId = readText(pickField(record.fields, ["candidateId", "CandidateId"]));
  if (!candidateId) {
    return null;
  }

  return {
    recordId: record.record_id,
    candidateId,
    status: normalizeDraftStatus(pickField(record.fields, ["status", "Status"])),
    title: readText(pickField(record.fields, ["title", "Title"])),
    slug: readText(pickField(record.fields, ["slug", "Slug"])) || null,
    sourceName: readText(pickField(record.fields, ["sourceName", "SourceName"])) || null,
    sourceUrl: readText(pickField(record.fields, ["sourceUrl", "SourceUrl"])) || null,
    tags: normalizeTags(pickField(record.fields, ["tags", "Tags"])),
    riskLevel: readText(pickField(record.fields, ["riskLevel", "RiskLevel"])) || null,
    qualityScore: readNumber(pickField(record.fields, ["qualityScore", "QualityScore"]), 0),
    workflowVersion: readText(pickField(record.fields, ["workflowVersion", "WorkflowVersion"])) || null,
    summary: readText(pickField(record.fields, ["summary", "Summary"])),
    worthReading: readText(pickField(record.fields, ["worthReading", "WorthReading"])),
    structuredJson: readText(pickField(record.fields, ["structuredJson", "StructuredJson"])) || null,
    markdownDraft: readText(pickField(record.fields, ["markdownDraft", "MarkdownDraft"])),
    coverImageUrl: readText(pickField(record.fields, ["coverImageUrl", "CoverImageUrl"])) || null,
    editorNotes: readText(pickField(record.fields, ["editorNotes", "EditorNotes"])) || null,
    previewUrl: readText(pickField(record.fields, ["previewUrl", "PreviewUrl"])) || null,
    publicUrl: readText(pickField(record.fields, ["publicUrl", "PublicUrl"])) || null,
    publishedAt: readText(pickField(record.fields, ["publishedAt", "PublishedAt"])) || null
  };
}

function warnOnSkippedRecords(entity: string, skippedCount: number) {
  if (skippedCount > 0) {
    console.warn(`Skipped ${skippedCount} Feishu ${entity} records because required fields were empty.`);
  }
}

export async function listFeishuSourceRecords() {
  const config = getFeishuSourceConfig();
  const records = await listFeishuRecords(config);
  const items: FeishuSourceRecord[] = [];
  let skippedCount = 0;

  for (const record of records) {
    const mapped = mapFeishuSourceRecord(record);
    if (!mapped) {
      skippedCount += 1;
      continue;
    }
    items.push(mapped);
  }

  warnOnSkippedRecords("source", skippedCount);
  return items;
}

export async function listFeishuModelRouteRecords() {
  const config = getFeishuModelRouteConfig();
  const records = await listFeishuRecords(config);
  const items: FeishuModelRouteRecord[] = [];
  let skippedCount = 0;

  for (const record of records) {
    const mapped = mapFeishuModelRouteRecord(record);
    if (!mapped) {
      skippedCount += 1;
      continue;
    }
    items.push(mapped);
  }

  warnOnSkippedRecords("model route", skippedCount);
  return items;
}

export async function listFeishuWorkflowRecords() {
  const config = getFeishuWorkflowConfig();
  const records = await listFeishuRecords(config);
  const items: FeishuWorkflowRecord[] = [];
  let skippedCount = 0;

  for (const record of records) {
    const mapped = mapFeishuWorkflowRecord(record);
    if (!mapped) {
      skippedCount += 1;
      continue;
    }
    items.push(mapped);
  }

  warnOnSkippedRecords("workflow", skippedCount);
  return items;
}

export async function listFeishuDraftRecords() {
  const config = getFeishuDraftConfig();
  const records = await listFeishuRecords(config);
  const items: FeishuDraftRecord[] = [];
  let skippedCount = 0;

  for (const record of records) {
    const mapped = mapFeishuDraftRecord(record);
    if (!mapped) {
      skippedCount += 1;
      continue;
    }
    items.push(mapped);
  }

  warnOnSkippedRecords("draft", skippedCount);
  return items;
}

export async function createOrUpdateFeishuDraftRecord(
  recordId: string | null,
  fields: Record<string, unknown>
) {
  const config = getFeishuDraftConfig();
  const normalizedFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (key === "publishedAt" && typeof value === "string") {
        const timestamp = Date.parse(value);
        return [key, Number.isFinite(timestamp) ? timestamp : value];
      }

      return [
        key,
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
          ? value
          : JSON.stringify(value)
      ];
    })
  );

  if (recordId) {
    return updateFeishuRecord(config, recordId, normalizedFields);
  }

  return createFeishuRecord(config, normalizedFields);
}

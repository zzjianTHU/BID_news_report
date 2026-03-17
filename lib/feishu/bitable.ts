import { SourceType } from "@prisma/client";

import { getFeishuSourceConfig } from "@/lib/env";
import { feishuRequest } from "@/lib/feishu/client";
import { slugify } from "@/lib/utils";

type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

type FeishuSourceRecord = {
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

type FeishuRecordPage = {
  items: FeishuRecord[];
  page_token?: string;
  has_more?: boolean;
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

function mapFeishuRecord(record: FeishuRecord): FeishuSourceRecord {
  const name = readText(pickField(record.fields, ["name", "Name", "名称"]));
  const url = readText(pickField(record.fields, ["url", "URL", "链接"]));

  if (!name || !url) {
    throw new Error(`Feishu source record ${record.record_id} is missing a name or URL.`);
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

export async function listFeishuSourceRecords() {
  const { appToken, tableId } = getFeishuSourceConfig();

  const items: FeishuSourceRecord[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      page_size: "100"
    });

    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const page = await feishuRequest<FeishuRecordPage>(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?${query.toString()}`
    );

    items.push(...page.items.map((record) => mapFeishuRecord(record)));
    pageToken = page.has_more ? page.page_token : undefined;
  } while (pageToken);

  return items;
}

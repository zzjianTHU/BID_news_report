import { DigestDuration, DispatchStatus, RiskLevel, SourceType } from "@prisma/client";
import { format } from "date-fns";

export function formatDateLabel(value: Date | string) {
  return format(new Date(value), "MMM d");
}

export function formatLongDate(value: Date | string) {
  return format(new Date(value), "yyyy-MM-dd");
}

export function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const TAG_LABELS: Record<string, string> = {
  agents: "智能体",
  models: "模型",
  infra: "基础设施",
  enterprise: "企业",
  research: "研究",
  safety: "安全",
  ranking: "排序",
  llama: "Llama",
  copilot: "Copilot",
  meta: "Meta",
  image: "图像",
  video: "视频",
  "open-models": "开放模型",
  "open-source": "开源",
  ecosystem: "生态",
  tools: "工具",
  developers: "开发者",
  apis: "API",
  products: "产品",
  google: "Google",
  microsoft: "Microsoft",
  rag: "RAG",
  search: "搜索"
};

export function translateTag(tag: string) {
  return TAG_LABELS[tag.toLowerCase()] ?? tag;
}

export function readTranslatedTitle(structuredJson: unknown) {
  if (!structuredJson || typeof structuredJson !== "object" || Array.isArray(structuredJson)) {
    return null;
  }

  const candidate = (structuredJson as { translatedTitle?: unknown }).translatedTitle;
  if (typeof candidate !== "string" || !candidate.trim()) {
    return null;
  }

  return candidate.trim();
}

export function formatBilingualTitle(originalTitle: string, translatedTitle?: string | null) {
  if (!translatedTitle) {
    return originalTitle;
  }

  const normalizedOriginal = originalTitle.trim().toLowerCase();
  const normalizedTranslated = translatedTitle.trim().toLowerCase();

  if (normalizedOriginal === normalizedTranslated) {
    return originalTitle;
  }

  return `${translatedTitle}（${originalTitle}）`;
}

export function durationFromTab(tab: string) {
  return tab === "8" ? DigestDuration.EIGHT : DigestDuration.THREE;
}

export function durationLabel(duration: DigestDuration | "3" | "8") {
  if (duration === DigestDuration.EIGHT || duration === "8") {
    return "8 分钟版";
  }

  return "3 分钟版";
}

export function statusTone(status: DispatchStatus | RiskLevel | SourceType) {
  switch (status) {
    case DispatchStatus.SENT:
    case RiskLevel.LOW:
    case SourceType.RSS:
      return "good";
    case DispatchStatus.PENDING:
      return "warm";
    case DispatchStatus.FAILED:
    case RiskLevel.HIGH:
      return "danger";
    default:
      return "neutral";
  }
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

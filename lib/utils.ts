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
  agents: "\u667a\u80fd\u4f53",
  models: "\u6a21\u578b",
  infra: "\u57fa\u7840\u8bbe\u65bd",
  enterprise: "\u4f01\u4e1a",
  research: "\u7814\u7a76",
  safety: "\u5b89\u5168",
  ranking: "\u6392\u5e8f",
  llama: "Llama",
  copilot: "Copilot",
  meta: "Meta",
  image: "\u56fe\u50cf",
  video: "\u89c6\u9891",
  "open-models": "\u5f00\u653e\u6a21\u578b",
  "open-source": "\u5f00\u6e90",
  ecosystem: "\u751f\u6001",
  tools: "\u5de5\u5177",
  developers: "\u5f00\u53d1\u8005",
  apis: "API",
  products: "\u4ea7\u54c1",
  google: "Google",
  microsoft: "Microsoft",
  rag: "RAG",
  search: "\u641c\u7d22"
};

const SOURCE_DESCRIPTION_FALLBACKS: Array<{
  pattern: RegExp;
  summary: string;
}> = [
  {
    pattern: /openai news/i,
    summary:
      "OpenAI \u5b98\u65b9\u65b0\u95fb RSS \u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 OpenAI \u7684\u6a21\u578b\u53d1\u5e03\u3001\u4ea7\u54c1\u66f4\u65b0\u548c\u5b98\u65b9\u516c\u544a\u3002"
  },
  {
    pattern: /google deepmind news/i,
    summary:
      "Google DeepMind \u5b98\u65b9\u535a\u5ba2\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6\u7814\u7a76\u8fdb\u5c55\u3001\u6a21\u578b\u53d1\u5e03\u548c\u5b89\u5168\u76f8\u5173\u66f4\u65b0\u3002"
  },
  {
    pattern: /anthropic news/i,
    summary:
      "Anthropic \u5b98\u65b9\u65b0\u95fb\u9875\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 Claude\u3001\u4f01\u4e1a\u4ea7\u54c1\u548c\u7814\u7a76\u53d1\u5e03\u3002"
  },
  {
    pattern: /hugging face blog/i,
    summary:
      "Hugging Face \u5b98\u65b9\u535a\u5ba2\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6\u5f00\u6e90\u6a21\u578b\u3001\u5de5\u5177\u94fe\u548c\u751f\u6001\u66f4\u65b0\u3002"
  },
  {
    pattern: /microsoft official blog/i,
    summary:
      "Microsoft \u5b98\u65b9\u535a\u5ba2 RSS \u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 Microsoft \u5728 AI\u3001Copilot \u548c\u4f01\u4e1a\u4ea7\u54c1\u65b9\u5411\u7684\u5b98\u65b9\u66f4\u65b0\u3002"
  },
  {
    pattern: /engineering at meta ai/i,
    summary:
      "Meta Engineering \u7684 AI \u680f\u76ee\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 Meta \u5728 AI \u57fa\u7840\u8bbe\u65bd\u3001\u7cfb\u7edf\u5de5\u7a0b\u548c\u6a21\u578b\u5e94\u7528\u4e0a\u7684\u5b98\u65b9\u6587\u7ae0\u3002"
  },
  {
    pattern: /stability ai news/i,
    summary:
      "Stability AI \u5b98\u65b9\u65b0\u95fb\u9875\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6\u56fe\u50cf\u3001\u89c6\u9891\u548c\u751f\u6210\u5f0f\u6a21\u578b\u76f8\u5173\u7684\u5b98\u65b9\u66f4\u65b0\u3002"
  },
  {
    pattern: /google developer tools/i,
    summary:
      "Google \u5f00\u53d1\u8005\u5de5\u5177\u680f\u76ee\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 Google \u9762\u5411\u5f00\u53d1\u8005\u7684 AI \u5de5\u5177\u3001API \u548c\u5de5\u7a0b\u80fd\u529b\u66f4\u65b0\u3002"
  },
  {
    pattern: /google ai/i,
    summary:
      "Google AI \u5b98\u65b9\u680f\u76ee\u6765\u6e90\uff0c\u4e3b\u8981\u7528\u4e8e\u8ddf\u8e2a Google \u5728 AI \u4ea7\u54c1\u3001\u6a21\u578b\u548c\u5e73\u53f0\u5c42\u9762\u7684\u66f4\u65b0\u3002"
  },
  {
    pattern: /cohere blog/i,
    summary:
      "Cohere \u5b98\u65b9\u535a\u5ba2\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6\u4f01\u4e1a\u641c\u7d22\u3001RAG \u548c\u6a21\u578b\u80fd\u529b\u76f8\u5173\u7684\u5b98\u65b9\u66f4\u65b0\u3002"
  },
  {
    pattern: /mistral news/i,
    summary:
      "Mistral \u5b98\u65b9\u65b0\u95fb\u680f\u76ee\u6765\u6e90\uff0c\u4e3b\u8981\u6293\u53d6 Mistral \u5728\u6a21\u578b\u3001\u5e73\u53f0\u548c\u4f01\u4e1a\u4ea7\u54c1\u65b9\u5411\u7684\u66f4\u65b0\u3002"
  }
];

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

  return `${translatedTitle}\uff08${originalTitle}\uff09`;
}

export function durationFromTab(tab: string) {
  return tab === "8" ? DigestDuration.EIGHT : DigestDuration.THREE;
}

export function durationLabel(duration: DigestDuration | "3" | "8") {
  if (duration === DigestDuration.EIGHT || duration === "8") {
    return "8 \u5206\u949f\u7248";
  }

  return "3 \u5206\u949f\u7248";
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

export function isBrokenText(value?: string | null) {
  if (!value) {
    return true;
  }

  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  return /\?{3,}|�|鏉|鍚|鐨|璇|鎶/.test(normalized);
}

export function describeSource(source: {
  name: string;
  type: SourceType | string;
  url: string;
  description?: string | null;
}) {
  if (!isBrokenText(source.description)) {
    return source.description!.trim();
  }

  const matched = SOURCE_DESCRIPTION_FALLBACKS.find((item) => item.pattern.test(source.name));
  if (matched) {
    return matched.summary;
  }

  const typeLabel =
    source.type === SourceType.RSS || source.type === "RSS"
      ? "RSS \u6765\u6e90"
      : "\u7f51\u9875\u6765\u6e90";

  return `${source.name} \u7684${typeLabel}\uff0c\u4e3b\u8981\u7528\u4e8e\u6293\u53d6\u8fd9\u4e2a\u7ad9\u70b9\u7684\u6700\u65b0\u6587\u7ae0\u548c\u66f4\u65b0\u5185\u5bb9\u3002`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import { DigestDuration, RiskLevel, type AutoPost, type ModelRouteConfig, type Source, type WorkflowConfig } from "@prisma/client";
import { z } from "zod";

import { invokeModelText } from "@/lib/ai/provider";

export type SourcePayload = {
  title: string;
  url: string;
  excerpt: string;
  rawContent: string;
  tags?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
};

type RoutesByKey = Map<string, ModelRouteConfig>;

const classificationSchema = z.object({
  category: z.string().min(1),
  riskLevel: z.nativeEnum(RiskLevel),
  qualityScore: z.number().min(0).max(1),
  shouldPublish: z.boolean(),
  keyFacts: z.array(z.string().min(1)).default([]),
  reasoningSummary: z.string().min(1)
});

const structuringSchema = z.object({
  translatedTitle: z.string().default(""),
  summary: z.string().min(1),
  worthReading: z.string().min(1),
  tldr: z.array(z.string().min(1)).min(1),
  outline: z.array(z.string().min(1)).min(1),
  sourceNotes: z.array(z.string().min(1)).default([])
});

const digestOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  entries: z.array(
    z.object({
      slug: z.string().min(1),
      title: z.string().min(1),
      summary: z.string().min(1),
      worthReading: z.string().min(1)
    })
  )
});

type ClassificationResult = z.output<typeof classificationSchema>;
type StructuringResult = z.output<typeof structuringSchema>;
type DigestOutput = z.output<typeof digestOutputSchema>;

export type ContentWorkflowResult = {
  summary: string;
  worthReading: string;
  tldr: string[];
  draftMarkdown: string;
  riskLevel: RiskLevel;
  qualityScore: number;
  workflowVersion: string;
  classificationJson: ClassificationResult;
  structuredJson: StructuringResult;
  shouldAutoPublish: boolean;
};

export type DigestWorkflowResult = {
  title: string;
  summary: string;
  entries: Array<{
    slug: string;
    title: string;
    summary: string;
    worthReading: string;
  }>;
};

function parseJsonResponse<T>(
  raw: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  normalizer?: (value: unknown) => unknown
) {
  const trimmed = raw.trim();
  const normalized = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  const parsed = JSON.parse(normalized);
  return schema.parse(normalizer ? normalizer(parsed) : parsed);
}

function unwrapModelEnvelope(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["answer", "result", "data", "output"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      return nested;
    }
  }

  return value;
}

function normalizeRiskLevel(value: unknown) {
  if (typeof value !== "string") {
    return RiskLevel.HIGH;
  }

  return value.trim().toUpperCase() === "LOW" ? RiskLevel.LOW : RiskLevel.HIGH;
}

function normalizeQualityScore(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.55;
  }

  if (value > 1) {
    return Math.max(0, Math.min(1, value / 100));
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function buildDerivedWorthReading({
  title,
  summary,
  outline
}: {
  title: string;
  summary: string;
  outline: string[];
}) {
  const corpus = `${title}\n${summary}\n${outline.join("\n")}`.toLowerCase();
  const reasons: string[] = [];

  if (/(benchmark|性能|效率|latency|throughput|cache|推理|并行|gpu|部署)/i.test(corpus)) {
    reasons.push("它给出了可直接落到工程实践里的性能优化或系统实现方法");
  }

  if (/(announce|launch|发布|推出|available|copilot|suite|合作|alliance)/i.test(corpus)) {
    reasons.push("它包含明确的产品动作、合作信号或商业化推进节点");
  }

  if (/(safety|governance|compliance|合规|安全|风险)/i.test(corpus)) {
    reasons.push("它补充了治理、合规或安全层面的关键信号");
  }

  if (/(model|llm|多模态|reasoning|训练|开放模型|开源)/i.test(corpus)) {
    reasons.push("它能帮助判断模型能力边界、技术路线和后续演进方向");
  }

  if (reasons.length === 0) {
    reasons.push("它把标题背后的关键动作、方法或影响范围讲得更具体了");
  }

  return `值得看，因为${reasons.slice(0, 2).join("；")}。`;
}

function normalizeStructuredPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const flattened: string[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const category = typeof record.category === "string" ? record.category.trim() : "";
    const points = normalizeStringArray(record.points);

    if (category && points.length > 0) {
      flattened.push(`${category}：${points.join("；")}`);
      continue;
    }

    if (category) {
      flattened.push(category);
    }

    flattened.push(...points);
  }

  return flattened;
}

function normalizeClassificationResponse(value: unknown) {
  const parsed = unwrapModelEnvelope(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const record = parsed as Record<string, unknown>;
  const qualityScore = normalizeQualityScore(record.qualityScore ?? record.score ?? record.confidence);
  const riskLevel = normalizeRiskLevel(record.riskLevel ?? record.risk ?? record.risk_level);

  return {
    category:
      typeof record.category === "string" && record.category.trim()
        ? record.category.trim().toLowerCase()
        : "general",
    riskLevel,
    qualityScore,
    shouldPublish:
      typeof record.shouldPublish === "boolean"
        ? record.shouldPublish
        : riskLevel === RiskLevel.LOW && qualityScore >= 0.7,
    keyFacts: normalizeStringArray(record.keyFacts ?? record.facts ?? record.highlights),
    reasoningSummary:
      typeof record.reasoningSummary === "string" && record.reasoningSummary.trim()
        ? record.reasoningSummary.trim()
        : "模型已给出结构化分类结果。"
  };
}

function normalizeStructuringResponse(value: unknown) {
  const parsed = unwrapModelEnvelope(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const record = parsed as Record<string, unknown>;
  const outline = [
    ...normalizeStringArray(record.outline),
    ...normalizeStructuredPoints(record.structuredPoints)
  ];

  const summary =
    typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim()
      : typeof record.abstract === "string" && record.abstract.trim()
        ? record.abstract.trim()
        : "";
  const tldr = normalizeStringArray(record.tldr ?? record.TLDR ?? record.keyPoints);
  const sourceNotes = normalizeStringArray(record.sourceNotes ?? record.references ?? record.links);
  const translatedTitle =
    typeof record.translatedTitle === "string" && record.translatedTitle.trim()
      ? record.translatedTitle.trim()
      : typeof record.titleZh === "string" && record.titleZh.trim()
        ? record.titleZh.trim()
        : typeof record.title_cn === "string" && record.title_cn.trim()
          ? record.title_cn.trim()
          : typeof record.translated_title === "string" && record.translated_title.trim()
            ? record.translated_title.trim()
            : "";
  const worthReading =
    typeof record.worthReading === "string" && record.worthReading.trim()
      ? record.worthReading.trim()
      : typeof record.whyWorthWatching === "string" && record.whyWorthWatching.trim()
        ? record.whyWorthWatching.trim()
        : typeof record.whyWorthReading === "string" && record.whyWorthReading.trim()
          ? record.whyWorthReading.trim()
          : typeof record.worthReading === "boolean"
            ? buildDerivedWorthReading({
                title: translatedTitle || summary,
                summary,
                outline
              })
            : "";

  return {
    translatedTitle,
    summary,
    worthReading,
    tldr,
    outline,
    sourceNotes
  };
}

async function translateTitleWithModel({
  route,
  title
}: {
  route: ModelRouteConfig;
  title: string;
}) {
  const response = await invokeModelText({
    route,
    messages: [
      {
        role: "system",
        content: `你是中文科技编辑。请把用户给出的英文标题翻译成简体中文标题。

要求：
- 只输出一行标题
- 不要解释
- 保留公司名、模型名、专有名词的英文
- 不要附加英文原文`
      },
      {
        role: "user",
        content: title
      }
    ]
  });

  return response.replace(/\s+/g, " ").trim();
}

function getRiskKeywords(workflow: WorkflowConfig | null) {
  return (workflow?.riskKeywords || "rumor,unverified,匿名,截图,未经证实,小道消息,转载无来源")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function preparePayloadForModel(payload: SourcePayload): SourcePayload {
  const excerpt = payload.excerpt.replace(/\s+/g, " ").trim();
  const rawContent = payload.rawContent.replace(/\s+/g, " ").trim();

  return {
    ...payload,
    excerpt: clampText(excerpt || payload.title, 1600),
    rawContent: clampText(rawContent || excerpt || payload.title, 12000)
  };
}

function splitIntoSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
}

function inferTopic(title: string, tags?: string) {
  const compactTitle = title.replace(/\s+/g, " ").trim();
  const firstTag = tags
    ?.split(",")
    .map((tag) => tag.trim())
    .find(Boolean);

  if (firstTag) {
    return `${compactTitle}（${firstTag}）`;
  }

  return compactTitle;
}

function summarizeSignals(corpus: string) {
  const normalized = corpus.toLowerCase();
  const signals: string[] = [];

  if (/(introducing|announce|launch|release|available today|general availability|now available)/i.test(normalized)) {
    signals.push("原文给出了明确的发布动作、上线范围或可用时间");
  }

  if (/(model|benchmark|performance|reasoning|open model|multimodal|context window|agent)/i.test(normalized)) {
    signals.push("它透露了模型能力、产品路线或评测方向的变化");
  }

  if (/(enterprise|trust|security|control|governance|compliance|management)/i.test(normalized)) {
    signals.push("它还补充了企业落地、治理或安全控制层面的信号");
  }

  if (/(infrastructure|gpu|cluster|accelerated computing|datacenter|deployment|latency|throughput)/i.test(normalized)) {
    signals.push("文中也释放了基础设施、部署方式或系统扩展方向的信息");
  }

  if (signals.length === 0) {
    signals.push("正文里提供了比标题更具体的动作、能力或影响范围");
  }

  return signals.slice(0, 2);
}

function buildFallbackSummary(payload: SourcePayload) {
  const cleaned = payload.rawContent.replace(/\s+/g, " ").trim() || payload.excerpt.replace(/\s+/g, " ").trim() || payload.title;
  const sentences = splitIntoSentences(cleaned);
  const topic = inferTopic(payload.title, payload.tags);
  const leadSentence = sentences[0] || cleaned || payload.title;
  const secondarySentence = sentences[1] || payload.excerpt || "";
  const signals = summarizeSignals(`${payload.title}\n${payload.excerpt}\n${payload.rawContent}`);

  return {
    summary: clampText(
      [
        `这篇内容主要围绕 ${topic} 展开。`,
        `原文重点提到：${leadSentence}`,
        secondarySentence ? `补充信息：${secondarySentence}` : ""
      ]
        .filter(Boolean)
        .join(" "),
      220
    ),
    worthReading: `${signals.join("；")}。`
  };
}

function buildFallbackMarkdown(payload: SourcePayload, summary: string, worthReading: string) {
  const cleaned = payload.rawContent.replace(/\s+/g, " ").trim() || payload.excerpt || payload.title;
  const keySentences = splitIntoSentences(cleaned).slice(0, 4);

  return [
    `# ${payload.title}`,
    "",
    "## TL;DR",
    "",
    `- ${summary}`,
    `- ${worthReading}`,
    ...keySentences.slice(0, 2).map((sentence) => `- 原文重点：${sentence}`),
    "",
    "## 这篇内容讲了什么",
    "",
    `这篇文章主要围绕“${inferTopic(payload.title, payload.tags)}”展开。`,
    "",
    `正文中更核心的信息包括：${keySentences[0] || payload.excerpt || payload.title}`,
    keySentences[1] ? `另外一条值得注意的信息是：${keySentences[1]}` : "",
    "",
    "## 关键信息",
    "",
    ...keySentences.map((sentence) => `- ${sentence}`),
    "",
    "## 原文链接",
    "",
    payload.url
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackClassification(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig | null
): ClassificationResult {
  const riskKeywords = getRiskKeywords(workflow);
  const corpus = `${payload.title} ${payload.excerpt} ${payload.rawContent}`.toLowerCase();
  const hasRiskKeyword = riskKeywords.some((keyword) => corpus.includes(keyword.toLowerCase()));
  const lowRisk = !hasRiskKeyword && source.trustScore >= (workflow?.autoPublishMinTrust ?? 80);

  return {
    category: payload.tags?.split(",")[0]?.trim() || "general",
    riskLevel: lowRisk ? RiskLevel.LOW : RiskLevel.HIGH,
    qualityScore: lowRisk ? 0.62 : 0.35,
    shouldPublish: lowRisk,
    keyFacts: [payload.excerpt || payload.rawContent].filter(Boolean).slice(0, 3),
    reasoningSummary: lowRisk ? "来源可信度较高，且未出现显著风险信号。" : "来源可信度不足或内容存在风险词。"
  };
}

function buildFallbackStructuring(payload: SourcePayload): StructuringResult {
  const fallback = buildFallbackSummary(payload);
  const outlineSource = splitIntoSentences(payload.rawContent || payload.excerpt).slice(0, 3);

  return {
    translatedTitle: "",
    summary: fallback.summary,
    worthReading: fallback.worthReading,
    tldr: [fallback.summary, ...outlineSource.slice(0, 2)],
    outline: outlineSource.length > 0 ? outlineSource : [payload.excerpt || payload.rawContent || payload.title],
    sourceNotes: [payload.url]
  };
}

function getRoute(routesByKey: RoutesByKey, routeKey: string | null | undefined, stageName: string) {
  if (!routeKey) {
    throw new Error(`${stageName} routeKey is missing.`);
  }

  const route = routesByKey.get(routeKey);
  if (!route || !route.enabled) {
    throw new Error(`${stageName} route "${routeKey}" was not found or is disabled.`);
  }

  return route;
}

async function runStructuredPrompt<T>({
  route,
  systemPrompt,
  userPayload,
  schema,
  normalizer
}: {
  route: ModelRouteConfig;
  systemPrompt: string;
  userPayload: Record<string, unknown>;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  normalizer?: (value: unknown) => unknown;
}) {
  const text = await invokeModelText({
    route,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}

请使用简体中文输出所有自然语言字段。
请只返回严格 JSON，不要输出解释、Markdown 或代码块。
如果字段需要表达“为什么值得看”，请明确写出核心信息、具体动作和潜在影响，不要写空泛套话。`
      },
      {
        role: "user",
        content: JSON.stringify(userPayload, null, 2)
      }
    ]
  });

  return parseJsonResponse(text, schema, normalizer);
}

async function runMarkdownPrompt({
  route,
  systemPrompt,
  userPayload
}: {
  route: ModelRouteConfig;
  systemPrompt: string;
  userPayload: Record<string, unknown>;
}) {
  return invokeModelText({
    route,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}

请使用简体中文写作，专有名词保留原文。
请直接返回完整 Markdown 正文，不要添加解释。
结构固定为：
## TL;DR
- 3 条中文要点
## 这篇内容讲了什么
## 关键信息
## 为什么值得关注
## 原文链接

正文不要只重复标题，必须把主要内容翻译并整理成中文。`
      },
      {
        role: "user",
        content: JSON.stringify(userPayload, null, 2)
      }
    ]
  });
}

export async function runClassification(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig,
  routesByKey: RoutesByKey
): Promise<ClassificationResult> {
  const route = getRoute(routesByKey, workflow.classificationRouteKey, "classification");
  return runStructuredPrompt<ClassificationResult>({
    route,
    systemPrompt: `${workflow.classificationPrompt}

JSON 字段必须严格使用以下键名：
- category: 字符串
- riskLevel: 只能是 LOW 或 HIGH
- qualityScore: 0 到 1 的数字
- shouldPublish: 布尔值
- keyFacts: 字符串数组
- reasoningSummary: 字符串`,
    userPayload: {
      source: {
        name: source.name,
        trustScore: source.trustScore,
        type: source.type
      },
      item: payload
    },
    schema: classificationSchema,
    normalizer: normalizeClassificationResponse
  });
}

export async function runStructuring(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig,
  routesByKey: RoutesByKey,
  classification: ClassificationResult
): Promise<StructuringResult> {
  const route = getRoute(routesByKey, workflow.structuringRouteKey, "structuring");
  const result = await runStructuredPrompt<StructuringResult>({
    route,
    systemPrompt: `${workflow.structuringPrompt}

JSON 字段必须严格使用以下键名：
- translatedTitle: 中文标题
- summary: 中文摘要
- worthReading: 中文说明“为什么值得看”
- tldr: 中文字符串数组
- outline: 中文字符串数组
- sourceNotes: 字符串数组

所有自然语言字段必须是简体中文，不要输出英文段落。
summary 必须直接概括文章讲了什么，至少提到核心动作、对象和结论。
worthReading 必须明确回答“为什么值得看”，不能写空泛套话，不能写“这篇内容主要围绕”或“值得继续跟踪”这种话。`,
    userPayload: {
      source: {
        name: source.name,
        trustScore: source.trustScore,
        type: source.type
      },
      item: payload,
      classification
    },
    schema: structuringSchema,
    normalizer: normalizeStructuringResponse
  });

  if (!result.translatedTitle) {
    try {
      const translatedTitle = await translateTitleWithModel({
        route,
        title: payload.title
      });

      if (translatedTitle) {
        return {
          ...result,
          translatedTitle
        };
      }
    } catch {
      return result;
    }
  }

  return result;
}

export async function runDetailMarkdown(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig,
  routesByKey: RoutesByKey,
  classification: ClassificationResult,
  structuring: StructuringResult
) {
  const route = getRoute(routesByKey, workflow.detailMarkdownRouteKey, "detail markdown");
  return runMarkdownPrompt({
    route,
    systemPrompt: workflow.detailMarkdownPrompt,
    userPayload: {
      source: {
        name: source.name,
        trustScore: source.trustScore,
        type: source.type
      },
      item: payload,
      classification,
      structuring
    }
  });
}

export async function runSingleContentWorkflow({
  source,
  payload,
  workflow,
  routesByKey
}: {
  source: Source;
  payload: SourcePayload;
  workflow: WorkflowConfig | null;
  routesByKey: RoutesByKey;
}): Promise<ContentWorkflowResult> {
  const workflowPayload = preparePayloadForModel(payload);
  const fallbackClassification = buildFallbackClassification(source, workflowPayload, workflow);
  const fallbackStructuring = buildFallbackStructuring(workflowPayload);
  const fallbackMarkdown = buildFallbackMarkdown(
    workflowPayload,
    fallbackStructuring.summary,
    fallbackStructuring.worthReading
  );

  if (!workflow) {
    return {
      summary: fallbackStructuring.summary,
      worthReading: fallbackStructuring.worthReading,
      tldr: fallbackStructuring.tldr,
      draftMarkdown: fallbackMarkdown,
      riskLevel: fallbackClassification.riskLevel,
      qualityScore: fallbackClassification.qualityScore,
      workflowVersion: "fallback-v1",
      classificationJson: fallbackClassification,
      structuredJson: fallbackStructuring,
      shouldAutoPublish: false
    };
  }

  let classification: ClassificationResult = fallbackClassification;
  let structuring: StructuringResult = fallbackStructuring;
  let draftMarkdown = fallbackMarkdown;
  let pipelineHealthy = true;

  try {
    classification = await runClassification(source, workflowPayload, workflow, routesByKey);
  } catch {
    pipelineHealthy = false;
  }

  try {
    if (pipelineHealthy) {
      structuring = await runStructuring(source, workflowPayload, workflow, routesByKey, classification);
    } else {
      throw new Error("classification failed");
    }
  } catch {
    pipelineHealthy = false;
  }

  try {
    if (pipelineHealthy) {
      draftMarkdown = await runDetailMarkdown(
        source,
        workflowPayload,
        workflow,
        routesByKey,
        classification,
        structuring
      );
    } else {
      throw new Error("structuring failed");
    }
  } catch {
    pipelineHealthy = false;
    draftMarkdown = fallbackMarkdown;
  }

  const shouldAutoPublish =
    pipelineHealthy &&
    classification.riskLevel === RiskLevel.LOW &&
    classification.shouldPublish &&
    classification.qualityScore >= workflow.autoPublishMinQuality &&
    source.trustScore >= workflow.autoPublishMinTrust;

  return {
    summary: structuring.summary,
    worthReading: structuring.worthReading,
    tldr: structuring.tldr,
    draftMarkdown,
    riskLevel: classification.riskLevel,
    qualityScore: classification.qualityScore,
    workflowVersion: workflow.version,
    classificationJson: classification,
    structuredJson: structuring,
    shouldAutoPublish
  };
}

function buildDigestFallback(posts: AutoPost[], duration: DigestDuration): DigestWorkflowResult {
  const limit = duration === DigestDuration.THREE ? 3 : 5;
  const selectedPosts = posts.slice(0, limit);

  return {
    title: "AI 情报日报",
    summary:
      selectedPosts.length <= 1
        ? "今天先整理出 1 条值得跟进的内容。"
        : `今天共整理 ${selectedPosts.length} 条值得跟进的内容，建议按优先级快速浏览。`,
    entries: selectedPosts.map((post) => ({
      slug: post.slug || "",
      title: post.title,
      summary: post.summary,
      worthReading: post.worthReading
    }))
  };
}

function buildDigestRouteKey(workflow: WorkflowConfig, duration: DigestDuration) {
  return duration === DigestDuration.THREE ? workflow.digestThreeRouteKey : workflow.digestEightRouteKey;
}

function buildDigestPrompt(workflow: WorkflowConfig, duration: DigestDuration) {
  return duration === DigestDuration.THREE ? workflow.digestThreePrompt : workflow.digestEightPrompt;
}

export async function runDigestWorkflow({
  duration,
  workflow,
  routesByKey,
  posts,
  digestDate
}: {
  duration: DigestDuration;
  workflow: WorkflowConfig | null;
  routesByKey: RoutesByKey;
  posts: AutoPost[];
  digestDate: string;
}): Promise<DigestWorkflowResult> {
  const fallback = buildDigestFallback(posts, duration);

  if (!workflow) {
    return fallback;
  }

  try {
    const route = getRoute(routesByKey, buildDigestRouteKey(workflow, duration), `${duration} digest`);
    const output = await runStructuredPrompt<DigestOutput>({
      route,
      systemPrompt: buildDigestPrompt(workflow, duration),
      userPayload: {
        digestDate,
        duration,
        posts: posts.map((post) => ({
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          worthReading: post.worthReading,
          sourceLabel: post.sourceLabel
        }))
      },
      schema: digestOutputSchema
    });

    const validEntries = output.entries.filter((entry) => posts.some((post) => post.slug === entry.slug));
    if (validEntries.length === 0) {
      return fallback;
    }

    return {
      title: output.title,
      summary: output.summary,
      entries: validEntries
    };
  } catch {
    return fallback;
  }
}

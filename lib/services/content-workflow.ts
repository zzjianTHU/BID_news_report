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

export type ContentWorkflowResult = {
  summary: string;
  worthReading: string;
  tldr: string[];
  draftMarkdown: string;
  riskLevel: RiskLevel;
  qualityScore: number;
  workflowVersion: string;
  classificationJson: z.infer<typeof classificationSchema>;
  structuredJson: z.infer<typeof structuringSchema>;
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

function parseJsonResponse<T>(raw: string, schema: z.ZodType<T>) {
  const trimmed = raw.trim();
  const normalized = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  return schema.parse(JSON.parse(normalized));
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

function buildFallbackSummary(title: string, rawContent: string) {
  const cleaned = rawContent.replace(/\s+/g, " ").trim() || title;
  return {
    summary: clampText(cleaned, 160),
    worthReading: `这条更新值得继续跟踪，因为它把“${clampText(title, 28)}”落到了更具体的动作或信号上。`
  };
}

function buildFallbackMarkdown(payload: SourcePayload, summary: string, worthReading: string) {
  return [
    `# ${payload.title}`,
    "",
    "## TL;DR",
    "",
    `- ${summary}`,
    `- ${worthReading}`,
    "",
    "## 发生了什么",
    "",
    payload.excerpt || payload.rawContent,
    "",
    "## 原始信息",
    "",
    payload.rawContent || payload.excerpt,
    "",
    `原文链接：${payload.url}`
  ].join("\n");
}

function buildFallbackClassification(source: Source, payload: SourcePayload, workflow: WorkflowConfig | null) {
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

function buildFallbackStructuring(payload: SourcePayload) {
  const fallback = buildFallbackSummary(payload.title, payload.rawContent || payload.excerpt);
  return {
    summary: fallback.summary,
    worthReading: fallback.worthReading,
    tldr: [fallback.summary],
    outline: [payload.excerpt || payload.rawContent || payload.title],
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
  schema
}: {
  route: ModelRouteConfig;
  systemPrompt: string;
  userPayload: Record<string, unknown>;
  schema: z.ZodType<T>;
}) {
  const text = await invokeModelText({
    route,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n请只返回严格 JSON，不要输出解释、Markdown 或代码块。`
      },
      {
        role: "user",
        content: JSON.stringify(userPayload, null, 2)
      }
    ]
  });

  return parseJsonResponse(text, schema);
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
        content: `${systemPrompt}\n\n请直接返回完整 Markdown 正文，不要添加额外解释。`
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
) {
  const route = getRoute(routesByKey, workflow.classificationRouteKey, "classification");
  return runStructuredPrompt({
    route,
    systemPrompt: workflow.classificationPrompt,
    userPayload: {
      source: {
        name: source.name,
        trustScore: source.trustScore,
        type: source.type
      },
      item: payload
    },
    schema: classificationSchema
  });
}

export async function runStructuring(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig,
  routesByKey: RoutesByKey,
  classification: z.infer<typeof classificationSchema>
) {
  const route = getRoute(routesByKey, workflow.structuringRouteKey, "structuring");
  return runStructuredPrompt({
    route,
    systemPrompt: workflow.structuringPrompt,
    userPayload: {
      source: {
        name: source.name,
        trustScore: source.trustScore,
        type: source.type
      },
      item: payload,
      classification
    },
    schema: structuringSchema
  });
}

export async function runDetailMarkdown(
  source: Source,
  payload: SourcePayload,
  workflow: WorkflowConfig,
  routesByKey: RoutesByKey,
  classification: z.infer<typeof classificationSchema>,
  structuring: z.infer<typeof structuringSchema>
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
  const fallbackClassification = buildFallbackClassification(source, payload, workflow);
  const fallbackStructuring = buildFallbackStructuring(payload);
  const fallbackMarkdown = buildFallbackMarkdown(payload, fallbackStructuring.summary, fallbackStructuring.worthReading);

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

  let classification = fallbackClassification;
  let structuring = fallbackStructuring;
  let draftMarkdown = fallbackMarkdown;
  let pipelineHealthy = true;

  try {
    classification = await runClassification(source, payload, workflow, routesByKey);
  } catch {
    pipelineHealthy = false;
  }

  try {
    if (pipelineHealthy) {
      structuring = await runStructuring(source, payload, workflow, routesByKey, classification);
    } else {
      throw new Error("classification failed");
    }
  } catch {
    pipelineHealthy = false;
  }

  try {
    if (pipelineHealthy) {
      draftMarkdown = await runDetailMarkdown(source, payload, workflow, routesByKey, classification, structuring);
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
        ? "今天先沉淀了一条值得继续跟踪的更新。"
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
    const output = await runStructuredPrompt({
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

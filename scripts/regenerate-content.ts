import { CandidateStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runSingleContentWorkflow, type SourcePayload } from "@/lib/services/content-workflow";
import { generateDigestForDate } from "@/lib/services/digest";
import { publishCandidate } from "@/lib/services/publishing";
import { fetchArticleDetails, shouldReplaceWithArticleBody, syncDraftRecord } from "@/lib/services/worker";

function getShanghaiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function resolveScopeStatuses(scope: string) {
  switch (scope) {
    case "published":
      return [CandidateStatus.PUBLISHED];
    case "review":
      return [CandidateStatus.REVIEW];
    case "active":
      return [CandidateStatus.PUBLISHED, CandidateStatus.REVIEW];
    default:
      throw new Error(`Unsupported scope "${scope}". Use published, review, or active.`);
  }
}

async function buildEnhancedPayload(candidate: {
  title: string;
  normalizedUrl: string;
  excerpt: string;
  rawContent: string;
  tags: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
}): Promise<SourcePayload> {
  const article = await fetchArticleDetails(candidate.normalizedUrl);
  const nextRawContent =
    article.rawContent && shouldReplaceWithArticleBody(candidate.rawContent, article.rawContent, candidate.title)
      ? article.rawContent
      : candidate.rawContent;
  const nextExcerpt =
    article.excerpt && article.excerpt.length > 40 ? article.excerpt : nextRawContent || candidate.excerpt;

  return {
    title: candidate.title,
    url: candidate.normalizedUrl,
    excerpt: nextExcerpt || candidate.excerpt,
    rawContent: nextRawContent || nextExcerpt || candidate.rawContent,
    tags: candidate.tags,
    coverImageUrl: article.coverImageUrl ?? candidate.coverImageUrl ?? undefined,
    coverImageAlt: article.coverImageAlt ?? candidate.coverImageAlt ?? candidate.title
  };
}

async function main() {
  const scope = process.argv[2] ?? "published";
  const limitArg = process.argv[3];
  const offsetArg = process.argv[4];
  const statuses = resolveScopeStatuses(scope);
  const take = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const skip = offsetArg ? Number.parseInt(offsetArg, 10) : 0;

  if (take !== undefined && (!Number.isFinite(take) || take <= 0)) {
    throw new Error(`Invalid limit "${limitArg}".`);
  }

  if (!Number.isFinite(skip) || skip < 0) {
    throw new Error(`Invalid offset "${offsetArg}".`);
  }

  const workflow = await prisma.workflowConfig.findFirst({
    where: {
      active: true
    }
  });

  if (!workflow) {
    throw new Error("No enabled workflow config found.");
  }

  const routes = await prisma.modelRouteConfig.findMany({
    where: {
      enabled: true
    }
  });
  const routesByKey = new Map(routes.map((route) => [route.routeKey, route]));

  const candidates = await prisma.candidateItem.findMany({
    where: {
      status: {
        in: statuses
      }
    },
    include: {
      source: true
    },
    orderBy:
      scope === "published"
        ? { publishedAt: "desc" }
        : [
            { createdAt: "desc" },
            { id: "desc" }
          ],
    ...(take !== undefined ? { take } : {}),
    ...(skip > 0 ? { skip } : {})
  });

  let updatedCount = 0;
  let refreshedPublishedCount = 0;
  let syncedDraftCount = 0;

  for (const candidate of candidates) {
    const payload = await buildEnhancedPayload(candidate);
    const generated = await runSingleContentWorkflow({
      source: candidate.source,
      payload,
      workflow,
      routesByKey
    });

    await prisma.candidateItem.update({
      where: {
        id: candidate.id
      },
      data: {
        excerpt: payload.excerpt,
        rawContent: payload.rawContent,
        coverImageUrl: payload.coverImageUrl,
        coverImageAlt: payload.coverImageAlt,
        aiSummary: generated.summary,
        worthReading: generated.worthReading,
        aiConfidence: generated.qualityScore,
        workflowVersion: generated.workflowVersion,
        qualityScore: generated.qualityScore,
        classificationJson: generated.classificationJson,
        structuredJson: generated.structuredJson,
        draftMarkdown: generated.draftMarkdown,
        riskLevel: generated.riskLevel
      }
    });

    if (candidate.status === CandidateStatus.PUBLISHED) {
      await publishCandidate(candidate.id, candidate.reviewDecisionBy);
      refreshedPublishedCount += 1;
    }

    await syncDraftRecord(candidate.id);
    syncedDraftCount += 1;

    updatedCount += 1;
  }

  if (statuses.includes(CandidateStatus.PUBLISHED)) {
    await generateDigestForDate(getShanghaiDateString());
  }

  console.log(
    JSON.stringify(
      {
        scope,
        take: take ?? null,
        skip,
        updatedCount,
        refreshedPublishedCount,
        syncedDraftCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

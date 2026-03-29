import { AutoPostStatus, CandidateStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

function readTldr(structuredJson: unknown) {
  if (!structuredJson || typeof structuredJson !== "object" || Array.isArray(structuredJson)) {
    return [];
  }

  const tldr = (structuredJson as { tldr?: unknown }).tldr;
  if (!Array.isArray(tldr)) {
    return [];
  }

  return tldr.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function ensureUniquePostSlug(candidateId: string, title: string, existingSlug?: string | null) {
  const base = slugify(existingSlug || title) || `post-${candidateId.slice(-6).toLowerCase()}`;
  const taken = await prisma.autoPost.findMany({
    where: {
      slug: {
        startsWith: base
      },
      NOT: {
        candidateItemId: candidateId
      }
    },
    select: {
      slug: true
    }
  });

  const takenSlugs = new Set(taken.map((post) => post.slug).filter((slug): slug is string => Boolean(slug)));
  if (!takenSlugs.has(base)) {
    return base;
  }

  let counter = 2;
  while (takenSlugs.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

export async function publishCandidate(candidateId: string, reviewer: string | null = null) {
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
    throw new Error(`Candidate ${candidateId} was not found.`);
  }

  const publishedAt = candidate.publishedAt ?? new Date();

  const updatedCandidate =
    candidate.status === CandidateStatus.PUBLISHED
      ? await prisma.candidateItem.update({
          where: {
            id: candidateId
          },
          data: {
            draftStatus: reviewer ? "APPROVED" : "AUTO_PUBLISHED",
            ...(reviewer
              ? {
                  reviewDecisionBy: reviewer,
                  reviewDecisionAt: new Date()
                }
              : {})
          },
          include: {
            source: true,
            autoPost: true
          }
        })
      : await prisma.candidateItem.update({
          where: {
            id: candidateId
          },
          data: {
            status: CandidateStatus.PUBLISHED,
            publishedAt,
            draftStatus: reviewer ? "APPROVED" : "AUTO_PUBLISHED",
            ...(reviewer
              ? {
                  reviewDecisionBy: reviewer,
                  reviewDecisionAt: new Date()
                }
              : {})
          },
          include: {
            source: true,
            autoPost: true
          }
        });

  const slug = await ensureUniquePostSlug(candidateId, updatedCandidate.title, updatedCandidate.autoPost?.slug);
  const tldr = readTldr(updatedCandidate.structuredJson);

  const autoPost = await prisma.autoPost.upsert({
    where: {
      candidateItemId: candidateId
    },
    update: {
      slug,
      title: updatedCandidate.title,
      summary: updatedCandidate.aiSummary,
      worthReading: updatedCandidate.worthReading,
      body: updatedCandidate.rawContent,
      bodyMarkdown: updatedCandidate.draftMarkdown ?? updatedCandidate.rawContent,
      tldr,
      workflowVersion: updatedCandidate.workflowVersion,
      qualityScore: updatedCandidate.qualityScore,
      tags: updatedCandidate.tags,
      sourceLabel: updatedCandidate.source.name,
      sourceUrl: updatedCandidate.normalizedUrl,
      status: AutoPostStatus.PUBLISHED,
      publishedAt
    },
    create: {
      candidateItemId: candidateId,
      slug,
      title: updatedCandidate.title,
      summary: updatedCandidate.aiSummary,
      worthReading: updatedCandidate.worthReading,
      body: updatedCandidate.rawContent,
      bodyMarkdown: updatedCandidate.draftMarkdown ?? updatedCandidate.rawContent,
      tldr,
      workflowVersion: updatedCandidate.workflowVersion,
      qualityScore: updatedCandidate.qualityScore,
      tags: updatedCandidate.tags,
      sourceLabel: updatedCandidate.source.name,
      sourceUrl: updatedCandidate.normalizedUrl,
      status: AutoPostStatus.PUBLISHED,
      publishedAt
    }
  });

  return {
    candidate: updatedCandidate,
    autoPost
  };
}

export async function rejectCandidate(candidateId: string, reviewer = "feishu-approval") {
  const candidate = await prisma.candidateItem.findUnique({
    where: {
      id: candidateId
    }
  });

  if (!candidate) {
    throw new Error(`Candidate ${candidateId} was not found.`);
  }

  if (candidate.status === CandidateStatus.REJECTED) {
    return candidate;
  }

  await prisma.autoPost.deleteMany({
    where: {
      candidateItemId: candidateId
    }
  });

  return prisma.candidateItem.update({
    where: {
      id: candidateId
    },
    data: {
      status: CandidateStatus.REJECTED,
      draftStatus: "REJECTED",
      reviewDecisionBy: reviewer,
      reviewDecisionAt: new Date()
    }
  });
}

import { AutoPostStatus, CandidateStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
      ? candidate
      : await prisma.candidateItem.update({
          where: {
            id: candidateId
          },
          data: {
            status: CandidateStatus.PUBLISHED,
            publishedAt,
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

  const autoPost = await prisma.autoPost.upsert({
    where: {
      candidateItemId: candidateId
    },
    update: {
      title: updatedCandidate.title,
      summary: updatedCandidate.aiSummary,
      worthReading: updatedCandidate.worthReading,
      body: updatedCandidate.rawContent,
      tags: updatedCandidate.tags,
      sourceLabel: updatedCandidate.source.name,
      sourceUrl: updatedCandidate.normalizedUrl,
      status: AutoPostStatus.PUBLISHED,
      publishedAt
    },
    create: {
      candidateItemId: candidateId,
      title: updatedCandidate.title,
      summary: updatedCandidate.aiSummary,
      worthReading: updatedCandidate.worthReading,
      body: updatedCandidate.rawContent,
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
      reviewDecisionBy: reviewer,
      reviewDecisionAt: new Date()
    }
  });
}

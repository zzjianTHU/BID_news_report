import {
  AutoPostStatus,
  CandidateStatus,
  DigestDuration,
  DispatchStatus,
  RiskLevel,
  ThoughtStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DashboardSnapshot, FeedWindow } from "@/lib/types";

export async function getSiteSnapshot(): Promise<DashboardSnapshot> {
  const [publishedCount, reviewCount, activeSourceCount, subscriberCount, lowRiskCount] =
    await Promise.all([
      prisma.autoPost.count({
        where: {
          status: AutoPostStatus.PUBLISHED
        }
      }),
      prisma.candidateItem.count({
        where: {
          status: CandidateStatus.REVIEW
        }
      }),
      prisma.source.count({
        where: {
          enabled: true
        }
      }),
      prisma.subscriber.count({
        where: {
          active: true
        }
      }),
      prisma.candidateItem.count({
        where: {
          riskLevel: RiskLevel.LOW,
          status: CandidateStatus.PUBLISHED
        }
      })
    ]);

  return {
    publishedCount,
    reviewCount,
    activeSourceCount,
    subscriberCount,
    lowRiskAutoPublishRate: publishedCount === 0 ? 0 : Math.round((lowRiskCount / publishedCount) * 100)
  };
}

export async function getFeedPosts(tag?: string, window: FeedWindow = "24h") {
  const since = new Date();
  since.setDate(since.getDate() - (window === "24h" ? 1 : 7));

  return prisma.autoPost.findMany({
    where: {
      status: AutoPostStatus.PUBLISHED,
      publishedAt: {
        gte: since
      },
      ...(tag && tag !== "all"
        ? {
            tags: {
              contains: tag
            }
          }
        : {})
    },
    include: {
      candidateItem: true
    },
    orderBy: [
      {
        publishedAt: "desc"
      }
    ]
  });
}

export async function getLatestDigest() {
  return prisma.digest.findFirst({
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
    },
    orderBy: {
      date: "desc"
    }
  });
}

export async function getDigestByDate(date: string) {
  return prisma.digest.findUnique({
    where: {
      date
    },
    include: {
      entries: {
        orderBy: {
          order: "asc"
        }
      }
    }
  });
}

export async function getArchiveDigests() {
  return prisma.digest.findMany({
    include: {
      entries: true
    },
    orderBy: {
      date: "desc"
    }
  });
}

export async function getPublishedThoughts() {
  return prisma.thoughtPost.findMany({
    where: {
      status: ThoughtStatus.PUBLISHED
    },
    orderBy: {
      publishedAt: "desc"
    }
  });
}

export async function getCandidatePreview(id: string) {
  return prisma.candidateItem.findUnique({
    where: {
      id
    },
    include: {
      source: true,
      autoPost: true
    }
  });
}

export async function getThoughtBySlug(slug: string) {
  return prisma.thoughtPost.findUnique({
    where: {
      slug
    }
  });
}

export async function getSources() {
  return prisma.source.findMany({
    orderBy: [{ enabled: "desc" }, { priority: "desc" }]
  });
}

export async function getWorkflowConfigs() {
  return prisma.workflowConfig.findMany({
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getQueueItems() {
  return prisma.candidateItem.findMany({
    where: {
      status: {
        in: [CandidateStatus.REVIEW, CandidateStatus.INGESTED]
      }
    },
    include: {
      source: true
    },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }]
  });
}

export async function getPublishedDigests() {
  return prisma.digest.findMany({
    include: {
      entries: {
        where: {
          duration: DigestDuration.THREE
        }
      },
      dispatches: {
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      date: "desc"
    }
  });
}

export async function getThoughtAdminList() {
  return prisma.thoughtPost.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
}

export async function getSubscribers() {
  return prisma.subscriber.findMany({
    include: {
      dispatches: {
        orderBy: {
          createdAt: "desc"
        },
        take: 3
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getDispatchOverview() {
  return prisma.emailDispatch.groupBy({
    by: ["status"],
    _count: {
      id: true
    }
  });
}

export async function getSubscriberDigestForLatestDate(duration: DigestDuration) {
  const latestDigest = await prisma.digest.findFirst({
    include: {
      entries: {
        where: {
          duration
        },
        orderBy: {
          order: "asc"
        }
      }
    },
    orderBy: {
      date: "desc"
    }
  });

  return latestDigest;
}

export async function getPendingDispatchCount() {
  return prisma.emailDispatch.count({
    where: {
      status: DispatchStatus.PENDING
    }
  });
}

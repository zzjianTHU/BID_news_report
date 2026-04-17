import {
  AutoPostStatus,
  CandidateStatus,
  DigestDuration,
  DispatchStatus,
  Prisma,
  RiskLevel,
  RunStatus,
  ThoughtStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DashboardSnapshot, FeedWindow } from "@/lib/types";
import { readTranslatedTitle } from "@/lib/utils";

function shouldUseDataFallback(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

async function withDataFallback<T>(label: string, fallbackValue: T, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (shouldUseDataFallback(error)) {
      console.warn(`Falling back for ${label}: ${error.message}`);
      return fallbackValue;
    }

    throw error;
  }
}

async function attachDigestDisplayTitles<T extends { entries: Array<{ postSlug?: string | null; title: string }> }>(
  digest: T | null
) {
  if (!digest) {
    return digest;
  }

  const slugs = digest.entries
    .map((entry) => entry.postSlug)
    .filter((slug): slug is string => Boolean(slug));

  if (slugs.length === 0) {
    return digest;
  }

  const posts = await prisma.autoPost.findMany({
    where: {
      slug: {
        in: slugs
      }
    },
    select: {
      slug: true,
      candidateItem: {
        select: {
          structuredJson: true
        }
      }
    }
  });

  const titleMap = new Map(
    posts.map((post) => [post.slug, readTranslatedTitle(post.candidateItem?.structuredJson)])
  );

  return {
    ...digest,
    entries: digest.entries.map((entry) => ({
      ...entry,
      displayTitle: (entry.postSlug && titleMap.get(entry.postSlug)) || entry.title
    }))
  };
}

export async function getSiteSnapshot(): Promise<DashboardSnapshot> {
  return withDataFallback(
    "getSiteSnapshot",
    {
      publishedCount: 0,
      reviewCount: 0,
      activeSourceCount: 0,
      subscriberCount: 0,
      lowRiskAutoPublishRate: 0
    },
    async () => {
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
  );
}

export async function getFeedPosts(tag?: string, window: FeedWindow = "24h") {
  const since = new Date();
  since.setDate(since.getDate() - (window === "24h" ? 1 : 7));

  return withDataFallback("getFeedPosts", [], () =>
    prisma.autoPost.findMany({
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
      }
      ,
      orderBy: [
        {
          publishedAt: "desc"
        }
      ]
    })
  );
}

export async function getLatestDigest() {
  return withDataFallback("getLatestDigest", null, async () =>
    attachDigestDisplayTitles(
      await prisma.digest.findFirst({
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
    })
    )
  );
}

export async function getDigestByDate(date: string) {
  return withDataFallback("getDigestByDate", null, async () =>
    attachDigestDisplayTitles(
      await prisma.digest.findUnique({
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
    })
    )
  );
}

export async function getArchiveDigests() {
  return withDataFallback("getArchiveDigests", [], () =>
    prisma.digest.findMany({
      include: {
        entries: true
      },
      orderBy: {
        date: "desc"
      }
    })
  );
}

export async function getPublishedThoughts() {
  return withDataFallback("getPublishedThoughts", [], () =>
    prisma.thoughtPost.findMany({
      where: {
        status: ThoughtStatus.PUBLISHED
      },
      orderBy: {
        publishedAt: "desc"
      }
    })
  );
}

export async function getCandidatePreview(id: string) {
  return withDataFallback("getCandidatePreview", null, () =>
    prisma.candidateItem.findUnique({
      where: {
        id
      },
      include: {
        source: true,
        autoPost: true
      }
    })
  );
}

export async function getPostBySlug(slug: string) {
  return withDataFallback("getPostBySlug", null, () =>
    prisma.autoPost.findUnique({
      where: {
        slug
      },
      include: {
        candidateItem: {
          include: {
            source: true
          }
        }
      }
    })
  );
}

export async function getThoughtBySlug(slug: string) {
  return withDataFallback("getThoughtBySlug", null, () =>
    prisma.thoughtPost.findUnique({
      where: {
        slug
      }
    })
  );
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

export async function getCandidateAdminList() {
  return prisma.candidateItem.findMany({
    include: {
      source: true
    },
    orderBy: [{ createdAt: "desc" }]
  });
}

export async function getRecentPublishedPosts(limit = 6) {
  return prisma.autoPost.findMany({
    where: {
      status: AutoPostStatus.PUBLISHED
    },
    include: {
      candidateItem: {
        include: {
          source: true
        }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: limit
  });
}

export async function getSourceAlerts(limit = 8) {
  return prisma.source.findMany({
    where: {
      OR: [{ failureCount: { gt: 0 } }, { lastError: { not: null } }]
    },
    orderBy: [{ failureCount: "desc" }, { updatedAt: "desc" }],
    take: limit
  });
}

export async function getSourceAdminList() {
  return prisma.source.findMany({
    include: {
      ingestionRuns: {
        orderBy: [{ startedAt: "desc" }],
        take: 3
      }
    },
    orderBy: [{ enabled: "desc" }, { priority: "desc" }, { updatedAt: "desc" }]
  });
}

export async function getSourceById(sourceId: string) {
  return prisma.source.findUnique({
    where: {
      id: sourceId
    },
    include: {
      ingestionRuns: {
        orderBy: [{ startedAt: "desc" }],
        take: 10
      },
      candidateItems: {
        orderBy: [{ createdAt: "desc" }],
        take: 10
      }
    }
  });
}

export async function getRecentIngestionRuns(limit = 12) {
  return prisma.ingestionRun.findMany({
    include: {
      source: true
    },
    orderBy: [{ startedAt: "desc" }],
    take: limit
  });
}

export async function getSchedulerConfig() {
  return prisma.schedulerConfig.upsert({
    where: {
      key: "default"
    },
    update: {},
    create: {
      key: "default"
    }
  });
}

export async function getIngestionHealthSnapshot() {
  const [lastRun, successCount, failedCount] = await Promise.all([
    prisma.ingestionRun.findFirst({
      orderBy: [{ startedAt: "desc" }],
      include: {
        source: true
      }
    }),
    prisma.ingestionRun.count({
      where: {
        status: RunStatus.SUCCESS
      }
    }),
    prisma.ingestionRun.count({
      where: {
        status: RunStatus.FAILED
      }
    })
  ]);

  return {
    lastRun,
    successCount,
    failedCount
  };
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

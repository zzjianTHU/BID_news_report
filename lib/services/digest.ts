import { AutoPostStatus, DigestDuration, DispatchStatus, type ModelRouteConfig, type WorkflowConfig } from "@prisma/client";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { runDigestWorkflow } from "@/lib/services/content-workflow";

type DigestOptions = {
  workflow?: WorkflowConfig | null;
  routesByKey?: Map<string, ModelRouteConfig>;
};

const DIGEST_TARGET_POST_COUNT = 5;

function getDayBounds(targetDate: Date) {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function buildWorthReading(postTitle: string, sourceLabel: string) {
  return `${sourceLabel} 这条更新能帮助团队更快判断“这件事是否值得继续跟踪”：${postTitle}`;
}

function normalizeTag(tags: string) {
  return tags.split(",").map((tag) => tag.trim()).find(Boolean) ?? "AI";
}

export async function generateDigestForDate(targetDate = new Date(), options: DigestOptions = {}) {
  const digestDate = format(targetDate, "yyyy-MM-dd");
  const { start, end } = getDayBounds(targetDate);

  const sameDayPosts = await prisma.autoPost.findMany({
    where: {
      status: AutoPostStatus.PUBLISHED,
      publishedAt: {
        gte: start,
        lt: end
      }
    },
    orderBy: [
      {
        publishedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  let publishedPosts = sameDayPosts;

  if (publishedPosts.length < DIGEST_TARGET_POST_COUNT) {
    const recentPosts = await prisma.autoPost.findMany({
      where: {
        status: AutoPostStatus.PUBLISHED,
        publishedAt: {
          lt: end
        }
      },
      orderBy: [
        {
          publishedAt: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      take: DIGEST_TARGET_POST_COUNT
    });

    const mergedPosts = new Map<string, (typeof recentPosts)[number]>();
    for (const post of [...publishedPosts, ...recentPosts]) {
      mergedPosts.set(post.id, post);
    }

    publishedPosts = Array.from(mergedPosts.values()).sort((left, right) => {
      const leftTime = (left.publishedAt ?? left.createdAt).getTime();
      const rightTime = (right.publishedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }

  if (publishedPosts.length === 0) {
    return null;
  }

  const workflow = options.workflow ?? null;
  const routesByKey = options.routesByKey ?? new Map<string, ModelRouteConfig>();
  const [threeMinuteDigest, eightMinuteDigest] = await Promise.all([
    runDigestWorkflow({
      duration: DigestDuration.THREE,
      workflow,
      routesByKey,
      posts: publishedPosts,
      digestDate
    }),
    runDigestWorkflow({
      duration: DigestDuration.EIGHT,
      workflow,
      routesByKey,
      posts: publishedPosts,
      digestDate
    })
  ]);

  const digest = await prisma.digest.upsert({
    where: {
      date: digestDate
    },
    update: {
      title: threeMinuteDigest.title,
      summary: threeMinuteDigest.summary,
      summaryThree: threeMinuteDigest.summary,
      summaryEight: eightMinuteDigest.summary
    },
    create: {
      date: digestDate,
      title: threeMinuteDigest.title,
      summary: threeMinuteDigest.summary,
      summaryThree: threeMinuteDigest.summary,
      summaryEight: eightMinuteDigest.summary
    }
  });

  await prisma.digestEntry.deleteMany({
    where: {
      digestId: digest.id
    }
  });

  const postBySlug = new Map(publishedPosts.map((post) => [post.slug, post] as const));
  const entries = [
    ...threeMinuteDigest.entries.map((entry, index) => {
      const sourcePost = postBySlug.get(entry.slug) ?? publishedPosts[index];
      return {
        digestId: digest.id,
        duration: DigestDuration.THREE,
        order: index + 1,
        title: entry.title,
        summary: entry.summary,
        worthReading: entry.worthReading || buildWorthReading(entry.title, sourcePost?.sourceLabel ?? "AI"),
        sourceLabel: sourcePost?.sourceLabel ?? "AI",
        sourceUrl: sourcePost?.sourceUrl ?? "",
        tag: normalizeTag(sourcePost?.tags ?? "AI"),
        postSlug: sourcePost?.slug ?? null
      };
    }),
    ...eightMinuteDigest.entries.map((entry, index) => {
      const sourcePost = postBySlug.get(entry.slug) ?? publishedPosts[index];
      return {
        digestId: digest.id,
        duration: DigestDuration.EIGHT,
        order: index + 1,
        title: entry.title,
        summary: entry.summary,
        worthReading: entry.worthReading || buildWorthReading(entry.title, sourcePost?.sourceLabel ?? "AI"),
        sourceLabel: sourcePost?.sourceLabel ?? "AI",
        sourceUrl: sourcePost?.sourceUrl ?? "",
        tag: normalizeTag(sourcePost?.tags ?? "AI"),
        postSlug: sourcePost?.slug ?? null
      };
    })
  ];

  await prisma.digestEntry.createMany({
    data: entries
  });

  return prisma.digest.findUnique({
    where: {
      id: digest.id
    },
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
    }
  });
}

export async function queueDigestDispatches(digestId: string, scheduledFor = new Date()) {
  const [digest, subscribers, existingDispatches] = await Promise.all([
    prisma.digest.findUnique({
      where: {
        id: digestId
      }
    }),
    prisma.subscriber.findMany({
      where: {
        active: true
      }
    }),
    prisma.emailDispatch.findMany({
      where: {
        digestId
      },
      select: {
        subscriberId: true
      }
    })
  ]);

  if (!digest) {
    throw new Error(`Digest ${digestId} was not found.`);
  }

  const existingSubscriberIds = new Set(existingDispatches.map((dispatch) => dispatch.subscriberId));
  const queued = [];

  for (const subscriber of subscribers) {
    if (existingSubscriberIds.has(subscriber.id)) {
      continue;
    }

    queued.push(
      prisma.emailDispatch.create({
        data: {
          subscriberId: subscriber.id,
          digestId,
          status: DispatchStatus.PENDING,
          subject: `${
            subscriber.defaultDuration === DigestDuration.THREE ? "3" : "8"
          } 分钟版 AI 情报日报`,
          scheduledFor,
          notes: "由定时 worker 自动加入发送队列。"
        }
      })
    );
  }

  if (queued.length > 0) {
    await Promise.all(queued);
  }

  return {
    digest,
    queuedCount: queued.length,
    subscriberCount: subscribers.length
  };
}

export async function dispatchPendingEmailQueue(limit = 100) {
  const now = new Date();
  const pendingDispatches = await prisma.emailDispatch.findMany({
    where: {
      status: DispatchStatus.PENDING,
      scheduledFor: {
        lte: now
      }
    },
    include: {
      subscriber: true,
      digest: true
    },
    orderBy: {
      scheduledFor: "asc"
    },
    take: limit
  });

  for (const dispatch of pendingDispatches) {
    await prisma.emailDispatch.update({
      where: {
        id: dispatch.id
      },
      data: {
        status: DispatchStatus.SENT,
        sentAt: new Date(),
        notes: `已模拟发送给 ${dispatch.subscriber.email}，当前版本以数据库队列和飞书通知为主。`
      }
    });
  }

  return {
    sentCount: pendingDispatches.length,
    dispatches: pendingDispatches
  };
}

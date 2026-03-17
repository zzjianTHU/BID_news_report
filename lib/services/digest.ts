import { AutoPostStatus, DigestDuration, DispatchStatus } from "@prisma/client";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";

function getDayBounds(targetDate: Date) {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function buildDigestSummary(postCount: number) {
  if (postCount === 0) {
    return "今天的自动流还没有新的已发布内容。";
  }

  if (postCount === 1) {
    return "今天先沉淀了一条值得追踪的更新，适合用 3 分钟快速掌握。";
  }

  return `今天共沉淀 ${postCount} 条已发布内容，重点集中在落地进展、产品路线和基础设施变化。`;
}

function buildWorthReading(postTitle: string, sourceLabel: string) {
  return `${sourceLabel} 这条更新能帮助团队更快判断“这件事是否值得继续跟踪”：${postTitle}`;
}

function buildEntrySummary(summary: string, duration: DigestDuration) {
  if (duration === DigestDuration.EIGHT) {
    return `${summary} 这条内容也被纳入更完整的上下文里，方便后续继续追踪。`;
  }

  return summary;
}

export async function generateDigestForDate(targetDate = new Date()) {
  const digestDate = format(targetDate, "yyyy-MM-dd");
  const { start, end } = getDayBounds(targetDate);

  const publishedPosts = await prisma.autoPost.findMany({
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

  if (publishedPosts.length === 0) {
    return null;
  }

  const digest = await prisma.digest.upsert({
    where: {
      date: digestDate
    },
    update: {
      title: "AI 情报日报",
      summary: buildDigestSummary(publishedPosts.length)
    },
    create: {
      date: digestDate,
      title: "AI 情报日报",
      summary: buildDigestSummary(publishedPosts.length)
    }
  });

  await prisma.digestEntry.deleteMany({
    where: {
      digestId: digest.id
    }
  });

  const threeMinutePosts = publishedPosts.slice(0, 3);
  const eightMinutePosts = publishedPosts.slice(0, 5);

  const entries = [
    ...threeMinutePosts.map((post, index) => ({
      digestId: digest.id,
      duration: DigestDuration.THREE,
      order: index + 1,
      title: post.title,
      summary: buildEntrySummary(post.summary, DigestDuration.THREE),
      worthReading: post.worthReading || buildWorthReading(post.title, post.sourceLabel),
      sourceLabel: post.sourceLabel,
      sourceUrl: post.sourceUrl,
      tag: post.tags.split(",")[0] ?? "AI"
    })),
    ...eightMinutePosts.map((post, index) => ({
      digestId: digest.id,
      duration: DigestDuration.EIGHT,
      order: index + 1,
      title: post.title,
      summary: buildEntrySummary(post.summary, DigestDuration.EIGHT),
      worthReading: post.worthReading || buildWorthReading(post.title, post.sourceLabel),
      sourceLabel: post.sourceLabel,
      sourceUrl: post.sourceUrl,
      tag: post.tags.split(",")[0] ?? "AI"
    }))
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

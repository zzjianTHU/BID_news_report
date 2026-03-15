import { AutoPostStatus, CandidateStatus, DigestDuration, RiskLevel, RunStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

function summarizeContent(title: string, rawContent: string) {
  return {
    title,
    summary: rawContent.slice(0, 110),
    worthReading: "自动脚本已为该条目补全结构化摘要，可在后台继续校订。"
  };
}

async function main() {
  const workflow = await prisma.workflowConfig.findFirst({
    where: {
      active: true
    }
  });

  const sources = await prisma.source.findMany({
    where: {
      enabled: true
    }
  });

  if (!workflow || sources.length === 0) {
    console.log("No active workflow or sources found.");
    return;
  }

  for (const source of sources) {
    const run = await prisma.ingestionRun.create({
      data: {
        sourceId: source.id,
        status: RunStatus.SUCCESS,
        itemsFound: 1,
        itemsPublished: source.trustScore >= workflow.autoPublishMinTrust ? 1 : 0,
        notes: "本地自动化脚本生成的演示运行。",
        startedAt: new Date(),
        finishedAt: new Date()
      }
    });

    const stamp = Date.now();
    const title = `${source.name} 自动采集演示 ${stamp}`;
    const rawContent = `${source.description}。本次自动化模拟用于验证从数据源到自动发布、digest 汇总和待审核队列的完整链路。`;
    const ai = summarizeContent(title, rawContent);
    const riskLevel = source.trustScore >= workflow.autoPublishMinTrust ? RiskLevel.LOW : RiskLevel.HIGH;
    const status = riskLevel === RiskLevel.LOW ? CandidateStatus.PUBLISHED : CandidateStatus.REVIEW;

    const candidate = await prisma.candidateItem.create({
      data: {
        sourceId: source.id,
        ingestionRunId: run.id,
        title,
        normalizedUrl: `${source.url}?demo=${stamp}`,
        excerpt: source.description,
        rawContent,
        tags: source.tags,
        aiSummary: ai.summary,
        worthReading: ai.worthReading,
        aiConfidence: riskLevel === RiskLevel.LOW ? 0.9 : 0.52,
        riskLevel,
        status,
        publishedAt: status === CandidateStatus.PUBLISHED ? new Date() : null
      }
    });

    if (status === CandidateStatus.PUBLISHED) {
      await prisma.autoPost.create({
        data: {
          candidateItemId: candidate.id,
          title: ai.title,
          summary: ai.summary,
          worthReading: ai.worthReading,
          body: rawContent,
          tags: source.tags,
          sourceLabel: source.name,
          sourceUrl: candidate.normalizedUrl,
          status: AutoPostStatus.PUBLISHED,
          publishedAt: new Date()
        }
      });
    }
  }

  const publishedPosts = await prisma.autoPost.findMany({
    where: {
      status: AutoPostStatus.PUBLISHED
    },
    orderBy: {
      publishedAt: "desc"
    },
    take: 5
  });

  const today = new Date().toISOString().slice(0, 10);
  const digest = await prisma.digest.upsert({
    where: {
      date: today
    },
    update: {
      title: "自动汇总 AI Digest",
      summary: "由自动化脚本重建的当日 digest。"
    },
    create: {
      date: today,
      title: "自动汇总 AI Digest",
      summary: "由自动化脚本重建的当日 digest。"
    }
  });

  await prisma.digestEntry.deleteMany({
    where: {
      digestId: digest.id
    }
  });

  const threePosts = publishedPosts.slice(0, 3);
  const eightPosts = publishedPosts.slice(0, 5);

  await prisma.digestEntry.createMany({
    data: [
      ...threePosts.map((post, index) => ({
        digestId: digest.id,
        duration: DigestDuration.THREE,
        order: index + 1,
        title: post.title,
        summary: post.summary,
        worthReading: post.worthReading,
        sourceLabel: post.sourceLabel,
        sourceUrl: post.sourceUrl,
        tag: post.tags.split(",")[0] ?? "AI"
      })),
      ...eightPosts.map((post, index) => ({
        digestId: digest.id,
        duration: DigestDuration.EIGHT,
        order: index + 1,
        title: post.title,
        summary: `${post.summary} 这条内容已被纳入更完整的 8 分钟版上下文。`,
        worthReading: post.worthReading,
        sourceLabel: post.sourceLabel,
        sourceUrl: post.sourceUrl,
        tag: post.tags.split(",")[0] ?? "AI"
      }))
    ]
  });

  console.log(`Automation run finished for ${sources.length} sources.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

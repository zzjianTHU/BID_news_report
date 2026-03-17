import {
  AutoPostStatus,
  CandidateStatus,
  DigestDuration,
  DispatchStatus,
  IngestionTrigger,
  PrismaClient,
  RiskLevel,
  RunStatus,
  SourceType,
  ThoughtStatus,
  UserRole
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.emailDispatch.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.digestEntry.deleteMany();
  await prisma.digest.deleteMany();
  await prisma.autoPost.deleteMany();
  await prisma.candidateItem.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.workflowConfig.deleteMany();
  await prisma.source.deleteMany();
  await prisma.thoughtPost.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        email: "admin@thu-bid.local",
        name: "周老师",
        role: UserRole.ADMIN
      },
      {
        email: "editor@thu-bid.local",
        name: "内容编辑 A",
        role: UserRole.EDITOR,
        topic: "AI 情报流"
      }
    ]
  });

  const workflow = await prisma.workflowConfig.create({
    data: {
      name: "AI 主情报流工作流",
      summaryPrompt:
        "用中文生成适合管理者快速阅读的标题、摘要和一句为什么值得看，避免空泛套话。",
      highlightPrompt:
        "优先抽取 Agent、模型落地、组织采用、资本与产业变化，输出可直接发布的亮点。",
      riskKeywords: "rumor,unverified,匿名,截图,未经证实,小道消息,转载无来源",
      autoPublishMinTrust: 72,
      digestRuleThree:
        "3 分钟版只保留最值得看的 3 条，强调判断与行动价值，每条摘要不超过 70 字。",
      digestRuleEight:
        "8 分钟版保留 5 条左右，补充背景、变化原因和机构视角，每条摘要 100-140 字。",
      notes:
        "移动端首页优先展示最新 digest Hero，其次是自动情报流，再放 Recent posts 和订阅入口。"
    }
  });

  const sources = await Promise.all([
    prisma.source.create({
      data: {
        name: "OpenAI News",
        slug: "openai-news",
        type: SourceType.RSS,
        url: "https://openai.com/news/rss.xml",
        description: "模型能力、产品更新与生态动向。",
        frequency: "每 2 小时",
        fetchIntervalMinutes: 120,
        priority: 92,
        trustScore: 95,
        tags: "models,products,ecosystem",
        nextRunAt: new Date("2026-03-15T08:00:00.000Z"),
        lastSyncedAt: new Date("2026-03-15T06:00:00.000Z")
      }
    }),
    prisma.source.create({
      data: {
        name: "Anthropic Updates",
        slug: "anthropic-updates",
        type: SourceType.WEB,
        url: "https://www.anthropic.com/news",
        description: "模型发布、企业合作与安全动态。",
        frequency: "每 4 小时",
        fetchIntervalMinutes: 240,
        priority: 88,
        trustScore: 90,
        tags: "agents,safety,enterprise",
        nextRunAt: new Date("2026-03-15T10:00:00.000Z"),
        lastSyncedAt: new Date("2026-03-15T06:00:00.000Z")
      }
    }),
    prisma.source.create({
      data: {
        name: "AI Infra Watch",
        slug: "ai-infra-watch",
        type: SourceType.RSS,
        url: "https://example.com/ai-infra/rss",
        description: "算力、AI infra 与企业部署案例。",
        frequency: "每 6 小时",
        fetchIntervalMinutes: 360,
        priority: 76,
        trustScore: 78,
        tags: "infra,enterprise,ops",
        nextRunAt: new Date("2026-03-15T12:00:00.000Z"),
        lastSyncedAt: new Date("2026-03-15T06:00:00.000Z")
      }
    }),
    prisma.source.create({
      data: {
        name: "Founder Notes",
        slug: "founder-notes",
        type: SourceType.WEB,
        url: "https://example.com/founder-notes",
        description: "创始人观点与非结构化案例，默认进入高风险审核。",
        frequency: "每日",
        fetchIntervalMinutes: 1440,
        priority: 60,
        trustScore: 58,
        enabled: true,
        tags: "founders,signals,market",
        nextRunAt: new Date("2026-03-16T06:00:00.000Z"),
        lastSyncedAt: new Date("2026-03-15T06:00:00.000Z")
      }
    })
  ]);

  const run = await prisma.ingestionRun.create({
    data: {
      sourceId: sources[0].id,
      trigger: IngestionTrigger.SCHEDULED,
      status: RunStatus.SUCCESS,
      itemsFound: 7,
      itemsPublished: 4,
      notes: "主源稳定，摘要生成成功率 100%。",
      errorSummary: null,
      startedAt: new Date("2026-03-15T06:00:00.000Z"),
      finishedAt: new Date("2026-03-15T06:04:00.000Z")
    }
  });

  const candidateData = [
    {
      source: sources[0],
      title: "企业把 Agent 试点从演示推进到真实业务流程",
      normalizedUrl: "https://example.com/openai-agent-rollout",
      excerpt: "试点重点从模型能力转向权限、审计与工作流接入。",
      rawContent:
        "多家团队开始把 Agent 接入客服、投研与内部知识支持流程，治理和监控成为上线前提。",
      tags: "agents,workflow,enterprise",
      aiSummary:
        "越来越多企业不再满足于演示效果，而是把 Agent 放进真实流程中，推动权限、审计和知识边界能力成为采购重点。",
      worthReading:
        "这说明 AI 竞争的关键正在从模型本身转向组织流程重构。",
      aiConfidence: 0.93,
      riskLevel: RiskLevel.LOW,
      status: CandidateStatus.PUBLISHED,
      publishedAt: new Date("2026-03-15T06:20:00.000Z")
    },
    {
      source: sources[1],
      title: "AI 原生产品开始用多模型路由替代单模型押注",
      normalizedUrl: "https://example.com/multi-model-routing",
      excerpt: "任务分层与模型路由逐渐成为成本和效果平衡的新常态。",
      rawContent:
        "新一代 AI SaaS 更少强调单一模型，而是按任务类型切换不同模型与工具。",
      tags: "models,products,ops",
      aiSummary:
        "面向生产场景的 AI 产品，正在把多模型协同变成默认架构，以兼顾速度、成本和准确率。",
      worthReading:
        "这意味着评估 AI 产品时，流程编排能力已经和模型能力同等重要。",
      aiConfidence: 0.89,
      riskLevel: RiskLevel.LOW,
      status: CandidateStatus.PUBLISHED,
      publishedAt: new Date("2026-03-15T07:10:00.000Z")
    },
    {
      source: sources[2],
      title: "AI 基础设施团队开始主打可观测性与成本治理",
      normalizedUrl: "https://example.com/infra-cost-governance",
      excerpt: "从 demo 走向部署后，监控与成本控制变成系统刚需。",
      rawContent:
        "企业内部开始要求 AI 运行链路像传统云服务一样可监控、可追责、可计费。",
      tags: "infra,ops,enterprise",
      aiSummary:
        "AI infra 正从性能竞赛转向可靠性与成本可控，企业采购标准更接近成熟软件基础设施。",
      worthReading:
        "谁能把 AI 服务做成可被运营和审计的系统，谁更容易进入企业核心场景。",
      aiConfidence: 0.84,
      riskLevel: RiskLevel.LOW,
      status: CandidateStatus.PUBLISHED,
      publishedAt: new Date("2026-03-15T08:00:00.000Z")
    },
    {
      source: sources[3],
      title: "某海外创始人称通用 Agent 将在半年内替代大部分研究员",
      normalizedUrl: "https://example.com/founder-rumor",
      excerpt: "观点激进，但论据不足且缺少一手来源。",
      rawContent:
        "文章主要基于个人判断和二手截图，缺少可验证案例，适合进入高风险待审队列。",
      tags: "founders,rumor,agents",
      aiSummary:
        "该观点激进且传播性强，但来源和证据链不足，暂不适合自动对外发布。",
      worthReading:
        "它能提醒我们关注市场情绪，但不适合作为对外判断依据。",
      aiConfidence: 0.48,
      riskLevel: RiskLevel.HIGH,
      status: CandidateStatus.REVIEW,
      publishedAt: null
    }
  ];

  const candidates = [];
  for (const item of candidateData) {
    const candidate = await prisma.candidateItem.create({
      data: {
        sourceId: item.source.id,
        ingestionRunId: run.id,
        title: item.title,
        normalizedUrl: item.normalizedUrl,
        excerpt: item.excerpt,
        rawContent: item.rawContent,
        tags: item.tags,
        aiSummary: item.aiSummary,
        worthReading: item.worthReading,
        aiConfidence: item.aiConfidence,
        riskLevel: item.riskLevel,
        status: item.status,
        publishedAt: item.publishedAt,
        reviewRequestedAt:
          item.status === CandidateStatus.REVIEW ? new Date("2026-03-15T08:20:00.000Z") : null,
        reviewMessageId: item.status === CandidateStatus.REVIEW ? "om_demo_review_001" : null
      }
    });
    candidates.push(candidate);
  }

  for (const candidate of candidates.filter((item) => item.status === CandidateStatus.PUBLISHED)) {
    await prisma.autoPost.create({
      data: {
        candidateItemId: candidate.id,
        title: candidate.title,
        summary: candidate.aiSummary,
        worthReading: candidate.worthReading,
        body:
          "自动生成稿件已完成结构化整理，编辑可在飞书里补充机构观点、校对标题或决定是否保留。",
        tags: candidate.tags,
        sourceLabel: sources.find((source) => source.id === candidate.sourceId)?.name ?? "AI Source",
        sourceUrl: candidate.normalizedUrl,
        status: AutoPostStatus.PUBLISHED,
        publishedAt: candidate.publishedAt
      }
    });
  }

  const digest = await prisma.digest.create({
    data: {
      date: "2026-03-15",
      title: "AI 情报日报",
      summary: "今天的自动流重点集中在 Agent 落地、模型路由和 AI 基础设施治理。"
    }
  });

  const digestEntries = [
    {
      duration: DigestDuration.THREE,
      order: 1,
      title: "Agent 正从演示走向流程接入",
      summary: "企业开始真正把 Agent 放入客服、投研与内部知识流程，治理能力成为上线门槛。",
      worthReading: "这标志着 AI 竞争正在转向流程改造而不是单点炫技。",
      sourceLabel: "OpenAI News",
      sourceUrl: "https://example.com/openai-agent-rollout",
      tag: "Agent"
    },
    {
      duration: DigestDuration.THREE,
      order: 2,
      title: "多模型路由成为 AI 产品默认架构",
      summary: "产品团队用模型路由平衡成本、准确率和响应速度，单模型押注在降温。",
      worthReading: "未来评估 AI 产品，编排与运营能力会越来越关键。",
      sourceLabel: "Anthropic Updates",
      sourceUrl: "https://example.com/multi-model-routing",
      tag: "Model Ops"
    },
    {
      duration: DigestDuration.THREE,
      order: 3,
      title: "AI Infra 从性能转向可观测与成本治理",
      summary: "企业部署之后，监控、计费、审计和可追责变成新需求。",
      worthReading: "这类基础能力会决定 AI 是否能走进核心生产系统。",
      sourceLabel: "AI Infra Watch",
      sourceUrl: "https://example.com/infra-cost-governance",
      tag: "Infra"
    },
    {
      duration: DigestDuration.EIGHT,
      order: 1,
      title: "Agent 项目进入组织深水区，流程治理比能力展示更重要",
      summary: "越来越多团队不再满足于 Demo，而是把 Agent 放进真实业务环节，这让权限、审计、知识边界和异常处理成为新门槛。",
      worthReading: "真正能落地的团队，不是回答问题最惊艳的，而是最懂组织流程的。",
      sourceLabel: "OpenAI News",
      sourceUrl: "https://example.com/openai-agent-rollout",
      tag: "Agent"
    },
    {
      duration: DigestDuration.EIGHT,
      order: 2,
      title: "多模型协同让 AI 产品从技术秀走向工程系统",
      summary: "面向生产场景的 AI SaaS 开始根据任务难度和成本要求，动态调用不同模型与工具，多模型路由成为效率与体验折中的主要路径。",
      worthReading: "企业之后买的不是某个模型，而是一套稳定可运营的 AI 服务栈。",
      sourceLabel: "Anthropic Updates",
      sourceUrl: "https://example.com/multi-model-routing",
      tag: "Model Ops"
    },
    {
      duration: DigestDuration.EIGHT,
      order: 3,
      title: "AI 基础设施进入经营视角：可观测、可审计、可计费",
      summary: "当 AI 真正进入企业日常运营后，运维团队开始要求 AI 服务具备完整监控、责任归属和成本分析能力，这让基础设施层价值迅速上升。",
      worthReading: "AI infra 的下一轮竞争，会更像传统企业软件而不是单点算力竞赛。",
      sourceLabel: "AI Infra Watch",
      sourceUrl: "https://example.com/infra-cost-governance",
      tag: "Infra"
    },
    {
      duration: DigestDuration.EIGHT,
      order: 4,
      title: "高风险观点仍需要人工把关，避免情绪型内容污染品牌判断",
      summary: "创始人激进观点和未经验证的截图很容易传播，但首版策略仍然是进入飞书审批，由编辑决定是否转化为可发布洞察。",
      worthReading: "AI 自动化不能替代机构判断，审核能力本身就是产品价值的一部分。",
      sourceLabel: "Founder Notes",
      sourceUrl: "https://example.com/founder-rumor",
      tag: "Review"
    }
  ];

  await prisma.digestEntry.createMany({
    data: digestEntries.map((item) => ({
      digestId: digest.id,
      ...item
    }))
  });

  await prisma.thoughtPost.createMany({
    data: [
      {
        slug: "agent-rollout-is-an-org-design-problem",
        title: "Agent 落地本质上是组织设计问题，不只是产品问题",
        excerpt:
          "如果团队仍把 Agent 视作一个更强的聊天界面，就很难真正进入经营流程。组织边界、权限结构和责任机制才是扩张关键。",
        body:
          "这类产品的下一步，不在更花哨的前端，而在更深的流程连接。\n\n当 AI 被放进真实业务后，组织开始提出一系列以前不在 Demo 阶段出现的问题：谁负责结果，如何审计，如何追踪上下文，如何定义失败后的兜底动作。\n\n因此，AI 产品经理和研究者不能只追模型指标，还要关注组织接口。",
        authorName: "中心研究组",
        status: ThoughtStatus.PUBLISHED,
        publishedAt: new Date("2026-03-14T09:00:00.000Z")
      },
      {
        slug: "why-ai-infra-now-looks-like-enterprise-software",
        title: "为什么 AI Infra 越来越像企业软件，而不是一场短期能力竞赛",
        excerpt:
          "当采购标准从能力展示转向稳定性与责任边界，AI Infra 的竞争方式就改变了。",
        body:
          "AI Infra 的价值在 2026 年出现了明显迁移：从性能比较，转向稳定部署与经营可见性。\n\n这意味着许多过去被视作中间层工具的能力，正在变成企业真正愿意付费的基础设施。\n\n对于内容站来说，这类结构性变化比单条新闻更值得持续追踪。",
        authorName: "中心研究组",
        status: ThoughtStatus.PUBLISHED,
        publishedAt: new Date("2026-03-10T08:30:00.000Z")
      }
    ]
  });

  const subscribers = await Promise.all([
    prisma.subscriber.create({
      data: {
        email: "ceo@example.com",
        name: "AI 创业者",
        interest: "主情报流",
        defaultDuration: DigestDuration.THREE,
        frequency: "工作日"
      }
    }),
    prisma.subscriber.create({
      data: {
        email: "research@example.com",
        name: "研究主管",
        interest: "Digest + 专题思考",
        defaultDuration: DigestDuration.EIGHT,
        frequency: "每日"
      }
    })
  ]);

  await prisma.emailDispatch.createMany({
    data: [
      {
        subscriberId: subscribers[0].id,
        digestId: digest.id,
        status: DispatchStatus.SENT,
        subject: "3 分钟看懂今天 AI 情报重点",
        scheduledFor: new Date("2026-03-15T09:00:00.000Z"),
        sentAt: new Date("2026-03-15T09:00:04.000Z"),
        notes: `使用工作流 ${workflow.name} 自动生成并发送。`
      },
      {
        subscriberId: subscribers[1].id,
        digestId: digest.id,
        status: DispatchStatus.PENDING,
        subject: "8 分钟版 AI 情报日报",
        scheduledFor: new Date("2026-03-15T11:00:00.000Z"),
        notes: "等待编辑补充一条机构点评后发送。"
      }
    ]
  });
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

import { PrismaClient } from "@prisma/client";
import { syncDraftRecord } from "@/lib/services/worker";

const prisma = new PrismaClient();

const updates = [
  {
    id: "cmnulbyv4001bup9sqluo9i5g",
    translatedTitle: "Mistral 新闻聚合页（非具体文章）",
    aiSummary:
      "这不是一篇具体新闻，而是 Mistral 官网的新闻栏目入口页。页面只是在概括这里会发布研究、产品更新和公司公告，并没有提供一条可独立审核的具体事件或文章正文。",
    worthReading:
      "不建议继续审核，因为这是一张栏目聚合页，不是独立内容；它不能代表一条具体新闻，也不适合进入首页或 digest。",
    editorNotes: "历史噪音清理：栏目聚合页，非独立文章。",
    outline: ["页面性质：新闻栏目入口", "问题：缺少独立文章正文", "处理：保留为已拒绝噪音样本"],
    sourceNote: "来源：Mistral News 栏目页",
    url: "https://mistral.ai/news"
  },
  {
    id: "cmnulc0zw001fup9sul03h1uj",
    translatedTitle: "申请产品演示（销售入口页）",
    aiSummary:
      "这条内容不是新闻或技术文章，而是 Cohere 官网的销售转化页面，核心动作是引导用户联系销售并申请产品演示。页面没有可用于情报站发布的研究、产品更新或公司动态信息。",
    worthReading:
      "不建议继续审核，因为它本质上是 CTA / 销售入口页，不包含可摘要的新闻事实或技术细节，属于抓取噪音。",
    editorNotes: "历史噪音清理：销售线索页面，非内容文章。",
    outline: ["页面性质：销售转化页", "问题：没有新闻事实或技术内容", "处理：保留为已拒绝噪音样本"],
    sourceNote: "来源：Cohere 销售联系页",
    url: "https://cohere.com/contact-sales"
  },
  {
    id: "cmnulkx2g000fupb83oj3ebd7",
    translatedTitle: "开发者工具栏目噪音页",
    aiSummary:
      "这条抓取结果只拿到了栏目标题和“Follow Us”之类的导航文本，没有抓到一篇真正的开发者工具文章正文，因此不能作为有效情报条目。",
    worthReading:
      "不建议继续审核，因为它只是页面导航噪音，不包含可发布的具体更新、技术信息或明确事件。",
    editorNotes: "历史噪音清理：导航文本被误识别为文章。",
    outline: ["页面性质：栏目或导航页", "问题：只抓到 Follow Us 等无效文本", "处理：保留为已拒绝噪音样本"],
    sourceNote: "来源：Google Developer Tools 栏目页",
    url: "https://blog.google/innovation-and-ai/technology/developers-tools/colab-updates/"
  }
];

async function main() {
  for (const item of updates) {
    await prisma.candidateItem.update({
      where: { id: item.id },
      data: {
        aiSummary: item.aiSummary,
        worthReading: item.worthReading,
        editorNotes: item.editorNotes,
        structuredJson: {
          translatedTitle: item.translatedTitle,
          summary: item.aiSummary,
          worthReading: item.worthReading,
          tldr: [item.aiSummary],
          outline: item.outline,
          sourceNotes: [item.sourceNote]
        },
        draftMarkdown: [
          `# ${item.translatedTitle}`,
          "",
          "## 这是什么",
          "",
          item.aiSummary,
          "",
          "## 为什么被拒绝",
          "",
          item.worthReading,
          "",
          "## 原始链接",
          "",
          item.url
        ].join("\n")
      }
    });

    await syncDraftRecord(item.id);
  }

  const result = await prisma.candidateItem.findMany({
    where: { id: { in: updates.map((item) => item.id) } },
    select: { title: true, aiSummary: true, worthReading: true, structuredJson: true, editorNotes: true }
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import type { CandidateItem, Digest, DigestEntry, Source } from "@prisma/client";

import { getAppBaseUrl } from "@/lib/env";
import { formatLongDate, parseTags } from "@/lib/utils";

function renderTagText(tags: string) {
  const normalized = parseTags(tags);
  return normalized.length > 0 ? normalized.join(" / ") : "AI";
}

export function buildReviewCard(candidate: CandidateItem, source: Source) {
  const previewUrl = `${getAppBaseUrl()}/preview/candidate/${candidate.id}`;
  const content = [
    `**标题** ${candidate.title}`,
    `**来源** ${source.name}`,
    `**标签** ${renderTagText(candidate.tags)}`,
    `**风险等级** ${candidate.riskLevel}`,
    `**摘要** ${candidate.aiSummary}`,
    `**为什么值得看** ${candidate.worthReading}`,
    `[原文链接](${candidate.normalizedUrl}) | [站内预览](${previewUrl})`
  ].join("\n");

  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true
    },
    header: {
      template: candidate.riskLevel === "HIGH" ? "red" : "orange",
      title: {
        tag: "plain_text",
        content: `待审核内容 · ${source.name}`
      }
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content
        }
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            type: "primary",
            text: {
              tag: "plain_text",
              content: "发布"
            },
            value: {
              action: "publish",
              candidateId: candidate.id
            }
          },
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "驳回"
            },
            value: {
              action: "reject",
              candidateId: candidate.id
            }
          }
        ]
      }
    ]
  };
}

export function buildDigestCard(digest: Digest, entries: DigestEntry[]) {
  const threeMinuteEntries = entries.filter((entry) => entry.duration === "THREE").slice(0, 3);
  const digestDate = formatLongDate(digest.date);
  const digestUrl = `${getAppBaseUrl()}/digest/${digest.date}?view=3`;

  const highlights = threeMinuteEntries
    .map((entry, index) => `${index + 1}. ${entry.title}`)
    .join("\n");

  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true
    },
    header: {
      template: "turquoise",
      title: {
        tag: "plain_text",
        content: `每日 Digest · ${digestDate}`
      }
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${digest.title}**\n${digest.summary}`
        }
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: highlights || "今日暂无新的 3 分钟版摘要。"
        }
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            type: "primary",
            text: {
              tag: "plain_text",
              content: "查看 3 分钟版"
            },
            url: digestUrl
          },
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "查看 8 分钟版"
            },
            url: `${getAppBaseUrl()}/digest/${digest.date}?view=8`
          }
        ]
      }
    ]
  };
}

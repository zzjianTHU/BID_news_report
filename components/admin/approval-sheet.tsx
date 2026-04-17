import { CandidateStatus, RiskLevel, type CandidateItem, type Source } from "@prisma/client";

import { reviewCandidateAction } from "@/lib/actions";
import { formatBilingualTitle, parseTags, readTranslatedTitle, translateTag } from "@/lib/utils";

type ApprovalSheetProps = {
  item: CandidateItem & {
    source: Source;
  };
};

function statusLabel(status: CandidateStatus) {
  switch (status) {
    case CandidateStatus.REVIEW:
      return "待审核";
    case CandidateStatus.INGESTED:
      return "刚入队";
    case CandidateStatus.PUBLISHED:
      return "已发布";
    case CandidateStatus.REJECTED:
      return "已拒绝";
    default:
      return status;
  }
}

export function ApprovalSheet({ item }: ApprovalSheetProps) {
  const tags = parseTags(item.tags);
  const displayTitle = formatBilingualTitle(item.title, readTranslatedTitle(item.structuredJson));

  return (
    <article className="approval-sheet">
      <div className="approval-header">
        <div>
          <p className="section-kicker">{item.source.name}</p>
          <h3>{displayTitle}</h3>
        </div>
        <span className={`status-pill ${item.riskLevel === RiskLevel.HIGH ? "danger" : "good"}`}>
          {item.riskLevel === RiskLevel.HIGH ? "高风险" : "低风险"}
        </span>
      </div>

      <p className="approval-excerpt">{item.aiSummary}</p>
      <p className="feed-insight">为什么值得看：{item.worthReading}</p>

      <div className="inline-tags">
        {tags.map((tag) => (
          <span className="tag-pill" key={tag}>
            {translateTag(tag)}
          </span>
        ))}
        <span className="tag-pill muted">{statusLabel(item.status)}</span>
      </div>

      <div className="approval-actions">
        <form action={reviewCandidateAction}>
          <input name="candidateId" type="hidden" value={item.id} />
          <input name="decision" type="hidden" value="publish" />
          <button className="button button-primary" type="submit">
            发布
          </button>
        </form>
        <form action={reviewCandidateAction}>
          <input name="candidateId" type="hidden" value={item.id} />
          <input name="decision" type="hidden" value="reject" />
          <button className="button button-secondary" type="submit">
            拒绝
          </button>
        </form>
      </div>
    </article>
  );
}

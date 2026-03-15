import { CandidateStatus, RiskLevel, type CandidateItem, type Source } from "@prisma/client";

import { reviewCandidateAction } from "@/lib/actions";
import { parseTags } from "@/lib/utils";

type ApprovalSheetProps = {
  item: CandidateItem & {
    source: Source;
  };
};

export function ApprovalSheet({ item }: ApprovalSheetProps) {
  const tags = parseTags(item.tags);

  return (
    <article className="approval-sheet">
      <div className="approval-header">
        <div>
          <p className="section-kicker">{item.source.name}</p>
          <h3>{item.title}</h3>
        </div>
        <span className={`status-pill ${item.riskLevel === RiskLevel.HIGH ? "danger" : "good"}`}>
          {item.riskLevel === RiskLevel.HIGH ? "High risk" : "Low risk"}
        </span>
      </div>

      <p className="approval-excerpt">{item.aiSummary}</p>
      <p className="feed-insight">为什么值得看：{item.worthReading}</p>

      <div className="inline-tags">
        {tags.map((tag) => (
          <span className="tag-pill" key={tag}>
            {tag}
          </span>
        ))}
        <span className="tag-pill muted">{CandidateStatus[item.status]}</span>
      </div>

      <div className="approval-actions">
        <form action={reviewCandidateAction}>
          <input name="candidateId" type="hidden" value={item.id} />
          <input name="decision" type="hidden" value="publish" />
          <button className="button button-primary" type="submit">
            Publish
          </button>
        </form>
        <form action={reviewCandidateAction}>
          <input name="candidateId" type="hidden" value={item.id} />
          <input name="decision" type="hidden" value="reject" />
          <button className="button button-secondary" type="submit">
            Reject
          </button>
        </form>
      </div>
    </article>
  );
}

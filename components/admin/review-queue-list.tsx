import type { CandidateItem, Source } from "@prisma/client";

import { ApprovalSheet } from "@/components/admin/approval-sheet";

type ReviewQueueListProps = {
  items: Array<
    CandidateItem & {
      source: Source;
    }
  >;
};

export function ReviewQueueList({ items }: ReviewQueueListProps) {
  if (items.length === 0) {
    return <div className="empty-state">当前没有待处理内容，自动流运行正常。</div>;
  }

  return (
    <div className="review-queue-list">
      {items.map((item) => (
        <ApprovalSheet item={item} key={item.id} />
      ))}
    </div>
  );
}

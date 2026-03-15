import { ReviewQueueList } from "@/components/admin/review-queue-list";
import { getPendingDispatchCount, getQueueItems } from "@/lib/data";

export default async function AdminQueuePage() {
  const [items, pendingDispatchCount] = await Promise.all([getQueueItems(), getPendingDispatchCount()]);

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Review queue</p>
          <h2>高风险待审核与新入库内容</h2>
        </div>
        <p className="section-note">{pendingDispatchCount} 条邮件任务等待 digest 发送。</p>
      </div>

      <ReviewQueueList items={items} />
    </section>
  );
}

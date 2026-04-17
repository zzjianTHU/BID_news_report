import { ReviewQueueConsole } from "@/components/admin/review-queue-console";
import { requireAdminSession } from "@/lib/auth";
import { getCandidateAdminList } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  await requireAdminSession();

  const queueItems = await getCandidateAdminList();

  return (
    <section className="admin-section">
      <p className="section-kicker">Queue workspace</p>
      <h2>审核列表页</h2>
      <p className="section-note">
        这里是站内审核工作台。默认只展示“待审核”内容，避免旧的拒绝噪音影响判断。你也可以再切换状态、风险、来源和关键词筛选。
      </p>
      <ReviewQueueConsole items={queueItems} />
    </section>
  );
}

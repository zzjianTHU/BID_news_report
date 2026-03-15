import { queueDigestDispatchAction } from "@/lib/actions";
import { getPublishedDigests } from "@/lib/data";

export default async function AdminDigestsPage() {
  const digests = await getPublishedDigests();

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Digests</p>
          <h2>每日 digest 与发送任务</h2>
        </div>
      </div>

      <div className="admin-list">
        {digests.map((digest) => (
          <article className="panel-card digest-admin-card" key={digest.id}>
            <div>
              <p className="section-kicker">{digest.date}</p>
              <h3>{digest.title}</h3>
              <p>{digest.summary}</p>
              <div className="feed-meta">
                <span>{digest.entries.length} 条 3 分钟版摘要</span>
                <span>{digest.dispatches.length} 个发送记录</span>
              </div>
            </div>
            <form action={queueDigestDispatchAction}>
              <input name="digestId" type="hidden" value={digest.id} />
              <button className="button button-primary" type="submit">
                重新生成发送任务
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}

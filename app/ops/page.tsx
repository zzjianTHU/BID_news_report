import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { getLatestDigest, getQueueItems, getSiteSnapshot, getSources } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const [snapshot, queueItems, sources, latestDigest] = await Promise.all([
    getSiteSnapshot(),
    getQueueItems(),
    getSources(),
    getLatestDigest()
  ]);

  const reviewItems = queueItems.slice(0, 8);
  const enabledSources = sources.filter((source) => source.enabled);
  const pausedSources = sources.filter((source) => !source.enabled);
  const lowPrioritySources = enabledSources.filter((source) => source.priority <= 60);

  return (
    <main className="page-shell">
      <SiteHeader />

      <div className="page-body">
        <section className="section-block">
          <p className="section-kicker">Ops dashboard</p>
          <h1 className="page-title">运营总览</h1>
          <p className="page-intro">
            这里是站内最小运营看板。你可以先在这里看清楚 source、待审队列和发布状态，再去飞书完成审批。
          </p>
        </section>

        <section className="ops-metric-grid">
          <article className="admin-metric-card">
            <p>已发布文章</p>
            <strong>{snapshot.publishedCount}</strong>
          </article>
          <article className="admin-metric-card">
            <p>待审核候选</p>
            <strong>{snapshot.reviewCount}</strong>
          </article>
          <article className="admin-metric-card">
            <p>启用中的来源</p>
            <strong>{snapshot.activeSourceCount}</strong>
          </article>
          <article className="admin-metric-card">
            <p>已生成 digest</p>
            <strong>{latestDigest ? 1 : 0}</strong>
          </article>
        </section>

        <div className="ops-grid">
          <section className="split-card ops-panel">
            <div className="ops-panel-header">
              <div>
                <p className="section-kicker">Review queue</p>
                <h2>最近待审内容</h2>
              </div>
              <span className="tag-pill muted">{queueItems.length} items</span>
            </div>

            <div className="ops-list">
              {reviewItems.length > 0 ? (
                reviewItems.map((item) => (
                  <article className="ops-list-item" key={item.id}>
                    <div className="ops-list-copy">
                      <p className="section-kicker">{item.source.name}</p>
                      <h3>{item.title}</h3>
                      <p>{item.aiSummary}</p>
                    </div>
                    <div className="ops-list-actions">
                      <span className={`status-pill ${item.riskLevel === "HIGH" ? "danger" : "good"}`}>
                        {item.riskLevel === "HIGH" ? "高风险" : "低风险"}
                      </span>
                      <Link className="mini-link dark" href={`/preview/candidate/${item.id}`}>
                        查看预览
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <p className="page-intro">当前没有待审内容，抓取与发布链路看起来比较健康。</p>
              )}
            </div>
          </section>

          <section className="split-card ops-panel">
            <div className="ops-panel-header">
              <div>
                <p className="section-kicker">Next actions</p>
                <h2>现在最该做的事</h2>
              </div>
            </div>

            <div className="ops-checklist">
              <div className="ops-checklist-item">
                <strong>1. 去飞书 draft 表审核 5 到 10 条高质量内容</strong>
                <p>把 status 改成 `APPROVED` 或 `REJECTED`，优先处理 OpenAI、Anthropic、DeepMind、Meta 这几类候选。</p>
              </div>
              <div className="ops-checklist-item">
                <strong>2. 同步审批结果回本地</strong>
                <p>执行 `npm run worker:sync-feishu-draft-decisions`，让第一批内容真正变成已发布文章。</p>
              </div>
              <div className="ops-checklist-item">
                <strong>3. 再生成第一版 digest</strong>
                <p>等有了已发布文章后，再执行 digest 生成和站点检查，首页就不会继续空着了。</p>
              </div>
            </div>
          </section>
        </div>

        <div className="ops-grid">
          <section className="split-card ops-panel">
            <div className="ops-panel-header">
              <div>
                <p className="section-kicker">Source health</p>
                <h2>来源状态</h2>
              </div>
            </div>

            <div className="ops-list">
              {enabledSources.map((source) => (
                <article className="ops-list-item" key={source.id}>
                  <div className="ops-list-copy">
                    <h3>{source.name}</h3>
                    <p>{source.url}</p>
                  </div>
                  <div className="ops-source-meta">
                    <span className="tag-pill">{source.type}</span>
                    <span className="tag-pill muted">P{source.priority}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="split-card ops-panel">
            <div className="ops-panel-header">
              <div>
                <p className="section-kicker">Watch list</p>
                <h2>需要继续盯的来源</h2>
              </div>
            </div>

            <div className="ops-checklist">
              <div className="ops-checklist-item">
                <strong>低优先级但仍启用</strong>
                <p>
                  {lowPrioritySources.length > 0
                    ? lowPrioritySources.map((source) => source.name).join("、")
                    : "当前没有低优先级启用来源。"}
                </p>
              </div>
              <div className="ops-checklist-item">
                <strong>已暂停来源</strong>
                <p>
                  {pausedSources.length > 0
                    ? pausedSources.map((source) => source.name).join("、")
                    : "当前没有暂停来源。"}
                </p>
              </div>
              <div className="ops-checklist-item">
                <strong>前台状态</strong>
                <p>
                  {snapshot.publishedCount > 0
                    ? "前台已经有已发布文章，可以继续检查 digest 和归档页。"
                    : "前台还处于空态，这是因为还没有已发布文章，不是站点故障。"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

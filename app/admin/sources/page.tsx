import Link from "next/link";

import { requireAdminSession } from "@/lib/auth";
import { runWorkerTaskAction, toggleSourceAction } from "@/lib/actions";
import { getRecentIngestionRuns, getSourceAdminList } from "@/lib/data";
import { formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildFeishuShortcut() {
  if (!process.env.FEISHU_SOURCE_WIKI_TOKEN) {
    return null;
  }

  return `https://feishu.cn/wiki/${process.env.FEISHU_SOURCE_WIKI_TOKEN}`;
}

export default async function AdminSourcesPage() {
  await requireAdminSession();

  const [sources, recentRuns] = await Promise.all([getSourceAdminList(), getRecentIngestionRuns(8)]);
  const feishuShortcut = buildFeishuShortcut();

  return (
    <>
      <section className="admin-section">
        <p className="section-kicker">Sources</p>
        <h2>来源管理</h2>
        <p className="section-note">
          飞书负责维护来源本身的配置字段，例如 URL、类型、优先级和抓取间隔；后台负责看状态、紧急启停、手动触发同步和抓取。
        </p>
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">How to manage</p>
              <h2>推荐的管理分工</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>在飞书里改配置</strong>
              <p>来源地址、RSS / WEB 类型、优先级、抓取间隔这些基础字段，建议统一在飞书 source 表里维护。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>在后台看状态和手动操作</strong>
              <p>这里更适合看最近抓取表现、失败次数、下一次抓取时间，以及临时启停和手动触发轮询。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>保持单一真相源</strong>
              <p>如果你同时在后台和飞书改同一个来源字段，下次飞书同步可能覆盖本地改动，所以字段配置仍以飞书为主。</p>
            </div>
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Quick actions</p>
              <h2>来源相关快捷动作</h2>
            </div>
          </div>
          <div className="admin-inline-actions">
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="sync-feishu-sources" />
              <button className="button button-secondary compact" type="submit">
                同步飞书来源
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="run-ingest-cycle" />
              <button className="button button-primary compact" type="submit">
                立即跑一轮抓取
              </button>
            </form>
            {feishuShortcut ? (
              <a className="button button-light compact" href={feishuShortcut} rel="noreferrer" target="_blank">
                打开飞书 source 表
              </a>
            ) : null}
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">All sources</p>
              <h2>来源卡片</h2>
            </div>
            <span className="tag-pill muted">{sources.length} 个来源</span>
          </div>
          <div className="ops-list">
            {sources.map((source) => (
              <article className="ops-list-item source-card" key={source.id}>
                <div className="ops-list-copy">
                  <p className="section-kicker">{source.type}</p>
                  <h3>
                    <Link className="mini-link dark source-card-link" href={`/admin/sources/${source.id}`}>
                      {source.name}
                    </Link>
                  </h3>
                  <p>{source.description || source.url}</p>
                  <div className="inline-tags">
                    <span className="tag-pill muted">优先级 P{source.priority}</span>
                    <span className="tag-pill muted">信任 {source.trustScore}</span>
                    <span className="tag-pill muted">每 {source.fetchIntervalMinutes} 分钟</span>
                    <span className={`tag-pill ${source.enabled ? "" : "muted"}`}>{source.enabled ? "启用中" : "已暂停"}</span>
                  </div>
                  <p className="section-note">
                    上次抓取：{source.lastRunAt ? formatDateLabel(source.lastRunAt) : "还没有运行"} | 下次抓取：
                    {source.nextRunAt ? formatDateLabel(source.nextRunAt) : "等待调度器分配"}
                  </p>
                  {source.lastError ? <p className="section-note source-error-note">最近错误：{source.lastError}</p> : null}
                </div>
                <div className="ops-list-actions">
                  <a className="mini-link dark" href={source.url} rel="noreferrer" target="_blank">
                    打开来源
                  </a>
                  <Link className="mini-link dark" href={`/admin/sources/${source.id}`}>
                    查看详情
                  </Link>
                  <form action={toggleSourceAction}>
                    <input name="sourceId" type="hidden" value={source.id} />
                    <input name="enabled" type="hidden" value={source.enabled ? "false" : "true"} />
                    <button className="button button-light compact" type="submit">
                      {source.enabled ? "临时暂停" : "重新启用"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent runs</p>
              <h2>最近抓取表现</h2>
            </div>
          </div>
          <div className="ops-list">
            {recentRuns.length > 0 ? (
              recentRuns.map((run) => (
                <article className="ops-list-item" key={run.id}>
                  <div className="ops-list-copy">
                    <p className="section-kicker">{run.source?.name ?? "未知来源"}</p>
                    <h3>{run.status === "FAILED" ? "抓取失败" : run.status === "PARTIAL" ? "部分成功" : "抓取完成"}</h3>
                    <p>
                      找到 {run.itemsFound} 条，发布 {run.itemsPublished} 条，开始于 {formatDateLabel(run.startedAt)}。
                    </p>
                    {run.errorSummary ? <p className="section-note source-error-note">{run.errorSummary}</p> : null}
                  </div>
                  <div className="ops-list-actions">
                    <span className={`status-pill ${run.status === "FAILED" ? "danger" : "good"}`}>{run.status}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">目前还没有抓取运行记录。</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

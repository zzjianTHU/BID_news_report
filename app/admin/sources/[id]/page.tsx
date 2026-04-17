import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth";
import { toggleSourceAction } from "@/lib/actions";
import { getSourceById } from "@/lib/data";
import { formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSourceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const source = await getSourceById(id);

  if (!source) {
    notFound();
  }

  return (
    <>
      <section className="admin-section">
        <p className="section-kicker">{source.type}</p>
        <h2>{source.name}</h2>
        <p className="section-note">{source.description || source.url}</p>
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Metadata</p>
              <h2>来源详情</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>来源地址</strong>
              <p>{source.url}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>类型 / 启用状态</strong>
              <p>
                {source.type} / {source.enabled ? "启用中" : "已暂停"}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>优先级 / 信任分</strong>
              <p>
                P{source.priority} / {source.trustScore}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>抓取间隔</strong>
              <p>每 {source.fetchIntervalMinutes} 分钟检查一次是否到期。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近运行</strong>
              <p>
                上次抓取：{source.lastRunAt ? formatDateLabel(source.lastRunAt) : "还没有运行"}；下次抓取：
                {source.nextRunAt ? formatDateLabel(source.nextRunAt) : "等待调度器轮询"}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近错误</strong>
              <p>{source.lastError || "当前没有记录错误。"}</p>
            </div>
          </div>
          <div className="admin-inline-actions">
            <a className="button button-light compact" href={source.url} rel="noreferrer" target="_blank">
              打开原始来源
            </a>
            <form action={toggleSourceAction}>
              <input name="sourceId" type="hidden" value={source.id} />
              <input name="enabled" type="hidden" value={source.enabled ? "false" : "true"} />
              <button className="button button-secondary compact" type="submit">
                {source.enabled ? "临时暂停抓取" : "重新启用抓取"}
              </button>
            </form>
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">How to manage</p>
              <h2>推荐操作方式</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>字段配置在飞书里改</strong>
              <p>像 URL、RSS / WEB 类型、优先级和抓取间隔，优先在飞书 source 表里改，避免来源配置出现两套真相源。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>后台更适合临时运营操作</strong>
              <p>这里更适合临时暂停、查看历史运行表现、确认错误是不是来源本身结构变化导致。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>何时该暂停一个来源</strong>
              <p>如果最近连续抓到聚合页、CTA 或导航噪音，而不是正文内容，就先暂停，再去飞书修 URL 或抓取策略。</p>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent runs</p>
              <h2>最近运行记录</h2>
            </div>
          </div>
          <div className="ops-list">
            {source.ingestionRuns.length > 0 ? (
              source.ingestionRuns.map((run) => (
                <article className="ops-list-item" key={run.id}>
                  <div className="ops-list-copy">
                    <h3>{run.status}</h3>
                    <p>
                      开始于 {formatDateLabel(run.startedAt)}，找到 {run.itemsFound} 条，发布 {run.itemsPublished} 条。
                    </p>
                    {run.notes ? <p className="section-note">{run.notes}</p> : null}
                    {run.errorSummary ? <p className="section-note source-error-note">{run.errorSummary}</p> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">还没有这条来源的抓取记录。</p>
            )}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent candidates</p>
              <h2>最近抓到的内容</h2>
            </div>
          </div>
          <div className="ops-list">
            {source.candidateItems.length > 0 ? (
              source.candidateItems.map((item) => (
                <article className="ops-list-item" key={item.id}>
                  <div className="ops-list-copy">
                    <h3>{item.title}</h3>
                    <p>{item.aiSummary}</p>
                    <p className="section-note">
                      状态：{item.status} | 风险：{item.riskLevel} | 入库：{formatDateLabel(item.createdAt)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">这条来源还没有抓到候选内容。</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

import Link from "next/link";

import { requireAdminSession } from "@/lib/auth";
import { runWorkerTaskAction, toggleSourceAction } from "@/lib/actions";
import { getRecentCandidateItems, getRecentIngestionRuns, getRunningIngestionRuns, getSourceAdminList } from "@/lib/data";
import { describeSource, formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildFeishuShortcut() {
  if (!process.env.FEISHU_SOURCE_WIKI_TOKEN) {
    return null;
  }

  return `https://feishu.cn/wiki/${process.env.FEISHU_SOURCE_WIKI_TOKEN}`;
}

function formatRunStatus(status: string) {
  if (status === "FAILED") {
    return "\u6293\u53d6\u5931\u8d25";
  }

  if (status === "PARTIAL") {
    return "\u90e8\u5206\u6210\u529f";
  }

  if (status === "SUCCESS") {
    return "\u6293\u53d6\u5b8c\u6210";
  }

  return status;
}

function formatTriggerLabel(trigger: string) {
  if (trigger === "MANUAL_SYNC") {
    return "\u624b\u52a8\u89e6\u53d1";
  }

  if (trigger === "SCHEDULED") {
    return "\u8c03\u5ea6\u89e6\u53d1";
  }

  return trigger;
}

function formatCandidateStatus(status: string) {
  if (status === "PUBLISHED") {
    return "\u5df2\u53d1\u5e03";
  }

  if (status === "REVIEW") {
    return "\u5f85\u5ba1\u6838";
  }

  if (status === "REJECTED") {
    return "\u5df2\u62d2\u7edd";
  }

  if (status === "INGESTED") {
    return "\u5df2\u5165\u5e93";
  }

  return status;
}

export default async function AdminSourcesPage() {
  await requireAdminSession();

  const [sources, runningRuns, recentRuns, recentCandidates] = await Promise.all([
    getSourceAdminList(),
    getRunningIngestionRuns(6),
    getRecentIngestionRuns(8),
    getRecentCandidateItems(8)
  ]);
  const feishuShortcut = buildFeishuShortcut();

  return (
    <>
      <section className="admin-section">
        <p className="section-kicker">Sources</p>
        <h2>{"\u6765\u6e90\u7ba1\u7406"}</h2>
        <p className="section-note">
          {
            "\u98de\u4e66\u8d1f\u8d23\u7ef4\u62a4\u6765\u6e90\u672c\u8eab\u7684\u914d\u7f6e\u5b57\u6bb5\uff0c\u4f8b\u5982 URL\u3001\u7c7b\u578b\u3001\u4f18\u5148\u7ea7\u548c\u6293\u53d6\u95f4\u9694\uff1b\u540e\u53f0\u8d1f\u8d23\u67e5\u770b\u8fd0\u884c\u72b6\u6001\u3001\u6700\u8fd1\u6293\u53d6\u8868\u73b0\u3001\u624b\u52a8\u89e6\u53d1\u540c\u6b65\u548c\u4e34\u65f6\u542f\u505c\u3002"
          }
        </p>
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Live progress</p>
              <h2>{"\u5f53\u524d\u6293\u53d6\u8fdb\u5ea6"}</h2>
            </div>
          </div>
          <div className="ops-list">
            {runningRuns.length > 0 ? (
              runningRuns.map((run) => (
                <article className="ops-list-item" key={run.id}>
                  <div className="ops-list-copy">
                    <p className="section-kicker">{run.source?.name ?? "\u672a\u77e5\u6765\u6e90"}</p>
                    <h3>{"\u6b63\u5728\u6293\u53d6\u4e2d"}</h3>
                    <p>
                      {formatTriggerLabel(run.trigger)}{"\uff0c\u5f00\u59cb\u4e8e"} {formatDateLabel(run.startedAt)}
                      {"\u3002\u8fd9\u4e00\u884c\u8fd8\u5728 RUNNING \u65f6\uff0c\u8bf4\u660e\u8fd9\u4e2a source \u8fd8\u6ca1\u8dd1\u5b8c\u3002"}
                    </p>
                  </div>
                  <div className="ops-list-actions">
                    <span className="status-pill warm">RUNNING</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">
                {
                  "\u5f53\u524d\u6ca1\u6709\u6b63\u5728\u8fd0\u884c\u7684 source\u3002\u5982\u679c\u4f60\u521a\u70b9\u4e86\u300c\u7acb\u5373\u8dd1\u4e00\u8f6e\u6293\u53d6\u300d\uff0c\u8fd9\u91cc\u4f1a\u5148\u663e\u793a RUNNING\uff0c\u8dd1\u5b8c\u540e\u624d\u4f1a\u8fdb\u5230\u4e0b\u9762\u7684\u300c\u6700\u8fd1\u6293\u53d6\u8868\u73b0\u300d\u3002"
                }
              </p>
            )}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Latest candidates</p>
              <h2>{"\u6700\u8fd1\u6293\u5230\u7684\u5185\u5bb9"}</h2>
            </div>
          </div>
          <div className="ops-list">
            {recentCandidates.length > 0 ? (
              recentCandidates.map((item) => (
                <article className="ops-list-item" key={item.id}>
                  <div className="ops-list-copy">
                    <p className="section-kicker">{item.source.name}</p>
                    <h3>{item.title}</h3>
                    <p className="section-note">
                      {formatCandidateStatus(item.status)}
                      {" | \u5165\u5e93\u4e8e "}
                      {formatDateLabel(item.createdAt)}
                    </p>
                  </div>
                  <div className="ops-list-actions">
                    <Link className="mini-link dark" href={`/preview/candidate/${item.id}`}>
                      {"\u7ad9\u5185\u9884\u89c8"}
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">{"\u76ee\u524d\u8fd8\u6ca1\u6709\u65b0\u5019\u9009\u5185\u5bb9\u3002"}</p>
            )}
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">How to manage</p>
              <h2>{"\u63a8\u8350\u7684\u7ba1\u7406\u5206\u5de5"}</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>{"\u5728\u98de\u4e66\u91cc\u6539\u914d\u7f6e"}</strong>
              <p>
                {
                  "\u6765\u6e90\u5730\u5740\u3001RSS / WEB \u7c7b\u578b\u3001\u4f18\u5148\u7ea7\u3001\u6293\u53d6\u95f4\u9694\u8fd9\u4e9b\u57fa\u7840\u5b57\u6bb5\uff0c\u5efa\u8bae\u7edf\u4e00\u5728\u98de\u4e66 source \u8868\u91cc\u7ef4\u62a4\u3002"
                }
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u5728\u540e\u53f0\u770b\u72b6\u6001\u548c\u624b\u52a8\u64cd\u4f5c"}</strong>
              <p>
                {
                  "\u8fd9\u91cc\u66f4\u9002\u5408\u770b\u6700\u8fd1\u6293\u53d6\u8868\u73b0\u3001\u5931\u8d25\u6b21\u6570\u3001\u4e0b\u6b21\u6293\u53d6\u65f6\u95f4\uff0c\u4ee5\u53ca\u4e34\u65f6\u542f\u505c\u548c\u624b\u52a8\u89e6\u53d1\u4efb\u52a1\u3002"
                }
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u4e0b\u9762\u90a3\u884c\u6587\u5b57\u662f\u4ec0\u4e48"}</strong>
              <p>
                {
                  "\u6bcf\u5f20\u6765\u6e90\u5361\u7247\u4e0b\u9762\u90a3\u4e00\u884c\uff0c\u5c31\u662f\u201c\u8fd9\u4e2a\u6765\u6e90\u662f\u4ec0\u4e48\u7c7b\u578b\u7684\u5b98\u65b9\u7ad9\u70b9\uff0c\u4e3b\u8981\u6293\u4ec0\u4e48\u5185\u5bb9\u201d\u7684\u8bf4\u660e\u3002"
                }
              </p>
            </div>
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Quick actions</p>
              <h2>{"\u6765\u6e90\u76f8\u5173\u5feb\u6377\u52a8\u4f5c"}</h2>
            </div>
          </div>
          <div className="admin-inline-actions">
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="sync-feishu-sources" />
              <button className="button button-secondary compact" type="submit">
                {"\u540c\u6b65\u98de\u4e66\u6765\u6e90"}
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="run-ingest-cycle" />
              <button className="button button-primary compact" type="submit">
                {"\u7acb\u5373\u8dd1\u4e00\u8f6e\u6293\u53d6"}
              </button>
            </form>
            {feishuShortcut ? (
              <a className="button button-light compact" href={feishuShortcut} rel="noreferrer" target="_blank">
                {"\u6253\u5f00\u98de\u4e66 source \u8868"}
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
              <h2>{"\u6765\u6e90\u5361\u7247"}</h2>
            </div>
            <span className="tag-pill muted">{sources.length} {"\u4e2a\u6765\u6e90"}</span>
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
                  <p>{describeSource(source)}</p>
                  <div className="inline-tags">
                    <span className="tag-pill muted">{"\u4f18\u5148\u7ea7"} P{source.priority}</span>
                    <span className="tag-pill muted">{"\u4fe1\u4efb"} {source.trustScore}</span>
                    <span className="tag-pill muted">{"\u6bcf"} {source.fetchIntervalMinutes} {"\u5206\u949f"}</span>
                    <span className={`tag-pill ${source.enabled ? "" : "muted"}`}>
                      {source.enabled ? "\u542f\u7528\u4e2d" : "\u5df2\u6682\u505c"}
                    </span>
                  </div>
                  <p className="section-note">
                    {"\u4e0a\u6b21\u6293\u53d6\uff1a"}
                    {source.lastRunAt ? formatDateLabel(source.lastRunAt) : "\u8fd8\u6ca1\u6709\u8fd0\u884c"} {" | "}
                    {"\u4e0b\u6b21\u6293\u53d6\uff1a"}
                    {source.nextRunAt
                      ? formatDateLabel(source.nextRunAt)
                      : "\u7b49\u5f85\u4f60\u624b\u52a8\u89e6\u53d1\u6216\u91cd\u65b0\u5f00\u542f\u81ea\u52a8\u8c03\u5ea6"}
                  </p>
                  {source.lastError ? (
                    <p className="section-note source-error-note">
                      {"\u6700\u8fd1\u9519\u8bef\uff1a"}
                      {source.lastError}
                    </p>
                  ) : null}
                </div>
                <div className="ops-list-actions">
                  <a className="mini-link dark" href={source.url} rel="noreferrer" target="_blank">
                    {"\u6253\u5f00\u6765\u6e90"}
                  </a>
                  <Link className="mini-link dark" href={`/admin/sources/${source.id}`}>
                    {"\u67e5\u770b\u8be6\u60c5"}
                  </Link>
                  <form action={toggleSourceAction}>
                    <input name="sourceId" type="hidden" value={source.id} />
                    <input name="enabled" type="hidden" value={source.enabled ? "false" : "true"} />
                    <button className="button button-light compact" type="submit">
                      {source.enabled ? "\u4e34\u65f6\u6682\u505c" : "\u91cd\u65b0\u542f\u7528"}
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
              <h2>{"\u6700\u8fd1\u6293\u53d6\u8868\u73b0"}</h2>
            </div>
          </div>
          <div className="ops-list">
            {recentRuns.length > 0 ? (
              recentRuns.map((run) => (
                <article className="ops-list-item" key={run.id}>
                  <div className="ops-list-copy">
                    <p className="section-kicker">{run.source?.name ?? "\u672a\u77e5\u6765\u6e90"}</p>
                    <h3>{formatRunStatus(run.status)}</h3>
                    <p>
                      {formatTriggerLabel(run.trigger)}
                      {" | \u627e\u5230"} {run.itemsFound} {"\u6761\uff0c\u53d1\u5e03"} {run.itemsPublished} {"\u6761\uff0c\u5f00\u59cb\u4e8e"}{" "}
                      {formatDateLabel(run.startedAt)}
                      {"\u3002"}
                    </p>
                    {run.itemsFound === 0 && run.status === "SUCCESS" ? (
                      <p className="section-note">
                        {
                          "\u8fd9\u4e00\u8f6e\u4efb\u52a1\u8dd1\u6210\u529f\u4e86\uff0c\u4f46\u6ca1\u6709\u53d1\u73b0\u65b0\u7684\u53ef\u5165\u5e93\u5185\u5bb9\u3002\u8fd9\u901a\u5e38\u610f\u5473\u7740\u201c\u6ca1\u6709\u65b0\u6587\u7ae0\u201d\u6216\u201c\u90fd\u88ab\u53bb\u91cd\u4e86\u201d\uff0c\u4e0d\u662f\u6293\u53d6\u5931\u8d25\u3002"
                        }
                      </p>
                    ) : null}
                    {run.errorSummary ? <p className="section-note source-error-note">{run.errorSummary}</p> : null}
                  </div>
                  <div className="ops-list-actions">
                    <span className={`status-pill ${run.status === "FAILED" ? "danger" : "good"}`}>{run.status}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">{"\u76ee\u524d\u8fd8\u6ca1\u6709\u6293\u53d6\u8fd0\u884c\u8bb0\u5f55\u3002"}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

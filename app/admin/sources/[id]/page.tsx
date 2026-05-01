import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth";
import { toggleSourceAction } from "@/lib/actions";
import { getSourceById } from "@/lib/data";
import { describeSource, formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
        <p className="section-note">{describeSource(source)}</p>
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Metadata</p>
              <h2>{"\u6765\u6e90\u8be6\u60c5"}</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>{"\u6765\u6e90\u5730\u5740"}</strong>
              <p>{source.url}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u7c7b\u578b / \u542f\u7528\u72b6\u6001"}</strong>
              <p>
                {source.type} / {source.enabled ? "\u542f\u7528\u4e2d" : "\u5df2\u6682\u505c"}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u4f18\u5148\u7ea7 / \u4fe1\u4efb\u5206"}</strong>
              <p>
                P{source.priority} / {source.trustScore}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u6293\u53d6\u95f4\u9694"}</strong>
              <p>
                {"\u6bcf"} {source.fetchIntervalMinutes} {"\u5206\u949f\u68c0\u67e5\u4e00\u6b21\u662f\u5426\u5230\u671f\u3002"}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u6700\u8fd1\u8fd0\u884c"}</strong>
              <p>
                {"\u4e0a\u6b21\u6293\u53d6\uff1a"}
                {source.lastRunAt ? formatDateLabel(source.lastRunAt) : "\u8fd8\u6ca1\u6709\u8fd0\u884c"}
                {"\uff1b\u4e0b\u6b21\u6293\u53d6\uff1a"}
                {source.nextRunAt
                  ? formatDateLabel(source.nextRunAt)
                  : "\u7b49\u5f85\u4f60\u624b\u52a8\u89e6\u53d1\u6216\u91cd\u65b0\u5f00\u542f\u81ea\u52a8\u8c03\u5ea6"}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u6700\u8fd1\u9519\u8bef"}</strong>
              <p>{source.lastError || "\u5f53\u524d\u6ca1\u6709\u8bb0\u5f55\u9519\u8bef\u3002"}</p>
            </div>
          </div>
          <div className="admin-inline-actions">
            <a className="button button-light compact" href={source.url} rel="noreferrer" target="_blank">
              {"\u6253\u5f00\u539f\u59cb\u6765\u6e90"}
            </a>
            <form action={toggleSourceAction}>
              <input name="sourceId" type="hidden" value={source.id} />
              <input name="enabled" type="hidden" value={source.enabled ? "false" : "true"} />
              <button className="button button-secondary compact" type="submit">
                {source.enabled ? "\u4e34\u65f6\u6682\u505c\u6293\u53d6" : "\u91cd\u65b0\u542f\u7528\u6293\u53d6"}
              </button>
            </form>
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">How to manage</p>
              <h2>{"\u63a8\u8350\u64cd\u4f5c\u65b9\u5f0f"}</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>{"\u5b57\u6bb5\u914d\u7f6e\u4f18\u5148\u5728\u98de\u4e66\u91cc\u6539"}</strong>
              <p>
                {
                  "\u50cf URL\u3001RSS / WEB \u7c7b\u578b\u3001\u4f18\u5148\u7ea7\u548c\u6293\u53d6\u95f4\u9694\uff0c\u4f18\u5148\u5728\u98de\u4e66 source \u8868\u91cc\u4fee\u6539\uff0c\u907f\u514d\u672c\u5730\u548c\u98de\u4e66\u51fa\u73b0\u4e24\u5957\u6765\u6e90\u771f\u76f8\u3002"
                }
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u540e\u53f0\u66f4\u9002\u5408\u4e34\u65f6\u8fd0\u8425\u64cd\u4f5c"}</strong>
              <p>
                {
                  "\u8fd9\u91cc\u66f4\u9002\u5408\u4e34\u65f6\u6682\u505c\u3001\u67e5\u770b\u6700\u8fd1\u8fd0\u884c\u8bb0\u5f55\u3001\u5224\u65ad\u662f\u4e0d\u662f\u6765\u6e90\u7ed3\u6784\u53d8\u5316\u5bfc\u81f4\u6293\u53d6\u5931\u6548\u3002"
                }
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>{"\u4ec0\u4e48\u65f6\u5019\u8be5\u6682\u505c\u4e00\u4e2a\u6765\u6e90"}</strong>
              <p>
                {
                  "\u5982\u679c\u6700\u8fd1\u8fde\u7eed\u6293\u5230\u805a\u5408\u9875\u3001CTA \u6216\u5bfc\u822a\u566a\u97f3\uff0c\u800c\u4e0d\u662f\u6b63\u6587\u5185\u5bb9\uff0c\u5c31\u5148\u6682\u505c\uff0c\u518d\u56de\u98de\u4e66\u4fee URL \u6216\u6293\u53d6\u7b56\u7565\u3002"
                }
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent runs</p>
              <h2>{"\u6700\u8fd1\u8fd0\u884c\u8bb0\u5f55"}</h2>
            </div>
          </div>
          <div className="ops-list">
            {source.ingestionRuns.length > 0 ? (
              source.ingestionRuns.map((run) => (
                <article className="ops-list-item" key={run.id}>
                  <div className="ops-list-copy">
                    <h3>{formatRunStatus(run.status)}</h3>
                    <p>
                      {"\u5f00\u59cb\u4e8e"} {formatDateLabel(run.startedAt)}
                      {"\uff0c\u627e\u5230"} {run.itemsFound} {"\u6761\uff0c\u53d1\u5e03"} {run.itemsPublished} {"\u6761\u3002"}
                    </p>
                    {run.notes ? <p className="section-note">{run.notes}</p> : null}
                    {run.errorSummary ? <p className="section-note source-error-note">{run.errorSummary}</p> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">{"\u8fd9\u6761\u6765\u6e90\u8fd8\u6ca1\u6709\u6293\u53d6\u8bb0\u5f55\u3002"}</p>
            )}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent candidates</p>
              <h2>{"\u6700\u8fd1\u6293\u5230\u7684\u5185\u5bb9"}</h2>
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
                      {"\u72b6\u6001\uff1a"}
                      {item.status}
                      {" | \u98ce\u9669\uff1a"}
                      {item.riskLevel}
                      {" | \u5165\u5e93\uff1a"}
                      {formatDateLabel(item.createdAt)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="page-intro">{"\u8fd9\u6761\u6765\u6e90\u8fd8\u6ca1\u6709\u6293\u5230\u5019\u9009\u5185\u5bb9\u3002"}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

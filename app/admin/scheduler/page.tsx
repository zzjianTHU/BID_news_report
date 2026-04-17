import { requireAdminSession } from "@/lib/auth";
import {
  installLocalSchedulerAction,
  removeLocalSchedulerAction,
  runWorkerTaskAction,
  saveSchedulerConfigAction
} from "@/lib/actions";
import { getIngestionHealthSnapshot, getSchedulerConfig } from "@/lib/data";
import { getLocalSchedulerTasks } from "@/lib/services/local-scheduler";
import { formatDateLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSchedulerPage() {
  await requireAdminSession();

  const [scheduler, ingestionHealth] = await Promise.all([getSchedulerConfig(), getIngestionHealthSnapshot()]);
  const localTasks = await getLocalSchedulerTasks(scheduler);
  const installedCount = localTasks.filter((task) => task.exists).length;

  return (
    <>
      <section className="admin-section">
        <p className="section-kicker">Scheduler</p>
        <h2>抓取调度</h2>
        <p className="section-note">
          这套机制分成两层：source 自己声明“多久该更新一次”，调度器再按固定频率去轮询“哪些来源已经到期”。前者建议在飞书 source
          表里配，后者在后台里统一管理，并且可以直接联动到本机 Windows 任务计划。
        </p>
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Config</p>
              <h2>轮询节奏配置</h2>
            </div>
          </div>

          <form action={saveSchedulerConfigAction} className="queue-toolbar-grid scheduler-form">
            <label>
              调度器开关
              <select defaultValue={scheduler.enabled ? "true" : "false"} name="enabled">
                <option value="true">启用</option>
                <option value="false">暂停</option>
              </select>
            </label>
            <label>
              抓取轮询间隔（分钟）
              <input defaultValue={scheduler.ingestIntervalMinutes} min={5} name="ingestIntervalMinutes" type="number" />
            </label>
            <label>
              source 同步间隔（分钟）
              <input defaultValue={scheduler.sourceSyncIntervalMinutes} min={5} name="sourceSyncIntervalMinutes" type="number" />
            </label>
            <label>
              control plane 同步间隔（分钟）
              <input
                defaultValue={scheduler.controlPlaneSyncIntervalMinutes}
                min={5}
                name="controlPlaneSyncIntervalMinutes"
                type="number"
              />
            </label>
            <label>
              draft 决策同步间隔（分钟）
              <input defaultValue={scheduler.draftSyncIntervalMinutes} min={5} name="draftSyncIntervalMinutes" type="number" />
            </label>
            <label>
              digest 建议生成小时（0-23）
              <input defaultValue={scheduler.digestGenerationHour} max={23} min={0} name="digestGenerationHour" type="number" />
            </label>
            <label className="scheduler-notes">
              备注
              <textarea defaultValue={scheduler.notes ?? ""} name="notes" rows={4} />
            </label>
            <div className="admin-inline-actions">
              <button className="button button-primary compact" type="submit">
                保存调度配置
              </button>
            </div>
          </form>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Run status</p>
              <h2>最近执行状态</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>最近抓取轮询</strong>
              <p>{scheduler.lastIngestRunAt ? formatDateLabel(scheduler.lastIngestRunAt) : "还没有记录"}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近 source 同步</strong>
              <p>{scheduler.lastSourceSyncAt ? formatDateLabel(scheduler.lastSourceSyncAt) : "还没有记录"}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近 control plane 同步</strong>
              <p>{scheduler.lastControlPlaneSyncAt ? formatDateLabel(scheduler.lastControlPlaneSyncAt) : "还没有记录"}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近 draft 同步</strong>
              <p>{scheduler.lastDraftSyncAt ? formatDateLabel(scheduler.lastDraftSyncAt) : "还没有记录"}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最近 digest 生成</strong>
              <p>{scheduler.lastDigestRunAt ? formatDateLabel(scheduler.lastDigestRunAt) : "还没有记录"}</p>
            </div>
            <div className="ops-checklist-item">
              <strong>抓取健康度</strong>
              <p>
                成功 {ingestionHealth.successCount} 次，失败 {ingestionHealth.failedCount} 次；最近一轮：
                {ingestionHealth.lastRun
                  ? `${ingestionHealth.lastRun.status} / ${formatDateLabel(ingestionHealth.lastRun.startedAt)}`
                  : "暂无记录"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Local task scheduler</p>
              <h2>本机任务计划联动</h2>
            </div>
            <span className="tag-pill muted">已安装 {installedCount} / {localTasks.length}</span>
          </div>
          <p className="section-note">
            这里会把当前后台里的调度配置写成 Windows 任务计划。保存配置后，再点一次“应用到本机任务计划”，本机定时任务就会按这套节奏执行。
          </p>
          <div className="admin-inline-actions">
            <form action={installLocalSchedulerAction}>
              <button className="button button-primary compact" type="submit">
                应用到本机任务计划
              </button>
            </form>
            <form action={removeLocalSchedulerAction}>
              <button className="button button-light compact" type="submit">
                移除本机任务计划
              </button>
            </form>
          </div>
          <div className="ops-list">
            {localTasks.map((task) => (
              <article className="ops-list-item" key={task.taskName}>
                <div className="ops-list-copy">
                  <p className="section-kicker">{task.label}</p>
                  <h3>{task.schedule}</h3>
                  <p>{task.taskName}</p>
                  <p className="section-note">命令：{task.command}</p>
                </div>
                <div className="ops-list-actions">
                  <span className={`status-pill ${task.exists ? "good" : "warm"}`}>{task.exists ? "已安装" : "未安装"}</span>
                  <span className="tag-pill muted">{task.state ?? "未查询到状态"}</span>
                  <span className="tag-pill muted">
                    下次运行：{task.nextRunTime ? formatDateLabel(new Date(task.nextRunTime)) : "暂无"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recommended setup</p>
              <h2>推荐的管理方式</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>飞书管理 source 的“个体节奏”</strong>
              <p>每个 source 在飞书里声明自己的抓取间隔 `fetchIntervalMinutes`，例如 60、120、180 分钟。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>后台管理全局“轮询节奏”</strong>
              <p>后台里的抓取轮询间隔建议配得比单个来源更密一些，例如每 15 分钟检查一次“谁到期了”。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>两边结合才真正生效</strong>
              <p>source 负责声明“多久该更新一次”，本机任务计划负责按后台配置不断触发轮询；这两层叠在一起，才是完整的自动抓取机制。</p>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Manual actions</p>
              <h2>手动触发</h2>
            </div>
          </div>
          <div className="admin-inline-actions scheduler-action-grid">
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="sync-feishu-sources" />
              <button className="button button-secondary compact" type="submit">
                同步飞书来源
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="sync-feishu-control-plane" />
              <button className="button button-secondary compact" type="submit">
                同步模型与工作流
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="run-ingest-cycle" />
              <button className="button button-primary compact" type="submit">
                立即跑抓取轮询
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="sync-feishu-draft-decisions" />
              <button className="button button-light compact" type="submit">
                同步飞书审核结果
              </button>
            </form>
            <form action={runWorkerTaskAction}>
              <input name="task" type="hidden" value="generate-digest" />
              <button className="button button-light compact" type="submit">
                立即生成 digest
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}

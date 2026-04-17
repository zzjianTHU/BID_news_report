"use client";

import { CandidateStatus, RiskLevel, type CandidateItem, type Source } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { bulkReviewCandidatesAction } from "@/lib/actions";
import { formatBilingualTitle, formatDateLabel, parseTags, readTranslatedTitle, translateTag } from "@/lib/utils";

type QueueItem = CandidateItem & {
  source: Source;
};

type ReviewQueueConsoleProps = {
  items: QueueItem[];
};

type GroupMode = "none" | "status" | "source" | "risk";

type ToastState = {
  tone: "good" | "danger";
  message: string;
} | null;

const STATUS_OPTIONS = [
  { value: "ALL", label: "全部状态" },
  { value: CandidateStatus.REVIEW, label: "待审核" },
  { value: CandidateStatus.INGESTED, label: "刚入队" },
  { value: CandidateStatus.PUBLISHED, label: "已发布" },
  { value: CandidateStatus.REJECTED, label: "已拒绝" }
] as const;

const RISK_OPTIONS = [
  { value: "ALL", label: "全部风险" },
  { value: RiskLevel.LOW, label: "低风险" },
  { value: RiskLevel.HIGH, label: "高风险" }
] as const;

const GROUP_OPTIONS = [
  { value: "none", label: "不分组" },
  { value: "status", label: "按状态分组" },
  { value: "source", label: "按来源分组" },
  { value: "risk", label: "按风险分组" }
] as const;

function statusLabel(status: CandidateStatus) {
  switch (status) {
    case CandidateStatus.REVIEW:
      return "待审核";
    case CandidateStatus.INGESTED:
      return "刚入队";
    case CandidateStatus.PUBLISHED:
      return "已发布";
    case CandidateStatus.REJECTED:
      return "已拒绝";
    default:
      return status;
  }
}

function riskLabel(riskLevel: RiskLevel) {
  return riskLevel === RiskLevel.HIGH ? "高风险" : "低风险";
}

function riskTone(riskLevel: RiskLevel) {
  return riskLevel === RiskLevel.HIGH ? "danger" : "good";
}

function formatPercentScore(value: number) {
  if (value > 1) {
    return Math.round(value);
  }

  return Math.round(value * 100);
}

function buildGroupLabel(mode: GroupMode, item: QueueItem) {
  if (mode === "status") {
    return statusLabel(item.status);
  }

  if (mode === "source") {
    return item.source.name;
  }

  if (mode === "risk") {
    return riskLabel(item.riskLevel);
  }

  return "全部候选";
}

export function ReviewQueueConsole({ items }: ReviewQueueConsoleProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>(CandidateStatus.REVIEW);
  const [risk, setRisk] = useState<(typeof RISK_OPTIONS)[number]["value"]>("ALL");
  const [groupMode, setGroupMode] = useState<GroupMode>("status");
  const [sourceName, setSourceName] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceOptions = [
    "ALL",
    ...Array.from(new Set(items.map((item) => item.source.name))).sort((a, b) => a.localeCompare(b))
  ];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.aiSummary.toLowerCase().includes(normalizedQuery) ||
        item.source.name.toLowerCase().includes(normalizedQuery);

      const matchesStatus = status === "ALL" || item.status === status;
      const matchesRisk = risk === "ALL" || item.riskLevel === risk;
      const matchesSource = sourceName === "ALL" || item.source.name === sourceName;

      return matchesQuery && matchesStatus && matchesRisk && matchesSource;
    });
  }, [items, query, risk, sourceName, status]);

  const groupedItems = useMemo(() => {
    if (groupMode === "none") {
      return [{ label: "全部候选", items: filteredItems }];
    }

    const groups = new Map<string, QueueItem[]>();
    for (const item of filteredItems) {
      const key = buildGroupLabel(groupMode, item);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return Array.from(groups.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems
    }));
  }, [filteredItems, groupMode]);

  const visibleSelectedIds = filteredItems.map((item) => item.id).filter((id) => selectedIds.includes(id));
  const allVisibleSelected = filteredItems.length > 0 && visibleSelectedIds.length === filteredItems.length;

  function toggleCandidate(candidateId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, candidateId])) : current.filter((itemId) => itemId !== candidateId)
    );
  }

  function toggleVisible(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...filteredItems.map((item) => item.id)])));
      return;
    }

    setSelectedIds((current) => current.filter((candidateId) => !filteredItems.some((item) => item.id === candidateId)));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function submitDecision(candidateIds: string[], decision: "publish" | "reject") {
    if (candidateIds.length === 0) {
      setToast({ tone: "danger", message: "请先选择至少一条候选内容。" });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    const formData = new FormData();
    for (const candidateId of candidateIds) {
      formData.append("candidateIds", candidateId);
    }
    formData.set("decision", decision);

    try {
      const result = await bulkReviewCandidatesAction(formData);
      if (!result?.ok) {
        setToast({ tone: "danger", message: "这次操作没有成功执行，请稍后再试。" });
        return;
      }

      setToast({
        tone: "good",
        message: `${decision === "publish" ? "已发布" : "已拒绝"} ${result.count} 条内容，列表和首页会自动刷新。`
      });

      setSelectedIds((current) => current.filter((id) => !candidateIds.includes(id)));
    } catch (error) {
      console.error(error);
      setToast({ tone: "danger", message: "操作失败了，可能是网络或服务端异常。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const reviewCount = items.filter((item) => item.status === CandidateStatus.REVIEW).length;
  const publishedCount = items.filter((item) => item.status === CandidateStatus.PUBLISHED).length;
  const rejectedCount = items.filter((item) => item.status === CandidateStatus.REJECTED).length;
  const highRiskCount = items.filter((item) => item.riskLevel === RiskLevel.HIGH).length;

  return (
    <section className="queue-console">
      <div className="admin-metric-grid queue-metric-grid">
        <article className="admin-metric-card">
          <p>总候选数</p>
          <strong>{items.length}</strong>
        </article>
        <article className="admin-metric-card">
          <p>待审核</p>
          <strong>{reviewCount}</strong>
        </article>
        <article className="admin-metric-card">
          <p>高风险</p>
          <strong>{highRiskCount}</strong>
        </article>
        <article className="admin-metric-card">
          <p>已发布</p>
          <strong>{publishedCount}</strong>
        </article>
        <article className="admin-metric-card">
          <p>当前选中</p>
          <strong>{selectedIds.length}</strong>
        </article>
      </div>

      <section className="panel-card queue-toolbar">
        <div className="queue-toolbar-grid">
          <label>
            搜索标题、摘要或来源
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如 Meta、Copilot、基础设施"
              type="search"
              value={query}
            />
          </label>
          <label>
            状态
            <select onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number]["value"])} value={status}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            风险
            <select onChange={(event) => setRisk(event.target.value as (typeof RISK_OPTIONS)[number]["value"])} value={risk}>
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            来源
            <select onChange={(event) => setSourceName(event.target.value)} value={sourceName}>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "全部来源" : option}
                </option>
              ))}
            </select>
          </label>
          <label>
            分组视图
            <select onChange={(event) => setGroupMode(event.target.value as GroupMode)} value={groupMode}>
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="queue-toolbar-footer">
          <div className="queue-toolbar-selection">
            <label className="queue-select-all">
              <input checked={allVisibleSelected} onChange={(event) => toggleVisible(event.target.checked)} type="checkbox" />
              <span>选中当前筛选结果</span>
            </label>
            <button className="button button-light compact" onClick={clearSelection} type="button">
              清空选中
            </button>
          </div>
          <span className="tag-pill muted">筛选后共 {filteredItems.length} 条</span>
        </div>
      </section>

      <section className="panel-card queue-bulk-panel">
        <div>
          <p className="section-kicker">Bulk actions</p>
          <h3>批量审核入口</h3>
          <p className="section-note">先勾选候选内容，再统一发布或拒绝。操作成功后会在这里给你即时反馈。</p>
        </div>
        <div className="queue-bulk-actions">
          <button
            className="button button-primary compact"
            disabled={isSubmitting || selectedIds.length === 0}
            onClick={() => submitDecision(selectedIds, "publish")}
            type="button"
          >
            {isSubmitting ? "处理中..." : "批量发布"}
          </button>
          <button
            className="button button-secondary compact"
            disabled={isSubmitting || selectedIds.length === 0}
            onClick={() => submitDecision(selectedIds, "reject")}
            type="button"
          >
            {isSubmitting ? "处理中..." : "批量拒绝"}
          </button>
          <span className="tag-pill muted">已拒绝总数 {rejectedCount}</span>
        </div>
        {toast ? <p className={`feedback ${toast.tone}`}>{toast.message}</p> : null}
      </section>

      {groupedItems.length > 0 ? (
        groupedItems.map((group) => (
          <section className="queue-group" key={group.label}>
            {groupMode !== "none" ? (
              <div className="queue-group-header">
                <div>
                  <p className="section-kicker">Group</p>
                  <h3>{group.label}</h3>
                </div>
                <span className="tag-pill muted">{group.items.length} 条</span>
              </div>
            ) : null}

            <div className="review-queue-list">
              {group.items.map((item) => {
                const tags = parseTags(item.tags);
                const displayTitle = formatBilingualTitle(item.title, readTranslatedTitle(item.structuredJson));

                return (
                  <article className={`approval-sheet ${item.riskLevel === RiskLevel.HIGH ? "risk-high" : "risk-low"}`} key={item.id}>
                    <div className="approval-header">
                      <div className="approval-title-row">
                        <label className="queue-checkbox">
                          <input
                            checked={selectedIds.includes(item.id)}
                            onChange={(event) => toggleCandidate(item.id, event.target.checked)}
                            type="checkbox"
                          />
                        </label>
                        <div>
                          <p className="section-kicker">{item.source.name}</p>
                          <h3>{displayTitle}</h3>
                        </div>
                      </div>
                      <div className="approval-status-stack">
                        <span className={`status-pill ${riskTone(item.riskLevel)}`}>{riskLabel(item.riskLevel)}</span>
                        <span className="tag-pill muted">{statusLabel(item.status)}</span>
                      </div>
                    </div>

                    <p className="approval-excerpt">{item.aiSummary}</p>
                    <p className="feed-insight">为什么值得看：{item.worthReading}</p>

                    <div className="inline-tags">
                      {tags.map((tag) => (
                        <span className="tag-pill" key={tag}>
                          {translateTag(tag)}
                        </span>
                      ))}
                    </div>

                    <div className="queue-meta-row">
                      <span>质量分：{formatPercentScore(item.qualityScore || 0)} / 100</span>
                      <span>置信度：{formatPercentScore(item.aiConfidence || 0)}%</span>
                      <span>入库时间：{formatDateLabel(item.createdAt)}</span>
                    </div>

                    <div className="approval-actions">
                      <Link className="button button-light compact" href={`/preview/candidate/${item.id}`}>
                        站内预览
                      </Link>
                      <Link className="button button-light compact" href={item.normalizedUrl} rel="noreferrer" target="_blank">
                        原文链接
                      </Link>
                      <button
                        className="button button-primary compact"
                        disabled={isSubmitting}
                        onClick={() => submitDecision([item.id], "publish")}
                        type="button"
                      >
                        发布
                      </button>
                      <button
                        className="button button-secondary compact"
                        disabled={isSubmitting}
                        onClick={() => submitDecision([item.id], "reject")}
                        type="button"
                      >
                        拒绝
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state">当前筛选条件下没有内容。你可以放宽搜索词、状态或来源筛选后再看。</div>
      )}
    </section>
  );
}

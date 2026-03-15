import type { DashboardSnapshot } from "@/lib/types";

type CompactStatusPanelProps = {
  snapshot: DashboardSnapshot;
};

export function CompactStatusPanel({ snapshot }: CompactStatusPanelProps) {
  const items = [
    { label: "自动发布", value: snapshot.publishedCount },
    { label: "待审核", value: snapshot.reviewCount },
    { label: "在线源", value: snapshot.activeSourceCount },
    { label: "订阅数", value: snapshot.subscriberCount },
    { label: "低风险直发率", value: `${snapshot.lowRiskAutoPublishRate}%` }
  ];

  return (
    <div className="admin-metric-grid">
      {items.map((item) => (
        <article className="admin-metric-card" key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

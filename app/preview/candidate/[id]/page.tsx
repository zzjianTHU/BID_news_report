import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCandidatePreview } from "@/lib/data";
import { formatDateLabel, parseTags } from "@/lib/utils";

type CandidatePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CandidatePreviewPage({ params }: CandidatePreviewPageProps) {
  const { id } = await params;
  const candidate = await getCandidatePreview(id);

  if (!candidate) {
    notFound();
  }

  const tags = parseTags(candidate.tags);

  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <section className="section-block">
          <p className="section-kicker">Candidate preview</p>
          <h1 className="page-title">{candidate.title}</h1>
          <p className="page-intro">{candidate.aiSummary}</p>
        </section>

        <section className="split-section">
          <article className="split-card">
            <div className="inline-tags">
              {tags.slice(0, 4).map((tag) => (
                <span className="tag-pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="feed-insight">为什么值得看：{candidate.worthReading}</p>
            <p>{candidate.excerpt}</p>
            <p>{candidate.rawContent}</p>

            <div className="feed-meta">
              <span>{candidate.source.name}</span>
              <span>{candidate.riskLevel}</span>
              <span>{candidate.status}</span>
              <span>{formatDateLabel(candidate.createdAt)}</span>
            </div>
          </article>

          <article className="split-card accent">
            <p className="section-kicker">Workflow status</p>
            <h2>
              {candidate.status === "PUBLISHED"
                ? "这条内容已经对外可见"
                : "这条内容正等待飞书审批"}
            </h2>
            <p>
              来源为 <strong>{candidate.source.name}</strong>。如果这条内容已发布，公开站首页和 digest 任务都会在后续轮次里自动读取它。
            </p>
            <div className="archive-actions">
              <Link className="button button-secondary" href={candidate.normalizedUrl} target="_blank">
                查看原文
              </Link>
              <Link className="button button-primary" href="/">
                返回首页
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

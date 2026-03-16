import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SubscribeCTA } from "@/components/subscribe-cta";
import { getThoughtBySlug } from "@/lib/data";
import { formatLongDate } from "@/lib/utils";

type ThoughtDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ThoughtDetailPage({ params }: ThoughtDetailPageProps) {
  const { slug } = await params;
  const thought = await getThoughtBySlug(slug);

  if (!thought) {
    notFound();
  }

  return (
    <main className="page-shell">
      <SiteHeader />
      <article className="article-shell">
        <Link className="mini-link dark" href="/thoughts">
          Back to thoughts
        </Link>
        <p className="section-kicker">专题 / 思考</p>
        <h1 className="article-title">{thought.title}</h1>
        <div className="article-meta">
          <span>{thought.authorName}</span>
          <span>{formatLongDate(thought.publishedAt ?? thought.createdAt)}</span>
        </div>
        <div className="article-body">
          {thought.body.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <SubscribeCTA compact />
      </article>
    </main>
  );
}

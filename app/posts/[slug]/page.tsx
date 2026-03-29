import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PostBackButton } from "@/components/post-back-button";
import { SiteHeader } from "@/components/site-header";
import { SubscribeCTA } from "@/components/subscribe-cta";
import { getPostBySlug } from "@/lib/data";
import { formatLongDate, parseTags } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PublicPostPageProps = {
  params: Promise<{ slug: string }>;
};

function readTldr(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export default async function PublicPostPage({ params }: PublicPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const tags = parseTags(post.tags);
  const tldr = readTldr(post.tldr);
  const coverLabel = post.candidateItem.coverImageAlt || post.title;
  const markdown = post.bodyMarkdown || post.body;

  return (
    <main className="page-shell">
      <SiteHeader />
      <article className="article-shell">
        <PostBackButton fallbackHref="/" label="Back to feed" />

        {post.candidateItem.coverImageUrl ? (
          <div
            aria-label={coverLabel}
            className="candidate-cover-shell article-cover-shell"
            role="img"
            style={{ backgroundImage: `url(${post.candidateItem.coverImageUrl})` }}
          />
        ) : null}

        <p className="section-kicker">Brief</p>
        <h1 className="article-title">{post.title}</h1>
        <p className="page-intro article-intro">{post.summary}</p>

        <div className="inline-tags article-tag-row">
          {tags.slice(0, 4).map((tag) => (
            <span className="tag-pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="article-meta">
          <span>{post.sourceLabel}</span>
          <span>{formatLongDate(post.publishedAt ?? post.createdAt)}</span>
          <Link className="text-link" href={post.sourceUrl} target="_blank">
            查看原文
          </Link>
        </div>

        {tldr.length > 0 ? (
          <section className="article-tldr">
            <p className="section-kicker">TL;DR</p>
            <ul className="flow-list">
              {tldr.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="article-body markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>

        <section className="article-sources">
          <p className="section-kicker">Source</p>
          <div className="archive-actions">
            <Link className="button button-secondary" href={post.sourceUrl} target="_blank">
              查看原文
            </Link>
            <PostBackButton fallbackHref="/" label="返回上一页" />
          </div>
        </section>

        <SubscribeCTA compact />
      </article>
    </main>
  );
}

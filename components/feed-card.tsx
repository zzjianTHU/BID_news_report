import Link from "next/link";

import type { FeedPost } from "@/lib/types";
import { formatBilingualTitle, formatDateLabel, parseTags, readTranslatedTitle, translateTag } from "@/lib/utils";

type FeedCardProps = {
  post: FeedPost;
  compact?: boolean;
};

export function FeedCard({ post, compact = false }: FeedCardProps) {
  const tags = parseTags(post.tags);
  const translatedTitle = readTranslatedTitle(post.candidateItem.structuredJson);
  const displayTitle = formatBilingualTitle(post.title, translatedTitle);
  const coverImageUrl = post.candidateItem.coverImageUrl;
  const coverImageAlt = post.candidateItem.coverImageAlt || displayTitle;
  const postHref = post.slug ? `/posts/${post.slug}` : post.sourceUrl;

  return (
    <article className={`feed-card ${compact ? "feed-card-compact" : ""}`}>
      <div className="feed-card-copy">
        <div className="inline-tags">
          {tags.slice(0, 3).map((tag) => (
            <span className="tag-pill" key={tag}>
              {translateTag(tag)}
            </span>
          ))}
        </div>
        <h3>
          <Link className="feed-card-link" href={postHref}>
            {displayTitle}
          </Link>
        </h3>
        <p className="feed-summary">{post.summary}</p>
        <p className="feed-insight">为什么值得看：{post.worthReading}</p>
        <div className="feed-meta">
          <span>{formatDateLabel(post.publishedAt ?? post.createdAt)}</span>
          <span>{post.sourceLabel}</span>
        </div>
      </div>
      <div className="feed-card-side">
        <div
          aria-label={coverImageAlt}
          className="feed-thumb"
          role={coverImageUrl ? "img" : undefined}
          style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : undefined}
        >
          {!coverImageUrl ? <span>{translateTag(tags[0] ?? "AI")}</span> : null}
        </div>
        <Link className="text-link" href={postHref}>
          阅读摘要
        </Link>
      </div>
    </article>
  );
}

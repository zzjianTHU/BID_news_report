import Link from "next/link";

import type { FeedPost } from "@/lib/types";
import { formatDateLabel, parseTags } from "@/lib/utils";

type FeedCardProps = {
  post: FeedPost;
  compact?: boolean;
};

export function FeedCard({ post, compact = false }: FeedCardProps) {
  const tags = parseTags(post.tags);

  return (
    <article className={`feed-card ${compact ? "feed-card-compact" : ""}`}>
      <div className="feed-card-copy">
        <div className="inline-tags">
          {tags.slice(0, 3).map((tag) => (
            <span className="tag-pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <h3>{post.title}</h3>
        <p className="feed-summary">{post.summary}</p>
        <p className="feed-insight">为什么值得看：{post.worthReading}</p>
        <div className="feed-meta">
          <span>{formatDateLabel(post.publishedAt ?? post.createdAt)}</span>
          <span>{post.sourceLabel}</span>
        </div>
      </div>
      <div className="feed-card-side">
        <div className="feed-thumb">
          <span>{tags[0] ?? "AI"}</span>
        </div>
        <Link className="text-link" href={post.sourceUrl} target="_blank">
          Read source
        </Link>
      </div>
    </article>
  );
}

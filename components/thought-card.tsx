import Link from "next/link";
import type { ThoughtPost } from "@prisma/client";

import { formatDateLabel } from "@/lib/utils";

type ThoughtCardProps = {
  post: ThoughtPost;
};

export function ThoughtCard({ post }: ThoughtCardProps) {
  return (
    <article className="thought-card">
      <div className="thought-card-copy">
        <p className="section-kicker">专题 / 思考</p>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <div className="feed-meta">
          <span>{formatDateLabel(post.publishedAt ?? post.createdAt)}</span>
          <span>{post.authorName}</span>
        </div>
      </div>
      <Link className="button button-secondary" href={`/thoughts/${post.slug}`}>
        Read note
      </Link>
    </article>
  );
}

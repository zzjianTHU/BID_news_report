import Link from "next/link";

import { DigestCard } from "@/components/digest-card";
import { FeedCard } from "@/components/feed-card";
import { FilterDrawer } from "@/components/filter-drawer";
import { SiteHeader } from "@/components/site-header";

import { SubscribeCTA } from "@/components/subscribe-cta";
import { ThoughtCard } from "@/components/thought-card";
import { getFeedPosts, getLatestDigest, getPublishedThoughts } from "@/lib/data";

type HomePageProps = {
  searchParams: Promise<{
    tag?: string;
    window?: "24h" | "7d";
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const tag = resolvedSearchParams.tag ?? "all";
  const window = resolvedSearchParams.window ?? "24h";

  const latestDigest = await getLatestDigest();
  const feedPosts = await getFeedPosts(tag, window);
  const thoughts = await getPublishedThoughts();

  return (
    <main className="page-shell">
      <SiteHeader />

      <div className="page-body">
        {latestDigest ? (
          <DigestCard digest={latestDigest} view="3" />
        ) : (
          <section className="digest-hero-card">
            <p className="section-kicker">Latest digest</p>
            <h1>自动 digest 正在准备中</h1>
            <p className="digest-hero-summary">最新一版还在整理中，稍后会在这里更新。</p>
          </section>
        )}

        <section className="section-block">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent posts</p>
              <h2>最新情报</h2>
            </div>
            <div className="section-actions">
              <FilterDrawer currentTag={tag} currentWindow={window} />
            </div>
          </div>

          <div className="feed-list">
            {feedPosts.length > 0 ? (
              feedPosts.map((post) => (
                <FeedCard key={post.id} post={post} />
              ))
            ) : (
              <article className="split-card">
                <p className="section-kicker">Nothing here yet</p>
                <h3>新的情报还在整理中</h3>
                <p className="page-intro">稍后回来，这里会出现今天最值得读的更新。</p>
              </article>
            )}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Notes</p>
              <h2>专题 / 思考</h2>
            </div>
            <Link className="mini-link dark" href="/thoughts">
              View all
            </Link>
          </div>
          <div className="thought-grid">
            {thoughts.map((post) => (
              <ThoughtCard key={post.id} post={post} />
            ))}
          </div>
        </section>

        <SubscribeCTA />
      </div>
    </main>
  );
}

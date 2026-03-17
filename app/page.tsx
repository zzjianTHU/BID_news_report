import Link from "next/link";

import { DigestCard } from "@/components/digest-card";
import { FeedCard } from "@/components/feed-card";
import { FilterDrawer } from "@/components/filter-drawer";
import { SiteHeader } from "@/components/site-header";

import { SubscribeCTA } from "@/components/subscribe-cta";
import { ThoughtCard } from "@/components/thought-card";
import { getFeedPosts, getLatestDigest, getPublishedThoughts, getSiteSnapshot } from "@/lib/data";

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

  const [snapshot, latestDigest, feedPosts, thoughts] = await Promise.all([
    getSiteSnapshot(),
    getLatestDigest(),
    getFeedPosts(tag, window),
    getPublishedThoughts()
  ]);

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
            <p className="digest-hero-summary">先配置数据源并运行自动化脚本，首页就会出现最新大卡片。</p>
          </section>
        )}



        <section className="stats-strip">
          <article>
            <p>自动发布</p>
            <strong>{snapshot.publishedCount}</strong>
          </article>
          <article>
            <p>待飞书审批</p>
            <strong>{snapshot.reviewCount}</strong>
          </article>
          <article>
            <p>在线源</p>
            <strong>{snapshot.activeSourceCount}</strong>
          </article>
          <article>
            <p>订阅中</p>
            <strong>{snapshot.subscriberCount}</strong>
          </article>
        </section>

        <section className="section-block">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent posts</p>
              <h2>自动主情报流</h2>
            </div>
            <div className="section-actions">
              <FilterDrawer currentTag={tag} currentWindow={window} />
            </div>
          </div>

          <div className="feed-list">
            {feedPosts.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </section>

        <section className="split-section">
          <div className="split-card">
            <p className="section-kicker">How it works</p>
            <h2>自动化主链路</h2>
            <ol className="flow-list">
              <li>抓取数据源并标准化入库</li>
              <li>AI 生成标题、摘要和“为什么值得看”</li>
              <li>低风险直发，高风险进入飞书审批</li>
              <li>汇总生成 3 分钟版 / 8 分钟版 digest</li>
              <li>按订阅偏好发送邮件</li>
            </ol>
          </div>
          <div className="split-card accent">
            <p className="section-kicker">Queue health</p>
            <h2>{snapshot.lowRiskAutoPublishRate}% 的已发布内容来自低风险直发</h2>
            <p>编辑团队只需要在飞书里处理不确定、证据链不足或需要机构判断的内容，保持效率和可信度平衡。</p>
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

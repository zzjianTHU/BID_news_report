import Link from "next/link";

import { CompactStatusPanel } from "@/components/admin/compact-status-panel";
import { ReviewQueueList } from "@/components/admin/review-queue-list";
import { requireAdminSession } from "@/lib/auth";
import {
  getLatestDigest,
  getQueueItems,
  getRecentPublishedPosts,
  getSiteSnapshot,
  getSourceAlerts,
  getSources
} from "@/lib/data";
import { formatDateLabel, readTranslatedTitle } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildFeishuShortcut() {
  if (!process.env.FEISHU_SOURCE_WIKI_TOKEN) {
    return null;
  }

  return `https://feishu.cn/wiki/${process.env.FEISHU_SOURCE_WIKI_TOKEN}`;
}

export default async function AdminDashboardPage() {
  await requireAdminSession();

  const [snapshot, queueItems, sources, latestDigest, recentPosts, sourceAlerts] = await Promise.all([
    getSiteSnapshot(),
    getQueueItems(),
    getSources(),
    getLatestDigest(),
    getRecentPublishedPosts(6),
    getSourceAlerts(6)
  ]);

  const reviewItems = queueItems.slice(0, 4);
  const enabledSources = sources.filter((source) => source.enabled);
  const pausedSources = sources.filter((source) => !source.enabled);
  const digestThreeCount = latestDigest?.entries.filter((entry) => entry.duration === "THREE").length ?? 0;
  const digestEightCount = latestDigest?.entries.filter((entry) => entry.duration === "EIGHT").length ?? 0;
  const feishuShortcut = buildFeishuShortcut();

  return (
    <>
      <section className="admin-section">
        <p className="section-kicker">Dashboard 2.0</p>
        <h2>后台首页 / 数据看板</h2>
        <p className="section-note">这里把站内审核、发布进度、digest 状态和来源异常收拢到一起，方便你每天先在这里看全局，再进入具体列表处理。</p>
        <CompactStatusPanel snapshot={snapshot} />
      </section>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <p className="section-kicker">Digest status</p>
          <h2>Digest 状态卡片</h2>
          {latestDigest ? (
            <div className="ops-checklist">
              <div className="ops-checklist-item">
                <strong>{latestDigest.title}</strong>
                <p>{latestDigest.summary}</p>
              </div>
              <div className="ops-checklist-item">
                <strong>今日摘要结构</strong>
                <p>3 分钟版 {digestThreeCount} 条，8 分钟版 {digestEightCount} 条。</p>
              </div>
              <div className="ops-checklist-item">
                <strong>快捷入口</strong>
                <p>
                  <Link className="mini-link dark" href={`/digest/${latestDigest.date}?view=3`}>
                    查看 3 分钟版
                  </Link>
                </p>
                <p>
                  <Link className="mini-link dark" href={`/digest/${latestDigest.date}?view=8`}>
                    查看 8 分钟版
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <p className="page-intro">当前还没有 digest，可以先继续审核并发布更多内容。</p>
          )}
        </section>

        <section className="admin-section panel-card">
          <p className="section-kicker">Shortcuts</p>
          <h2>飞书快捷入口</h2>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>审核队列</strong>
              <p>
                <Link className="mini-link dark" href="/admin/queue">
                  进入站内审核工作台
                </Link>
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>运营看板</strong>
              <p>
                <Link className="mini-link dark" href="/ops">
                  打开站内运营看板
                </Link>
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>来源管理</strong>
              <p>
                <Link className="mini-link dark" href="/admin/sources">
                  查看来源卡片与最近抓取表现
                </Link>
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>抓取调度</strong>
              <p>
                <Link className="mini-link dark" href="/admin/scheduler">
                  配置轮询节奏并手动触发 worker
                </Link>
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>飞书后台</strong>
              <p>
                {feishuShortcut ? (
                  <a className="mini-link dark" href={feishuShortcut} rel="noreferrer" target="_blank">
                    打开飞书 Wiki / 多维表格
                  </a>
                ) : (
                  "当前还没有配置飞书直达链接，但飞书审批链路本身是可用的。"
                )}
              </p>
            </div>
            <div className="ops-checklist-item">
              <strong>前台展示说明</strong>
              <p>首页面向读者时不会展示“为什么 24 小时为空”或“source 从哪来”这类运营提示；这些说明已经收回后台，避免影响读者阅读体验。</p>
            </div>
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent published</p>
              <h2>最近发布</h2>
            </div>
            <Link className="mini-link dark" href="/archive">
              查看归档
            </Link>
          </div>
          <div className="ops-list">
            {recentPosts.length > 0 ? (
              recentPosts.map((post) => {
                const translatedTitle = readTranslatedTitle(post.candidateItem?.structuredJson);
                const displayTitle = translatedTitle ? `${translatedTitle}（${post.title}）` : post.title;

                return (
                  <article className="ops-list-item" key={post.id}>
                    <div className="ops-list-copy">
                      <p className="section-kicker">{post.sourceLabel}</p>
                      <h3>{displayTitle}</h3>
                      <p>{post.summary}</p>
                    </div>
                    <div className="ops-list-actions">
                      <span className="tag-pill muted">{post.publishedAt ? formatDateLabel(post.publishedAt) : "待发布时间"}</span>
                      {post.slug ? (
                        <Link className="mini-link dark" href={`/posts/${post.slug}`}>
                          查看文章
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="page-intro">当前还没有最近发布内容。</p>
            )}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Source alerts</p>
              <h2>Source 异常</h2>
            </div>
            <span className="tag-pill muted">启用 {enabledSources.length} / 暂停 {pausedSources.length}</span>
          </div>
          <div className="ops-list">
            {sourceAlerts.length > 0 ? (
              sourceAlerts.map((source) => (
                <article className="ops-list-item" key={source.id}>
                  <div className="ops-list-copy">
                    <h3>{source.name}</h3>
                    <p>{source.lastError || `最近失败 ${source.failureCount} 次，建议回飞书检查 URL、类型或抓取策略。`}</p>
                  </div>
                  <div className="ops-list-actions">
                    <span className="status-pill danger">异常 {source.failureCount}</span>
                    <span className="tag-pill muted">{source.enabled ? "仍在启用" : "已暂停"}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="ops-checklist">
                <div className="ops-checklist-item">
                  <strong>当前没有明显 source 异常</strong>
                  <p>启用中的来源近期没有连续失败或错误摘要，说明抓取链路当前比较稳定。</p>
                </div>
                <div className="ops-checklist-item">
                  <strong>仍建议观察的来源</strong>
                  <p>{pausedSources.length > 0 ? pausedSources.map((source) => source.name).join("、") : "当前没有暂停来源。"}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Source map</p>
              <h2>当前启用的信息来源</h2>
            </div>
            <span className="tag-pill muted">{enabledSources.length} 个启用中</span>
          </div>
          <p className="section-note">这些来源只在后台说明里展示，用来帮助你判断抓取范围和每日更新节奏，不再放在给读者看的首页。</p>
          <div className="inline-tags">
            {enabledSources.map((source) => (
              <span className="tag-pill" key={source.id}>
                {source.name}
              </span>
            ))}
          </div>
        </section>

        <section className="admin-section panel-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Display logic</p>
              <h2>前台展示逻辑</h2>
            </div>
          </div>
          <div className="ops-checklist">
            <div className="ops-checklist-item">
              <strong>首页只展示读者该看到的内容</strong>
              <p>运营提示、来源说明、时间窗口解释都收在后台，不在前台打断阅读。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>最新情报优先取 24 小时内容</strong>
              <p>如果 24 小时内没有已发布文章，首页会静默回退到近 7 天内容，但不会把这层机制直接写给读者看。</p>
            </div>
            <div className="ops-checklist-item">
              <strong>上线条件</strong>
              <p>只有通过审核并进入 PUBLISHED 的文章，才会进入首页、归档和 digest。</p>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-section">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Review queue</p>
            <h2>待审内容预览</h2>
          </div>
          <Link className="mini-link dark" href="/admin/queue">
            查看全部
          </Link>
        </div>
        <ReviewQueueList items={reviewItems} />
      </section>
    </>
  );
}

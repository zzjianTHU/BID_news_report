import { SiteHeader } from "@/components/site-header";
import { SubscribeCTA } from "@/components/subscribe-cta";

export default function AboutPage() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <section className="section-block">
          <p className="section-kicker">About</p>
          <h1 className="page-title">这不是传统内容站，而是一套轻量情报自动化系统。</h1>
          <p className="page-intro">
            产品主体是 AI 驱动的采集、处理、摘要、分流和分发能力。前台只承载最值得看的信息，后台负责配置工作流和做最后一层判断。
          </p>
        </section>

        <section className="split-section">
          <div className="split-card">
            <p className="section-kicker">Method</p>
            <h2>系统负责初稿，人负责判断</h2>
            <ol className="flow-list">
              <li>定时抓取 RSS 和网页列表</li>
              <li>去重、打标签、抽取元信息</li>
              <li>AI 生成标题、摘要与价值判断</li>
              <li>低风险直发，高风险审核</li>
              <li>自动汇总 digest 和邮件任务</li>
            </ol>
          </div>
          <div className="split-card accent">
            <p className="section-kicker">Editorial principle</p>
            <h2>自动化不是替代机构判断，而是压缩整理成本。</h2>
            <p>系统帮助团队更快进入“今天什么值得发、什么不应该发、什么值得写成长文”的判断状态。</p>
          </div>
        </section>

        <SubscribeCTA />
      </div>
    </main>
  );
}

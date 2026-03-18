import { SiteHeader } from "@/components/site-header";
import { SubscribeCTA } from "@/components/subscribe-cta";

export default function AboutPage() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <section className="section-block">
          <p className="section-kicker">About</p>
          <h1 className="page-title">我们每天筛出真正值得读的 AI 变化。</h1>
          <p className="page-intro">
            这里关注的不只是“又发了什么”，而是哪些模型、产品、基础设施和企业落地变化，真的值得你花时间跟进。
          </p>
        </section>

        <section className="split-section">
          <div className="split-card">
            <p className="section-kicker">Coverage</p>
            <h2>我们重点看这几类变化</h2>
            <ol className="flow-list">
              <li>模型能力与产品路线更新</li>
              <li>AI Infra 与平台生态变化</li>
              <li>企业采用、组织动作与真实案例</li>
              <li>值得延伸成专题的长期信号</li>
            </ol>
          </div>
          <div className="split-card accent">
            <p className="section-kicker">Editorial principle</p>
            <h2>先帮你快速知道发生了什么，再说明为什么值得看。</h2>
            <p>每条内容都会尽量压缩成可快速浏览的摘要，同时保留原始出处，方便你继续深读和判断。</p>
          </div>
        </section>

        <SubscribeCTA />
      </div>
    </main>
  );
}

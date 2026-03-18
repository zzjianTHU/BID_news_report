import { subscribeAction } from "@/lib/actions";

import { SiteHeader } from "@/components/site-header";

type SubscribePageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const resolvedSearchParams = await searchParams;
  const success = resolvedSearchParams.success === "1";
  const error = resolvedSearchParams.error === "1";

  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <section className="subscribe-page">
          <div className="subscribe-panel">
            <p className="section-kicker">Subscribe</p>
            <h1 className="page-title">把每天值得读的 AI 情报直接发到邮箱。</h1>
            <p className="page-intro">
              先选关注范围、默认 digest 时长和推送频率。我们会尽量把重要更新压缩成更容易消费的日常阅读流。
            </p>
            <ul className="flow-list">
              <li>主情报流：当天最值得跟进的更新</li>
              <li>3 分钟 / 8 分钟 digest：适应不同阅读时长</li>
              <li>专题 / 思考：不定期发送结构化判断</li>
            </ul>
          </div>

          <form action={subscribeAction} className="subscribe-form-panel">
            <label>
              邮箱
              <input name="email" placeholder="name@example.com" required type="email" />
            </label>
            <label>
              称呼
              <input name="name" placeholder="可选" type="text" />
            </label>
            <label>
              关注内容
              <select defaultValue="主情报流" name="interest">
                <option value="主情报流">主情报流</option>
                <option value="Digest + 专题思考">Digest + 专题思考</option>
                <option value="仅 8 分钟深读">仅 8 分钟深读</option>
              </select>
            </label>
            <label>
              默认阅读时长
              <select defaultValue="3" name="duration">
                <option value="3">3 分钟版</option>
                <option value="8">8 分钟版</option>
              </select>
            </label>
            <label>
              推送频率
              <select defaultValue="工作日" name="frequency">
                <option value="工作日">工作日</option>
                <option value="每日">每日</option>
              </select>
            </label>
            <button className="button button-primary" type="submit">
              完成订阅
            </button>
            {success ? <p className="feedback good">订阅成功，新的 digest 会按你的默认偏好发送到邮箱。</p> : null}
            {error ? <p className="feedback danger">请先填写有效邮箱地址。</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}

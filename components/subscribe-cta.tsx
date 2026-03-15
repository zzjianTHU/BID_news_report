import Link from "next/link";

type SubscribeCTAProps = {
  compact?: boolean;
};

export function SubscribeCTA({ compact = false }: SubscribeCTAProps) {
  return (
    <section className={`subscribe-cta ${compact ? "is-compact" : ""}`}>
      <div>
        <p className="section-kicker">Subscribe</p>
        <h2>把 AI 自动情报和每日 digest 直接发到邮箱。</h2>
        <p>
          首版只做最轻量订阅：主情报流、默认阅读时长和推送频率。先把稳定触达跑通，再迭代更细偏好。
        </p>
      </div>
      <Link className="button button-primary" href="/subscribe">
        Start subscription
      </Link>
    </section>
  );
}

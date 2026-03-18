import Link from "next/link";

type SubscribeCTAProps = {
  compact?: boolean;
};

export function SubscribeCTA({ compact = false }: SubscribeCTAProps) {
  return (
    <section className={`subscribe-cta ${compact ? "is-compact" : ""}`}>
      <div>
        <p className="section-kicker">Subscribe</p>
        <h2>把每天值得读的 AI digest 直接发到邮箱。</h2>
        <p>
          选好关注范围和默认阅读时长，就能用更短时间跟上真正重要的变化。
        </p>
      </div>
      <Link className="button button-primary" href="/subscribe">
        Start subscription
      </Link>
    </section>
  );
}

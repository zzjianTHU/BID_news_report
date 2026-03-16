import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { StickySwitcher } from "@/components/sticky-switcher";
import { SubscribeCTA } from "@/components/subscribe-cta";
import { getDigestByDate } from "@/lib/data";

type DigestPageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ view?: "3" | "8" }>;
};

export default async function DigestPage({ params, searchParams }: DigestPageProps) {
  const { date } = await params;
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view === "8" ? "8" : "3";
  const digest = await getDigestByDate(date);

  if (!digest) {
    notFound();
  }

  const duration = view === "8" ? "EIGHT" : "THREE";
  const entries = digest.entries.filter((entry) => entry.duration === duration);

  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <StickySwitcher
          sticky
          items={[
            { href: `/digest/${date}?view=3`, label: "3 min", active: view === "3" },
            { href: `/digest/${date}?view=8`, label: "8 min", active: view === "8" },
            { href: "/archive", label: "Archive" }
          ]}
        />

        <section className="section-block">
          <p className="section-kicker">Digest</p>
          <h1 className="page-title">
            {digest.title} · {view === "8" ? "8 分钟版" : "3 分钟版"}
          </h1>
          <p className="page-intro">{digest.summary}</p>
        </section>

        <div className="digest-list">
          {entries.map((entry) => (
            <article className="digest-entry-card" key={`${entry.duration}-${entry.order}`}>
              <div className="digest-entry-head">
                <span className="digest-order">{String(entry.order).padStart(2, "0")}</span>
                <div>
                  <p className="section-kicker">{entry.tag}</p>
                  <h2>{entry.title}</h2>
                </div>
              </div>
              <p>{entry.summary}</p>
              <p className="feed-insight">为什么值得看：{entry.worthReading}</p>
              <div className="feed-meta">
                <span>{entry.sourceLabel}</span>
                <Link className="text-link" href={entry.sourceUrl} target="_blank">
                  原文链接
                </Link>
              </div>
            </article>
          ))}
        </div>

        <SubscribeCTA compact />
      </div>
    </main>
  );
}

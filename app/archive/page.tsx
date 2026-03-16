import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { StickySwitcher } from "@/components/sticky-switcher";
import { getArchiveDigests } from "@/lib/data";

export default async function ArchivePage() {
  const digests = await getArchiveDigests();

  return (
    <main className="page-shell">
      <SiteHeader />
      <div className="page-body">
        <StickySwitcher
          items={[
            { href: "/", label: "Main feed" },
            { href: "/archive", label: "Digest archive", active: true },
            { href: "/thoughts", label: "Thoughts" }
          ]}
        />

        <section className="section-block">
          <p className="section-kicker">Archive</p>
          <h1 className="page-title">每日 digest 归档</h1>
          <p className="page-intro">默认先提供按日期浏览，后续再叠加更细的搜索和主题过滤。</p>
        </section>

        <div className="archive-list">
          {digests.map((digest) => (
            <article className="archive-card" key={digest.id}>
              <div>
                <p className="section-kicker">{digest.date}</p>
                <h2>{digest.title}</h2>
                <p>{digest.summary}</p>
              </div>
              <div className="archive-actions">
                <Link className="button button-secondary" href={`/digest/${digest.date}?view=3`}>
                  3 分钟版
                </Link>
                <Link className="button button-primary" href={`/digest/${digest.date}?view=8`}>
                  8 分钟版
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

import { SiteHeader } from "@/components/site-header";
import { StickySwitcher } from "@/components/sticky-switcher";
import { SubscribeCTA } from "@/components/subscribe-cta";
import { ThoughtCard } from "@/components/thought-card";
import { getPublishedThoughts } from "@/lib/data";

export default async function ThoughtsPage() {
  const thoughts = await getPublishedThoughts();

  return (
    <main className="page-shell">
      <SiteHeader current="thoughts" />
      <div className="page-body">
        <StickySwitcher
          items={[
            { href: "/", label: "Main feed" },
            { href: "/archive", label: "Digests" },
            { href: "/thoughts", label: "Thoughts", active: true }
          ]}
        />

        <section className="section-block">
          <p className="section-kicker">Thoughts</p>
          <h1 className="page-title">人工专题 / 思考</h1>
          <p className="page-intro">自动流负责快，专题思考负责深。这里承载研究组不定期发布的结构化判断。</p>
        </section>

        <div className="thought-grid">
          {thoughts.map((post) => (
            <ThoughtCard key={post.id} post={post} />
          ))}
        </div>

        <SubscribeCTA compact />
      </div>
    </main>
  );
}

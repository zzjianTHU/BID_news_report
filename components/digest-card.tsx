import Link from "next/link";

import type { DigestWithEntries, DurationTab } from "@/lib/types";
import { durationLabel, formatLongDate } from "@/lib/utils";

type DigestCardProps = {
  digest: DigestWithEntries;
  view?: DurationTab;
};

export function DigestCard({ digest, view = "3" }: DigestCardProps) {
  const duration = view === "8" ? "EIGHT" : "THREE";
  const items = digest.entries.filter((entry) => entry.duration === duration).slice(0, 3);
  const summary = view === "8" ? digest.summaryEight || digest.summary : digest.summaryThree || digest.summary;

  return (
    <article className="digest-hero-card">
      <p className="section-kicker">Latest digest</p>
      <h1>{digest.title}</h1>
      <p className="digest-hero-summary">{summary}</p>

      <div className="digest-entry-preview">
        {items.map((item) => (
          <div className="digest-preview-row" key={`${item.duration}-${item.order}`}>
            <span className="digest-order">{String(item.order).padStart(2, "0")}</span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="digest-hero-footer">
        <Link className="button button-light" href={`/digest/${digest.date}?view=${view}`}>
          Read the latest
        </Link>
        <div className="digest-footnote">
          <span>{formatLongDate(digest.date)}</span>
          <span>{durationLabel(view)}</span>
        </div>
      </div>
    </article>
  );
}

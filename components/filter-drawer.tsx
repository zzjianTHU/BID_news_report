"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const tagOptions = [
  { label: "All", value: "all" },
  { label: "Agents", value: "agents" },
  { label: "Models", value: "models" },
  { label: "Infra", value: "infra" },
  { label: "Enterprise", value: "enterprise" }
];

const windowOptions = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" }
];

type FilterDrawerProps = {
  currentTag: string;
  currentWindow: string;
};

export function FilterDrawer({ currentTag, currentWindow }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    setOpen(false);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="filter-drawer-shell">
      <button className="filter-toggle" onClick={() => setOpen((value) => !value)} type="button">
        Filters
      </button>
      <div className={`filter-drawer ${open ? "is-open" : ""}`}>
        <div className="filter-group">
          <p className="filter-label">Tag</p>
          <div className="chip-row">
            {tagOptions.map((option) => (
              <button
                className={`chip ${currentTag === option.value ? "is-active" : ""}`}
                key={option.value}
                onClick={() => updateParam("tag", option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <p className="filter-label">Window</p>
          <div className="chip-row">
            {windowOptions.map((option) => (
              <button
                className={`chip ${currentWindow === option.value ? "is-active" : ""}`}
                key={option.value}
                onClick={() => updateParam("window", option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

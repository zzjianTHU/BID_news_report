"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const tagOptions = [
  { label: "全部", value: "all" },
  { label: "智能体", value: "agents" },
  { label: "模型", value: "models" },
  { label: "基础设施", value: "infra" },
  { label: "企业", value: "enterprise" }
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
        筛选
      </button>
      <div className={`filter-drawer ${open ? "is-open" : ""}`}>
        <div className="filter-group">
          <p className="filter-label">标签</p>
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
          <p className="filter-label">时间范围</p>
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

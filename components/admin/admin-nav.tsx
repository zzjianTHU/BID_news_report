"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavProps = {
  items: Array<{
    href: string;
    label: string;
  }>;
};

export function AdminNav({ items }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin navigation">
      {items.map((item) => (
        <Link
          className={`main-nav-link admin-nav-link ${pathname === item.href ? "is-active" : ""}`}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

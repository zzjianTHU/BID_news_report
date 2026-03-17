"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", isActive: (pathname: string) => pathname === "/" },
  { href: "/archive", label: "Digest", isActive: (pathname: string) => pathname === "/archive" || pathname.startsWith("/digest/") },
  { href: "/thoughts", label: "Thoughts", isActive: (pathname: string) => pathname === "/thoughts" || pathname.startsWith("/thoughts/") },
  { href: "/about", label: "About", isActive: (pathname: string) => pathname === "/about" }
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header-shell">
      <div className="site-header-inner">
        <div className="brand-block">
          <Link className="brand-title" href="/">
            清华 AI 情报自动站
          </Link>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`main-nav-link ${item.isActive(pathname) ? "is-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="button button-primary compact" href="/subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </header>
  );
}

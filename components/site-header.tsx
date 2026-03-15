import Link from "next/link";

type SiteHeaderProps = {
  current?: "home" | "digest" | "thoughts" | "about";
};

const navItems = [
  { href: "/", label: "Home", key: "home" },
  { href: "/archive", label: "Digest", key: "digest" },
  { href: "/thoughts", label: "Thoughts", key: "thoughts" },
  { href: "/about", label: "About", key: "about" }
] as const;

export function SiteHeader({ current = "home" }: SiteHeaderProps) {
  return (
    <header className="site-header-shell">
      <div className="top-app-bar">
        <div>
          <p className="micro-label">THU BUSINESS INTELLIGENCE</p>
          <p className="micro-domain">mobile-first ai dispatch</p>
        </div>
        <Link className="mini-link" href="/admin/login">
          Admin
        </Link>
      </div>

      <div className="site-header">
        <div className="brand-block">
          <Link className="brand-title" href="/">
            清华 AI 情报自动站
          </Link>
          <p className="brand-subtitle">自动抓取、处理与发布，人工判断做最后一层把关。</p>
        </div>

        <div className="header-actions">
          <Link className="button button-primary" href="/subscribe">
            Subscribe
          </Link>
          <Link className="mini-link dark" href="/admin/login">
            Sign in
          </Link>
        </div>
      </div>

      <nav className="main-nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`main-nav-link ${current === item.key ? "is-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

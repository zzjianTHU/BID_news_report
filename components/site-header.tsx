"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Home", isActive: (pathname: string) => pathname === "/" },
  { href: "/archive", label: "Digest", isActive: (pathname: string) => pathname === "/archive" || pathname.startsWith("/digest/") },
  { href: "/thoughts", label: "Thoughts", isActive: (pathname: string) => pathname === "/thoughts" || pathname.startsWith("/thoughts/") },
  { href: "/about", label: "About", isActive: (pathname: string) => pathname === "/about" }
] as const;

export function SiteHeader() {
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only trigger hide/show if scrolling more than a buffer to prevent jitter
      if (Math.abs(currentScrollY - lastScrollY) < 10) {
        return;
      }

      // Hide if scrolling down and past header height (e.g. 80px)
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsHidden(true);
      } else {
        // Show if scrolling up or at top
        setIsHidden(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header className={`site-header-shell ${isHidden ? "is-hidden" : ""}`}>
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
            className={`main-nav-link ${item.isActive(pathname) ? "is-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

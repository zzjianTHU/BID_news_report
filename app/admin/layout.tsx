import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/lib/actions";

const adminNavItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/queue", label: "审核列表" },
  { href: "/admin/sources", label: "来源管理" },
  { href: "/admin/scheduler", label: "抓取调度" }
];

export default function AdminLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="page-shell">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="section-kicker">Admin</p>
            <h1>后台管理</h1>
            <p className="page-intro">这里用于查看站点状态、待审内容和后续运营动作。</p>
          </div>
          <div className="header-actions">
            <Link className="button button-light compact" href="/ops">
              返回运营看板
            </Link>
            <form action={logoutAction}>
              <button className="button button-secondary compact" type="submit">
                退出后台
              </button>
            </form>
          </div>
        </header>

        <AdminNav items={adminNavItems} />
        <div className="admin-page-shell">{children}</div>
      </div>
    </main>
  );
}

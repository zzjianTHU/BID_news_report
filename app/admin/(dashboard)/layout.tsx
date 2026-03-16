import { AdminNav } from "@/components/admin/admin-nav";
import { CompactStatusPanel } from "@/components/admin/compact-status-panel";
import { logoutAction } from "@/lib/actions";
import { requireAdminSession } from "@/lib/auth";
import { getSiteSnapshot } from "@/lib/data";

const adminNav = [
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/workflows", label: "Workflows" },
  { href: "/admin/digests", label: "Digests" },
  { href: "/admin/thoughts", label: "Thoughts" },
  { href: "/admin/subscribers", label: "Subscribers" }
];

export default async function AdminDashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSession();
  const snapshot = await getSiteSnapshot();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="section-kicker">Operations</p>
          <h1>AI 情报自动化控制台</h1>
        </div>
        <form action={logoutAction}>
          <button className="button button-secondary" type="submit">
            Logout
          </button>
        </form>
      </header>
      <AdminNav items={adminNav} />

      <CompactStatusPanel snapshot={snapshot} />

      <div className="admin-page-shell">{children}</div>
    </main>
  );
}

import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth";
import { loginAction } from "@/lib/actions";

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/admin/queue");
  }

  const resolvedSearchParams = await searchParams;

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <p className="section-kicker">Admin login</p>
        <h1>登录运营控制台</h1>
        <p>默认账号可在 `lib/auth.ts` 中查看或用环境变量覆盖，当前适合本地 MVP 演示。</p>
        <form action={loginAction} className="admin-form">
          <label>
            邮箱
            <input defaultValue="admin@thu-bid.local" name="email" required type="email" />
          </label>
          <label>
            密码
            <input defaultValue="demo12345" name="password" required type="password" />
          </label>
          <button className="button button-primary" type="submit">
            Sign in
          </button>
          {resolvedSearchParams.error === "1" ? (
            <p className="feedback danger">账号或密码不正确。</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

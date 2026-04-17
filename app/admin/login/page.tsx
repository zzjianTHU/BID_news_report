import { loginAction } from "@/lib/actions";
import { getAdminCredentials, isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminAuthenticated()) {
    return (
      <div className="admin-login-shell">
        <section className="admin-login-card">
          <p className="section-kicker">Admin</p>
          <h1>你已经登录后台</h1>
          <p className="page-intro">直接访问 `/admin` 或 `/admin/queue` 就可以继续使用后台。</p>
        </section>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const credentials = getAdminCredentials();

  return (
    <div className="admin-login-shell">
      <section className="admin-login-card">
        <p className="section-kicker">Admin</p>
        <h1>后台登录</h1>
        <p className="page-intro">先用本地管理员账户登录，再进入后台首页和审核列表页。</p>

        {resolvedSearchParams.error ? (
          <p className="feedback danger">邮箱或密码不正确，请重新输入。</p>
        ) : null}

        <form action={loginAction} className="admin-form">
          <label>
            邮箱
            <input defaultValue={credentials.email} name="email" type="email" />
          </label>
          <label>
            密码
            <input defaultValue={credentials.password} name="password" type="password" />
          </label>
          <button className="button button-primary" type="submit">
            登录后台
          </button>
        </form>
      </section>
    </div>
  );
}

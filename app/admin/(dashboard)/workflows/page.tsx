import { DesktopConfigForm } from "@/components/admin/desktop-config-form";
import { getWorkflowConfigs } from "@/lib/data";

export default async function AdminWorkflowsPage() {
  const workflows = await getWorkflowConfigs();

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Workflows</p>
          <h2>自动化工作流配置</h2>
        </div>
        <p className="section-note">手机端以只读和必要编辑为主，复杂配置默认桌面优先。</p>
      </div>

      <div className="workflow-stack">
        {workflows.map((workflow) => (
          <div className="panel-card" key={workflow.id}>
            <DesktopConfigForm workflow={workflow} />
          </div>
        ))}
      </div>
    </section>
  );
}

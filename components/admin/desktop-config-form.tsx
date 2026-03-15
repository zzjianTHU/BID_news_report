import type { WorkflowConfig } from "@prisma/client";

import { saveWorkflowAction } from "@/lib/actions";

type DesktopConfigFormProps = {
  workflow: WorkflowConfig;
};

export function DesktopConfigForm({ workflow }: DesktopConfigFormProps) {
  return (
    <form action={saveWorkflowAction} className="admin-form desktop-config-form">
      <input name="workflowId" type="hidden" value={workflow.id} />
      <label>
        工作流名称
        <input defaultValue={workflow.name} name="name" required type="text" />
      </label>
      <label>
        摘要 Prompt
        <textarea defaultValue={workflow.summaryPrompt} name="summaryPrompt" rows={4} />
      </label>
      <label>
        高亮 Prompt
        <textarea defaultValue={workflow.highlightPrompt} name="highlightPrompt" rows={4} />
      </label>
      <label>
        风险关键词
        <textarea defaultValue={workflow.riskKeywords} name="riskKeywords" rows={3} />
      </label>
      <div className="admin-form-grid">
        <label>
          自动发布阈值
          <input defaultValue={workflow.autoPublishMinTrust} name="autoPublishMinTrust" type="number" />
        </label>
      </div>
      <label>
        3 分钟版规则
        <textarea defaultValue={workflow.digestRuleThree} name="digestRuleThree" rows={3} />
      </label>
      <label>
        8 分钟版规则
        <textarea defaultValue={workflow.digestRuleEight} name="digestRuleEight" rows={3} />
      </label>
      <label>
        备注
        <textarea defaultValue={workflow.notes ?? ""} name="notes" rows={3} />
      </label>
      <button className="button button-primary" type="submit">
        保存配置
      </button>
    </form>
  );
}

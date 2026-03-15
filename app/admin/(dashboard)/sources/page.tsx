import { createSourceAction, toggleSourceAction } from "@/lib/actions";
import { getSources } from "@/lib/data";

export default async function AdminSourcesPage() {
  const sources = await getSources();

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Sources</p>
          <h2>数据源管理</h2>
        </div>
      </div>

      <div className="admin-two-column">
        <form action={createSourceAction} className="admin-form panel-card">
          <h3>新增数据源</h3>
          <label>
            名称
            <input name="name" required type="text" />
          </label>
          <label>
            类型
            <select defaultValue="RSS" name="type">
              <option value="RSS">RSS</option>
              <option value="WEB">WEB</option>
            </select>
          </label>
          <label>
            URL
            <input name="url" required type="url" />
          </label>
          <label>
            描述
            <textarea name="description" rows={3} />
          </label>
          <div className="admin-form-grid">
            <label>
              频率
              <input defaultValue="每日" name="frequency" type="text" />
            </label>
            <label>
              优先级
              <input defaultValue="70" name="priority" type="number" />
            </label>
            <label>
              可信度
              <input defaultValue="70" name="trustScore" type="number" />
            </label>
          </div>
          <label>
            标签
            <input defaultValue="ai,signals" name="tags" type="text" />
          </label>
          <button className="button button-primary" type="submit">
            添加数据源
          </button>
        </form>

        <div className="admin-list panel-card">
          <h3>当前源</h3>
          {sources.map((source) => (
            <article className="source-row" key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <p>{source.description}</p>
                <div className="feed-meta">
                  <span>{source.type}</span>
                  <span>{source.frequency}</span>
                  <span>信任 {source.trustScore}</span>
                </div>
              </div>
              <form action={toggleSourceAction}>
                <input name="sourceId" type="hidden" value={source.id} />
                <input name="enabled" type="hidden" value={source.enabled ? "false" : "true"} />
                <button className="button button-secondary" type="submit">
                  {source.enabled ? "停用" : "启用"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

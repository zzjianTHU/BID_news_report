import { createThoughtAction } from "@/lib/actions";
import { getThoughtAdminList } from "@/lib/data";

export default async function AdminThoughtsPage() {
  const thoughts = await getThoughtAdminList();

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Thoughts</p>
          <h2>人工专题 / 思考</h2>
        </div>
      </div>

      <div className="admin-two-column">
        <form action={createThoughtAction} className="admin-form panel-card">
          <h3>新增或覆盖文章</h3>
          <label>
            标题
            <input name="title" required type="text" />
          </label>
          <label>
            摘要
            <textarea name="excerpt" rows={3} />
          </label>
          <label>
            正文
            <textarea name="body" rows={8} />
          </label>
          <label>
            作者
            <input defaultValue="中心研究组" name="authorName" type="text" />
          </label>
          <label>
            状态
            <select defaultValue="PUBLISHED" name="status">
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            保存文章
          </button>
        </form>

        <div className="admin-list panel-card">
          <h3>已存在文章</h3>
          {thoughts.map((thought) => (
            <article className="source-row" key={thought.id}>
              <div>
                <strong>{thought.title}</strong>
                <p>{thought.excerpt}</p>
              </div>
              <span className={`status-pill ${thought.status === "PUBLISHED" ? "good" : "warm"}`}>
                {thought.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import { durationLabel } from "@/lib/utils";
import { getDispatchOverview, getSubscribers } from "@/lib/data";

export default async function AdminSubscribersPage() {
  const [subscribers, dispatchOverview] = await Promise.all([getSubscribers(), getDispatchOverview()]);

  return (
    <section className="admin-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Subscribers</p>
          <h2>订阅者与邮件状态</h2>
        </div>
      </div>

      <div className="panel-card">
        <div className="inline-tags">
          {dispatchOverview.map((item) => (
            <span className="tag-pill" key={item.status}>
              {item.status}: {item._count.id}
            </span>
          ))}
        </div>
      </div>

      <div className="admin-list">
        {subscribers.map((subscriber) => (
          <article className="panel-card subscriber-card" key={subscriber.id}>
            <div>
              <h3>{subscriber.name ?? subscriber.email}</h3>
              <p>{subscriber.email}</p>
              <div className="feed-meta">
                <span>{subscriber.interest}</span>
                <span>{durationLabel(subscriber.defaultDuration)}</span>
                <span>{subscriber.frequency}</span>
              </div>
            </div>
            <div className="subscriber-dispatches">
              {subscriber.dispatches.map((dispatch) => (
                <span className={`status-pill ${dispatch.status === "SENT" ? "good" : "warm"}`} key={dispatch.id}>
                  {dispatch.status}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

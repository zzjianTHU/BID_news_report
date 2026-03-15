const briefData = {
  all: {
    label: "全站精选",
    description: "帮管理者和研究者快速了解今天最值得看的 AI 与产业动态。",
    sources: ["中心原创点评", "国际研究机构", "行业观察站", "企业公开资料"],
    durations: {
      "3": {
        target: "适合快速扫读",
        copy: "优先显示最重要的 3 条内容，每条包含摘要与一句判断。",
        items: [
          {
            tag: "AI",
            title: "Agent 产品进入组织试点期，关注点从能力转向流程接入",
            summary:
              "多家企业开始将 Agent 试点从概念验证推进到部门流程中，采购与 IT 团队更关注权限、监控与交付边界。",
            insight: "值得看：这说明 AI 进入组织的真正门槛已从模型效果转向流程治理。"
          },
          {
            tag: "快消",
            title: "快消品牌把增长预算转向私域和即时零售协同",
            summary:
              "近期品牌投放案例显示，新增预算不再单独押注单个平台，而是更强调全域协同和转化链闭环。",
            insight: "值得看：品牌增长逻辑正在从单点爆发回到精细化渠道组合。"
          },
          {
            tag: "中心视角",
            title: "商业模式创新的机会，正在出现在“AI + 传统行业流程重构”",
            summary:
              "中心判断认为，未来更有价值的不是单一工具，而是基于行业流程的新型组织与服务模式。",
            insight: "值得看：这为后续专题研究和深度报告提供了清晰选题方向。"
          }
        ]
      },
      "8": {
        target: "适合中度阅读",
        copy: "在速览之外加入背景和专题分组，帮助用户形成更完整的理解。",
        items: [
          {
            tag: "AI",
            title: "Agent 试点从演示阶段进入落地阶段，组织治理成为新议题",
            summary:
              "最近一批企业级 AI 实践案例中，产品展示能力已不再是唯一亮点，真正决定试点能否持续的是权限管理、知识边界、监控与协作流程的接入。",
            insight: "中心点评：AI 落地不再只是技术选型问题，而是流程重构问题。"
          },
          {
            tag: "快消",
            title: "快消品牌正在用更细的渠道编排替代粗放式投放",
            summary:
              "品牌不再追求单平台的声量最大化，而是更关注内容投放、私域承接、即时零售与复购链条的配合，增长团队与品牌团队协同变得更重要。",
            insight: "中心点评：渠道关系的再设计，可能比单次爆款更决定中期增长。"
          },
          {
            tag: "商业模式",
            title: "AI 正在把部分传统咨询和服务流程改造成可重复交付的产品",
            summary:
              "当流程中的研究、整理、生成和反馈环节逐步标准化后，原本依赖高人力的服务模式有机会演变为轻服务 + 平台化交付的新模式。",
            insight: "中心点评：这类变化值得持续追踪，未来可沉淀为机构深度专题。"
          }
        ]
      }
    }
  },
  ai: {
    label: "AI",
    description: "面向 AI 创业者、产品经理和管理者的每日情报流。",
    sources: ["模型团队博客", "研究机构", "技术媒体", "中心 AI 观察"],
    durations: {
      "3": {
        target: "3 分钟看懂 AI 重点",
        copy: "聚焦模型、Agent、组织落地三类最重要信息。",
        items: [
          {
            tag: "Agent",
            title: "企业开始要求 Agent 可审计、可回溯、可接入权限体系",
            summary: "企业落地开始从“能不能做”转向“能不能管”。",
            insight: "值得看：下一波机会会更偏平台层和治理层。"
          },
          {
            tag: "模型",
            title: "开源模型生态继续丰富，选型难度也同步上升",
            summary: "团队更需要按业务场景评估模型，而不是只看 benchmark。",
            insight: "值得看：模型选择方法论本身就是内容产品机会。"
          },
          {
            tag: "组织",
            title: "AI 项目推进开始需要跨产品、IT、法务的联合机制",
            summary: "试点进入真实业务流程后，协作成本成为关键变量。",
            insight: "值得看：组织协同会决定 AI 应用能否扩张。"
          }
        ]
      },
      "8": {
        target: "8 分钟理解 AI 趋势",
        copy: "加入背景和中心观点，适合每天做一次中度更新。",
        items: [
          {
            tag: "Agent",
            title: "Agent 产品价值正在从演示能力转向流程价值",
            summary:
              "当企业开始真实试点，问题不再是 Agent 能否回答问题，而是能否融入现有工作流、保留审计记录、连接知识库与权限系统。",
            insight: "中心点评：流程接入能力会逐步取代单点炫技，成为 B 端竞争关键。"
          },
          {
            tag: "模型",
            title: "多模型协同与场景化选型，会成为企业配置 AI 能力的常态",
            summary:
              "企业很难用单一模型覆盖所有任务，更现实的路径是建立任务分层与模型路由机制，兼顾成本、速度与准确率。",
            insight: "中心点评：选型逻辑会沉淀成新的组织能力，而不仅是技术决策。"
          },
          {
            tag: "组织",
            title: "AI 项目正从创新部门试点，向业务条线经营指标靠拢",
            summary:
              "只有当项目能够对效率、增长或风险控制产生可验证影响时，企业才会继续投入资源，这将提高 AI 项目的落地门槛。",
            insight: "中心点评：未来值得追踪的不是 Demo 数量，而是经营指标变化。"
          }
        ]
      }
    }
  },
  fmcg: {
    label: "快消",
    description: "围绕品牌、渠道和消费者变化的快消观察频道。",
    sources: ["行业媒体", "品牌案例", "电商平台公开信息", "中心快消研究"],
    durations: {
      "3": {
        target: "3 分钟掌握快消重点",
        copy: "优先呈现今天最值得关注的品牌动作与渠道变化。",
        items: [
          {
            tag: "渠道",
            title: "品牌预算更偏向全域协同，而非单渠道冲刺",
            summary: "品牌增长团队开始更重视私域、即时零售与内容投放的联动。",
            insight: "值得看：增长策略更像系统工程，而不是单点投放。"
          },
          {
            tag: "品牌",
            title: "快消新品传播节奏从“大首发”转向“连续触达”",
            summary: "越来越多品牌选择更细颗粒度的投放节奏，拉长新品教育周期。",
            insight: "值得看：品牌建设和销售转化正在重新耦合。"
          },
          {
            tag: "消费者",
            title: "消费者对高性价比和确定性价值的偏好持续增强",
            summary: "高频消费场景里，价格敏感与可信承诺同时在上升。",
            insight: "值得看：品牌叙事要更具体地回应消费者的实际感知。"
          }
        ]
      },
      "8": {
        target: "8 分钟追踪快消变化",
        copy: "补充品牌逻辑、渠道编排和消费者行为变化的上下文。",
        items: [
          {
            tag: "渠道",
            title: "快消渠道策略进入“精细化协同”时代",
            summary:
              "品牌越来越难依赖单一平台实现稳定增长，实际操作上开始强调内容种草、即时履约、门店触点和私域复购之间的配合。",
            insight: "中心点评：渠道关系设计会成为未来快消经营能力的重要组成部分。"
          },
          {
            tag: "品牌",
            title: "新品打法更重视连续教育，而不是一次性打爆",
            summary:
              "品牌正在调整新品上市节奏，把预算分配到多轮触达与用户理解建立，而不是只集中在首发期获取声量。",
            insight: "中心点评：这意味着品牌管理的时间维度变长了，组织协同要求也更高。"
          },
          {
            tag: "消费者",
            title: "消费决策更看重确定性价值，品牌需要给出更具体承诺",
            summary:
              "在快消场景中，消费者越来越倾向对价格、品质、使用感形成直接判断，模糊的品牌表达更难带来高效转化。",
            insight: "中心点评：品牌叙事正在从抽象价值观转向可感知利益点。"
          }
        ]
      }
    }
  }
};

const state = {
  channel: "all",
  duration: "3"
};

const briefList = document.querySelector("#brief-list");
const summaryTitle = document.querySelector("#summary-title");
const summaryText = document.querySelector("#summary-text");
const readingTarget = document.querySelector("#reading-target");
const readingCopy = document.querySelector("#reading-copy");
const sourceList = document.querySelector("#source-list");
const channelButtons = document.querySelectorAll("[data-channel]");
const durationButtons = document.querySelectorAll("[data-duration]");
const subscribeForm = document.querySelector("#subscribe-form");
const feedback = document.querySelector("#form-feedback");

function renderBrief() {
  const channel = briefData[state.channel];
  const view = channel.durations[state.duration];

  summaryTitle.textContent = `${channel.label} · ${state.duration} 分钟版`;
  summaryText.textContent = channel.description;
  readingTarget.textContent = view.target;
  readingCopy.textContent = view.copy;

  briefList.innerHTML = view.items
    .map(
      (item, index) => `
        <article class="brief-card">
          <div class="brief-card-header">
            <div class="brief-card-title-group">
              <span class="brief-card-order">${String(index + 1).padStart(2, "0")}</span>
              <h5>${item.title}</h5>
            </div>
            <span class="brief-tag">${item.tag}</span>
          </div>
          <p>${item.summary}</p>
          <div class="brief-insight">${item.insight}</div>
        </article>
      `
    )
    .join("");

  sourceList.innerHTML = channel.sources.map((source) => `<li>${source}</li>`).join("");
}

function setActiveButton(buttons, key, value) {
  buttons.forEach((button) => {
    const isActive = button.dataset[key] === value;
    button.classList.toggle("is-active", isActive);
  });
}

channelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.channel = button.dataset.channel;
    setActiveButton(channelButtons, "channel", state.channel);
    renderBrief();
  });
});

durationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.duration = button.dataset.duration;
    setActiveButton(durationButtons, "duration", state.duration);
    renderBrief();
  });
});

if (subscribeForm && feedback) {
  subscribeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.querySelector("#email-input").value.trim();
    const topic = document.querySelector("#topic-select").selectedOptions[0].textContent;
    const duration = document.querySelector("#duration-select").value;

    feedback.textContent = `${email} 已加入 Demo 订阅列表，默认接收 ${topic} 的 ${duration} 分钟版。`;
    subscribeForm.reset();
  });
}

renderBrief();

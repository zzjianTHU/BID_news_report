const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

export function getOptionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function getAppBaseUrl() {
  return (process.env.APP_BASE_URL ?? DEFAULT_APP_BASE_URL).replace(/\/$/, "");
}

export function getFeishuBaseUrl() {
  return (process.env.FEISHU_BASE_URL ?? DEFAULT_FEISHU_BASE_URL).replace(/\/$/, "");
}

export function getFeishuAppConfig() {
  return {
    appId: requireEnv("FEISHU_APP_ID"),
    appSecret: requireEnv("FEISHU_APP_SECRET"),
    verificationToken: requireEnv("FEISHU_VERIFICATION_TOKEN"),
    encryptKey: requireEnv("FEISHU_ENCRYPT_KEY")
  };
}

function getFeishuBitableAppToken() {
  return requireEnv("FEISHU_SOURCE_APP_TOKEN");
}

function getFeishuTableId(name: string) {
  return requireEnv(name);
}

export function getFeishuSourceConfig() {
  return {
    ...getFeishuAppConfig(),
    appToken: getFeishuBitableAppToken(),
    tableId: getFeishuTableId("FEISHU_SOURCE_TABLE_ID")
  };
}

export function getFeishuModelRouteConfig() {
  return {
    ...getFeishuAppConfig(),
    appToken: getFeishuBitableAppToken(),
    tableId: getFeishuTableId("FEISHU_MODEL_ROUTE_TABLE_ID")
  };
}

export function getFeishuWorkflowConfig() {
  return {
    ...getFeishuAppConfig(),
    appToken: getFeishuBitableAppToken(),
    tableId: getFeishuTableId("FEISHU_WORKFLOW_TABLE_ID")
  };
}

export function getFeishuDraftConfig() {
  return {
    ...getFeishuAppConfig(),
    appToken: getFeishuBitableAppToken(),
    tableId: getFeishuTableId("FEISHU_DRAFT_TABLE_ID")
  };
}

export function getFeishuReviewChatId() {
  return process.env.FEISHU_REVIEW_CHAT_ID ?? null;
}

export function getFeishuDigestChatId() {
  return process.env.FEISHU_DIGEST_CHAT_ID ?? null;
}

export function getWorkerSharedSecret() {
  return requireEnv("WORKER_SHARED_SECRET");
}

export function getContentWorkflowModel() {
  return getOptionalEnv("CONTENT_WORKFLOW_MODEL");
}

const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
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

export function getFeishuSourceConfig() {
  return {
    ...getFeishuAppConfig(),
    appToken: requireEnv("FEISHU_SOURCE_APP_TOKEN"),
    tableId: requireEnv("FEISHU_SOURCE_TABLE_ID")
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

import crypto from "node:crypto";

import { getFeishuAppConfig, getFeishuBaseUrl } from "@/lib/env";

type FeishuApiEnvelope<T> = {
  code: number;
  msg: string;
  data?: T;
  tenant_access_token?: string;
  expire?: number;
};

let tokenCache:
  | {
      value: string;
      expiresAt: number;
    }
  | undefined;

async function parseFeishuResponse<T>(response: Response) {
  const payload = (await response.json()) as FeishuApiEnvelope<T>;

  if (!response.ok || payload.code !== 0) {
    throw new Error(`Feishu API request failed: ${payload.msg || response.statusText}`);
  }

  return payload;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function getTenantAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.value;
  }

  const { appId, appSecret } = getFeishuAppConfig();
  const response = await fetch(`${getFeishuBaseUrl()}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  const payload = await parseFeishuResponse(response);
  const token = payload.tenant_access_token;
  const expire = payload.expire ?? 7200;

  if (!token) {
    throw new Error("Feishu tenant access token is missing from the response.");
  }

  tokenCache = {
    value: token,
    expiresAt: Date.now() + Math.max(expire - 60, 60) * 1000
  };

  return token;
}

export async function feishuRequest<T>(
  path: string,
  init: RequestInit = {},
  options: {
    authenticated?: boolean;
  } = {}
) {
  const authenticated = options.authenticated ?? true;
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json; charset=utf-8");

  if (authenticated) {
    headers.set("Authorization", `Bearer ${await getTenantAccessToken()}`);
  }

  const response = await fetch(`${getFeishuBaseUrl()}${path}`, {
    ...init,
    headers
  });

  const payload = await parseFeishuResponse<T>(response);

  if (!payload.data) {
    throw new Error("Feishu API response did not include a data payload.");
  }

  return payload.data;
}

export async function sendFeishuTextMessage(chatId: string, text: string) {
  const data = await feishuRequest<{ message_id: string }>("/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({
        text
      })
    })
  });

  return data.message_id;
}

export async function sendFeishuInteractiveMessage(chatId: string, card: Record<string, unknown>) {
  const data = await feishuRequest<{ message_id: string }>("/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(card)
    })
  });

  return data.message_id;
}

export function verifyFeishuRequest(rawBody: string, headers: Headers, providedToken?: string) {
  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (verificationToken && providedToken && verificationToken !== providedToken) {
    return false;
  }

  const requestTimestamp = headers.get("x-lark-request-timestamp");
  const requestNonce = headers.get("x-lark-request-nonce");
  const signature = headers.get("x-lark-signature");
  const encryptKey = process.env.FEISHU_ENCRYPT_KEY;

  if (!signature) {
    return verificationToken ? providedToken === verificationToken : true;
  }

  if (!encryptKey || !requestTimestamp || !requestNonce) {
    return false;
  }

  const expectedSignature = crypto
    .createHash("sha256")
    .update(`${requestTimestamp}${requestNonce}${encryptKey}${rawBody}`)
    .digest("hex");

  return safeCompare(expectedSignature, signature);
}

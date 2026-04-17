import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getOptionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function readConfigured(name) {
  return Boolean(getOptionalEnv(name));
}

function looksPlaceholder(value) {
  if (!value) {
    return false;
  }

  return (
    /^local[-_]/i.test(value) ||
    /^local$/i.test(value) ||
    /your[_-]?/i.test(value) ||
    /example/i.test(value) ||
    /changeme/i.test(value) ||
    /password/i.test(value)
  );
}

function maskUrlKind(value) {
  if (!value) {
    return "missing";
  }

  if (/127\.0\.0\.1|localhost/i.test(value)) {
    return "local";
  }

  return "remote";
}

function addResult(results, name, status, detail) {
  results.push({ name, status, detail });
}

async function parseFeishuResponse(response) {
  const payload = await response.json();

  if (!response.ok || payload.code !== 0) {
    throw new Error(`Feishu API request failed: ${payload.msg || response.statusText}`);
  }

  return payload;
}

function getFeishuBaseUrl() {
  return (process.env.FEISHU_BASE_URL ?? "https://open.feishu.cn/open-apis").replace(/\/$/, "");
}

async function getTenantAccessToken() {
  const response = await fetch(`${getFeishuBaseUrl()}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET
    })
  });

  const payload = await parseFeishuResponse(response);
  if (!payload.tenant_access_token) {
    throw new Error("Feishu tenant access token is missing from the response.");
  }

  return payload.tenant_access_token;
}

async function listFeishuRecordCount(appToken, tableId, accessToken) {
  const query = new URLSearchParams({ page_size: "1" });
  const response = await fetch(
    `${getFeishuBaseUrl()}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${query.toString()}`,
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const payload = await parseFeishuResponse(response);
  return Array.isArray(payload.data?.items) ? payload.data.items.length : 0;
}

async function resolveBitableAppToken(accessToken) {
  const directToken = getOptionalEnv("FEISHU_SOURCE_APP_TOKEN");
  if (directToken && !looksPlaceholder(directToken)) {
    return directToken;
  }

  const wikiToken = getOptionalEnv("FEISHU_SOURCE_WIKI_TOKEN");
  if (!wikiToken || looksPlaceholder(wikiToken)) {
    throw new Error("Neither FEISHU_SOURCE_APP_TOKEN nor FEISHU_SOURCE_WIKI_TOKEN is configured.");
  }

  const response = await fetch(
    `${getFeishuBaseUrl()}/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`,
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const payload = await parseFeishuResponse(response);
  const objToken = payload.data?.node?.obj_token;
  const objType = payload.data?.node?.obj_type;

  if (!objToken || objType !== "bitable") {
    throw new Error(`Failed to resolve wiki token into bitable app token. Resolved type: ${objType ?? "unknown"}`);
  }

  return objToken;
}

function hasFeishuCoreEnv() {
  const keys = [
    "FEISHU_APP_ID",
    "FEISHU_APP_SECRET",
    "FEISHU_VERIFICATION_TOKEN",
    "FEISHU_ENCRYPT_KEY",
    "FEISHU_SOURCE_TABLE_ID",
    "FEISHU_MODEL_ROUTE_TABLE_ID",
    "FEISHU_WORKFLOW_TABLE_ID",
    "FEISHU_DRAFT_TABLE_ID"
  ];

  return keys.every(readConfigured);
}

function hasRealValues(keys) {
  return keys.every((key) => {
    const value = getOptionalEnv(key);
    return value && !looksPlaceholder(value);
  });
}

function checkOpsDefaults(results) {
  const workerSecret = getOptionalEnv("WORKER_SHARED_SECRET");
  addResult(
    results,
    "Worker shared secret",
    workerSecret && !looksPlaceholder(workerSecret) ? "PASS" : "FAIL",
    workerSecret && !looksPlaceholder(workerSecret)
      ? "Internal worker route can be authenticated."
      : "WORKER_SHARED_SECRET is missing or still a placeholder."
  );

  addResult(
    results,
    "Feishu review chat",
    readConfigured("FEISHU_REVIEW_CHAT_ID") ? "PASS" : "WARN",
    readConfigured("FEISHU_REVIEW_CHAT_ID")
      ? "Review notifications can be sent."
      : "Review notifications are disabled until FEISHU_REVIEW_CHAT_ID is configured."
  );

  addResult(
    results,
    "Feishu digest chat",
    readConfigured("FEISHU_DIGEST_CHAT_ID") ? "PASS" : "WARN",
    readConfigured("FEISHU_DIGEST_CHAT_ID")
      ? "Digest notifications can be sent."
      : "Digest notifications are disabled until FEISHU_DIGEST_CHAT_ID is configured."
  );
}

async function checkDatabase(results) {
  const databaseUrl = getOptionalEnv("DATABASE_URL");
  const directUrl = getOptionalEnv("DIRECT_URL");
  const databaseEnvHealthy =
    databaseUrl &&
    directUrl &&
    !looksPlaceholder(databaseUrl) &&
    !looksPlaceholder(directUrl);

  addResult(
    results,
    "Database env",
    databaseEnvHealthy ? "PASS" : "FAIL",
    `DATABASE_URL=${maskUrlKind(databaseUrl)}, DIRECT_URL=${maskUrlKind(directUrl)}${
      databaseEnvHealthy ? "" : " (missing or placeholder values detected)"
    }`
  );

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    addResult(results, "Database reachability", "PASS", "Prisma can connect and run SELECT 1.");
  } catch (error) {
    addResult(
      results,
      "Database reachability",
      "FAIL",
      error instanceof Error ? error.message : "Unknown database error."
    );
  }
}

async function checkModels(results) {
  const configuredKeys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"].filter((key) => {
    const value = getOptionalEnv(key);
    return value && !looksPlaceholder(value);
  });

  addResult(
    results,
    "Model API keys",
    configuredKeys.length > 0 ? "PASS" : "FAIL",
    configuredKeys.length > 0
      ? `Configured keys: ${configuredKeys.join(", ")}`
      : "No standard model API keys are configured."
  );

  const workflowModel = getOptionalEnv("CONTENT_WORKFLOW_MODEL");
  addResult(
    results,
    "Content workflow model env",
    workflowModel && !looksPlaceholder(workflowModel) ? "PASS" : "WARN",
    workflowModel && !looksPlaceholder(workflowModel)
      ? workflowModel
      : "CONTENT_WORKFLOW_MODEL is empty or placeholder; live routing depends on Feishu/DB route config."
  );
}

async function checkFeishu(results) {
  const feishuKeys = [
    "FEISHU_APP_ID",
    "FEISHU_APP_SECRET",
    "FEISHU_VERIFICATION_TOKEN",
    "FEISHU_ENCRYPT_KEY",
    "FEISHU_SOURCE_TABLE_ID",
    "FEISHU_MODEL_ROUTE_TABLE_ID",
    "FEISHU_WORKFLOW_TABLE_ID",
    "FEISHU_DRAFT_TABLE_ID"
  ];
  const hasBitableLocator =
    hasRealValues(["FEISHU_SOURCE_APP_TOKEN"]) || hasRealValues(["FEISHU_SOURCE_WIKI_TOKEN"]);
  const feishuEnvHealthy = hasRealValues(feishuKeys) && hasBitableLocator;

  addResult(
    results,
    "Feishu env",
    hasFeishuCoreEnv() && feishuEnvHealthy ? "PASS" : "FAIL",
    hasFeishuCoreEnv() && feishuEnvHealthy
      ? "Core app, bitable, and callback env vars are configured."
      : "One or more Feishu env vars are missing or still placeholders. FEISHU_SOURCE_APP_TOKEN or FEISHU_SOURCE_WIKI_TOKEN is required."
  );

  if (!hasFeishuCoreEnv() || !feishuEnvHealthy) {
    addResult(results, "Feishu live checks", "WARN", "Skipped because required Feishu env vars are incomplete.");
    return;
  }

  let accessToken;
  try {
    accessToken = await getTenantAccessToken();
    addResult(results, "Feishu auth", "PASS", "Tenant access token request succeeded.");
  } catch (error) {
    addResult(
      results,
      "Feishu auth",
      "FAIL",
      error instanceof Error ? error.message : "Unknown Feishu auth error."
    );
    addResult(results, "Feishu table access", "WARN", "Skipped because auth did not succeed.");
    return;
  }

  try {
    const bitableAppToken = await resolveBitableAppToken(accessToken);
    const [sourceProbe, routeProbe, workflowProbe, draftProbe] = await Promise.all([
      listFeishuRecordCount(bitableAppToken, process.env.FEISHU_SOURCE_TABLE_ID, accessToken),
      listFeishuRecordCount(
        bitableAppToken,
        process.env.FEISHU_MODEL_ROUTE_TABLE_ID,
        accessToken
      ),
      listFeishuRecordCount(
        bitableAppToken,
        process.env.FEISHU_WORKFLOW_TABLE_ID,
        accessToken
      ),
      process.env.FEISHU_DRAFT_TABLE_ID
        ? listFeishuRecordCount(bitableAppToken, process.env.FEISHU_DRAFT_TABLE_ID, accessToken)
        : Promise.resolve(0)
    ]);

    addResult(
      results,
      "Feishu table access",
      "PASS",
      `sourceProbe=${sourceProbe}, routeProbe=${routeProbe}, workflowProbe=${workflowProbe}, draftProbe=${draftProbe}`
    );
  } catch (error) {
    addResult(
      results,
      "Feishu table access",
      "FAIL",
      error instanceof Error ? error.message : "Unknown Feishu table error."
    );
  }
}

function printSummary(results) {
  console.log("BID runtime doctor");
  console.log("==================");

  for (const result of results) {
    console.log(`[${result.status}] ${result.name}: ${result.detail}`);
  }

  const failCount = results.filter((result) => result.status === "FAIL").length;
  const warnCount = results.filter((result) => result.status === "WARN").length;

  console.log("==================");
  console.log(`Failures: ${failCount}`);
  console.log(`Warnings: ${warnCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const results = [];

  checkOpsDefaults(results);
  await checkDatabase(results);
  await checkModels(results);
  await checkFeishu(results);
  printSummary(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

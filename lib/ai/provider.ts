import type { ModelRouteConfig } from "@prisma/client";

type ModelMessage = {
  role: "system" | "user";
  content: string;
};

type InvokeModelParams = {
  route: Pick<
    ModelRouteConfig,
    "provider" | "baseUrl" | "model" | "apiKeyEnvName" | "temperature" | "maxTokens" | "timeoutMs"
  >;
  messages: ModelMessage[];
  jsonMode?: boolean;
};

function getApiKey(route: Pick<ModelRouteConfig, "apiKeyEnvName">) {
  const value = process.env[route.apiKeyEnvName];
  if (!value) {
    throw new Error(`Model API key env "${route.apiKeyEnvName}" is not set.`);
  }
  return value;
}

function normalizeBaseUrl(baseUrl: string | null | undefined, fallback: string) {
  return (baseUrl || fallback).replace(/\/$/, "");
}

async function parseError(response: Response) {
  try {
    const payload = await response.text();
    return payload || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function invokeOpenAiStyle(params: InvokeModelParams) {
  const apiKey = getApiKey(params.route);
  const baseUrl = normalizeBaseUrl(params.route.baseUrl, "https://api.openai.com/v1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.route.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.route.model,
        temperature: params.route.temperature,
        max_tokens: params.route.maxTokens,
        response_format: params.jsonMode ? { type: "json_object" } : undefined,
        messages: params.messages
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${await parseError(response)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI-compatible response did not include message content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeAnthropic(params: InvokeModelParams) {
  const apiKey = getApiKey(params.route);
  const baseUrl = normalizeBaseUrl(params.route.baseUrl, "https://api.anthropic.com");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.route.timeoutMs);
  const systemPrompt = params.messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = params.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.route.model,
        system: systemPrompt,
        temperature: params.route.temperature,
        max_tokens: params.route.maxTokens,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${await parseError(response)}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{
        text?: string;
      }>;
    };

    const content = payload.content?.map((item) => item.text ?? "").join("\n").trim();
    if (!content) {
      throw new Error("Anthropic response did not include text content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeGemini(params: InvokeModelParams) {
  const apiKey = getApiKey(params.route);
  const baseUrl = normalizeBaseUrl(params.route.baseUrl, "https://generativelanguage.googleapis.com/v1beta");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.route.timeoutMs);
  const systemPrompt = params.messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = params.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");

  try {
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(params.route.model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: systemPrompt
            ? {
                parts: [{ text: systemPrompt }]
              }
            : undefined,
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: params.route.temperature,
            maxOutputTokens: params.route.maxTokens,
            responseMimeType: params.jsonMode ? "application/json" : "text/plain"
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${await parseError(response)}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
    if (!content) {
      throw new Error("Gemini response did not include text content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeModelText(params: InvokeModelParams) {
  switch (params.route.provider) {
    case "OPENAI":
    case "OPENAI_COMPATIBLE":
      return invokeOpenAiStyle(params);
    case "ANTHROPIC":
      return invokeAnthropic(params);
    case "GEMINI":
      return invokeGemini(params);
    default:
      throw new Error(`Unsupported model provider: ${params.route.provider satisfies never}`);
  }
}

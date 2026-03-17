import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyFeishuRequest } from "@/lib/feishu/client";
import { publishCandidate, rejectCandidate } from "@/lib/services/publishing";

function getProvidedToken(payload: Record<string, any>) {
  return payload.token ?? payload.header?.token ?? payload.event?.token ?? undefined;
}

function getActionValue(payload: Record<string, any>) {
  return payload.action?.value ?? payload.event?.action?.value ?? undefined;
}

function getReviewer(payload: Record<string, any>) {
  return (
    payload.operator?.name ??
    payload.operator?.operator_id?.user_id ??
    payload.operator?.operator_id?.open_id ??
    payload.event?.operator?.name ??
    payload.event?.operator?.operator_id?.user_id ??
    "feishu-approval"
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!rawBody) {
    return NextResponse.json({ error: "Missing request body." }, { status: 400 });
  }

  let payload: Record<string, any>;

  try {
    payload = JSON.parse(rawBody) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!verifyFeishuRequest(rawBody, request.headers, getProvidedToken(payload))) {
    return NextResponse.json({ error: "Invalid Feishu signature." }, { status: 401 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({
      challenge: payload.challenge
    });
  }

  if (payload.encrypt) {
    return NextResponse.json(
      {
        error: "Encrypted Feishu callbacks are not supported in this deployment yet."
      },
      { status: 400 }
    );
  }

  const action = getActionValue(payload);
  if (!action?.candidateId || !action?.action) {
    return NextResponse.json({
      ok: true
    });
  }

  try {
    if (action.action === "publish") {
      await publishCandidate(String(action.candidateId), getReviewer(payload));
    } else if (action.action === "reject") {
      await rejectCandidate(String(action.candidateId), getReviewer(payload));
    } else {
      return NextResponse.json({ error: "Unsupported Feishu action." }, { status: 400 });
    }

    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/subscribe");
    revalidatePath(`/preview/candidate/${String(action.candidateId)}`);

    return NextResponse.json({
      toast: {
        type: "success",
        content: action.action === "publish" ? "已发布到公开站。" : "已驳回该内容。"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        toast: {
          type: "danger",
          content: error instanceof Error ? error.message : "处理飞书审批动作时失败。"
        }
      },
      { status: 500 }
    );
  }
}

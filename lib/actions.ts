"use server";

import {
  AutoPostStatus,
  CandidateStatus,
  DigestDuration,
  DispatchStatus,
  RiskLevel,
  SourceType,
  ThoughtStatus
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearAdminSession, createAdminSession, getAdminCredentials } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durationFromTab, slugify } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const admin = getAdminCredentials();

  if (email !== admin.email || password !== admin.password) {
    redirect("/admin/login?error=1");
  }

  await createAdminSession();
  redirect("/admin/queue");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/");
}

export async function subscribeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const interest = String(formData.get("interest") ?? "主情报流").trim();
  const duration = String(formData.get("duration") ?? "3").trim();
  const frequency = String(formData.get("frequency") ?? "工作日").trim();

  if (!email) {
    redirect("/subscribe?error=1");
  }

  await prisma.subscriber.upsert({
    where: {
      email
    },
    update: {
      name: name || null,
      interest,
      defaultDuration: durationFromTab(duration),
      frequency,
      active: true
    },
    create: {
      email,
      name: name || null,
      interest,
      defaultDuration: durationFromTab(duration),
      frequency,
      active: true
    }
  });

  revalidatePath("/");
  revalidatePath("/subscribe");
  revalidatePath("/admin/subscribers");
  redirect("/subscribe?success=1");
}

export async function createSourceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!name || !url) {
    return;
  }

  await prisma.source.create({
    data: {
      name,
      slug: slugify(name),
      type: String(formData.get("type") ?? "RSS") === "WEB" ? SourceType.WEB : SourceType.RSS,
      url,
      description: String(formData.get("description") ?? "").trim(),
      frequency: String(formData.get("frequency") ?? "每日").trim(),
      priority: Number(formData.get("priority") ?? 70),
      trustScore: Number(formData.get("trustScore") ?? 70),
      tags: String(formData.get("tags") ?? "ai").trim()
    }
  });

  revalidatePath("/admin/sources");
}

export async function toggleSourceAction(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";

  await prisma.source.update({
    where: {
      id: sourceId
    },
    data: {
      enabled
    }
  });

  revalidatePath("/admin/sources");
}

export async function saveWorkflowAction(formData: FormData) {
  const workflowId = String(formData.get("workflowId") ?? "");

  await prisma.workflowConfig.update({
    where: {
      id: workflowId
    },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      summaryPrompt: String(formData.get("summaryPrompt") ?? "").trim(),
      highlightPrompt: String(formData.get("highlightPrompt") ?? "").trim(),
      riskKeywords: String(formData.get("riskKeywords") ?? "").trim(),
      autoPublishMinTrust: Number(formData.get("autoPublishMinTrust") ?? 70),
      digestRuleThree: String(formData.get("digestRuleThree") ?? "").trim(),
      digestRuleEight: String(formData.get("digestRuleEight") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim()
    }
  });

  revalidatePath("/admin/workflows");
}

export async function reviewCandidateAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const candidate = await prisma.candidateItem.findUnique({
    where: {
      id: candidateId
    },
    include: {
      source: true
    }
  });

  if (!candidate) {
    return;
  }

  if (decision === "publish") {
    await prisma.candidateItem.update({
      where: {
        id: candidateId
      },
      data: {
        status: CandidateStatus.PUBLISHED,
        riskLevel: RiskLevel.LOW,
        publishedAt: new Date()
      }
    });

    await prisma.autoPost.upsert({
      where: {
        candidateItemId: candidateId
      },
      update: {
        title: candidate.title,
        summary: candidate.aiSummary,
        worthReading: candidate.worthReading,
        body: candidate.rawContent,
        tags: candidate.tags,
        sourceLabel: candidate.source.name,
        sourceUrl: candidate.normalizedUrl,
        status: AutoPostStatus.PUBLISHED,
        publishedAt: new Date()
      },
      create: {
        candidateItemId: candidateId,
        title: candidate.title,
        summary: candidate.aiSummary,
        worthReading: candidate.worthReading,
        body: candidate.rawContent,
        tags: candidate.tags,
        sourceLabel: candidate.source.name,
        sourceUrl: candidate.normalizedUrl,
        status: AutoPostStatus.PUBLISHED,
        publishedAt: new Date()
      }
    });
  }

  if (decision === "reject") {
    await prisma.candidateItem.update({
      where: {
        id: candidateId
      },
      data: {
        status: CandidateStatus.REJECTED
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/queue");
}

export async function createThoughtAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return;
  }

  const slug = slugify(title);

  await prisma.thoughtPost.upsert({
    where: {
      slug
    },
    update: {
      excerpt: String(formData.get("excerpt") ?? "").trim(),
      body: String(formData.get("body") ?? "").trim(),
      authorName: String(formData.get("authorName") ?? "中心研究组").trim(),
      status:
        String(formData.get("status") ?? "DRAFT") === "PUBLISHED"
          ? ThoughtStatus.PUBLISHED
          : ThoughtStatus.DRAFT,
      publishedAt:
        String(formData.get("status") ?? "DRAFT") === "PUBLISHED" ? new Date() : null
    },
    create: {
      slug,
      title,
      excerpt: String(formData.get("excerpt") ?? "").trim(),
      body: String(formData.get("body") ?? "").trim(),
      authorName: String(formData.get("authorName") ?? "中心研究组").trim(),
      status:
        String(formData.get("status") ?? "DRAFT") === "PUBLISHED"
          ? ThoughtStatus.PUBLISHED
          : ThoughtStatus.DRAFT,
      publishedAt:
        String(formData.get("status") ?? "DRAFT") === "PUBLISHED" ? new Date() : null
    }
  });

  revalidatePath("/thoughts");
  revalidatePath("/admin/thoughts");
}

export async function queueDigestDispatchAction(formData: FormData) {
  const digestId = String(formData.get("digestId") ?? "");

  const [digest, subscribers] = await Promise.all([
    prisma.digest.findUnique({
      where: {
        id: digestId
      }
    }),
    prisma.subscriber.findMany({
      where: {
        active: true
      }
    })
  ]);

  if (!digest) {
    return;
  }

  for (const subscriber of subscribers) {
    await prisma.emailDispatch.create({
      data: {
        subscriberId: subscriber.id,
        digestId,
        status: DispatchStatus.PENDING,
        subject: `${subscriber.defaultDuration === DigestDuration.THREE ? "3" : "8"} 分钟版 AI 情报日报`,
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
        notes: "由后台重新生成发送任务。"
      }
    });
  }

  revalidatePath("/admin/digests");
  revalidatePath("/admin/subscribers");
}

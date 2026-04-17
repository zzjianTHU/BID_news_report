"use server";

import { SourceType, ThoughtStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearAdminSession, createAdminSession, getAdminCredentials } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueDigestDispatches } from "@/lib/services/digest";
import { installLocalSchedulerTasks, removeLocalSchedulerTasks } from "@/lib/services/local-scheduler";
import { publishCandidate, rejectCandidate } from "@/lib/services/publishing";
import { runWorkerTask } from "@/lib/services/worker";
import { durationFromTab, slugify } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const admin = getAdminCredentials();

  if (email !== admin.email || password !== admin.password) {
    redirect("/admin/login?error=1");
  }

  await createAdminSession();
  redirect("/admin");
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

export async function saveSchedulerConfigAction(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const ingestIntervalMinutes = Number(formData.get("ingestIntervalMinutes") ?? 15);
  const sourceSyncIntervalMinutes = Number(formData.get("sourceSyncIntervalMinutes") ?? 60);
  const controlPlaneSyncIntervalMinutes = Number(formData.get("controlPlaneSyncIntervalMinutes") ?? 60);
  const draftSyncIntervalMinutes = Number(formData.get("draftSyncIntervalMinutes") ?? 15);
  const digestGenerationHour = Number(formData.get("digestGenerationHour") ?? 20);
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.schedulerConfig.upsert({
    where: {
      key: "default"
    },
    update: {
      enabled,
      ingestIntervalMinutes,
      sourceSyncIntervalMinutes,
      controlPlaneSyncIntervalMinutes,
      draftSyncIntervalMinutes,
      digestGenerationHour,
      notes: notes || null
    },
    create: {
      key: "default",
      enabled,
      ingestIntervalMinutes,
      sourceSyncIntervalMinutes,
      controlPlaneSyncIntervalMinutes,
      draftSyncIntervalMinutes,
      digestGenerationHour,
      notes: notes || null
    }
  });

  revalidatePath("/admin/scheduler");
  revalidatePath("/admin");
}

export async function runWorkerTaskAction(formData: FormData) {
  const task = String(formData.get("task") ?? "").trim();

  if (!task) {
    return;
  }

  await runWorkerTask(task as Parameters<typeof runWorkerTask>[0]);

  const schedulerUpdate: Record<string, Date | undefined> = {};
  const now = new Date();

  if (task === "sync-feishu-sources") {
    schedulerUpdate.lastSourceSyncAt = now;
  }

  if (task === "sync-feishu-control-plane") {
    schedulerUpdate.lastControlPlaneSyncAt = now;
  }

  if (task === "run-ingest-cycle") {
    schedulerUpdate.lastIngestRunAt = now;
  }

  if (task === "sync-feishu-draft-decisions") {
    schedulerUpdate.lastDraftSyncAt = now;
  }

  if (task === "generate-digest") {
    schedulerUpdate.lastDigestRunAt = now;
  }

  if (Object.keys(schedulerUpdate).length > 0) {
    await prisma.schedulerConfig.upsert({
      where: {
        key: "default"
      },
      update: schedulerUpdate,
      create: {
        key: "default",
        ...schedulerUpdate
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/ops");
  revalidatePath("/admin");
  revalidatePath("/admin/scheduler");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/queue");
}

export async function installLocalSchedulerAction() {
  const scheduler = await prisma.schedulerConfig.upsert({
    where: {
      key: "default"
    },
    update: {},
    create: {
      key: "default"
    }
  });

  await installLocalSchedulerTasks(scheduler);

  revalidatePath("/admin");
  revalidatePath("/admin/scheduler");
}

export async function removeLocalSchedulerAction() {
  const scheduler = await prisma.schedulerConfig.upsert({
    where: {
      key: "default"
    },
    update: {},
    create: {
      key: "default"
    }
  });

  await removeLocalSchedulerTasks(scheduler);

  revalidatePath("/admin");
  revalidatePath("/admin/scheduler");
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
    await publishCandidate(candidateId, "admin-manual-review");
  }

  if (decision === "reject") {
    await rejectCandidate(candidateId, "admin-manual-review");
  }

  revalidatePath("/");
  revalidatePath("/ops");
  revalidatePath("/admin");
  revalidatePath("/admin/queue");
}

export async function bulkReviewCandidatesAction(formData: FormData) {
  const candidateIds = formData
    .getAll("candidateIds")
    .map((value) => String(value))
    .filter(Boolean);
  const decision = String(formData.get("decision") ?? "");

  if (candidateIds.length === 0) {
    return { count: 0, decision, ok: false };
  }

  for (const candidateId of candidateIds) {
    if (decision === "publish") {
      await publishCandidate(candidateId, "admin-bulk-review");
    }

    if (decision === "reject") {
      await rejectCandidate(candidateId, "admin-bulk-review");
    }
  }

  revalidatePath("/");
  revalidatePath("/ops");
  revalidatePath("/admin");
  revalidatePath("/admin/queue");

  return {
    count: candidateIds.length,
    decision,
    ok: true
  };
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

  await queueDigestDispatches(digestId, new Date(Date.now() + 60 * 60 * 1000));

  revalidatePath("/admin/digests");
  revalidatePath("/admin/subscribers");
}

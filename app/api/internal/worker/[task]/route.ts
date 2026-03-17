import { NextResponse } from "next/server";

import { getWorkerSharedSecret } from "@/lib/env";
import { runWorkerTask, workerTasks } from "@/lib/services/worker";

function getProvidedSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-worker-secret");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> }
) {
  const { task } = await params;

  if (!workerTasks.includes(task as (typeof workerTasks)[number])) {
    return NextResponse.json({ error: "Unknown worker task." }, { status: 404 });
  }

  if (getProvidedSecret(request) !== getWorkerSharedSecret()) {
    return NextResponse.json({ error: "Unauthorized worker invocation." }, { status: 401 });
  }

  try {
    const result = await runWorkerTask(task as (typeof workerTasks)[number]);

    return NextResponse.json({
      ok: true,
      task,
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        task,
        error: error instanceof Error ? error.message : "Worker task failed."
      },
      { status: 500 }
    );
  }
}

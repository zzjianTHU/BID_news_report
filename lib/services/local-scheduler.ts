import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SchedulerConfig } from "@prisma/client";

const execFileAsync = promisify(execFile);
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const SCHTASKS = "C:\\Windows\\System32\\schtasks.exe";
const TASK_PREFIX = "BID News";

export type LocalTaskStatus = {
  taskName: string;
  label: string;
  schedule: string;
  command: string;
  exists: boolean;
  state: string | null;
  lastRunTime: string | null;
  nextRunTime: string | null;
};

type LocalTaskDefinition = {
  taskName: string;
  label: string;
  schedule: string;
  command: string;
  createArgs: string[];
};

function buildWorkerCommand(task: string) {
  const workspace = process.cwd().replace(/'/g, "''");
  return `${POWERSHELL} -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '${workspace}'; npm run worker:${task}"`;
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  const wrappedTimestamp = normalized.match(/\/Date\((\d+)(?:[-+]\d+)?\)\//);

  if (wrappedTimestamp) {
    const timestamp = Number(wrappedTimestamp[1]);
    if (!Number.isFinite(timestamp) || timestamp < 946684800000) {
      return null;
    }

    return new Date(timestamp).toISOString();
  }

  if (normalized.startsWith("0001") || normalized.startsWith("1899")) {
    return null;
  }

  return normalized;
}

function buildTaskDefinitions(config: SchedulerConfig): LocalTaskDefinition[] {
  return [
    {
      taskName: `${TASK_PREFIX} - Sync Sources`,
      label: "飞书来源同步",
      schedule: `每 ${config.sourceSyncIntervalMinutes} 分钟`,
      command: buildWorkerCommand("sync-feishu-sources"),
      createArgs: [
        "/Create",
        "/TN",
        `${TASK_PREFIX} - Sync Sources`,
        "/SC",
        "MINUTE",
        "/MO",
        String(config.sourceSyncIntervalMinutes),
        "/TR",
        buildWorkerCommand("sync-feishu-sources"),
        "/F"
      ]
    },
    {
      taskName: `${TASK_PREFIX} - Sync Control Plane`,
      label: "模型与工作流同步",
      schedule: `每 ${config.controlPlaneSyncIntervalMinutes} 分钟`,
      command: buildWorkerCommand("sync-feishu-control-plane"),
      createArgs: [
        "/Create",
        "/TN",
        `${TASK_PREFIX} - Sync Control Plane`,
        "/SC",
        "MINUTE",
        "/MO",
        String(config.controlPlaneSyncIntervalMinutes),
        "/TR",
        buildWorkerCommand("sync-feishu-control-plane"),
        "/F"
      ]
    },
    {
      taskName: `${TASK_PREFIX} - Ingest Cycle`,
      label: "抓取轮询",
      schedule: `每 ${config.ingestIntervalMinutes} 分钟`,
      command: buildWorkerCommand("run-ingest-cycle"),
      createArgs: [
        "/Create",
        "/TN",
        `${TASK_PREFIX} - Ingest Cycle`,
        "/SC",
        "MINUTE",
        "/MO",
        String(config.ingestIntervalMinutes),
        "/TR",
        buildWorkerCommand("run-ingest-cycle"),
        "/F"
      ]
    },
    {
      taskName: `${TASK_PREFIX} - Sync Draft Decisions`,
      label: "飞书审核结果同步",
      schedule: `每 ${config.draftSyncIntervalMinutes} 分钟`,
      command: buildWorkerCommand("sync-feishu-draft-decisions"),
      createArgs: [
        "/Create",
        "/TN",
        `${TASK_PREFIX} - Sync Draft Decisions`,
        "/SC",
        "MINUTE",
        "/MO",
        String(config.draftSyncIntervalMinutes),
        "/TR",
        buildWorkerCommand("sync-feishu-draft-decisions"),
        "/F"
      ]
    },
    {
      taskName: `${TASK_PREFIX} - Generate Digest`,
      label: "Digest 生成",
      schedule: `每天 ${padTime(config.digestGenerationHour)}:00`,
      command: buildWorkerCommand("generate-digest"),
      createArgs: [
        "/Create",
        "/TN",
        `${TASK_PREFIX} - Generate Digest`,
        "/SC",
        "DAILY",
        "/ST",
        `${padTime(config.digestGenerationHour)}:00`,
        "/TR",
        buildWorkerCommand("generate-digest"),
        "/F"
      ]
    }
  ];
}

async function queryTaskStatus(definition: LocalTaskDefinition): Promise<LocalTaskStatus> {
  const script = `
$task = Get-ScheduledTask -TaskName '${definition.taskName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue
if ($null -eq $task) {
  [pscustomobject]@{
    Exists = $false
    State = $null
    LastRunTime = $null
    NextRunTime = $null
  } | ConvertTo-Json -Compress
  exit 0
}
$info = Get-ScheduledTaskInfo -TaskName '${definition.taskName.replace(/'/g, "''")}'
[pscustomobject]@{
  Exists = $true
  State = $task.State.ToString()
  LastRunTime = $info.LastRunTime
  NextRunTime = $info.NextRunTime
} | ConvertTo-Json -Compress
`;

  try {
    const { stdout } = await execFileAsync(POWERSHELL, ["-NoProfile", "-Command", script]);
    const parsed = JSON.parse(stdout.trim()) as {
      Exists: boolean;
      State?: string | null;
      LastRunTime?: string | null;
      NextRunTime?: string | null;
    };

    return {
      taskName: definition.taskName,
      label: definition.label,
      schedule: definition.schedule,
      command: definition.command,
      exists: parsed.Exists,
      state: parsed.State ?? null,
      lastRunTime: parseDateString(parsed.LastRunTime),
      nextRunTime: parseDateString(parsed.NextRunTime)
    };
  } catch {
    return {
      taskName: definition.taskName,
      label: definition.label,
      schedule: definition.schedule,
      command: definition.command,
      exists: false,
      state: "UNKNOWN",
      lastRunTime: null,
      nextRunTime: null
    };
  }
}

export async function getLocalSchedulerTasks(config: SchedulerConfig) {
  const definitions = buildTaskDefinitions(config);
  return Promise.all(definitions.map((definition) => queryTaskStatus(definition)));
}

export async function installLocalSchedulerTasks(config: SchedulerConfig) {
  const definitions = buildTaskDefinitions(config);

  for (const definition of definitions) {
    await execFileAsync(SCHTASKS, definition.createArgs, {
      windowsHide: true
    });
  }

  return getLocalSchedulerTasks(config);
}

export async function removeLocalSchedulerTasks(config: SchedulerConfig) {
  const definitions = buildTaskDefinitions(config);

  for (const definition of definitions) {
    try {
      await execFileAsync(
        SCHTASKS,
        ["/Delete", "/TN", definition.taskName, "/F"],
        {
          windowsHide: true
        }
      );
    } catch {
      // Task might not exist; safe to ignore.
    }
  }

  return getLocalSchedulerTasks(config);
}

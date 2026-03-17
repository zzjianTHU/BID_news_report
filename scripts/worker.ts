import { runWorkerTask, workerTasks } from "../lib/services/worker";
import { prisma } from "../lib/prisma";

async function main() {
  const task = process.argv[2];

  if (!task || !workerTasks.includes(task as (typeof workerTasks)[number])) {
    throw new Error(`Unknown worker task "${task ?? ""}". Supported tasks: ${workerTasks.join(", ")}`);
  }

  const result = await runWorkerTask(task as (typeof workerTasks)[number]);
  console.log(JSON.stringify({ task, result }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

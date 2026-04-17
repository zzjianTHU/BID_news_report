import { prisma } from "../lib/prisma";
import {
  getLocalSchedulerTasks,
  installLocalSchedulerTasks,
  removeLocalSchedulerTasks
} from "../lib/services/local-scheduler";

async function main() {
  const mode = process.argv[2] ?? "status";

  const scheduler = await prisma.schedulerConfig.upsert({
    where: {
      key: "default"
    },
    update: {},
    create: {
      key: "default"
    }
  });

  if (mode === "apply") {
    const tasks = await installLocalSchedulerTasks(scheduler);
    console.log(JSON.stringify({ mode, tasks }, null, 2));
    return;
  }

  if (mode === "remove") {
    const tasks = await removeLocalSchedulerTasks(scheduler);
    console.log(JSON.stringify({ mode, tasks }, null, 2));
    return;
  }

  const tasks = await getLocalSchedulerTasks(scheduler);
  console.log(JSON.stringify({ mode: "status", tasks }, null, 2));
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

import { prisma } from "../lib/prisma";
import { runWorkerTask } from "../lib/services/worker";

async function main() {
  const result = await runWorkerTask("run-ingest-cycle");
  console.log(JSON.stringify(result, null, 2));
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

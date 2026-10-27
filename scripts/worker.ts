// Background worker: renders paid receipts into print files.
// Run alongside the Next server: `npm run worker`.
import "./load-env";
import { getDb } from "@/lib/server/db";
import { requeueStuckJobs } from "@/lib/server/jobs";
import { errorMessage, log } from "@/lib/server/log";
import { closeBrowser } from "@/lib/server/render";
import { purgeExpiredPhotos, runNextJob } from "@/lib/server/worker";

const IDLE_MS = 2_000;
const HOUSEKEEPING_MS = 60 * 60_000;

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    log.info("worker.stopping", { signal });
  });
}

async function main() {
  const db = getDb();
  log.info("worker.started", { requeued: requeueStuckJobs(db) });
  let lastHousekeeping = 0;

  while (!stopping) {
    try {
      if (Date.now() - lastHousekeeping > HOUSEKEEPING_MS) {
        lastHousekeeping = Date.now();
        requeueStuckJobs(db);
        await purgeExpiredPhotos(db);
      }
      const didWork = await runNextJob(db);
      if (!didWork) await new Promise((r) => setTimeout(r, IDLE_MS));
    } catch (err) {
      log.error("worker.loop_error", { error: errorMessage(err) });
      await new Promise((r) => setTimeout(r, IDLE_MS));
    }
  }
  await closeBrowser();
  db.close();
}

main().catch((err) => {
  log.error("worker.crashed", { error: errorMessage(err) });
  process.exit(1);
});

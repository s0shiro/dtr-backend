import cron from "node-cron";
import { executeAutoClockOut } from "./cron.js";

const timezone = "Asia/Manila";

console.log(`[Test Cron] Starting test scheduler (Timezone: ${timezone}) - running every 10 seconds`);

const job = cron.schedule("*/10 * * * * *", async () => {
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
  console.log(`[Test Cron] Triggering executeAutoClockOut() at ${now}`);
  
  try {
    await executeAutoClockOut();
    console.log(`[Test Cron] Finished executeAutoClockOut() trigger for ${now}`);
  } catch (error) {
    console.error(`[Test Cron] Error during executeAutoClockOut()`, error);
  }
}, { timezone });

job.start();

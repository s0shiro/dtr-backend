import { createServer } from "node:http";

import { app } from "./app.js";
import { env } from "./config/db.js";
import { initCronJobs } from "./services/cron.js";

const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
  initCronJobs();
});

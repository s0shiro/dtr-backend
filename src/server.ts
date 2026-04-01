import { createServer } from "node:http";

import { app } from "./app";
import { env } from "./config/db";

const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});

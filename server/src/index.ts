import "dotenv/config";
import { createApp } from "./app";
import { env } from "./env";

createApp().listen(env.PORT, () => {
  console.log(`SentryPhish API listening on :${env.PORT}`);
});

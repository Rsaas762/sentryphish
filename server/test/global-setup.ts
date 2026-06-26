import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.test" });

export default function () {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env },
  });
}

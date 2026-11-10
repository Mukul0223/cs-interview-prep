import { execSync } from "node:child_process";
export default async function () {
  console.log("Setting up test database...");
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
    stdio: "inherit",
  });

  console.log("Test database ready!");
}

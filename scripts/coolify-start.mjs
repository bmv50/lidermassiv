import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const stateRoot = process.env.SITES_RUNTIME_ROOT || "/data";
const persistTo = path.join(stateRoot, "wrangler", "state");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const config = path.join(root, "dist", "server", "wrangler.json");
// Wrangler resolves .dev.vars beside --config, not from the process cwd.
const varsFile = path.join(path.dirname(config), ".dev.vars");

mkdirSync(persistTo, { recursive: true });

const runtimeVars = ["PUBLIC_ORIGIN", "ADMIN_LOGIN", "ADMIN_PASSWORD_HASH", "CONSULTANT_PROVIDER", "CONSULTANT_DAILY_LIMIT", "YANDEX_API_KEY", "YANDEX_FOLDER_ID", "YANDEX_MODEL", "CONSULTANT_N8N_URL", "CONSULTANT_N8N_TOKEN"];
const vars = runtimeVars
  .filter((name) => process.env[name] !== undefined)
  .map((name) => `${name}=${JSON.stringify(process.env[name])}`);
vars.push("DEMO_MODE=true");
writeFileSync(varsFile, `${vars.join("\n")}\n`, { mode: 0o600 });
chmodSync(varsFile, 0o600);

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Wrangler exited (${signal || code}).`));
    });
  });
}

await run([
  "d1", "execute", "DB", "--local", "--yes",
  "--persist-to", persistTo,
  "--config", config,
  "--file", path.join(root, "deploy", "schema.sql"),
]);

const server = spawn(process.execPath, [
  wrangler, "dev", "--config", config, "--local",
  "--persist-to", persistTo,
  "--ip", "0.0.0.0",
  "--port", String(process.env.PORT || "8787"),
  "--inspector-port", "0",
  "--show-interactive-dev-session=false",
], { cwd: root, stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.once("error", (error) => {
  console.error("Failed to start the Wrangler server.", error);
  process.exitCode = 1;
});
server.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

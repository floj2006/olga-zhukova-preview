import { loadLocalEnvironment } from "../server/index.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  hashPassword,
  validPasswordHash,
  verifyPassword,
} from "../server/security.mjs";
const script = fileURLToPath(
  new URL("../scripts/setup-admin.mjs", import.meta.url),
);
async function run(source = "", extra = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "olga-admin-setup-"));
  if (source) await writeFile(path.join(root, ".env.local"), source);
  const env = { ...process.env };
  delete env.ADMIN_SETUP_PASSWORD;
  delete env.ADMIN_SETUP_ORIGIN;
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...env, ...extra },
    encoding: "utf8",
    windowsHide: true,
  });
  return { root, ...result };
}
test("fresh access uses chosen local origin without logging credentials", async () => {
  const result = await run("", { ADMIN_SETUP_ORIGIN: "http://127.0.0.1:4174" });
  assert.equal(result.status, 0);
  const env = await readFile(path.join(result.root, ".env.local"), "utf8");
  const access = await readFile(
    path.join(result.root, "artifacts/admin-access.txt"),
    "utf8",
  );
  assert.ok(/^APP_ORIGIN=http:\/\/127\.0\.0\.1:4174$/m.test(env));
  const rawHash = env.match(/^ADMIN_PASSWORD_HASH=(.+)$/m)?.[1];
  assert.ok(
    rawHash &&
      rawHash.includes("\\$") &&
      /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(
        rawHash.replace(/\\\$/g, "$"),
      ),
    "Hash delimiters are escaped for Next",
  );
  const password = access.match(/^Password: (.+)$/m)?.[1];
  assert.ok(
    password &&
      !result.stdout.includes(password) &&
      !result.stderr.includes(password),
    "Password is written privately only",
  );
});
test("copied example with empty fields can be initialized without duplicate settings", async () => {
  const example = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  const result = await run(example);
  assert.equal(result.status, 0);
  const env = await readFile(path.join(result.root, ".env.local"), "utf8");
  for (const name of [
    "ADMIN_PASSWORD_HASH",
    "ADMIN_SESSION_SECRET",
    "APP_ORIGIN",
  ]) {
    assert.equal(
      env.split(/\r?\n/).filter((line) => line.startsWith(name + "=")).length,
      1,
    );
  }
});
test("existing escaped access is preserved", async () => {
  const source =
    "ADMIN_PASSWORD_HASH=" +
    (await hashPassword("private-setup-test-password")).replace(/\$/g, "\\$") +
    "\nADMIN_SESSION_SECRET=" +
    "a".repeat(48) +
    "\n";
  const result = await run(source);
  assert.equal(result.status, 1);
  assert.ok(
    (await readFile(path.join(result.root, ".env.local"), "utf8")) === source,
    "Settings are unchanged",
  );
});
test("partial settings are not overwritten", async () => {
  const source =
    "ADMIN_PASSWORD_HASH=\nADMIN_SESSION_SECRET=" + "b".repeat(48) + "\n";
  const result = await run(source);
  assert.equal(result.status, 1);
  assert.ok(
    (await readFile(path.join(result.root, ".env.local"), "utf8")) === source,
    "Partial settings are preserved",
  );
});
test("invalid origin refuses access generation", async () => {
  const result = await run("", {
    ADMIN_SETUP_ORIGIN: "http://untrusted.example/path",
  });
  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(path.join(result.root, ".env.local")), {
    code: "ENOENT",
  });
});
test("existing private access file cannot be overwritten", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "olga-admin-access-existing-"),
  );
  await mkdir(path.join(root, "artifacts"));
  const access = path.join(root, "artifacts/admin-access.txt");
  await writeFile(access, "Existing private access");
  const env = { ...process.env };
  delete env.ADMIN_SETUP_PASSWORD;
  delete env.ADMIN_SETUP_ORIGIN;
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.ok(
    (await readFile(access, "utf8")) === "Existing private access",
    "Existing access file is unchanged",
  );
});

test("Next environment loader keeps generated hash valid and password usable", async () => {
  const password = "private-next-env-test-password";
  const result = await run("", { ADMIN_SETUP_PASSWORD: password });
  assert.equal(result.status, 0);
  const env = { ...process.env, SETUP_TEST_ROOT: result.root };
  delete env.ADMIN_PASSWORD_HASH;
  delete env.ADMIN_SESSION_SECRET;
  delete env.APP_ORIGIN;
  const securityURL = new URL("../server/security.mjs", import.meta.url).href;
  const code = [
    'import nextEnv from "@next/env";',
    "import {validPasswordHash,verifyPassword} from " +
      JSON.stringify(securityURL) +
      ";",
    "nextEnv.loadEnvConfig(process.env.SETUP_TEST_ROOT,false,{info(){},error(){}},true);",
    "if (!validPasswordHash(process.env.ADMIN_PASSWORD_HASH)) process.exit(2);",
    'if (!(await verifyPassword("private-next-env-test-password",process.env.ADMIN_PASSWORD_HASH))) process.exit(3);',
  ].join("\n");
  const loaded = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.ok(
    loaded.status === 0,
    "Real Next env loader verifies the generated private access",
  );
  assert.ok(
    !loaded.stdout.includes(password) && !loaded.stderr.includes(password),
    "No password logging",
  );
});

test("raw existing hash is escaped without replacing credentials or access file", async () => {
  const hash = await hashPassword("private-normalize-test-password");
  const secret = "c".repeat(48);
  const source =
    "ADMIN_PASSWORD_HASH=" +
    hash +
    "\nADMIN_SESSION_SECRET=" +
    secret +
    "\nAPP_ORIGIN=http://127.0.0.1:4174\n";
  const result = await run(source);
  assert.equal(result.status, 0);
  const normalized = await readFile(
    path.join(result.root, ".env.local"),
    "utf8",
  );
  assert.ok(
    normalized.includes("ADMIN_PASSWORD_HASH=" + hash.replace(/\$/g, "\\$")),
  );
  assert.ok(normalized.includes("ADMIN_SESSION_SECRET=" + secret));
  await assert.rejects(
    readFile(path.join(result.root, "artifacts/admin-access.txt")),
    { code: "ENOENT" },
  );
});

test("local CLI loader decodes the same generated access and preserves explicit variables", async () => {
  const password = "private-cli-env-test-password";
  const result = await run("", { ADMIN_SETUP_PASSWORD: password });
  assert.equal(result.status, 0);
  const target = {
    NODE_ENV: "development",
    ADMIN_SESSION_SECRET: "existing-explicit-secret",
  };
  await loadLocalEnvironment(result.root, target);
  assert.ok(
    validPasswordHash(target.ADMIN_PASSWORD_HASH),
    "Generated CLI hash remains valid",
  );
  assert.ok(
    await verifyPassword(password, target.ADMIN_PASSWORD_HASH),
    "Same password works in CLI environment",
  );
  assert.equal(target.ADMIN_SESSION_SECRET, "existing-explicit-secret");
  const production = { NODE_ENV: "production" };
  await loadLocalEnvironment(result.root, production);
  assert.ok(
    !production.ADMIN_PASSWORD_HASH,
    "Production ignores local credential files",
  );
});

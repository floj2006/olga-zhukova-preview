import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { hashPassword, validPasswordHash } from "../server/security.mjs";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const accessPath = path.join(root, "artifacts", "admin-access.txt");
let existing = "";
try {
  existing = await readFile(envPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
function setting(name) {
  const rows = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(name + "="));
  if (rows.length > 1)
    throw new Error(
      "Duplicate setting: " + name + ". Resolve it before setting up access.",
    );
  const value = rows[0]?.slice(name.length + 1).trim() || "";
  const decoded = /^(".*"|'.*')$/.test(value) ? value.slice(1, -1) : value;
  return decoded.replace(/\\\$/g, "$");
}
function replaceSetting(source, name, value) {
  const rows = source.split(/\r?\n/);
  const index = rows.findIndex((line) => line.trim().startsWith(name + "="));
  if (index >= 0) rows[index] = name + "=" + value;
  else rows.push(name + "=" + value);
  return rows.join("\n");
}
const envHash = (hash) => hash.replace(/\$/g, "\\$");
const currentHash = setting("ADMIN_PASSWORD_HASH");
const currentSecret = setting("ADMIN_SESSION_SECRET");
if (currentHash || currentSecret) {
  if (validPasswordHash(currentHash) && currentSecret.length >= 32) {
    const normalized = replaceSetting(
      existing,
      "ADMIN_PASSWORD_HASH",
      envHash(currentHash),
    );
    if (normalized !== existing) {
      await writeFile(envPath, normalized, { mode: 0o600 });
      console.log(
        "Admin hash escaping corrected for Next.js. Existing password and signing secret are unchanged. Restart the local server.",
      );
    } else {
      console.error(
        "Admin access already exists. Nothing changed. Use the existing private access file.",
      );
      process.exitCode = 1;
    }
  } else {
    console.error(
      "Admin settings are partly filled or invalid. Nothing changed. Restore both settings or clear both empty setup fields before generating new access.",
    );
    process.exitCode = 1;
  }
} else {
  const originValue =
    process.env.ADMIN_SETUP_ORIGIN ||
    setting("APP_ORIGIN") ||
    "http://127.0.0.1:4173";
  let originURL;
  try {
    originURL = new URL(originValue);
  } catch {
    throw new Error("ADMIN_SETUP_ORIGIN is not a valid origin.");
  }
  const localHost = ["127.0.0.1", "localhost", "[::1]"].includes(
    originURL.hostname,
  );
  if (
    (originURL.protocol !== "https:" &&
      !(originURL.protocol === "http:" && localHost)) ||
    originURL.username ||
    originURL.password ||
    originURL.pathname !== "/" ||
    originURL.search ||
    originURL.hash
  )
    throw new Error(
      "ADMIN_SETUP_ORIGIN must be a local HTTP or HTTPS origin without a path.",
    );

  const password =
    process.env.ADMIN_SETUP_PASSWORD || randomBytes(18).toString("base64url");
  const hash = await hashPassword(password);
  const secret = randomBytes(48).toString("base64url");
  let contents = replaceSetting(
    existing.trimEnd(),
    "APP_ORIGIN",
    originURL.origin,
  );
  contents = replaceSetting(contents, "ADMIN_PASSWORD_HASH", envHash(hash));
  contents = replaceSetting(contents, "ADMIN_SESSION_SECRET", secret);
  await mkdir(path.dirname(accessPath), { recursive: true });
  // Credentials stay private and are never printed or served as public assets.
  await writeFile(
    accessPath,
    "Local administration: " +
      originURL.origin +
      "/admin/\nPassword: " +
      password +
      "\n\nPrivate file. Do not publish or commit.\n",
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(envPath, contents.trim() + "\n", { mode: 0o600 });
  console.log(
    "Admin access prepared: artifacts/admin-access.txt. Settings: .env.local. Restart the local server.",
  );
}

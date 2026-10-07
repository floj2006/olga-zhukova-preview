import { lstat } from "node:fs/promises";
import { readdir, readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadLocalEnvironment } from "../server/index.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const release = await mkdtemp(path.join(artifacts, "release-"));
const bundle = path.join(release, "site");
await mkdir(bundle);
const env = { NODE_ENV: "development" };
await loadLocalEnvironment(root, env);
const secrets = [
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SESSION_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_ACCESS_TOKEN",
  "VK_COMMUNITY_TOKEN",
  "VERCEL_TOKEN",
]
  .map((key) => env[key])
  .filter((value) => value && value.length >= 12);
const files = [];
async function copy(relative) {
  const source = path.join(root, relative);
  if ((await lstat(source)).isSymbolicLink()) throw Error("Symlinks are not included in releases");
  const data = await readFile(source);
  if (secrets.some((secret) => data.includes(Buffer.from(secret))))
    throw Error("Private configuration found in " + relative);
  const target = path.join(bundle, relative);
  const resolved = path.relative(bundle, target);
  if (resolved.startsWith("..") || path.isAbsolute(resolved))
    throw Error("Unsafe release path");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  files.push({
    path: relative.replaceAll(path.sep, "/"),
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
async function tree(relative) {
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink())
      throw Error("Symlinks are not included in releases");
    if (
      entry.name.startsWith(".") ||
      /\.(?:log|pem|key)$/i.test(entry.name) ||
      entry.name === "admin-access.txt"
    )
      throw Error("Private file in release source: " + entry.name);
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) await tree(name);
    else await copy(name);
  }
}
for (const directory of ["app", "components", "lib", "server", "public"])
  await tree(directory);
for (const file of [
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "vercel.json",
  ".vercelignore",
  ".nvmrc",
  "scripts/prepare-public.mjs",
])
  await copy(file);
const archive = path.join(release, "site.tgz");
const result = spawnSync("tar", ["-czf", archive, "-C", bundle, "."], {
  encoding: "utf8",
  windowsHide: true,
});
if (result.status !== 0)
  throw Error(result.stderr || "Could not create release archive");
const contents = spawnSync("tar", ["-tzf", archive], {
  encoding: "utf8",
  windowsHide: true,
});
if (
  contents.status !== 0 ||
  /(?:^|\/)\.env|(?:^|\/)(?:\.data|\.git|artifacts|node_modules|\.next)(?:\/|$)/m.test(
    contents.stdout,
  )
)
  throw Error("Release archive contains an excluded directory");
await writeFile(
  path.join(release, "manifest.json"),
  JSON.stringify({ created: new Date().toISOString(), files }, null, 2),
);
console.log(
  JSON.stringify(
    {
      directory: release,
      archive,
      files: files.length,
      bytes: files.reduce((n, file) => n + file.bytes, 0),
      includesPrivateData: false,
    },
    null,
    2,
  ),
);

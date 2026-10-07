import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["tests/booking-react.test.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BROWSER: "webkit" },
  windowsHide: true,
});
process.exit(result.status ?? 1);

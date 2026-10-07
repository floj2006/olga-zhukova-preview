import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnvironment } from "../server/index.mjs";
import { checkCloud } from "../server/cloud-check.mjs";
export { checkCloud } from "../server/cloud-check.mjs";

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await loadLocalEnvironment();
  const results = await checkCloud(process.env);
  for (const item of results)
    console.log(`${item.ok ? "OK" : "НЕ ГОТОВО"}: ${item.label}`);
  console.log(
    "Проверка только чтением; данные не изменялись. Наличие функций не подтверждает версию их SQL и работу записей.",
  );
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

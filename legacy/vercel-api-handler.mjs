import { createApiHandler } from "../server/index.mjs";

const handler = createApiHandler();

export default async function api(req, res) {
  if (!(await (await handler)(req, res))) {
    res.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({ error: "API route not found.", code: "not_found" }),
    );
  }
}

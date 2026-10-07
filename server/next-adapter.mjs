import { Readable } from "node:stream";
import { createApiHandler } from "./index.mjs";
export function createNextHandler(options) {
  let handler;
  return async function (request) {
    handler ||= createApiHandler(options);
    const body = request.body
      ? Readable.fromWeb(request.body)
      : Readable.from([]);
    const url = new URL(request.url);
    body.url = url.pathname + url.search;
    body.method = request.method;
    body.headers = Object.fromEntries(request.headers);
    body.socket = {
      encrypted: url.protocol === "https:",
      remoteAddress: "local-next",
    };
    const chunks = [];
    let headers = {},
      status = 200;
    const response = {
      headersSent: false,
      writableEnded: false,
      writeHead(code, values) {
        status = code;
        headers = { ...headers, ...values };
        this.headersSent = true;
        return this;
      },
      setHeader(key, value) {
        headers[key] = value;
        return this;
      },
      end(chunk) {
        if (chunk)
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        this.writableEnded = true;
        return this;
      },
    };
    const handled = await (await handler)(body, response);
    if (!handled)
      return Response.json(
        { error: "Страница API не найдена." },
        { status: 404 },
      );
    return new Response(
      request.method === "HEAD" ? null : Buffer.concat(chunks),
      { status, headers },
    );
  };
}
export const handleRequest = createNextHandler();

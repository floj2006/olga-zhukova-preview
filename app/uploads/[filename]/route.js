import { handleRequest } from "../../../server/next-adapter.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleRequest;

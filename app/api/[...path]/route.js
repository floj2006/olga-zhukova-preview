import { handleRequest } from "../../../server/next-adapter.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleRequest;
export const POST = handleRequest;
export const PATCH = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;

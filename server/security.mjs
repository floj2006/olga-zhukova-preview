import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./validation.mjs";

const derive = promisify(scrypt);
export const COOKIE_NAME = "olga_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  ) {
    throw new Error("Admin password must contain 12–256 characters.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export function validPasswordHash(value) {
  return (
    typeof value === "string" &&
    /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value)
  );
}

export async function verifyPassword(password, encoded) {
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    !validPasswordHash(encoded)
  )
    return false;
  const [, salt, expected] = encoded.split("$");
  const actual = await derive(password, salt, 64, SCRYPT_OPTIONS);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function sessionSecurity(env) {
  const secret = env.ADMIN_SESSION_SECRET ?? "";
  const passwordHash = env.ADMIN_PASSWORD_HASH ?? "";
  const configured = secret.length >= 32 && validPasswordHash(passwordHash);
  // A password rotation invalidates previously issued cookies, even when the signing key stays unchanged.
  const sign = (payload) =>
    createHmac("sha256", secret)
      .update(`${payload}.${passwordHash}`)
      .digest("base64url");
  const production = Boolean(env.VERCEL) || env.NODE_ENV === "production";
  const secure = production || env.APP_ORIGIN?.startsWith("https:");
  const cookie = (value, age = SESSION_SECONDS) =>
    `${COOKIE_NAME}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  return {
    configured,
    issue() {
      if (!configured)
        throw new HttpError(
          503,
          "Админ-панель ещё не настроена.",
          "admin_not_configured",
        );
      const session = {
        exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        csrf: randomBytes(24).toString("base64url"),
      };
      const payload = Buffer.from(JSON.stringify(session)).toString(
        "base64url",
      );
      return {
        csrfToken: session.csrf,
        cookie: cookie(`${payload}.${sign(payload)}`),
      };
    },
    clearCookie: () => cookie("", 0),
    read(req) {
      if (!configured) return null;
      const raw = req.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`))
        ?.slice(COOKIE_NAME.length + 1);
      if (!raw || raw.length > 1024) return null;
      const parts = raw.split(".");
      if (parts.length !== 2 || !equal(parts[1], sign(parts[0]))) return null;
      try {
        const session = JSON.parse(
          Buffer.from(parts[0], "base64url").toString(),
        );
        if (
          !Number.isInteger(session.exp) ||
          session.exp <= Date.now() / 1000 ||
          typeof session.csrf !== "string" ||
          session.csrf.length !== 32
        )
          return null;
        return session;
      } catch {
        return null;
      }
    },
    checkCsrf(req, session) {
      if (!session || !equal(req.headers["x-csrf-token"], session.csrf)) {
        throw new HttpError(
          403,
          "Сессия формы истекла. Обновите страницу.",
          "csrf_failed",
        );
      }
    },
    verify: (password) => verifyPassword(password, passwordHash),
  };
}

export function checkOrigin(req, env) {
  if (req.headers["sec-fetch-site"] === "cross-site")
    throw new HttpError(
      403,
      "Запрос с другого сайта отклонён.",
      "origin_failed",
    );
  const origin = req.headers.origin;
  if (!origin) return;
  const expected =
    env.APP_ORIGIN ||
    `${req.socket?.encrypted ? "https" : "http"}://${req.headers.host}`;
  try {
    if (new URL(origin).origin === new URL(expected).origin) return;
  } catch {
    /* Reject malformed origins. */
  }
  throw new HttpError(403, "Запрос с другого сайта отклонён.", "origin_failed");
}

export function rateKey(req, scope, env) {
  // Vercel overwrites x-real-ip; a local Node server uses the socket address and ignores spoofed forwarding headers.
  const ip = env.VERCEL
    ? (req.headers["x-real-ip"] ?? req.socket?.remoteAddress ?? "unknown")
    : (req.socket?.remoteAddress ?? "unknown");
  return createHmac(
    "sha256",
    env.ADMIN_SESSION_SECRET || "local-development-rate-limit",
  )
    .update(`${scope}:${ip}`)
    .digest("hex");
}

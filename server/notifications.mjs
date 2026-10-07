import { createHash } from "node:crypto";
export const vkConfigured = (env) =>
  env.VK_NOTIFICATIONS_ENABLED === "true" &&
  Boolean(env.VK_COMMUNITY_TOKEN) &&
  /^-?\d+$/.test(env.VK_PEER_ID || "");
export async function notifyLead(lead, env, fetchImpl = fetch) {
  if (!vkConfigured(env)) return { status: "disabled" };
  const randomId =
    createHash("sha256").update(lead.id).digest().readUInt32BE(0) &
      0x7fffffff || 1;
  try {
    const origin = new URL(env.APP_ORIGIN);
    const response = await fetchImpl(
      "https://api.vk.com/method/messages.send",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        redirect: "error",
        signal: AbortSignal.timeout(4000),
        body: new URLSearchParams({
          access_token: env.VK_COMMUNITY_TOKEN,
          v: "5.199",
          peer_id: env.VK_PEER_ID,
          random_id: String(randomId),
          dont_parse_links: "1",
          message:
            "Новая заявка на мероприятие" +
            (lead.eventDate ? " · " + lead.eventDate : "") +
            "\nКонтакты и расчёт в админке: " +
            origin.origin +
            "/admin",
        }),
      },
    );
    const data = await response.json();
    if (!response.ok || data.error || !Number.isInteger(data.response))
      return { status: "failed", at: new Date().toISOString() };
    return { status: "sent", at: new Date().toISOString() };
  } catch {
    return { status: "failed", at: new Date().toISOString() };
  }
}

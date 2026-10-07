import { sessionSecurity } from "./security.mjs";
import { vkConfigured } from "./notifications.mjs";
export function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
// Configuration only. Never return keys, tokens, hashes, customer data or readiness guarantees.
export function deploymentStatus(env) {
  const cloud = Boolean(
    httpsOrigin(env.SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const app = httpsOrigin(env.APP_ORIGIN);
  const site = httpsOrigin(env.SITE_URL);
  const production = Boolean(env.VERCEL) || env.NODE_ENV === "production";
  const vkEnabled = env.VK_NOTIFICATIONS_ENABLED === "true";
  const adminConfigured = sessionSecurity(env).configured;
  return {
    mode: production ? "production" : "local",
    cloudConfigured: cloud,
    checks: [
      {
        id: "storage",
        title: "Постоянное хранение",
        status: cloud ? "configured" : "blocked",
        detail: cloud
          ? "Настройки облака заданы. Подключение и сохранение данных нужно проверить отдельно."
          : "Облако не подключено. Публичный приём заявок требует постоянного хранения.",
      },
      {
        id: "admin",
        title: "Доступ к управлению",
        status: adminConfigured ? "configured" : "blocked",
        detail: adminConfigured
          ? "Серверные настройки входа заданы."
          : "Настройте пароль администратора и ключ сессии на сервере.",
      },
      {
        id: "origin",
        title: "Адрес опубликованного сайта",
        status: app && site && app === site ? "configured" : "blocked",
        detail:
          app && site && app === site
            ? "Адреса сайта и обработчика заявок согласованы. Проверка домена после публикации ещё нужна."
            : "Задайте одинаковый HTTPS-адрес сайта в APP_ORIGIN и SITE_URL перед публикацией.",
      },
      {
        id: "vk",
        title: "Уведомления ВК",
        status: !vkEnabled
          ? "optional"
          : vkConfigured(env)
            ? "configured"
            : "blocked",
        detail: !vkEnabled
          ? "Выключены. Заявки доступны в админке."
          : vkConfigured(env)
            ? "Настройки заданы. Фактическая доставка в разрешённый диалог ещё не проверена."
            : "Уведомления включены, но настройки сообщества и получателя неполные.",
      },
    ],
  };
}

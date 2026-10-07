// Read-only checks: no initialization, writes, lead contents or response bodies in results.
export async function checkCloud(env, fetchImpl = fetch) {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (key) => !env[key]?.trim(),
  );
  if (missing.length)
    return [{ ok: false, label: `Не настроены: ${missing.join(", ")}` }];
  let origin;
  try {
    const url = new URL(env.SUPABASE_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
    origin = url.origin;
  } catch {
    return [
      {
        ok: false,
        label:
          "SUPABASE_URL должен быть HTTPS-адресом проекта без пути и пароля.",
      },
    ];
  }
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  async function get(
    route,
    label,
    inspect = () => true,
    accept = "application/json",
  ) {
    try {
      const response = await fetchImpl(origin + route, {
        method: "GET",
        headers: { ...headers, Accept: accept },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok)
        return {
          ok: false,
          label: `${label}: HTTP ${response.status}. Проверьте доступ и применение server/schema.sql.`,
        };
      const ok = inspect(await response.json());
      return {
        ok,
        label: ok
          ? label
          : `${label}: структура или настройки не соответствуют проекту.`,
      };
    } catch {
      return {
        ok: false,
        label: `${label}: не удалось проверить ответ сервера.`,
      };
    }
  }
  const required = [
    "olga_save_content",
    "olga_initialize",
    "olga_add_lead",
    "olga_search_leads",
    "olga_save_catalog",
    "olga_save_availability",
    "olga_update_lead",
    "olga_gallery",
    "olga_order_gallery",
    "olga_rate_limit",
  ];
  const bucket = encodeURIComponent(
    env.SUPABASE_GALLERY_BUCKET || "olga-gallery",
  );
  // Independent reads run together so one unavailable service cannot multiply the timeout.
  return Promise.all([
    ...["olga_site", "olga_leads", "olga_availability"].map((table) =>
      get(
        `/rest/v1/${table}?select=id&limit=0`,
        `Доступ к ${table}`,
        Array.isArray,
      ),
    ),
    get(
      "/rest/v1/",
      "Наличие SQL-функций в API",
      (schema) => required.every((name) => schema?.paths?.[`/rpc/${name}`]),
      "application/openapi+json",
    ),
    get(
      `/storage/v1/bucket/${bucket}`,
      "Хранилище фотографий",
      (value) =>
        value?.public === true &&
        Number(value.file_size_limit) === 3145728 &&
        ["image/jpeg", "image/png", "image/webp"].every((mime) =>
          value.allowed_mime_types?.includes(mime),
        ),
    ),
  ]);
}

import { createLaunchStatus } from "./launch-status.js";
import { createContentEditor } from "./content-editor.js";
import { calendarList, nextBusyDate } from "./calendar-list.js";
import { addQuoteCopy } from "./quote-copy.js";
import { eventToday } from "../booking-rules.js";
import { photoPreview } from "./photo-preview.js";

(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat("ru-RU");
  const units = {
    hour: "за час",
    item: "за услугу / комплект",
    meeting: "за встречу",
  };
  const shortUnits = { hour: "ч", item: "шт.", meeting: "встреч" };
  const eventTypes = {
    wedding: "Свадьба",
    corporate: "Корпоратив",
    anniversary: "Юбилей",
    graduation: "Выпускной",
    other: "Другое событие",
  };
  const statuses = {
    new: "Новая",
    contacted: "Связались",
    booked: "Забронировано",
    closed: "Закрыта",
  };
  const state = {
    csrf: "",
    authenticated: false,
    tab: "services",
    catalog: null,
    services: [],
    baseline: "",
    catalogBusy: false,
    conflict: false,
    leads: [],
    leadsLoaded: false,
    leadsBusy: false,
    nextOffset: 0,
    hasMore: false,
    leadDrafts: new Map(),
    leadWrites: new Set(),
    gallery: [],
    photoDrafts: new Map(),
    uploadBusy: false,
    galleryBusy: false,
    previewUrl: "",
    availability: null,
    calendarBusy: false,
    calendarMonth: new Date(`${eventToday().slice(0, 7)}-01T12:00:00Z`),
    calendarSelection: new Set(),
    calendarNoteDrafts: new Map(),
    newServices: new WeakSet(),
    manualServiceIds: new WeakSet(),
  };
  let sessionVersion = 0;
  const operations = { catalog: 0, calendar: 0, gallery: 0 };
  const privateRequests = new Set();
  const cancelled = () =>
    Object.assign(new Error("Запрос отменён."), { cancelled: true });
  const operation = (section) => {
    const session = sessionVersion;
    const version = ++operations[section];
    return () =>
      state.authenticated &&
      session === sessionVersion &&
      version === operations[section];
  };
  const currentSession = () => {
    const session = sessionVersion;
    return () => state.authenticated && session === sessionVersion;
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function message(id, text = "", kind = "") {
    const node = typeof id === "string" ? $(id) : id;
    node.textContent = text;
    node.dataset.kind = kind;
  }
  function button(text, className = "secondary") {
    const node = element("button", `admin-button ${className}`, text);
    node.type = "button";
    return node;
  }
  function field(
    labelText,
    {
      value = "",
      type = "text",
      tag = "input",
      required = false,
      maxLength,
      options,
      className = "",
      id,
    } = {},
  ) {
    const label = element("label", `admin-field ${className}`);
    label.append(document.createTextNode(labelText));
    const input = element(tag);
    if (tag === "input") input.type = type;
    if (id) {
      input.id = id;
      input.name = id;
    }
    if (options)
      for (const [key, title] of Object.entries(options)) {
        const option = element("option", "", title);
        option.value = key;
        input.append(option);
      }
    input.value = value;
    input.required = required;
    if (maxLength) input.maxLength = maxLength;
    label.append(input);
    return { label, input };
  }
  function checkbox(text, checked, disabled = false) {
    const label = element("label", "admin-check");
    const input = element("input");
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = disabled;
    label.append(input, document.createTextNode(text));
    return { label, input };
  }
  function pending(node, busy, text) {
    if (busy) {
      if (!node.dataset.idleText) node.dataset.idleText = node.textContent;
      if (text) node.textContent = text;
    } else if (node.dataset.idleText) {
      node.textContent = node.dataset.idleText;
      delete node.dataset.idleText;
    }
    node.disabled = busy;
    node.setAttribute("aria-busy", String(busy));
  }
  const servicesDirty = () =>
    Boolean(state.catalog) && JSON.stringify(state.services) !== state.baseline;
  const uploadDirty = () =>
    Boolean(
      $("photo-file").files.length ||
      $("photo-alt").value ||
      $("photo-caption").value ||
      $("photo-featured").checked ||
      !$("photo-published").checked,
    );
  let contentEditor;
  function sectionDirty(tab) {
    if (tab === "content") return contentEditor?.dirty();
    return tab === "services"
      ? servicesDirty()
      : tab === "leads"
        ? state.leadDrafts.size > 0
        : tab === "calendar"
          ? state.calendarNoteDrafts.size > 0
          : state.photoDrafts.size > 0 || uploadDirty();
  }
  const anyDirty = () =>
    contentEditor?.dirty() ||
    servicesDirty() ||
    state.leadDrafts.size > 0 ||
    state.calendarNoteDrafts.size > 0 ||
    state.calendarBusy ||
    state.galleryBusy ||
    state.uploadBusy ||
    state.catalogBusy ||
    state.leadWrites.size > 0 ||
    state.photoDrafts.size > 0 ||
    uploadDirty();

  async function api(path, { method = "GET", body, initial = false } = {}) {
    const session = sessionVersion;
    const controller = new AbortController();
    if (!initial) privateRequests.add(controller);
    const active = () =>
      session === sessionVersion && !controller.signal.aborted;
    let response;
    try {
      const headers = { Accept: "application/json" };
      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
        if (state.csrf) headers["x-csrf-token"] = state.csrf;
      }
      response = await fetch(path, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      });
    } catch (cause) {
      if (!active()) throw cancelled();
      throw new Error(
        cause.name === "TimeoutError" || cause.name === "AbortError"
          ? "Сервер долго не отвечает. Проверьте соединение и повторите попытку."
          : "Не удалось связаться с сервером. Проверьте соединение и повторите попытку.",
      );
    } finally {
      privateRequests.delete(controller);
    }
    if (!active()) throw cancelled();
    let data;
    try {
      data = await response.json();
    } catch {
      if (!active()) throw cancelled();
      throw new Error(
        "Сервер вернул неожиданный ответ. Повторите попытку позже.",
      );
    }
    if (!active()) throw cancelled();
    if (!response.ok) {
      const error = new Error(data.error || "Не удалось выполнить запрос.");
      error.status = response.status;
      error.data = data;
      if (response.status === 401 && !initial) {
        showLogin(
          "Сессия завершена. Войдите снова. Несохранённые изменения остаются в этой вкладке.",
        );
      }
      throw error;
    }
    return data;
  }

  function showLogin(text = "", unconfigured = false) {
    sessionVersion++;
    for (const controller of privateRequests) controller.abort();
    privateRequests.clear();
    for (const section of Object.keys(operations)) operations[section]++;
    leadLoadVersion++;
    clearTimeout(leadSearchTimer);
    state.authenticated = false;
    state.csrf = "";
    state.catalogBusy =
      state.calendarBusy =
      state.galleryBusy =
      state.uploadBusy =
      state.leadsBusy =
        false;
    state.leadWrites.clear();
    updateLeadBusy();
    for (const id of [
      "services-list",
      "leads-list",
      "gallery-list",
      "calendar-busy-list",
      "calendar-days",
    ])
      $(id).replaceChildren();
    for (const id of [
      "catalog-status",
      "leads-message",
      "gallery-message",
      "calendar-message",
      "leads-count",
      "gallery-count",
      "calendar-found",
      "calendar-upcoming",
      "workspace-message",
    ])
      message(id);
    $("leads-list").hidden = false;
    $("leads-list").setAttribute("aria-busy", "false");
    $("leads-refresh").disabled = true;
    pending($("leads-more"), false);
    $("leads-more").hidden = true;
    updateLeadBusy();
    pending($("catalog-save"), false);
    pending($("upload-submit"), false);
    pending($("gallery-refresh"), false);
    updateSaveState();
    updateGalleryBusy();
    $("calendar-editor").setAttribute("aria-busy", "false");
    launchStatus.reset();
    $("session-loading").hidden = true;
    $("workspace").hidden = true;
    $("logout").hidden = true;
    $("login-view").hidden = false;
    $("login-form").hidden = unconfigured;
    $("session-retry").hidden = !unconfigured;
    message("login-message", text, text ? "error" : "");
  }
  async function enterWorkspace(csrf) {
    sessionVersion++;
    state.csrf = csrf;
    state.authenticated = true;
    $("session-loading").hidden = true;
    $("login-view").hidden = true;
    $("workspace").hidden = false;
    $("logout").hidden = false;
    $("password").value = "";
    const active = currentSession();
    if (state.catalog) renderServices();
    renderGallery();
    if (state.leadsLoaded) renderLeads();
    updateLeadBusy();
    updateGalleryBusy();
    renderCalendar();
    launchStatus.load();
    if (!state.catalog) await loadCatalog();
    else if (anyDirty())
      message(
        "workspace-message",
        "Ваши несохранённые изменения сохранены в этой вкладке. Проверьте и сохраните их.",
      );
    if (!active()) return;
    if (state.tab === "content") await contentEditor.load();
    if (!active()) return;
    if (state.tab === "leads" && !state.leadsLoaded) await loadLeads();
    if (!active()) return;
    if (state.tab === "calendar" && !state.availability)
      await loadAvailability();
  }
  async function checkSession() {
    const generation = sessionVersion;
    $("session-retry").disabled = true;
    try {
      const session = await api("/api/admin/session", { initial: true });
      if (session.authenticated && session.csrfToken)
        await enterWorkspace(session.csrfToken);
      else showLogin("", session.configured === false);
    } catch (error) {
      if (error.cancelled) return;
      if (error.status === 401) {
        const unconfigured = error.data?.configured === false;
        showLogin(
          unconfigured
            ? "Доступ к управлению ещё не настроен. Повторите проверку после настройки."
            : "",
          unconfigured,
        );
      } else {
        showLogin(
          error.status === 503
            ? "Управление сайтом пока недоступно. Повторите проверку позже."
            : error.message,
          true,
        );
      }
    } finally {
      if (generation === sessionVersion || !state.authenticated)
        $("session-retry").disabled = false;
    }
  }
  $("session-retry").addEventListener("click", checkSession);
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if ($("login-submit").disabled) return;
    pending($("login-submit"), true, "Входим…");
    message("login-message");
    try {
      const result = await api("/api/admin/login", {
        method: "POST",
        body: { password: $("password").value },
        initial: true,
      });
      await enterWorkspace(result.csrfToken);
    } catch (error) {
      if (error.cancelled) return;
      if (error.status === 503) showLogin(error.message, true);
      else message("login-message", error.message, "error");
    } finally {
      pending($("login-submit"), false);
    }
  });
  $("logout").addEventListener("click", async () => {
    if ($("logout").disabled || !state.authenticated) return;
    if (
      anyDirty() &&
      !window.confirm(
        "Есть несохранённые изменения. Выйти и отказаться от них?",
      )
    )
      return;
    pending($("logout"), true, "Выходим…");
    try {
      await api("/api/admin/logout", { method: "POST", body: {} });
      state.catalog = null;
      state.services = [];
      state.baseline = "";
      state.newServices = new WeakSet();
      state.manualServiceIds = new WeakSet();
      state.leads = [];
      state.leadsLoaded = false;
      state.nextOffset = 0;
      state.hasMore = false;
      state.leadsTotal = undefined;
      leadLoadVersion++;
      clearTimeout(leadSearchTimer);
      $("leads-search").value = "";
      $("leads-filter").value = "";
      state.leadDrafts.clear();
      contentEditor?.reset();
      state.gallery = [];
      $("gallery-search").value = "";
      $("gallery-filter").value = "";
      $("gallery-count").textContent = "";
      $("gallery-filter-empty").hidden = true;
      state.photoDrafts.clear();
      state.availability = null;
      state.calendarSelection.clear();
      state.calendarNoteDrafts.clear();
      state.conflict = false;
      $("services-list").replaceChildren();
      $("leads-list").replaceChildren();
      $("gallery-list").replaceChildren();
      $("calendar-busy-list").replaceChildren();
      $("calendar-search").value = "";
      $("calendar-period").value = "upcoming";
      $("calendar-found").textContent = "";
      $("calendar-upcoming").textContent = "";
      $("calendar-days").replaceChildren();
      $("upload-form").reset();
      clearPreview();
      message("workspace-message");
      showLogin("Вы вышли из управления сайтом.");
      $("password").focus();
    } catch (error) {
      if (error.cancelled || !state.authenticated) return;
      message("workspace-message", error.message, "error");
    } finally {
      pending($("logout"), false);
    }
  });

  async function switchTab(tab) {
    if (!state.authenticated) return;
    if (tab === state.tab) return;
    if (
      sectionDirty(state.tab) &&
      !window.confirm(
        "В разделе есть несохранённые изменения. Перейти в другой раздел? Изменения останутся в этой вкладке.",
      )
    )
      return;
    state.tab = tab;
    for (const name of [
      "services",
      "leads",
      "calendar",
      "gallery",
      "content",
    ]) {
      $("panel-" + name).hidden = name !== tab;
      $("tab-" + name).setAttribute("aria-selected", String(name === tab));
      $("tab-" + name).tabIndex = name === tab ? 0 : -1;
    }
    $("tab-" + tab).focus();
    const active = currentSession();
    if (tab === "leads" && !state.leadsLoaded) await loadLeads();
    if (!active()) return;
    if (tab === "calendar" && !state.availability) await loadAvailability();
    if (!active()) return;
    if (tab === "gallery" && !state.catalog) await refreshGallery();
    if (!active()) return;
    if (tab === "content") await contentEditor.load();
  }
  const tabs = [...document.querySelectorAll("[data-tab]")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        switchTab(tabs[next].dataset.tab);
      }
    });
  }
  window.addEventListener("beforeunload", (event) => {
    if (!anyDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function updateSaveState() {
    const dirty = servicesDirty();
    const busy =
      state.catalogBusy ||
      state.galleryBusy ||
      state.uploadBusy ||
      !state.authenticated;
    $("catalog-save").disabled = !dirty || busy || state.conflict;
    $("add-service").disabled =
      !state.catalog || busy || state.services.length >= 50;
    $("catalog-reload").disabled = busy;
    $("catalog-reload-conflict").disabled = busy;
    $("catalog-conflict").hidden = !state.conflict;
    $("services-list").inert = state.catalogBusy;
    $("services-form").setAttribute("aria-busy", String(state.catalogBusy));
    $("services-dirty").textContent = !state.catalog
      ? "Каталог ещё не загружен."
      : dirty
        ? "Есть несохранённые изменения"
        : "Все изменения сохранены";
  }
  async function loadCatalog() {
    if (
      !state.authenticated ||
      state.catalogBusy ||
      state.galleryBusy ||
      state.uploadBusy
    )
      return;
    const active = operation("catalog");
    state.catalogBusy = true;
    updateGalleryBusy();
    message("catalog-status", "Загружаем каталог…");
    try {
      const catalog = await api("/api/admin/catalog");
      if (!active()) return;
      state.catalog = catalog;
      state.services = structuredClone(catalog.services);
      state.baseline = JSON.stringify(state.services);
      state.newServices = new WeakSet();
      state.manualServiceIds = new WeakSet();
      state.gallery = catalog.gallery;
      state.conflict = false;
      renderServices();
      renderGallery();
      message("catalog-status");
    } catch (error) {
      if (!active() || error.cancelled) return;
      message("catalog-status", error.message, "error");
    } finally {
      if (active()) {
        state.catalogBusy = false;
        updateGalleryBusy();
      }
    }
  }
  async function reloadCatalog() {
    if (
      !state.authenticated ||
      state.catalogBusy ||
      state.galleryBusy ||
      state.uploadBusy
    )
      return;
    if (
      servicesDirty() &&
      !window.confirm(
        "Загрузить свежий каталог? Несохранённые изменения услуг будут отменены.",
      )
    )
      return;
    await loadCatalog();
  }
  $("catalog-reload").addEventListener("click", reloadCatalog);
  $("catalog-reload-conflict").addEventListener("click", reloadCatalog);

  function slug(title, current) {
    const letters = {
      а: "a",
      б: "b",
      в: "v",
      г: "g",
      д: "d",
      е: "e",
      ё: "yo",
      ж: "zh",
      з: "z",
      и: "i",
      й: "y",
      к: "k",
      л: "l",
      м: "m",
      н: "n",
      о: "o",
      п: "p",
      р: "r",
      с: "s",
      т: "t",
      у: "u",
      ф: "f",
      х: "h",
      ц: "ts",
      ч: "ch",
      ш: "sh",
      щ: "sch",
      ъ: "",
      ы: "y",
      ь: "",
      э: "e",
      ю: "yu",
      я: "ya",
    };
    let base = [...title.toLowerCase()]
      .map((char) => letters[char] ?? char)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!/^[a-z]/.test(base)) base = "service-" + base;
    base = base.slice(0, 42).replace(/-+$/g, "") || "service";
    let id = base,
      suffix = 2;
    while (
      id === "consultation" ||
      state.services.some((service) => service !== current && service.id === id)
    )
      id = `${base}-${suffix++}`;
    return id;
  }
  function renderServices(newIndex = -1) {
    if (!state.authenticated) {
      $("services-list").replaceChildren();
      return;
    }
    const opened = new Set(
      [...$("services-list").querySelectorAll("details[open]")].map((node) =>
        Number(node.dataset.index),
      ),
    );
    const nodes = state.services.map((service, index) => {
      const row = element("details", "admin-record admin-service");
      row.dataset.index = index;
      row.open = opened.has(index) || index === newIndex;
      const summary = element("summary");
      const name = element("span", "admin-record-name");
      const title = element("span", "admin-record-title");
      const category = element("span", "admin-record-subtitle");
      name.append(title, category);
      const price = element("span", "admin-price");
      const badge = element("span", "admin-badge");
      summary.append(
        element(
          "span",
          "admin-record-number",
          String(index + 1).padStart(2, "0"),
        ),
        name,
        price,
        badge,
      );
      const updateSummary = () => {
        title.textContent = service.title || "Новая услуга";
        category.textContent = service.category || "Без категории";
        price.textContent = `${service.from ? "от " : ""}${money.format(Number(service.price) || 0)} ₽`;
        badge.textContent = service.active ? "На сайте" : "В архиве";
        badge.classList.toggle("inactive", !service.active);
      };
      updateSummary();
      const body = element("div", "admin-record-body");
      const grid = element("div", "admin-service-grid");
      const titleField = field("Название", {
        value: service.title,
        required: true,
        maxLength: 120,
        className: "wide",
        id: `service-title-${index}`,
      });
      const categoryField = field("Категория", {
        value: service.category,
        required: true,
        maxLength: 60,
        id: `service-category-${index}`,
      });
      const priceField = field("Цена, ₽", {
        value: service.price,
        type: "number",
        required: true,
        id: `service-price-${index}`,
      });
      priceField.input.min = "0";
      priceField.input.max = "10000000";
      priceField.input.step = "1";
      const unitField = field("Единица расчёта", {
        tag: "select",
        value: service.unit,
        options: units,
        id: `service-unit-${index}`,
      });
      unitField.input.disabled = service.id === "consultation";
      const idField = field("Идентификатор", {
        value: service.id,
        required: true,
        maxLength: 48,
        id: `service-id-${index}`,
      });
      idField.input.pattern = "[a-z][a-z0-9\\-]{0,47}";
      idField.input.readOnly = !state.newServices.has(service);
      idField.input.title =
        "Латинская буква в начале, затем латинские буквы, цифры и дефисы. До 48 символов.";
      if (state.newServices.has(service))
        idField.label.append(
          element(
            "small",
            "",
            "Создаётся из названия. Латинские буквы, цифры и дефисы.",
          ),
        );
      const description = field("Описание", {
        tag: "textarea",
        value: service.description,
        maxLength: 600,
        className: "full",
        id: `service-description-${index}`,
      });
      grid.append(
        titleField.label,
        categoryField.label,
        priceField.label,
        unitField.label,
        idField.label,
        description.label,
      );
      const toggles = element("div", "admin-toggles");
      const active = checkbox(
        "Показывать на сайте",
        service.active,
        service.id === "consultation" && service.active,
      );
      const from = checkbox("Цена «от»", service.from);
      toggles.append(active.label, from.label);
      for (const [key, input] of [
        ["title", titleField.input],
        ["category", categoryField.input],
        ["price", priceField.input],
        ["unit", unitField.input],
        ["id", idField.input],
        ["description", description.input],
      ]) {
        input.addEventListener("input", () => {
          service[key] =
            key === "price"
              ? input.value === ""
                ? null
                : Number(input.value)
              : input.value;
          if (key === "id") state.manualServiceIds.add(service);
          if (
            key === "title" &&
            state.newServices.has(service) &&
            !state.manualServiceIds.has(service)
          ) {
            service.id = slug(input.value, service);
            idField.input.value = service.id;
          }
          updateSummary();
          updateSaveState();
          message("catalog-status");
        });
      }
      for (const [key, input] of [
        ["active", active.input],
        ["from", from.input],
      ])
        input.addEventListener("change", () => {
          service[key] = input.checked;
          updateSummary();
          updateSaveState();
          message("catalog-status");
        });
      body.append(grid, toggles);
      if (service.id === "consultation")
        body.append(
          element(
            "p",
            "admin-special-note",
            "Первая встреча всегда бесплатна. Цена здесь — за каждую дополнительную встречу.",
          ),
        );
      else
        body.append(
          element(
            "p",
            "admin-special-note",
            "Чтобы убрать услугу из каталога, отключите «Показывать на сайте» и сохраните изменения.",
          ),
        );
      if (state.newServices.has(service)) {
        const remove = button("Отменить добавление");
        remove.addEventListener("click", () => {
          if (
            !window.confirm(
              "Убрать эту новую услугу из несохранённых изменений?",
            )
          )
            return;
          state.services.splice(state.services.indexOf(service), 1);
          renderServices();
          updateSaveState();
        });
        toggles.append(remove);
      }
      row.append(summary, body);
      return row;
    });
    $("services-list").replaceChildren(...nodes);
    if (!nodes.length)
      $("services-list").append(
        element("p", "admin-empty", "Услуг пока нет. Добавьте первую услугу."),
      );
  }
  $("add-service").addEventListener("click", () => {
    if (
      !state.authenticated ||
      state.catalogBusy ||
      state.galleryBusy ||
      state.uploadBusy ||
      !state.catalog ||
      state.services.length >= 50
    )
      return;
    const service = {
      id: "",
      title: "",
      description: "",
      unit: "item",
      price: 0,
      from: false,
      category: "Дополнительно",
      active: true,
    };
    service.id = slug("Новая услуга", service);
    state.services.push(service);
    state.newServices.add(service);
    renderServices(state.services.length - 1);
    updateSaveState();
    $(`service-title-${state.services.length - 1}`).focus();
  });
  $("services-form").noValidate = true;
  $("services-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      !state.authenticated ||
      !servicesDirty() ||
      state.catalogBusy ||
      state.galleryBusy ||
      state.uploadBusy ||
      state.conflict
    )
      return;
    for (const input of $("services-form").querySelectorAll(
      "input, select, textarea",
    )) {
      if (!input.checkValidity()) {
        input.closest("details").open = true;
        input.reportValidity();
        return;
      }
    }
    const ids = new Set();
    for (const service of state.services) {
      if (!service.title.trim() || !service.category.trim()) {
        message(
          "catalog-status",
          "Заполните название и категорию каждой услуги.",
          "error",
        );
        return;
      }
      if (ids.has(service.id)) {
        message(
          "catalog-status",
          "Идентификаторы услуг должны быть уникальными.",
          "error",
        );
        return;
      }
      if (state.newServices.has(service) && service.id === "consultation") {
        message(
          "catalog-status",
          "Идентификатор consultation используется для дополнительных встреч. Выберите другой.",
          "error",
        );
        return;
      }
      ids.add(service.id);
    }
    const active = operation("catalog");
    state.catalogBusy = true;
    updateGalleryBusy();
    pending($("catalog-save"), true, "Сохраняем…");
    message("catalog-status", "Сохраняем услуги и цены…");
    try {
      const catalog = await api("/api/admin/catalog", {
        method: "PUT",
        body: { version: state.catalog.version, services: state.services },
      });
      if (!active()) return;
      state.catalog = catalog;
      state.services = structuredClone(catalog.services);
      state.baseline = JSON.stringify(state.services);
      state.newServices = new WeakSet();
      state.manualServiceIds = new WeakSet();
      state.gallery = catalog.gallery;
      renderServices();
      renderGallery();
      message(
        "catalog-status",
        "Услуги и цены сохранены. Изменения уже на сайте.",
        "success",
      );
    } catch (error) {
      if (!active() || error.cancelled) return;
      if (error.status === 409) state.conflict = true;
      message("catalog-status", error.message, "error");
    } finally {
      if (active()) {
        state.catalogBusy = false;
        pending($("catalog-save"), false);
        updateGalleryBusy();
      }
    }
  });

  function dateLabel(value, withTime = false) {
    if (!value) return "Не указана";
    const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (!Number.isFinite(date.getTime())) return "Не указана";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }
  let leadSearchTimer,
    leadLoadVersion = 0;
  function updateLeadBusy() {
    const busy = state.leadsBusy || state.leadWrites.size > 0;
    $("leads-list").inert = busy;
    $("leads-refresh").disabled = busy || !state.authenticated;
    $("leads-search").disabled =
      state.leadWrites.size > 0 || !state.authenticated;
    $("leads-filter").disabled =
      state.leadWrites.size > 0 || !state.authenticated;
    $("leads-more").disabled = busy || !state.authenticated;
  }
  async function latestLead(lead, active) {
    let offset = 0;
    for (;;) {
      const data = await api(
        "/api/admin/leads?" +
          new URLSearchParams({
            limit: "100",
            offset: String(offset),
            q: lead.phone,
          }),
      );
      if (!active()) throw cancelled();
      const latest = data.leads.find((item) => item.id === lead.id);
      if (latest) return latest;
      if (!data.hasMore || !data.leads.length)
        throw new Error(
          "Свежая версия заявки не найдена. Обновите список заявок.",
        );
      offset = data.offset + data.leads.length;
    }
  }
  async function loadLeads(append = false) {
    if (!state.authenticated || state.leadWrites.size) return;
    const active = currentSession();
    if (append && state.leadsBusy) return;
    clearTimeout(leadSearchTimer);
    const version = ++leadLoadVersion;
    const query = $("leads-search").value.trim();
    const statusFilter = $("leads-filter").value;
    state.leadsBusy = true;
    updateLeadBusy();
    pending($("leads-more"), true, "Загружаем…");
    message("leads-message", "Загружаем заявки…");
    $("leads-list").setAttribute("aria-busy", "true");
    if (!append) $("leads-list").hidden = true;
    $("leads-count").textContent = "";
    try {
      const data = await api(
        `/api/admin/leads?${new URLSearchParams({ limit: "50", offset: String(append ? state.nextOffset : 0), q: query, status: statusFilter })}`,
      );
      if (version !== leadLoadVersion || !active()) return;
      if (append) {
        const existing = new Set(state.leads.map((lead) => lead.id));
        state.leads.push(
          ...data.leads.filter((lead) => !existing.has(lead.id)),
        );
      } else {
        state.leads = data.leads;
      }
      state.nextOffset = data.offset + data.leads.length;
      state.hasMore = data.hasMore;
      state.leadsTotal = data.total;
      state.leadsLoaded = true;
      renderLeads();
      $("leads-list").hidden = false;
      message("leads-message");
    } catch (error) {
      if (version !== leadLoadVersion || !active() || error.cancelled) return;
      $("leads-list").hidden = false;
      state.hasMore = false;
      message("leads-message", error.message, "error");
    } finally {
      if (version !== leadLoadVersion || !active()) return;
      state.leadsBusy = false;
      $("leads-list").setAttribute("aria-busy", "false");
      $("leads-refresh").disabled = false;
      pending($("leads-more"), false);
      $("leads-more").hidden = !state.hasMore;
      updateLeadBusy();
    }
  }
  $("leads-refresh").addEventListener("click", () => loadLeads());
  $("leads-more").addEventListener("click", () => loadLeads(true));
  $("leads-search").addEventListener("input", () => {
    // Invalidate an older response immediately, including during the debounce interval.
    leadLoadVersion++;
    state.hasMore = false;
    $("leads-more").hidden = true;
    clearTimeout(leadSearchTimer);
    leadSearchTimer = setTimeout(() => loadLeads(), 300);
  });
  $("leads-filter").addEventListener("change", () => loadLeads());
  function renderLeads() {
    if (!state.authenticated) {
      $("leads-list").replaceChildren();
      return;
    }
    const opened = new Set(
      [...$("leads-list").querySelectorAll("details[open]")].map(
        (node) => node.dataset.id,
      ),
    );
    const matching = state.leads;
    const rows = matching.map((lead) => {
      const row = element("details", "admin-record admin-lead");
      row.dataset.id = lead.id;
      row.open = opened.has(lead.id);
      const summary = element("summary");
      const name = element("span", "admin-record-name");
      name.append(
        element("span", "admin-record-title", lead.name),
        element("span", "admin-record-subtitle", lead.phone),
      );
      const badge = element(
        "span",
        "admin-badge",
        statuses[lead.status] || lead.status,
      );
      summary.append(
        element("span", "admin-lead-date", dateLabel(lead.createdAt, true)),
        name,
        element(
          "span",
          "admin-lead-event",
          eventTypes[lead.eventType] || lead.eventType || "Формат не указан",
        ),
        element(
          "span",
          "admin-price",
          `${lead.quote?.from ? "от " : ""}${money.format(lead.quote?.total || 0)} ₽`,
        ),
        badge,
      );
      const body = element("div", "admin-record-body");
      const grid = element("div", "admin-lead-grid");
      const info = element("div");
      const details = element("dl", "admin-lead-details");
      for (const [label, value] of [
        ["Телефон", lead.phone],
        ["Формат", eventTypes[lead.eventType] || lead.eventType || "Не указан"],
        ["Дата события", dateLabel(lead.eventDate)],
        ["Комментарий", lead.comment || "Не оставлен"],
      ]) {
        const dd = element("dd");
        if (
          label === "Телефон" &&
          /^[+\d\s()-]+$/.test(value) &&
          /^\d{10,15}$/.test(value.replace(/\D/g, ""))
        ) {
          const phone = element("a", "", value);
          phone.href = `tel:${value.startsWith("+") ? "+" : ""}${value.replace(/\D/g, "")}`;
          dd.append(phone);
        } else dd.textContent = value;
        details.append(element("dt", "", label), dd);
      }
      const quote = element("div", "admin-quote");
      quote.append(element("h3", "", "Расчёт при отправке заявки"));
      const lines = element("ul");
      for (const line of lead.quote?.lines || []) {
        const li = element("li");
        li.append(
          element(
            "span",
            "",
            `${line.title} · ${line.quantity} ${shortUnits[line.unit] || ""} × ${money.format(line.unitPrice)} ₽`,
          ),
          element(
            "span",
            "",
            `${line.from ? "от " : ""}${money.format(line.total)} ₽`,
          ),
        );
        lines.append(li);
      }
      if (!(lead.quote?.lines || []).length)
        quote.append(element("p", "admin-muted", "Услуги не выбраны."));
      const total = element("p", "admin-quote-total");
      total.append(
        element("span", "", "Предварительно"),
        element(
          "strong",
          "",
          `${lead.quote?.from ? "от " : ""}${money.format(lead.quote?.total || 0)} ₽`,
        ),
      );
      quote.append(lines, total);
      addQuoteCopy(quote, lead.quote);
      info.append(details, quote);
      const notification = element("p", "admin-muted");
      const statusText = (value) =>
        value === "sent"
          ? "Уведомление ВК отправлено"
          : value === "failed"
            ? "Не удалось отправить уведомление ВК. Заявка сохранена."
            : "Уведомления ВК не подключены";
      notification.textContent = statusText(lead.notification?.status);
      info.append(notification);
      if (lead.notification?.status === "failed") {
        const retry = button("Повторить уведомление ВК");
        retry.onclick = async () => {
          retry.disabled = true;
          try {
            const r = await api("/api/admin/leads/" + lead.id + "/notify", {
              method: "POST",
              body: {},
            });
            lead.notification = r.notification;
            notification.textContent = statusText(r.notification.status);
            retry.hidden = r.notification.status === "sent";
          } catch (e) {
            notification.textContent = e.message;
          } finally {
            retry.disabled = false;
          }
        };
        info.append(retry);
      }
      const form = element("form", "admin-lead-form");
      const draft = state.leadDrafts.get(lead.id) || {
        status: lead.status,
        note: lead.note || "",
      };
      const status = field("Статус заявки", {
        tag: "select",
        value: draft.status,
        options: statuses,
        id: `lead-status-${lead.id}`,
      });
      const note = field("Внутренняя заметка", {
        tag: "textarea",
        value: draft.note,
        maxLength: 4000,
        id: `lead-note-${lead.id}`,
      });
      note.label.append(
        element("small", "", "Видна только в управлении сайтом."),
      );
      const save = button("Сохранить заявку", "");
      const reset = button("Отменить правки");
      save.type = "submit";
      const feedback = element("p", "admin-message");
      feedback.setAttribute("role", "status");
      const recovery = element("div", "admin-lead-conflict");
      recovery.dataset.leadConflict = lead.id;
      const latest = element("p", "admin-message");
      const reapply = button("Применить мой черновик");
      const discard = button("Принять свежие данные");
      const reload = button("Загрузить свежую заявку");
      const recoveryActions = element("div", "admin-actions");
      recoveryActions.append(reapply, discard, reload);
      recovery.append(latest, recoveryActions);
      const conflict = () => {
        const current = state.leadDrafts.get(lead.id);
        return Boolean(
          current &&
          (current.conflict || (current.version || 1) !== (lead.version || 1)),
        );
      };
      const sync = () => {
        const current = state.leadDrafts.get(lead.id);
        const blocked = conflict();
        const fresh =
          current &&
          ((current.version || 1) !== (lead.version || 1) ||
            current.latestVersion === (lead.version || 1));
        save.disabled = !current || blocked;
        reset.disabled = !current;
        recovery.hidden = !blocked;
        reapply.disabled = discard.disabled = !fresh;
        reload.hidden = Boolean(fresh);
        latest.textContent = fresh
          ? "Заявка изменена в другой вкладке. Свежий статус: " +
            (statuses[lead.status] || lead.status) +
            ". Свежая заметка: " +
            (lead.note || "не заполнена") +
            ". Выберите, какие правки оставить."
          : "Заявка изменена в другой вкладке. Ваш черновик сохранён. Загрузите свежую версию, чтобы сравнить правки.";
      };
      const discardDraft = () => {
        status.input.value = lead.status;
        note.input.value = lead.note || "";
        state.leadDrafts.delete(lead.id);
        sync();
        message(
          feedback,
          "Несохранённые правки отменены. Восстановлена последняя загруженная версия заявки.",
        );
        status.input.focus();
      };
      const change = () => {
        const previous = state.leadDrafts.get(lead.id);
        const next = {
          ...previous,
          status: status.input.value,
          note: note.input.value,
          version: previous?.version || lead.version || 1,
        };
        if (next.status === lead.status && next.note === (lead.note || ""))
          state.leadDrafts.delete(lead.id);
        else state.leadDrafts.set(lead.id, next);
        sync();
        message(feedback);
      };
      reset.addEventListener("click", () => {
        if (!reset.disabled && !state.leadWrites.size) discardDraft();
      });
      discard.addEventListener("click", () => {
        if (!discard.disabled && !state.leadWrites.size) discardDraft();
      });
      reapply.addEventListener("click", () => {
        if (reapply.disabled || state.leadWrites.size) return;
        const current = state.leadDrafts.get(lead.id);
        state.leadDrafts.set(lead.id, {
          ...current,
          version: lead.version || 1,
          conflict: false,
          latestVersion: undefined,
        });
        sync();
        message(
          feedback,
          "Ваш черновик применён к свежей версии. Проверьте правки и нажмите «Сохранить заявку».",
        );
      });
      reload.addEventListener("click", async () => {
        if (reload.disabled || state.leadWrites.size || !state.authenticated)
          return;
        const active = currentSession();
        state.leadWrites.add(lead.id);
        updateLeadBusy();
        pending(reload, true, "Загружаем…");
        message(feedback, "Загружаем свежую версию заявки…");
        try {
          const fresh = await latestLead(lead, active);
          if (!active()) return;
          Object.assign(lead, fresh);
          const current = state.leadDrafts.get(lead.id);
          if (current) current.latestVersion = lead.version || 1;
          badge.textContent = statuses[lead.status];
          sync();
          message(feedback);
        } catch (error) {
          if (active() && !error.cancelled)
            message(feedback, error.message, "error");
        } finally {
          if (active()) {
            state.leadWrites.delete(lead.id);
            pending(reload, false);
            updateLeadBusy();
          }
        }
      });
      status.input.addEventListener("change", change);
      note.input.addEventListener("input", change);
      sync();
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (
          save.disabled ||
          !state.authenticated ||
          state.leadWrites.size ||
          state.leadsBusy
        )
          return;
        const active = currentSession();
        const changes = {
          status: status.input.value,
          note: note.input.value,
          version: state.leadDrafts.get(lead.id)?.version || lead.version || 1,
        };
        state.leadWrites.add(lead.id);
        updateLeadBusy();
        pending(save, true, "Сохраняем…");
        message(feedback, "Сохраняем заявку…");
        reset.disabled = true;
        status.input.disabled = true;
        note.input.disabled = true;
        try {
          const data = await api(
            "/api/admin/leads/" + encodeURIComponent(lead.id),
            { method: "PATCH", body: changes },
          );
          if (!active()) return;
          Object.assign(lead, data.lead);
          state.leadDrafts.delete(lead.id);
          status.input.value = lead.status;
          note.input.value = lead.note || "";
          badge.textContent = statuses[lead.status];
          message(feedback, "Изменения сохранены.", "success");
        } catch (error) {
          if (!active() || error.cancelled) return;
          if (error.status === 409) {
            const current = state.leadDrafts.get(lead.id);
            if (current) current.conflict = true;
            try {
              const fresh = await latestLead(lead, active);
              if (!active()) return;
              Object.assign(lead, fresh);
              if (current) current.latestVersion = lead.version || 1;
              badge.textContent = statuses[lead.status];
              message(
                feedback,
                "Сохранение остановлено: сравните свежие данные с вашим черновиком.",
                "error",
              );
            } catch (refreshError) {
              if (!active() || refreshError.cancelled) return;
              message(feedback, refreshError.message, "error");
            }
          } else message(feedback, error.message, "error");
        } finally {
          if (!active()) return;
          state.leadWrites.delete(lead.id);
          pending(save, false);
          status.input.disabled = false;
          note.input.disabled = false;
          sync();
          updateLeadBusy();
        }
      });
      const actions = element("div", "admin-actions");
      actions.append(save, reset);
      form.append(status.label, note.label, actions, feedback, recovery);
      grid.append(info, form);
      body.append(grid);
      row.append(summary, body);
      return row;
    });
    $("leads-list").replaceChildren(...rows);
    if (!rows.length)
      $("leads-list").append(
        element(
          "p",
          "admin-empty",
          $("leads-search").value.trim() || $("leads-filter").value
            ? "По вашим условиям ничего не найдено. Измените поиск или статус."
            : "Заявок пока нет. Здесь появятся обращения, отправленные через сайт.",
        ),
      );
    $("leads-count").textContent =
      `Показано ${matching.length}${Number.isInteger(state.leadsTotal) ? ` из ${state.leadsTotal} найденных заявок` : " заявок"}${state.hasMore ? ". Есть ещё заявки." : "."}`;
    $("leads-more").hidden = !state.hasMore;
  }

  function calendarKey(date) {
    return date.toISOString().slice(0, 10);
  }
  async function loadAvailability() {
    if (!state.authenticated || state.calendarBusy) return;
    const active = operation("calendar");
    state.calendarBusy = true;
    renderCalendar();
    message("calendar-message", "Загружаем календарь…");
    try {
      const availability = await api("/api/admin/availability");
      if (!active()) return;
      state.availability = availability;
      message("calendar-message");
    } catch (error) {
      if (!active() || error.cancelled) return;
      message("calendar-message", error.message, "error");
    } finally {
      if (active()) {
        state.calendarBusy = false;
        renderCalendar();
      }
    }
  }
  async function saveDates(changes, focusDate) {
    if (
      !state.authenticated ||
      state.calendarBusy ||
      !state.availability ||
      !changes.length
    )
      return;
    const active = operation("calendar");
    state.calendarBusy = true;
    renderCalendar();
    message("calendar-message", "Сохраняем даты…");
    try {
      const availability = await api("/api/admin/availability", {
        method: "PATCH",
        body: { version: state.availability.version, changes },
      });
      if (!active()) return;
      state.availability = availability;
      for (const change of changes) {
        state.calendarNoteDrafts.delete(change.date);
        state.calendarSelection.delete(change.date);
      }
      message(
        "calendar-message",
        "Календарь сохранён. Даты обновлены на сайте.",
        "success",
      );
    } catch (error) {
      if (!active() || error.cancelled) return;
      if (error.status === 409) {
        try {
          const availability = await api("/api/admin/availability");
          if (!active()) return;
          state.availability = availability;
        } catch (refreshError) {
          if (!active() || refreshError.cancelled) return;
          state.availability = null;
        }
        message(
          "calendar-message",
          "Календарь изменён в другой вкладке. Проверьте свежие даты и повторите действие.",
          "error",
        );
      } else message("calendar-message", error.message, "error");
    } finally {
      if (!active()) return;
      state.calendarBusy = false;
      renderCalendar();
      if (focusDate)
        $("calendar-days")
          .querySelector(`[data-date="${focusDate}"]`)
          ?.focus({ preventScroll: true });
    }
  }
  function renderCalendar() {
    if (!state.authenticated) {
      $("calendar-days").replaceChildren();
      $("calendar-busy-list").replaceChildren();
      return;
    }
    const month = state.calendarMonth,
      key = calendarKey(month).slice(0, 7),
      entries = state.availability?.dates || [];
    const busy = new Map(entries.map((entry) => [entry.date, entry]));
    const today = eventToday();
    $("calendar-month").textContent = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(month);
    $("calendar-editor").setAttribute("aria-busy", String(state.calendarBusy));
    $("calendar-refresh").disabled = state.calendarBusy;
    $("calendar-prev").disabled = state.calendarBusy || key <= "2000-01";
    $("calendar-next").disabled = state.calendarBusy || key >= "2099-12";
    $("calendar-jump").value = key;
    $("calendar-jump").setCustomValidity("");
    $("calendar-jump").disabled = state.calendarBusy;
    $("calendar-today").disabled = state.calendarBusy;
    $("calendar-days").replaceChildren();
    const count = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    for (let n = 0; n < (month.getUTCDay() + 6) % 7; n++) {
      $("calendar-days").append(element("span"));
    }
    for (let day = 1; day <= count; day++) {
      const date = `${key}-${String(day).padStart(2, "0")}`,
        occupied = busy.has(date);
      const dayButton = button(String(day), "admin-calendar-day");
      dayButton.dataset.date = date;
      if (date === today) dayButton.setAttribute("aria-current", "date");
      dayButton.dataset.busy = String(occupied);
      dayButton.disabled = state.calendarBusy || !state.availability;
      dayButton.setAttribute(
        "aria-label",
        `${dateLabel(date)}${date === today ? ", сегодня" : ""}, ${occupied ? "занято" : "свободно"}`,
      );
      dayButton.setAttribute(
        "aria-pressed",
        String(
          $("calendar-multiple").checked
            ? state.calendarSelection.has(date)
            : occupied,
        ),
      );
      dayButton.addEventListener("click", () => {
        if ($("calendar-multiple").checked) {
          if (state.calendarSelection.has(date))
            state.calendarSelection.delete(date);
          else if (state.calendarSelection.size < 366)
            state.calendarSelection.add(date);
          renderCalendar();
          $("calendar-days")
            .querySelector(`[data-date="${date}"]`)
            ?.focus({ preventScroll: true });
        } else saveDates([{ date, busy: !occupied }], date);
      });
      $("calendar-days").append(dayButton);
    }
    $("calendar-multiple").disabled = state.calendarBusy || !state.availability;
    $("calendar-bulk").hidden = !$("calendar-multiple").checked;
    $("calendar-selected").textContent = state.calendarSelection.size
      ? `Выбрано дат: ${state.calendarSelection.size}`
      : "Даты не выбраны";
    for (const id of [
      "calendar-mark-busy",
      "calendar-mark-free",
      "calendar-clear",
    ])
      $(id).disabled = state.calendarBusy || !state.calendarSelection.size;
    const list = $("calendar-busy-list"),
      opened = new Set(
        [...list.querySelectorAll("details[open]")].map(
          (el) => el.dataset.date,
        ),
      );
    list.replaceChildren();
    const nearest = nextBusyDate(entries);
    $("calendar-upcoming").textContent = !state.availability
      ? ""
      : nearest
        ? `Ближайшая занятая дата — ${dateLabel(nearest)}.`
        : "Предстоящих занятых дат нет.";
    const visibleEntries = calendarList(
      entries,
      $("calendar-period").value,
      $("calendar-search").value,
    );
    $("calendar-found").textContent = state.availability
      ? `Показано: ${visibleEntries.length} из ${entries.length}`
      : "";
    for (const entry of visibleEntries) {
      const row = element("details", "admin-busy-date");
      row.dataset.date = entry.date;
      row.open = opened.has(entry.date);
      const summary = element("summary", "", dateLabel(entry.date));
      const body = element("form", "admin-date-form");
      const note = field("Личная заметка", {
        tag: "textarea",
        value: state.calendarNoteDrafts.get(entry.date) ?? entry.note ?? "",
        maxLength: 2000,
        id: `date-note-${entry.date}`,
      });
      const actions = element("div", "admin-actions"),
        save = button("Сохранить заметку", ""),
        free = button("Освободить дату");
      const locate = button("Показать в календаре");
      locate.addEventListener("click", () => {
        state.calendarMonth = new Date(
          `${entry.date.slice(0, 7)}-01T12:00:00Z`,
        );
        renderCalendar();
        $("calendar-days")
          .querySelector(`[data-date="${entry.date}"]`)
          ?.focus();
      });
      save.type = "submit";
      save.disabled = free.disabled = note.input.disabled = state.calendarBusy;
      note.input.addEventListener("input", () => {
        if (note.input.value === (entry.note || ""))
          state.calendarNoteDrafts.delete(entry.date);
        else state.calendarNoteDrafts.set(entry.date, note.input.value);
      });
      body.addEventListener("submit", (event) => {
        event.preventDefault();
        saveDates([{ date: entry.date, busy: true, note: note.input.value }]);
      });
      free.addEventListener("click", () =>
        saveDates([{ date: entry.date, busy: false }]),
      );
      actions.append(save, free, locate);
      body.append(note.label, actions);
      row.append(summary, body);
      list.append(row);
    }
    if (!visibleEntries.length)
      list.append(
        element(
          "p",
          "admin-empty",
          state.availability
            ? "По выбранному периоду и запросу дат нет. Измените фильтр или очистите поиск."
            : "Загрузите календарь для проверки дат.",
        ),
      );
    const legend = document.querySelector(".admin-calendar-legend");
    legend.hidden = !state.availability;
  }
  $("calendar-refresh").addEventListener("click", loadAvailability);
  $("calendar-period").addEventListener("change", renderCalendar);
  $("calendar-search").addEventListener("input", renderCalendar);
  $("calendar-jump").addEventListener("change", () => {
    const input = $("calendar-jump");
    if (state.calendarBusy) return;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.value)) {
      input.setCustomValidity("Укажите месяц от 2000-01 до 2099-12.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    state.calendarMonth = new Date(`${input.value}-01T12:00:00Z`);
    renderCalendar();
  });
  $("calendar-jump").addEventListener("input", () =>
    $("calendar-jump").setCustomValidity(""),
  );
  $("calendar-today").addEventListener("click", () => {
    if (state.calendarBusy) return;
    $("calendar-jump").setCustomValidity("");
    state.calendarMonth = new Date(`${eventToday().slice(0, 7)}-01T12:00:00Z`);
    renderCalendar();
  });
  for (const [id, step] of [
    ["calendar-prev", -1],
    ["calendar-next", 1],
  ])
    $(id).addEventListener("click", () => {
      state.calendarMonth.setUTCMonth(state.calendarMonth.getUTCMonth() + step);
      renderCalendar();
    });
  $("calendar-multiple").addEventListener("change", () => {
    state.calendarSelection.clear();
    renderCalendar();
  });
  $("calendar-clear").addEventListener("click", () => {
    state.calendarSelection.clear();
    renderCalendar();
  });
  $("calendar-mark-busy").addEventListener("click", () =>
    saveDates(
      [...state.calendarSelection].map((date) => ({ date, busy: true })),
    ),
  );
  $("calendar-mark-free").addEventListener("click", () =>
    saveDates(
      [...state.calendarSelection].map((date) => ({ date, busy: false })),
    ),
  );
  $("calendar-days").addEventListener("keydown", (event) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (
      !(event.key in steps) &&
      !["Home", "End", "PageUp", "PageDown"].includes(event.key)
    )
      return;
    if (
      !event.target.dataset.date ||
      state.calendarBusy ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    const target = new Date(`${event.target.dataset.date}T12:00:00Z`);
    if (event.key in steps)
      target.setUTCDate(target.getUTCDate() + steps[event.key]);
    else if (event.key === "Home") target.setUTCDate(1);
    else if (event.key === "End")
      target.setUTCMonth(target.getUTCMonth() + 1, 0);
    else {
      const day = target.getUTCDate();
      target.setUTCDate(1);
      target.setUTCMonth(
        target.getUTCMonth() + (event.key === "PageUp" ? -1 : 1),
      );
      const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
    }
    const date = calendarKey(target);
    if (date < "2000-01-01" || date > "2099-12-31") return;
    if (date.slice(0, 7) !== calendarKey(state.calendarMonth).slice(0, 7)) {
      state.calendarMonth = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
      renderCalendar();
    }
    $("calendar-days").querySelector(`[data-date="${date}"]`)?.focus();
  });

  function updateGalleryBusy() {
    const busy = state.galleryBusy || state.uploadBusy || state.catalogBusy;
    $("gallery-list").inert = busy;
    $("gallery-list").setAttribute("aria-busy", String(busy));
    for (const control of $("gallery-list").querySelectorAll(
      "input, select, textarea, button",
    )) {
      if (busy) {
        if (!Object.hasOwn(control.dataset, "galleryIdleDisabled"))
          control.dataset.galleryIdleDisabled = String(control.disabled);
        control.disabled = true;
      } else if (Object.hasOwn(control.dataset, "galleryIdleDisabled")) {
        control.disabled = control.dataset.galleryIdleDisabled === "true";
        delete control.dataset.galleryIdleDisabled;
      }
    }
    if (!busy) {
      for (const article of $("gallery-list").querySelectorAll(
        "[data-photo-id]",
      )) {
        const save = article.querySelector("button[type=submit]");
        if (save)
          save.disabled = !state.photoDrafts.has(article.dataset.photoId);
      }
    }
    $("gallery-refresh").disabled = busy || !state.authenticated;
    $("upload-fields").disabled = busy || !state.authenticated;
    $("upload-submit").disabled = busy || !state.authenticated;
    if (state.authenticated) filterGallery();
    updateSaveState();
  }
  function clearPreview() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
    $("upload-preview").hidden = true;
    $("upload-preview").removeAttribute("src");
    $("upload-clear").hidden = true;
  }
  $("upload-clear").addEventListener("click", () => {
    if (state.uploadBusy) return;
    $("photo-file").value = "";
    clearPreview();
    message(
      "gallery-message",
      "Файл убран. Описание и подпись сохранены — выберите другую фотографию.",
    );
    $("photo-file").focus();
  });
  function validateFile(file) {
    if (!file) throw new Error("Выберите фотографию.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Выберите фотографию в формате JPEG, PNG или WebP.");
    if (!file.size || file.size > 20 * 1024 * 1024)
      throw new Error("Размер исходной фотографии — до 20 МБ.");
  }
  $("photo-file").addEventListener("change", () => {
    clearPreview();
    message("gallery-message");
    const file = $("photo-file").files[0];
    if (!file) return;
    try {
      validateFile(file);
      state.previewUrl = URL.createObjectURL(file);
      $("upload-preview").src = state.previewUrl;
      $("upload-preview").hidden = false;
      $("upload-clear").hidden = false;
      const previewUrl = state.previewUrl;
      // Ignore decoding results for a file that has since been replaced or cleared.
      $("upload-preview")
        .decode()
        .catch(() => {
          if (state.previewUrl !== previewUrl || state.uploadBusy) return;
          $("photo-file").value = "";
          clearPreview();
          message(
            "gallery-message",
            "Не удалось открыть фотографию. Выберите другой JPEG, PNG или WebP. Описание и подпись сохранены.",
            "error",
          );
        });
    } catch (error) {
      message("gallery-message", error.message, "error");
      $("photo-file").value = "";
    }
  });
  $("upload-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      !state.authenticated ||
      state.uploadBusy ||
      state.galleryBusy ||
      state.catalogBusy
    )
      return;
    const file = $("photo-file").files[0];
    try {
      validateFile(file);
    } catch (error) {
      message("gallery-message", error.message, "error");
      return;
    }
    const alt = $("photo-alt").value.trim(),
      caption = $("photo-caption").value.trim();
    if (!alt) {
      message("gallery-message", "Добавьте описание изображения.", "error");
      $("photo-alt").focus();
      return;
    }
    const active = operation("gallery");
    state.uploadBusy = true;
    updateGalleryBusy();
    pending($("upload-submit"), true, "Загружаем…");
    message("gallery-message", "Готовим фотографию к загрузке…");
    try {
      const { prepareGalleryImage } = await import("../image-tools.js");
      if (!active()) return;
      const prepared = await prepareGalleryImage(file);
      if (!active()) return;
      message("gallery-message", "Загружаем фотографию…");
      const result = await api("/api/admin/gallery", {
        method: "POST",
        body: {
          ...prepared,
          alt,
          caption,
          featured: $("photo-featured").checked,
          published: $("photo-published").checked,
        },
      });
      if (!active()) return;
      state.gallery.push(result.photo);
      $("upload-form").reset();
      clearPreview();
      renderGallery();
      message(
        "gallery-message",
        result.photo.published === false
          ? "Фотография загружена и скрыта с сайта. Опубликовать её можно в настройках снимка."
          : "Фотография загружена и появилась на сайте.",
        "success",
      );
    } catch (error) {
      if (!active() || error.cancelled) return;
      message("gallery-message", error.message, "error");
    } finally {
      if (active()) {
        state.uploadBusy = false;
        pending($("upload-submit"), false);
        updateGalleryBusy();
      }
    }
  });
  async function refreshGallery() {
    if (
      !state.authenticated ||
      state.galleryBusy ||
      state.uploadBusy ||
      state.catalogBusy
    )
      return;
    if (
      state.photoDrafts.size &&
      !window.confirm(
        "Обновить галерею? Несохранённые описания и подписи будут отменены.",
      )
    )
      return;
    const active = operation("gallery");
    state.galleryBusy = true;
    updateGalleryBusy();
    pending($("gallery-refresh"), true, "Обновляем…");
    message("gallery-message", "Загружаем фотографии…");
    try {
      const catalog = await api("/api/admin/catalog");
      if (!active()) return;
      state.gallery = catalog.gallery;
      state.photoDrafts.clear();
      renderGallery();
      message("gallery-message");
    } catch (error) {
      if (!active() || error.cancelled) return;
      message("gallery-message", error.message, "error");
    } finally {
      if (active()) {
        state.galleryBusy = false;
        pending($("gallery-refresh"), false);
        updateGalleryBusy();
      }
    }
  }
  $("gallery-refresh").addEventListener("click", refreshGallery);
  function imageUrl(raw) {
    try {
      const url = new URL(raw, location.origin);
      if (url.origin === location.origin || url.protocol === "https:")
        return url.href;
    } catch {
      /* A malformed stored URL must not become an image source. */
    }
    return "";
  }
  function renderGallery() {
    if (!state.authenticated) {
      $("gallery-list").replaceChildren();
      return;
    }
    const photos = state.gallery.map((photo, index) => {
      const article = element("article", "admin-photo");
      article.dataset.photoId = photo.id;
      const img = element("img");
      img.alt = photo.alt;
      img.loading = "lazy";
      const url = imageUrl(photo.url);
      const preview = photoPreview(img, url);
      const form = element("form");
      const draft = state.photoDrafts.get(photo.id) || {
        alt: photo.alt,
        caption: photo.caption || "",
        featured: photo.featured === true,
        published: photo.published !== false,
      };
      const alt = field("Описание изображения", {
        value: draft.alt,
        required: true,
        maxLength: 240,
        id: `photo-alt-${photo.id}`,
      });
      const caption = field("Подпись на сайте", {
        value: draft.caption,
        maxLength: 240,
        id: `photo-caption-${photo.id}`,
      });
      const featured = checkbox("Крупный акцентный кадр", draft.featured);
      const published = checkbox("Показывать на сайте", draft.published);
      const publication = element(
        "p",
        "admin-muted",
        photo.published !== false ? "На сайте" : "Скрыто с сайта",
      );
      const order = element("div", "admin-photo-order");
      const earlier = button("← Раньше"),
        later = button("Позже →");
      earlier.setAttribute("aria-label", `Переместить раньше: ${photo.alt}`);
      later.setAttribute("aria-label", `Переместить позже: ${photo.alt}`);
      earlier.disabled = index === 0 || state.galleryBusy;
      later.disabled = index === state.gallery.length - 1 || state.galleryBusy;
      earlier.addEventListener("click", () => movePhoto(index, -1));
      later.addEventListener("click", () => movePhoto(index, 1));
      order.append(
        earlier,
        element(
          "span",
          "admin-muted",
          `${index + 1} / ${state.gallery.length}`,
        ),
        later,
      );
      const actions = element("div", "admin-actions");
      const save = button("Сохранить", "");
      save.type = "submit";
      save.disabled = !state.photoDrafts.has(photo.id);
      const remove = button("Удалить", "danger");
      remove.setAttribute("aria-label", `Удалить фотографию: ${photo.alt}`);
      const feedback = element("p", "admin-message");
      feedback.setAttribute("role", "status");
      const change = () => {
        const next = {
          version:
            state.photoDrafts.get(photo.id)?.version || photo.version || 1,
          alt: alt.input.value,
          caption: caption.input.value,
          featured: featured.input.checked,
          published: published.input.checked,
        };
        if (
          next.alt === photo.alt &&
          next.caption === (photo.caption || "") &&
          next.featured === (photo.featured === true) &&
          next.published === (photo.published !== false)
        )
          state.photoDrafts.delete(photo.id);
        else state.photoDrafts.set(photo.id, next);
        save.disabled = !state.photoDrafts.has(photo.id);
        message(feedback);
      };
      alt.input.addEventListener("input", change);
      caption.input.addEventListener("input", change);
      featured.input.addEventListener("change", change);
      published.input.addEventListener("change", change);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (
          !state.authenticated ||
          save.disabled ||
          state.galleryBusy ||
          state.uploadBusy ||
          state.catalogBusy
        )
          return;
        if (!alt.input.value.trim()) {
          message(feedback, "Добавьте описание изображения.", "error");
          return;
        }
        const changes = {
          version:
            state.photoDrafts.get(photo.id)?.version || photo.version || 1,
          alt: alt.input.value.trim(),
          caption: caption.input.value.trim(),
          featured: featured.input.checked,
          published: published.input.checked,
        };
        const active = operation("gallery");
        state.galleryBusy = true;
        updateGalleryBusy();
        pending(save, true, "Сохраняем…");
        message(feedback, "Сохраняем настройки фотографии…");
        remove.disabled = true;
        alt.input.disabled = true;
        caption.input.disabled = true;
        featured.input.disabled = true;
        published.input.disabled = true;
        try {
          const result = await api(
            `/api/admin/gallery/${encodeURIComponent(photo.id)}`,
            { method: "PATCH", body: changes },
          );
          if (!active()) return;
          Object.assign(photo, result.photo);
          state.photoDrafts.delete(photo.id);
          alt.input.value = photo.alt;
          caption.input.value = photo.caption || "";
          img.alt = photo.alt;
          publication.textContent =
            photo.published !== false ? "На сайте" : "Скрыто с сайта";
          remove.setAttribute("aria-label", `Удалить фотографию: ${photo.alt}`);
          message(feedback, "Изменения сохранены.", "success");
          filterGallery();
        } catch (error) {
          if (!active() || error.cancelled) return;
          message(feedback, error.message, "error");
        } finally {
          if (!active()) return;
          state.galleryBusy = false;
          pending(save, false);
          remove.disabled = false;
          alt.input.disabled = false;
          caption.input.disabled = false;
          featured.input.disabled = false;
          published.input.disabled = false;
          save.disabled = !state.photoDrafts.has(photo.id);
          updateGalleryBusy();
        }
      });
      remove.addEventListener("click", async () => {
        if (
          !state.authenticated ||
          state.galleryBusy ||
          state.uploadBusy ||
          state.catalogBusy ||
          remove.disabled ||
          !window.confirm(
            `Удалить фотографию «${photo.alt}» из галереи? Она исчезнет с сайта. Это действие нельзя отменить.`,
          )
        )
          return;
        const active = operation("gallery");
        state.galleryBusy = true;
        updateGalleryBusy();
        pending(remove, true, "Удаляем…");
        message(feedback, "Удаляем фотографию…");
        save.disabled = true;
        alt.input.disabled = true;
        caption.input.disabled = true;
        try {
          await api(`/api/admin/gallery/${encodeURIComponent(photo.id)}`, {
            method: "DELETE",
            body: {},
          });
          if (!active()) return;
          state.gallery = state.gallery.filter(
            (entry) => entry.id !== photo.id,
          );
          state.photoDrafts.delete(photo.id);
          renderGallery();
          message("gallery-message", "Фотография удалена.", "success");
        } catch (error) {
          if (!active() || error.cancelled) return;
          message(feedback, error.message, "error");
          pending(remove, false);
          alt.input.disabled = false;
          caption.input.disabled = false;
          save.disabled = !state.photoDrafts.has(photo.id);
        } finally {
          if (active()) {
            state.galleryBusy = false;
            updateGalleryBusy();
          }
        }
      });
      actions.append(save, remove);
      form.append(
        publication,
        alt.label,
        caption.label,
        featured.label,
        published.label,
        actions,
        feedback,
      );
      article.append(preview, order, form);
      return article;
    });
    $("gallery-list").replaceChildren(...photos);
    updateGalleryBusy();
    if (!photos.length)
      $("gallery-list").append(
        element(
          "p",
          "admin-empty",
          "Фотографий пока нет. Загрузите первый снимок с мероприятия.",
        ),
      );
  }

  function filterGallery() {
    if (!state.authenticated) return;
    const busy = state.galleryBusy || state.uploadBusy || state.catalogBusy;
    const query = $("gallery-search").value.trim().toLocaleLowerCase("ru-RU");
    const status = $("gallery-filter").value;
    let visible = 0;
    for (const article of $("gallery-list").querySelectorAll(
      "[data-photo-id]",
    )) {
      const photo = state.gallery.find(
        (item) => item.id === article.dataset.photoId,
      );
      if (!photo) continue;
      const draft = state.photoDrafts.get(photo.id) || photo;
      const matches =
        `${draft.alt || ""} ${draft.caption || ""}`
          .toLocaleLowerCase("ru-RU")
          .includes(query) &&
        (!status ||
          (status === "published"
            ? photo.published !== false
            : photo.published === false));
      article.hidden = !matches;
      if (matches) visible++;
      const orderButtons = article.querySelectorAll(
        ".admin-photo-order button",
      );
      const index = state.gallery.indexOf(photo);
      orderButtons[0].disabled = Boolean(
        query || status || busy || index === 0,
      );
      orderButtons[1].disabled = Boolean(
        query || status || busy || index === state.gallery.length - 1,
      );
    }
    $("gallery-count").textContent =
      `Показано: ${visible} из ${state.gallery.length}${query || status ? ". Для изменения порядка сбросьте поиск и фильтр." : ""}`;
    $("gallery-filter-empty").hidden =
      visible > 0 || state.gallery.length === 0;
  }
  $("gallery-search").addEventListener("input", filterGallery);
  $("gallery-filter").addEventListener("change", filterGallery);

  async function movePhoto(index, direction) {
    if (
      !state.authenticated ||
      state.galleryBusy ||
      state.uploadBusy ||
      state.catalogBusy
    )
      return;
    const ids = state.gallery.map((photo) => photo.id);
    if (index + direction < 0 || index + direction >= ids.length) return;
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    const active = operation("gallery");
    state.galleryBusy = true;
    updateGalleryBusy();
    message("gallery-message", "Сохраняем порядок…");
    try {
      const result = await api("/api/admin/gallery/order", {
        method: "PUT",
        body: { ids },
      });
      if (!active()) return;
      state.gallery = result.gallery;
      message("gallery-message", "Порядок фотографий сохранён.", "success");
    } catch (error) {
      if (!active() || error.cancelled) return;
      message("gallery-message", error.message, "error");
    } finally {
      if (active()) {
        state.galleryBusy = false;
        renderGallery();
        updateGalleryBusy();
      }
    }
  }
  const launchStatus = createLaunchStatus(api);
  contentEditor = createContentEditor(api);
  checkSession();
})();

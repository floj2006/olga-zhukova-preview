(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Content remains visible if JavaScript is disabled or observers are unavailable.
  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("js");
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll(".reveal")
      .forEach((element) => reveal.observe(element));
  }

  const header = $("header");
  const updateHeader = () =>
    header.classList.toggle("scrolled", window.scrollY > 90);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  $("year").textContent = new Date().getFullYear();

  const menuButton = $("menu-toggle");
  const menu = $("mobile-menu");
  function setMenu(open, restoreFocus = false) {
    menu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Закрыть меню" : "Открыть меню",
    );
    document.body.classList.toggle("menu-open", open);
    if (open) menu.querySelector("a").focus();
    else if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    setMenu(false);
    if (link.hash) {
      const target = document.querySelector(link.hash);
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") setMenu(false, true);
    if (event.key === "Tab") {
      const last = menu.querySelector("a:last-child");
      if (event.shiftKey && document.activeElement === menuButton) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        menuButton.focus();
      }
    }
  });
  window
    .matchMedia("(min-width: 901px)")
    .addEventListener("change", (event) => {
      if (event.matches) setMenu(false);
    });

  // A single open chapter keeps the programme easy to scan.
  const chapters = document.querySelectorAll(".program details");
  chapters.forEach((chapter) =>
    chapter.addEventListener("toggle", () => {
      if (chapter.open)
        chapters.forEach((other) => {
          if (other !== chapter) other.open = false;
        });
    }),
  );

  const steps = [
    {
      key: "format",
      label: "ФОРМАТ СОБЫТИЯ",
      summary: "Формат",
      title: "Какой повод для праздника?",
      note: "Выберите формат вашего события.",
      options: [
        { id: "wedding", title: "Свадьба", note: "Ваша история любви" },
        {
          id: "corporate",
          title: "Корпоратив",
          note: "Вечер для вашей команды",
        },
        { id: "anniversary", title: "Юбилей", note: "В кругу самых близких" },
        { id: "graduation", title: "Выпускной", note: "Начало новой главы" },
      ],
    },
    {
      key: "guests",
      label: "ВАШИ ГОСТИ",
      summary: "Гости",
      title: "Сколько гостей пригласим?",
      note: "Достаточно примерного числа — детали уточним вместе.",
      options: [
        { id: "intimate", title: "До 30 гостей", note: "Камерный праздник" },
        { id: "medium", title: "31–60 гостей", note: "Близкие и друзья" },
        { id: "large", title: "61–100 гостей", note: "Большая компания" },
        { id: "grand", title: "Более 100 гостей", note: "Масштабное событие" },
      ],
    },
    {
      key: "duration",
      label: "ПРОДОЛЖИТЕЛЬНОСТЬ",
      summary: "Программа",
      title: "Как долго будем праздновать?",
      note: "Речь о времени работы ведущей на вашем событии.",
      options: [
        { id: "short", title: "До 4 часов", note: "Самое важное и яркое" },
        { id: "standard", title: "6 часов", note: "Полноценная программа" },
        { id: "full", title: "8 часов", note: "От встречи до финала" },
        { id: "undecided", title: "Пока не знаю", note: "Определимся вместе" },
      ],
    },
    {
      key: "location",
      label: "МЕСТО ВСТРЕЧИ",
      summary: "Место",
      title: "Где состоится ваш вечер?",
      note: "Учтём дорогу и особенности вашей площадки.",
      options: [
        { id: "city", title: "Вологда", note: "В пределах города" },
        { id: "nearby", title: "Рядом с городом", note: "До 50 км от Вологды" },
        {
          id: "region",
          title: "Вологодская область",
          note: "Более 50 км от города",
        },
        { id: "other", title: "Другой город", note: "Выезд обсудим лично" },
      ],
    },
    {
      key: "support",
      label: "МУЗЫКА И НАСТРОЕНИЕ",
      summary: "Сопровождение",
      title: "Добавим музыку к эмоциям?",
      note: "Выберите подходящий состав команды.",
      options: [
        {
          id: "host",
          title: "Только ведущая",
          note: "Музыка — на вашей стороне",
        },
        {
          id: "dj",
          title: "Ведущая + DJ",
          note: "Звук предоставляет площадка",
        },
        {
          id: "complete",
          title: "Ведущая, DJ и звук",
          note: "Команда с оборудованием",
        },
        {
          id: "undecided",
          title: "Нужен совет",
          note: "Подберём лучшее решение",
        },
      ],
    },
  ];
  const rates = window.EVENT_PRICING;
  const storageKey = "olga-event-calculator-v1";
  const answers = {};
  let currentStep = 0;
  let resultText = "";
  const currency = new Intl.NumberFormat("ru-RU");
  const disclaimer = rates.demo
    ? "Демонстрационный расчёт: тарифы пока не подтверждены. Точную стоимость и доступность даты уточните у Ольги."
    : "Расчёт ориентировочный. Итоговая стоимость зависит от даты, площадки и деталей программы.";
  $("calculator-note").textContent = disclaimer;

  // Store only event preferences, never contact or personal data.
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved && typeof saved === "object") {
      for (const step of steps) {
        if (step.options.some((option) => option.id === saved[step.key]))
          answers[step.key] = saved[step.key];
      }
    }
  } catch {
    /* The calculator also works with browser storage disabled. */
  }
  function saveAnswers() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      /* Optional persistence. */
    }
  }

  function renderStep(focus = false) {
    const step = steps[currentStep];
    $("quiz").hidden = false;
    $("quiz-result").hidden = true;
    $("step-label").textContent = step.label;
    $("step-number").textContent = String(currentStep + 1).padStart(2, "0");
    $("progress-fill").style.width =
      `${((currentStep + 1) / steps.length) * 100}%`;
    document
      .querySelector(".progress-track")
      .setAttribute("aria-valuenow", String(currentStep + 1));
    $("question-title").textContent = step.title;
    $("question-note").textContent = step.note;
    const options = $("quiz-options");
    options.replaceChildren();
    for (const option of step.options) {
      const label = document.createElement("label");
      label.className = "quiz-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = step.key;
      input.value = option.id;
      input.checked = answers[step.key] === option.id;
      input.required = true;
      const content = document.createElement("span");
      content.className = "option-content";
      const title = document.createElement("strong");
      title.textContent = option.title;
      const note = document.createElement("small");
      note.textContent = option.note;
      content.append(title, note);
      label.append(input, content);
      options.append(label);
    }
    $("quiz-back").disabled = currentStep === 0;
    $("quiz-next").disabled = !answers[step.key];
    $("quiz-next").querySelector("span").textContent =
      currentStep === steps.length - 1 ? "ПОЛУЧИТЬ РАСЧЁТ" : "ДАЛЕЕ";
    if (focus) {
      $("question-title").focus({ preventScroll: true });
      const top = $("booking").getBoundingClientRect().top;
      if (top < 90 || top > window.innerHeight / 2) {
        $("booking").scrollIntoView({
          behavior: reducedMotion.matches ? "instant" : "smooth",
          block: "start",
        });
      }
    }
  }

  $("quiz-options").addEventListener("change", (event) => {
    const step = steps[currentStep];
    if (!step.options.some((option) => option.id === event.target.value))
      return;
    answers[step.key] = event.target.value;
    $("quiz-next").disabled = false;
    saveAnswers();
  });
  $("quiz-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!answers[steps[currentStep].key]) return;
    if (currentStep < steps.length - 1) {
      currentStep++;
      renderStep(true);
    } else showResult();
  });
  $("quiz-back").addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      renderStep(true);
    }
  });

  function showResult() {
    if (steps.some((step) => !answers[step.key])) return;
    const total = steps.reduce(
      (sum, step) => sum + rates[step.key][answers[step.key]],
      0,
    );
    $("result-price").textContent = currency.format(total);
    const summary = $("result-summary");
    summary.replaceChildren();
    const lines = [];
    for (const step of steps) {
      const option = step.options.find((item) => item.id === answers[step.key]);
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = step.summary;
      const description = document.createElement("dd");
      description.textContent = option.title;
      row.append(term, description);
      summary.append(row);
      lines.push(`${step.summary}: ${option.title}`);
    }
    const extras = [];
    if (answers.duration === "undecided")
      extras.push("В расчёте учтено до 4 часов работы.");
    if (answers.location === "other")
      extras.push(
        "Дорога и проживание в другом городе рассчитываются отдельно.",
      );
    if (answers.support === "undecided")
      extras.push("Музыка и оборудование в сумму не включены.");
    $("result-disclaimer").textContent = [disclaimer, ...extras].join(" ");
    resultText = [
      "Здравствуйте, Ольга! Хочу обсудить мероприятие.",
      ...lines,
      `Предварительная стоимость${rates.demo ? " (демонстрационные тарифы)" : ""}: от ${currency.format(total)} ₽.`,
      ...extras,
      "Подскажите, пожалуйста, доступность даты и точную стоимость.",
    ].join("\n");
    $("dialog-event").textContent = lines.join(" · ");
    $("quiz").hidden = true;
    $("quiz-result").hidden = false;
    $("result-title").focus({ preventScroll: true });
    $("booking").scrollIntoView({
      behavior: reducedMotion.matches ? "instant" : "smooth",
      block: "start",
    });
  }
  $("quiz-restart").addEventListener("click", () => {
    currentStep = 0;
    renderStep(true);
  });
  document.querySelectorAll("[data-event]").forEach((link) => {
    link.addEventListener("click", () => {
      answers.format = link.dataset.event;
      saveAnswers();
      currentStep = 0;
      renderStep();
    });
  });
  renderStep();

  const dialog = $("contact-dialog");
  $("exact-quote").addEventListener("click", () => {
    $("copy-status").textContent = "";
    $("copy-fallback").hidden = true;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
  $("dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    $("exact-quote").focus({ preventScroll: true });
  });
  $("copy-details").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      $("copy-status").textContent =
        "Детали скопированы. Можно отправить их Ольге.";
    } catch {
      const fallback = $("copy-fallback");
      fallback.value = resultText;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      $("copy-status").textContent = "Выделите и скопируйте текст ниже.";
    }
  });
})();

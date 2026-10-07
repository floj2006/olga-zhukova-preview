export function photoPreview(img, url) {
  const wrapper = document.createElement("div");
  wrapper.className = "admin-photo-preview";
  const fallback = document.createElement("div");
  fallback.className = "admin-photo-fallback";
  fallback.hidden = true;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "admin-button secondary";
  retry.textContent = "Загрузить фото снова";
  fallback.append(status, retry);
  wrapper.append(img, fallback);
  const failed = () => {
    img.hidden = true;
    fallback.hidden = false;
    status.textContent = "Фото недоступно. Подпись и настройки можно редактировать.";
    retry.disabled = !url;
    wrapper.setAttribute("aria-busy", "false");
  };
  img.addEventListener("error", failed);
  img.addEventListener("load", () => {
    const restoreFocus = document.activeElement === retry;
    img.hidden = false;
    fallback.hidden = true;
    retry.disabled = false;
    wrapper.setAttribute("aria-busy", "false");
    if (restoreFocus) {
      img.tabIndex = -1;
      img.focus({ preventScroll: true });
    }
  });
  retry.addEventListener("click", () => {
    retry.disabled = true;
    status.textContent = "Загружаем фотографию…";
    wrapper.setAttribute("aria-busy", "true");
    img.loading = "eager";
    img.removeAttribute("src");
    img.src = url;
  });
  if (url) img.src = url;
  else failed();
  return wrapper;
}

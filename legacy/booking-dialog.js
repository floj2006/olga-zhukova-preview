const dialog = document.querySelector("#booking-dialog");
let opener;
export function openBooking(trigger, tab = "date") {
  const wasOpen = dialog.open;
  if (!wasOpen) opener = trigger;
  document.querySelector(`#booking-${tab}-tab`).click();
  if (!wasOpen) dialog.showModal();
  document.querySelector(`#booking-${tab}-tab`).focus({ preventScroll: true });
  if (!wasOpen) document.dispatchEvent(new CustomEvent("olga:booking-opened", { detail: { step: tab } }));
  if (tab === "date") document.dispatchEvent(new Event("olga:date-recheck"));
}
for (const trigger of document.querySelectorAll("[data-check-date]")) {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openBooking(trigger, "date");
  });
}
document.querySelector("#booking-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => opener?.focus({ preventScroll: true }));
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

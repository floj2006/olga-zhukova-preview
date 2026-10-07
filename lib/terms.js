export const termFields = [
  ["duration", "Длительность и состав программы"],
  ["travel", "Выезд и площадка"],
  ["payment", "Подтверждение даты и оплата"],
  ["cancellation", "Перенос и отмена"],
];
export const emptyTerms = () => ({
  published: false,
  ...Object.fromEntries(termFields.map(([key]) => [key, ""])),
});
export function termsComplete(terms) {
  return termFields.every(
    ([key]) => typeof terms?.[key] === "string" && terms[key].trim(),
  );
}

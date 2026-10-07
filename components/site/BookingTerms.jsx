"use client";
import { useBooking } from "../booking/BookingProvider";
import { termFields, termsComplete } from "../../lib/terms";
export default function BookingTerms() {
  const { catalog } = useBooking();
  const terms = catalog?.content?.terms;
  if (!terms?.published || !termsComplete(terms)) return null;
  return termFields.map(([key, label]) => (
    <details key={key} data-booking-term={key}>
      <summary>{label}</summary>
      <p>{terms[key]}</p>
    </details>
  ));
}

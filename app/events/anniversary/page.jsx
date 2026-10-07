import { pageMetadata } from "../../../lib/page-metadata";
import PublicShell from "../../../components/site/PublicShell";
import EventPage from "../../../components/site/EventPage";
import { eventPages } from "../../../lib/event-pages";

export const metadata = pageMetadata({
  title: "Ведущая на юбилей в Вологде",
  description:
    "Юбилей с Ольгой Жуковой в Вологде. Личные истории, поздравления близких и программа с вниманием к разным поколениям гостей.",
  alternates: { canonical: "/events/anniversary" },
});

export default function AnniversaryPage() {
  return (
    <PublicShell mainClassName="editorial-page event-tone-anniversary">
      <EventPage event={eventPages.anniversary} />
    </PublicShell>
  );
}

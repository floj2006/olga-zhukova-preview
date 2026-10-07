import { pageMetadata } from "../../../lib/page-metadata";
import PublicShell from "../../../components/site/PublicShell";
import EventPage from "../../../components/site/EventPage";
import { eventPages } from "../../../lib/event-pages";

export const metadata = pageMetadata({
  title: "Ведущая на выпускной в Вологде",
  description:
    "Выпускной с Ольгой Жуковой в Вологде. Торжественная часть, слова благодарности, музыка и общение в ритме выпускников.",
  alternates: { canonical: "/events/graduation" },
});

export default function GraduationPage() {
  return (
    <PublicShell mainClassName="editorial-page event-tone-graduation">
      <EventPage event={eventPages.graduation} />
    </PublicShell>
  );
}

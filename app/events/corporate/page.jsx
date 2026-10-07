import { pageMetadata } from "../../../lib/page-metadata";
import PublicShell from "../../../components/site/PublicShell";
import EventPage from "../../../components/site/EventPage";
import { eventPages } from "../../../lib/event-pages";

export const metadata = pageMetadata({
  title: "Ведущая на корпоратив в Вологде",
  description:
    "Ольга Жукова — ведущая корпоративов в Вологде. Программа под команду и повод: награждения, выступления, музыка и живое общение.",
  alternates: { canonical: "/events/corporate" },
});

export default function CorporatePage() {
  return (
    <PublicShell mainClassName="editorial-page event-tone-corporate">
      <EventPage event={eventPages.corporate} />
    </PublicShell>
  );
}

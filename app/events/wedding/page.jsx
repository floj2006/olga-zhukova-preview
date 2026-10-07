import { pageMetadata } from "../../../lib/page-metadata";
import PublicShell from "../../../components/site/PublicShell";
import EventPage from "../../../components/site/EventPage";
import { eventPages } from "../../../lib/event-pages";

export const metadata = pageMetadata({
  title: "Ведущая на свадьбу в Вологде",
  description:
    "Ольга Жукова — ведущая на свадьбу в Вологде, 15+ лет опыта. Индивидуальная программа, внимание к гостям и естественный ритм вечера.",
  alternates: { canonical: "/events/wedding" },
});

export default function WeddingPage() {
  return (
    <PublicShell mainClassName="editorial-page event-tone-wedding">
      <EventPage event={eventPages.wedding} />
    </PublicShell>
  );
}

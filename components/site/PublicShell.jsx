import BookingProvider from "../booking/BookingProvider";
import Telemetry from "../Telemetry";
import Header from "./Header";
import Footer from "./Footer";
import BookingDialog from "./BookingDialog";
import ContactDialog from "./ContactDialog";
import IconLibrary from "./IconLibrary";
import PageScripts from "../PageScripts";
import PublicMotion from "./PublicMotion";
import { person } from "../../lib/site";

export default function PublicShell({
  children,
  home = false,
  mainClassName = "",
}) {
  return (
    <BookingProvider>
      <div className="public-site">
        <a className="skip-link" href="#main">
          Перейти к содержимому
        </a>
        <IconLibrary />
        <Header home={home} />
        <BookingDialog />
        <main id="main" tabIndex={-1} className={mainClassName}>
          {children}
        </main>
        <Footer home={home} />
        <ContactDialog />
        <PageScripts />
        <Telemetry />
        <PublicMotion />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(person).replace(/</g, "\\u003c"),
          }}
        />
      </div>
    </BookingProvider>
  );
}

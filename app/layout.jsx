import { siteOrigin, isPreview } from "../lib/site";
import "./globals.css";
export const metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "Ольга Жукова — ведущая мероприятий в Вологде",
    template: "%s — Ольга Жукова",
  },
  description:
    "Ведущая свадеб, корпоративов, юбилеев и выпускных в Вологде. 15+ лет опыта. Выберите услуги, проверьте дату и обсудите программу.",
  robots: isPreview
    ? { index: false, follow: false }
    : { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Ольга Жукова",
    title: "Ольга Жукова — ведущая мероприятий",
    description: "Ваши люди. Ваш повод. Программа с вашим характером.",
    images: [
      { url: "/olga.jpg", width: 1024, height: 1536, alt: "Ольга Жукова" },
    ],
  },
  twitter: { card: "summary", images: ["/olga.jpg"] },
};
export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

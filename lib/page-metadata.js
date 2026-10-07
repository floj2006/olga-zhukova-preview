export function pageMetadata(metadata) {
  const title =
    typeof metadata.title === "object"
      ? metadata.title.absolute
      : metadata.title + " — Ольга Жукова";
  const image = {
    url: "/olga.jpg",
    width: 1024,
    height: 1536,
    alt: "Ольга Жукова, ведущая мероприятий",
  };
  return {
    ...metadata,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: "Ольга Жукова",
      title,
      description: metadata.description,
      url: metadata.alternates.canonical,
      images: [image],
    },
    twitter: {
      card: "summary",
      title,
      description: metadata.description,
      images: ["/olga.jpg"],
    },
  };
}

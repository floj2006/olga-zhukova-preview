"use client";
import { useEffect } from "react";
import { useBooking } from "../booking/BookingProvider";
// No fetch or second store: publish the same catalogue that pricing already owns.
export default function GalleryDataBridge() {
  const { catalog } = useBooking();
  useEffect(() => {
    const publish = () => {
      const gallery = document.getElementById("gallery");
      if (catalog && gallery?.setGallery)
        gallery.setGallery(
          Array.isArray(catalog.gallery) ? catalog.gallery : [],
        );
    };
    publish();
    document.addEventListener("olga:gallery-ready", publish);
    return () => document.removeEventListener("olga:gallery-ready", publish);
  }, [catalog]);
  return null;
}

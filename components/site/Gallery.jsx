import GalleryClient from "./GalleryClient";
import GalleryDataBridge from "./GalleryDataBridge";
export default function Gallery() {
  return (
    <>
      <GalleryDataBridge />
      <GalleryClient>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              <span className="short-line"></span>
              {"МОМЕНТЫ С МЕРОПРИЯТИЙ\n              "}
            </p>
            <h2 id="gallery-title">
              {"\n                Люди. Эмоции."}
              <br />
              <em>{"Ваши истории."}</em>
            </h2>
          </div>
          <p className="section-aside">
            {"\n              Общение, важные слова"}
            <br />
            {"и настроение вечера.\n            "}
          </p>
        </div>
      </GalleryClient>
    </>
  );
}

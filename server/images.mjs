import sharp from "sharp";
import { HttpError } from "./validation.mjs";
export async function normalizeImage(upload) {
  try {
    const image = sharp(upload.bytes, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1)
      throw new Error("invalid");
    const { data, info } = await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 3 * 1024 * 1024)
      throw new HttpError(413, "Фото после обработки больше 3 МБ.");
    return {
      bytes: data,
      mime: "image/webp",
      extension: "webp",
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "Не удалось обработать изображение. Выберите корректный JPEG, PNG или WebP.",
    );
  }
}

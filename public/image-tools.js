export async function prepareGalleryImage(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Выберите фотографию JPEG, PNG или WebP.");
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Исходный файл должен быть не больше 20 МБ.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Не удалось открыть фотографию. Попробуйте другой файл.");
  });
  try {
    if (bitmap.width * bitmap.height > 80_000_000)
      throw new Error(
        "Изображение слишком большое. Уменьшите его до 80 мегапикселей.",
      );
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)),
      height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не смог подготовить изображение.");
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.84),
    );
    if (!blob)
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.84),
      );
    if (!blob) throw new Error("Не удалось сжать фотографию.");
    if (scale === 1 && file.size < blob.size) blob = file;
    if (blob.size > 3 * 1024 * 1024)
      throw new Error(
        "После сжатия фото всё ещё больше 3 МБ. Выберите файл меньшего размера.",
      );
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Не удалось прочитать фото."));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, width, height };
  } finally {
    bitmap.close();
  }
}

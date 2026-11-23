const DATABASE_NAME = "daily-route-focus-assets";
const DATABASE_VERSION = 1;
const STORE_NAME = "wallpapers";
const MAX_EDGE = 1920;

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function compressWallpaper(file) {
  if (!(file instanceof Blob) || !file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("当前设备无法处理图片");
  }
  context.fillStyle = "#f4f1ea";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) {
    throw new Error("图片压缩失败");
  }
  return blob;
}

export async function saveWallpaperAsset(id, blob) {
  const database = await openDatabase();
  if (!database) {
    throw new Error("当前环境无法保存壁纸");
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

export async function readWallpaperAsset(id) {
  const database = await openDatabase();
  if (!database) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.addEventListener("success", () => {
      database.close();
      resolve(request.result instanceof Blob ? request.result : null);
    });
    request.addEventListener("error", () => {
      database.close();
      reject(request.error);
    });
  });
}

export async function deleteWallpaperAsset(id) {
  const database = await openDatabase();
  if (!database) {
    return;
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

export async function clearWallpaperAssets() {
  const database = await openDatabase();
  if (!database) {
    return;
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

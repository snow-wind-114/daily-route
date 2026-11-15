export const UPDATE_MANIFEST_URL =
  "https://snow-wind-114.github.io/daily-route/update.json";

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseUpdateManifest(payload) {
  const versionCode = Number(payload?.versionCode);
  const versionName =
    typeof payload?.versionName === "string" ? payload.versionName.trim() : "";
  const apkUrl = validUrl(payload?.apkUrl);
  const releaseUrl = validUrl(payload?.releaseUrl);
  const notes = Array.isArray(payload?.notes)
    ? payload.notes
        .filter((note) => typeof note === "string")
        .map((note) => note.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  if (
    !Number.isInteger(versionCode) ||
    versionCode < 1 ||
    !versionName ||
    !apkUrl ||
    !releaseUrl
  ) {
    throw new Error("更新清单格式不正确");
  }

  return { versionCode, versionName, apkUrl, releaseUrl, notes };
}

export async function checkForUpdate({
  currentVersionCode,
  fetchImpl = globalThis.fetch,
  manifestUrl = UPDATE_MANIFEST_URL,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("当前环境无法检查更新");
  }

  const response = await fetchImpl(`${manifestUrl}?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`更新服务器返回 ${response.status}`);
  }

  const manifest = parseUpdateManifest(await response.json());
  return {
    state:
      manifest.versionCode > Number(currentVersionCode)
        ? "available"
        : "latest",
    manifest,
  };
}

import { isNativeApp } from "./notifications.js";

function getPlugin(name) {
  if (!isNativeApp()) {
    return null;
  }
  return globalThis.DailyRouteNative?.[name] ?? null;
}

export async function shareNativeBackup(filename, contents) {
  const filesystem = getPlugin("Filesystem");
  const share = getPlugin("Share");
  if (!filesystem || !share) {
    return false;
  }

  await filesystem.writeFile({
    path: filename,
    data: contents,
    directory: "CACHE",
    encoding: "utf8",
  });
  const result = await filesystem.getUri({
    path: filename,
    directory: "CACHE",
  });

  await share.share({
    title: "每日安排活动备份",
    text: "Daily Route 活动备份",
    files: [result.uri],
    dialogTitle: "导出活动备份",
  });
  return true;
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [packageText, gradle, app, update] = await Promise.all([
  readFile(resolve(root, "package.json"), "utf8"),
  readFile(resolve(root, "android/app/build.gradle"), "utf8"),
  readFile(resolve(root, "app.js"), "utf8"),
  readFile(resolve(root, "update.json"), "utf8"),
]);

const packageVersion = JSON.parse(packageText).version;
const gradleName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const gradleCode = Number(
  gradle.match(/versionCode\s+(\d+)/)?.[1],
);
const appVersion = app.match(/const APP_VERSION = "([^"]+)"/)?.[1];
const appCode = Number(
  app.match(/const APP_VERSION_CODE = (\d+)/)?.[1],
);
const manifest = JSON.parse(update);

const versions = [
  packageVersion,
  gradleName,
  appVersion,
  manifest.versionName,
];
const codes = [gradleCode, appCode, Number(manifest.versionCode)];
if (new Set(versions).size !== 1 || new Set(codes).size !== 1) {
  throw new Error(
    `版本不一致：${JSON.stringify({ versions, codes })}`,
  );
}

console.log(`版本一致：v${packageVersion} (${gradleCode})`);

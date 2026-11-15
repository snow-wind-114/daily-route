import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = resolve(projectRoot, "www");

if (dirname(outputDirectory) !== projectRoot) {
  throw new Error("拒绝清理项目目录之外的目标");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "account.js",
  "app-state.js",
  "backup.js",
  "date-utils.js",
  "native-files.js",
  "notifications.js",
  "schedule.js",
  "sw.js",
  "manifest.webmanifest",
];

await Promise.all(
  files.map((filename) =>
    copyFile(join(projectRoot, filename), join(outputDirectory, filename)),
  ),
);
await cp(join(projectRoot, "icons"), join(outputDirectory, "icons"), {
  recursive: true,
});

await build({
  entryPoints: [join(projectRoot, "scripts", "native-entry.js")],
  bundle: true,
  format: "iife",
  outfile: join(outputDirectory, "native-bridge.js"),
  platform: "browser",
  target: ["chrome100"],
});

const outputIndexPath = join(outputDirectory, "index.html");
const outputIndex = await readFile(outputIndexPath, "utf8");
const nativeIndex = outputIndex.replace(
  '<script type="module" src="./app.js"></script>',
  '<script src="./native-bridge.js"></script>\n    <script type="module" src="./app.js"></script>',
);

if (nativeIndex === outputIndex) {
  throw new Error("无法向安卓页面注入 Capacitor 运行时");
}

await writeFile(outputIndexPath, nativeIndex);

import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(projectRoot, "dist");
const assetsRoot = path.join(distRoot, "assets");
const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");

const budgetsKb = {
  initialJs: 220,
  standardAsyncJs: 130,
  optionalHeicDecoder: 360,
  optionalHlsPlayer: 190,
  css: 35,
};

const assetFiles = readdirSync(assetsRoot);
const initialJsFiles = new Set(
  [...indexHtml.matchAll(/(?:src|href)="\/assets\/([^"?]+\.js)"/g)].map(
    (match) => match[1],
  ),
);

function gzipSizeKb(fileName) {
  const content = readFileSync(path.join(assetsRoot, fileName));
  return gzipSync(content).byteLength / 1024;
}

function sumGzipKb(fileNames) {
  return [...fileNames].reduce((total, fileName) => total + gzipSizeKb(fileName), 0);
}

function maxGzipKb(fileNames) {
  return fileNames.reduce(
    (largest, fileName) => Math.max(largest, gzipSizeKb(fileName)),
    0,
  );
}

const javascriptFiles = assetFiles.filter((fileName) => fileName.endsWith(".js"));
const optionalHeicFiles = javascriptFiles.filter((fileName) =>
  fileName.startsWith("heic2any-"),
);
const optionalHlsFiles = javascriptFiles.filter((fileName) =>
  fileName.startsWith("hls-"),
);
const standardAsyncFiles = javascriptFiles.filter(
  (fileName) =>
    !initialJsFiles.has(fileName) &&
    !optionalHeicFiles.includes(fileName) &&
    !optionalHlsFiles.includes(fileName),
);
const cssFiles = assetFiles.filter((fileName) => fileName.endsWith(".css"));

const measurementsKb = {
  initialJs: sumGzipKb(initialJsFiles),
  standardAsyncJs: maxGzipKb(standardAsyncFiles),
  optionalHeicDecoder: maxGzipKb(optionalHeicFiles),
  optionalHlsPlayer: maxGzipKb(optionalHlsFiles),
  css: sumGzipKb(cssFiles),
};

let failed = false;
for (const [metric, measuredKb] of Object.entries(measurementsKb)) {
  const budgetKb = budgetsKb[metric];
  const status = measuredKb <= budgetKb ? "PASS" : "FAIL";
  console.log(
    `${status} ${metric}: ${measuredKb.toFixed(2)} KiB gzip / ${budgetKb} KiB budget`,
  );
  failed ||= measuredKb > budgetKb;
}

if (failed) {
  process.exitCode = 1;
}

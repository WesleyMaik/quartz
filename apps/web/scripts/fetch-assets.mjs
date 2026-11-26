// Downloads runtime assets that Quartz serves from its own origin (no third-party requests at runtime).
// Usage: pnpm --filter @qrtz/web fetch:assets
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "engines");

const TYPST_FONTS_SOURCE =
  "https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/files/fonts/";
const TYPST_FONTS = [
  "DejaVuSansMono-Bold.ttf",
  "DejaVuSansMono-BoldOblique.ttf",
  "DejaVuSansMono-Oblique.ttf",
  "DejaVuSansMono.ttf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-BoldItalic.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Semibold.otf",
  "LibertinusSerif-SemiboldItalic.otf",
  "NewCM10-Bold.otf",
  "NewCM10-BoldItalic.otf",
  "NewCM10-Italic.otf",
  "NewCM10-Regular.otf",
  "NewCMMath-Bold.otf",
  "NewCMMath-Book.otf",
  "NewCMMath-Regular.otf",
];

/** Siglum runtime (TeX Live 2026). Keep in sync with the `@siglum/engine` version in compiler-latex. */
const SIGLUM = {
  version: "0.2.2",
  releaseId: "tl2026-0cc2592f50103429",
  url: "https://github.com/SiglumProject/siglum/releases/download/v0.2.2/siglum-runtime-v0.2.2.tar.gz",
  sha256: "7d09309610344e7b89570aa22192505b4064bc3bc629e5a9c3a7952d919224b6",
};

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function download(url, target) {
  if (await exists(target)) return "cached";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  return "downloaded";
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function fetchTypstFonts() {
  const target = join(root, "typst", "fonts");
  for (const name of TYPST_FONTS) {
    const status = await download(`${TYPST_FONTS_SOURCE}${name}`, join(target, name));
    console.log(`typst font ${name}: ${status}`);
  }
}

async function fetchSiglumRuntime() {
  const target = join(root, "latex", SIGLUM.releaseId);
  if (await exists(join(target, "wasm", "busytex.wasm"))) {
    console.log(`siglum runtime ${SIGLUM.releaseId}: cached`);
    return;
  }
  const archive = join(tmpdir(), `siglum-runtime-v${SIGLUM.version}.tar.gz`);
  console.log(`siglum runtime: ${await download(SIGLUM.url, archive)} (${SIGLUM.url})`);
  const actual = await sha256File(archive);
  if (actual !== SIGLUM.sha256) {
    await rm(archive);
    throw new Error(`Siglum runtime checksum mismatch: expected ${SIGLUM.sha256}, got ${actual}`);
  }
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  // `._*` entries are macOS metadata files included in the upstream archive.
  await run("tar", ["-xzf", archive, "-C", target, "--exclude", "._*"]);
  console.log(`siglum runtime ${SIGLUM.releaseId}: extracted to ${target}`);
}

await fetchTypstFonts();
await fetchSiglumRuntime();

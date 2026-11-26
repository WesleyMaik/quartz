// Downloads runtime assets that Quartz serves from its own origin (no third-party requests at runtime).
// Usage: pnpm --filter @qrtz/web fetch:assets
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const typstFonts = join(root, "typst", "fonts");
for (const name of TYPST_FONTS) {
  const status = await download(`${TYPST_FONTS_SOURCE}${name}`, join(typstFonts, name));
  console.log(`typst font ${name}: ${status}`);
}

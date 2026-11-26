// Downloads runtime assets that Quartz serves from its own origin (no third-party requests at runtime).
// Usage: pnpm --filter @qrtz/web fetch:assets
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

/**
 * LaTeX packages the Siglum runtime does not ship, served from the Quartz origin instead of a CTAN
 * proxy. Archives come from the frozen TeX Live 2025 `tlnet-final` (permanent URLs, so checksums stay
 * valid; the rolling mirror changes and dated snapshots block automated downloads). They keep their
 * own licenses (mostly LPPL), recorded per package in the generated index.
 * Keep `LATEX_EXTRAS_ID` in sync with `compiler-latex`.
 */
const LATEX_EXTRAS = {
  id: "extra-tl2025-final",
  snapshot: "https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2025/tlnet-final/archive/",
  packages: {
    booktabs: "ae7dd63ef6f428959140dc5119e9a420e826e8d9acbc7a93c5240e332568e2b0",
    caption: "c10e09b6a2a9ad9b33f0803967280faa625ac7eaf3837b2dc9105a7b50934484",
    csquotes: "d25aa481af53f68c2933a427b72c0ce04b78c9be800c2668c90167b9ebd0ad7b",
    enumitem: "887fa546b820d8345d801404978a57876afe9ed22debcca736bb24d4f8338618",
    everysel: "35c04613080faab79bf9776d60f0e996ff7de6e70c9ec588d6df8c0013534297",
    float: "5b3077cf3d7b4799afcde6993c3e5d813ebee6b29b45c0e19fa37817d19139b4",
    fontspec: "b5efd8094c6704cd6ef08e5a86e682b84e37e08bb7695439a6c2649a82033656",
    lipsum: "288fc3c0a716249f54d833a5bae0cf461fe06d53ff772d41d0244b9b1eb0b809",
    listings: "8b65f9d11165661b897c241107ba5b425e34cf7ac9655c7060efa4db76205bee",
    mathtools: "b5e9452fb20c2ab195d8b5d1b4f0164d6256ad7b8773f7576ec778395501e94a",
    microtype: "57b380b27006b34c5cc8fe20a0ceb0e3da848f397c5607b40f2c270055197ebe",
    multirow: "c1afe8c9d424ae96d31f73b80a8a9c229a76dae90e2a159d944ddd48008c6662",
    paracol: "ba94af285ff647c179415e1230ece9cff832b6b28cdc6c3addecc4db4ca10070",
    parskip: "e9006bd35337f4d0eefa3bc2f8f42ef1b0240364066dfc24b5ae8f10ef788e80",
    ragged2e: "d19a4dbc657f092eb001c7aacba25682a7d76d4f0e2d773c377be5121fe06afb",
    setspace: "53bffec9151d0c223fdfec937f0b03b0432388a1bc4a3a704fa1e60ccd0e3eb3",
    titlesec: "5af4e3f6c2f677a65de1b81c9c3707d0117de56d4d596fbcb4734f6ceb3908ac",
    tocloft: "1dc3a1c765503751b55769d8d140e76b675bfcf655cc6a803b7441bddb638512",
    wrapfig: "4fa783e861cbed8d88ea65b45cb297e8f810a11f30c789ca5cff96a161bd1aa2",
    xcolor: "9db9fc23f7f640b8bc7a8844e60fd4c03110dd24c4393a5808c89647e5904a96",
    xstring: "02f71cefc2bc50481f6aac7ef2faf60eeb6656cc19f9dff000e8f559b5635e85",
    xurl: "6f5ab54b384710ed7a9c1f43cb6f4fbb8e7f8564a545ec16c565375ceb4dd95e",
  },
};

async function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

/** Extras entry preloaded on every LaTeX compile; keep in sync with `compiler-latex`. */
const CM_SUPER_MAPS = "cm-super-maps";

/**
 * The runtime ships cm-super as a lazily loaded bundle, so its font maps never reach `pdftex.map`
 * and pdfTeX falls back to bitmap fonts it cannot build (for example `tcrm1000`, the TS1 font of
 * `\textbullet` in every itemize). Copies only the maps and encodings (~180 KB) out of the
 * uncompressed bundle; the Type 1 fonts themselves still load lazily from the runtime.
 */
async function extractCmSuperMaps(target) {
  const runtime = join(root, "latex", SIGLUM.releaseId);
  const manifest = JSON.parse(await readFile(join(runtime, "file-manifest.json"), "utf8"));
  const raw = await readFile(join(runtime, "cm-super.raw"));
  const prefix = "/texlive/texmf-dist/";
  const files = [];
  for (const [path, entry] of Object.entries(manifest)) {
    if (entry.bundle !== "cm-super" || !/\/dvips\/cm-super\/[^/]+\.(?:map|enc)$/.test(path)) {
      continue;
    }
    // A separate folder: the lazy bundle already registers placeholders at the original paths, and
    // Siglum does not overwrite those, so files mounted there would be dropped.
    const file = path.slice(prefix.length).replace("/cm-super/", "/cm-super-quartz/");
    await mkdir(dirname(join(target, "files", file)), { recursive: true });
    await writeFile(join(target, "files", file), raw.subarray(entry.start, entry.end));
    files.push(file);
  }
  if (files.length === 0) throw new Error("cm-super maps not found in the Siglum runtime.");
  console.log(`latex extra ${CM_SUPER_MAPS}: ${files.length} files (gpl)`);
  return { license: "gpl", files };
}

async function fetchLatexExtras() {
  const target = join(root, "latex", LATEX_EXTRAS.id);
  if (await exists(join(target, "index.json"))) {
    console.log(`latex extras ${LATEX_EXTRAS.id}: cached`);
    return;
  }
  const work = join(tmpdir(), `quartz-${LATEX_EXTRAS.id}`);
  await rm(work, { recursive: true, force: true });
  await rm(target, { recursive: true, force: true });
  const index = { id: LATEX_EXTRAS.id, packages: {} };
  for (const [name, sha256] of Object.entries(LATEX_EXTRAS.packages)) {
    const archive = join(work, `${name}.tar.xz`);
    await download(`${LATEX_EXTRAS.snapshot}${name}.tar.xz`, archive);
    const actual = await sha256File(archive);
    if (actual !== sha256) {
      throw new Error(`LaTeX package ${name} checksum mismatch: expected ${sha256}, got ${actual}`);
    }
    const unpacked = join(work, name);
    await mkdir(unpacked, { recursive: true });
    // Relative paths: GNU tar on Windows reads "C:" in an absolute path as a remote host.
    await run("tar", ["-xJf", `${name}.tar.xz`, "-C", name], { cwd: work });
    const tlpobj = await readFile(join(unpacked, "tlpkg", "tlpobj", `${name}.tlpobj`), "utf8");
    const license = /^catalogue-license (.+)$/m.exec(tlpobj)?.[1] ?? "unknown";
    // Runtime files only: TeX Live metadata, documentation and sources stay out of the bundle.
    const files = (await listFiles(unpacked)).filter(
      (file) =>
        !file.startsWith("tlpkg/") && !file.startsWith("doc/") && !file.startsWith("source/"),
    );
    for (const file of files) {
      await mkdir(dirname(join(target, "files", file)), { recursive: true });
      await copyFile(join(unpacked, file), join(target, "files", file));
    }
    index.packages[name] = { license, files };
    console.log(`latex extra ${name}: ${files.length} files (${license})`);
  }
  index.packages[CM_SUPER_MAPS] = await extractCmSuperMaps(target);
  await writeFile(join(target, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  await rm(work, { recursive: true, force: true });
  console.log(`latex extras ${LATEX_EXTRAS.id}: written to ${target}`);
}

await fetchTypstFonts();
await fetchSiglumRuntime();
await fetchLatexExtras();

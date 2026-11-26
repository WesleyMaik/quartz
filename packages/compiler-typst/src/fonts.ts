/**
 * Fonts served from the Quartz origin under `<assetBaseUrl>/fonts/`. They are the Typst default
 * text fonts (OFL / GUST / Bitstream Vera licenses), fetched by `pnpm fetch:assets`.
 * Loading them locally keeps compilation free of third-party network requests.
 */
export const TYPST_TEXT_FONTS = [
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
] as const;

/** Upstream source pinned to the version typst.ts 0.7 expects. */
export const TYPST_FONTS_SOURCE =
  "https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/files/fonts/";

const MAX_STEM_LENGTH = 100;
const FALLBACK_STEM = "project";

// biome-ignore lint/suspicious/noControlCharactersInRegex: the rule exists to strip control characters.
const FORBIDDEN_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Download name for a project archive that every common file system accepts. */
export function projectArchiveName(title: string): string {
  const cleaned = title.normalize("NFC").replace(FORBIDDEN_CHARACTERS, " ").replace(/\s+/g, " ");
  // Truncate by code point so a surrogate pair is never split.
  const stem = Array.from(cleaned.trim())
    .slice(0, MAX_STEM_LENGTH)
    .join("")
    .replace(/^[. ]+|[. ]+$/g, "");
  const safe = stem === "" || RESERVED_NAMES.test(stem) ? FALLBACK_STEM : stem;
  return `${safe}.zip`;
}

/** Project title suggested by an imported archive's file name. */
export function projectTitleFromArchive(fileName: string): string {
  const title = fileName.replace(/\.zip$/i, "").trim();
  return title === "" ? "Imported project" : title;
}

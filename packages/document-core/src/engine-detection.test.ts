import { describe, expect, it } from "vitest";
import { detectEngine, findEntryCandidates } from "./engine-detection";
import { PROJECT_TEMPLATES } from "./templates";

describe("detectEngine", () => {
  it("detects LaTeX entry from content, not file name", () => {
    const result = detectEngine([
      { path: "chapters/one.tex", text: "\\section{One}" },
      { path: "paper.tex", text: "\\documentclass{article}\n\\begin{document}x\\end{document}" },
    ]);
    expect(result).toEqual({
      engine: "latex",
      entry: "paper.tex",
      compiler: { engine: "latex", variant: "pdflatex" },
    });
  });

  it("selects xelatex when fontspec is used", () => {
    const result = detectEngine([
      {
        path: "main.tex",
        text: "\\documentclass{article}\n\\usepackage{fontspec}\n\\begin{document}\\end{document}",
      },
    ]);
    expect(result?.compiler).toEqual({ engine: "latex", variant: "xelatex" });
  });

  it("detects Typst", () => {
    const result = detectEngine([{ path: "main.typ", text: '#set page(paper: "a4")\n= Hi' }]);
    expect(result?.engine).toBe("typst");
    expect(result?.entry).toBe("main.typ");
  });

  it("returns undefined without a document root", () => {
    expect(detectEngine([{ path: "refs.bib", text: "@article{a}" }])).toBeUndefined();
  });

  it.each(PROJECT_TEMPLATES.map((template) => [template.id, template] as const))(
    "template %s is detected as its own engine and entry",
    (_id, template) => {
      const files = Object.entries(template.files).map(([path, text]) => ({ path, text }));
      const result = detectEngine(files);
      expect(result?.engine).toBe(template.engine);
      expect(result?.entry).toBe(template.entry);
    },
  );
});

describe("findEntryCandidates", () => {
  const latex = "\\documentclass{article}\n\\begin{document}\\end{document}";
  const entries = (files: Record<string, string>) => {
    const found = findEntryCandidates(
      Object.entries(files).map(([path, text]) => ({ path, text })),
    );
    return { all: found.candidates.map((c) => c.entry), suggested: found.suggested?.entry };
  };

  it("suggests the only candidate", () => {
    expect(entries({ "paper.tex": latex, "intro.tex": "Text" })).toEqual({
      all: ["paper.tex"],
      suggested: "paper.tex",
    });
  });

  it("prefers the main file closest to the root", () => {
    const found = entries({ "extra/main.tex": latex, "main.tex": latex, "other.tex": latex });
    expect(found.suggested).toBe("main.tex");
    expect(found.all).toHaveLength(3);
  });

  it.each([
    [{ "a.tex": latex, "b.tex": latex }],
    [{ "main.tex": latex, "main.typ": "#set page()" }],
  ])("asks when candidates are equally likely", (files) => {
    expect(entries(files).suggested).toBeUndefined();
    expect(entries(files).all).toHaveLength(2);
  });

  it("ignores Typst includes below the root", () => {
    expect(
      entries({ "paper.typ": "#set page()", "sections/a.typ": '#import "x.typ"' }).all,
    ).toEqual(["paper.typ"]);
  });

  it("offers every document when none looks like a root", () => {
    expect(entries({ "a.tex": "A", "b.tex": "B" })).toEqual({
      all: ["a.tex", "b.tex"],
      suggested: undefined,
    });
  });

  it("finds nothing without LaTeX or Typst files", () => {
    expect(entries({ "readme.md": "# Hi" })).toEqual({ all: [], suggested: undefined });
  });
});

import { describe, expect, it } from "vitest";
import { detectEngine } from "./engine-detection";
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

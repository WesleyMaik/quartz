import { describe, expect, it } from "vitest";
import { parseLatexLog } from "./log-parser";

const files = new Set(["main.tex", "sections/introduction.tex"]);

describe("parseLatexLog", () => {
  it("attributes an undefined control sequence to the current file and line", () => {
    const log = [
      "(./main.tex",
      "(./sections/introduction.tex",
      "! Undefined control sequence.",
      "l.3 \\foo",
      "         bar",
    ].join("\n");
    expect(parseLatexLog(log, "main.tex", files)).toEqual([
      {
        severity: "error",
        message: "Undefined control sequence",
        file: "sections/introduction.tex",
        line: 3,
        source: "latex",
      },
    ]);
  });

  it("parses file:line:error style output", () => {
    const log = "./main.tex:12: LaTeX Error: Environment foo undefined.";
    expect(parseLatexLog(log, "main.tex", files)[0]).toMatchObject({
      severity: "error",
      file: "main.tex",
      line: 12,
    });
  });

  it("joins wrapped warnings and reads the input line", () => {
    const log = [
      "(./main.tex",
      "LaTeX Warning: Reference `eq:x' on page 1 undefined on input line",
      "27.",
      "",
    ].join("\n");
    expect(parseLatexLog(log, "main.tex", files)).toEqual([
      {
        severity: "warning",
        message: "Reference `eq:x' on page 1 undefined on input line 27.",
        file: "main.tex",
        line: 27,
        source: "latex",
      },
    ]);
  });

  it("reports overfull boxes as info and deduplicates repeats", () => {
    const line = "Overfull \\hbox (12.0pt too wide) in paragraph at lines 5--7";
    const result = parseLatexLog(`${line}\n${line}`, "main.tex", files);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ severity: "info", line: 5 });
  });

  it("ignores files that are not part of the project", () => {
    const log = "(/texlive/article.cls\n! Missing $ inserted.\nl.9 x^2";
    expect(parseLatexLog(log, "main.tex", files)[0]).toMatchObject({ file: "main.tex", line: 9 });
  });
});

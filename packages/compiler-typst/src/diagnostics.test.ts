import { describe, expect, it } from "vitest";
import { normalizeTypstDiagnostic } from "./diagnostics";

describe("normalizeTypstDiagnostic", () => {
  it("converts 0-based ranges to 1-based line and column", () => {
    expect(
      normalizeTypstDiagnostic({
        package: "",
        path: "/sections/intro.typ",
        severity: "Error",
        range: "2:9-3:15",
        message: "unknown variable: foo",
      }),
    ).toEqual({
      severity: "error",
      message: "unknown variable: foo",
      source: "typst",
      file: "sections/intro.typ",
      line: 3,
      column: 10,
    });
  });

  it("maps warnings and keeps diagnostics without range", () => {
    const result = normalizeTypstDiagnostic({
      package: "",
      path: "/main.typ",
      severity: "Warning",
      range: "",
      message: "unused",
    });
    expect(result).toEqual({
      severity: "warning",
      message: "unused",
      source: "typst",
      file: "main.typ",
    });
  });
});

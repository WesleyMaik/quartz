import { type QuartzError, quartzError } from "@qrtz/document-core";
import { englishMessages, loadMessages } from "@qrtz/messages";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { describeError } from "./describe-error";

const english = createIntl({ locale: "en", messages: englishMessages });

describe("describeError", () => {
  it("uses the code when the error has no narrower key", () => {
    const error = quartzError("storage.unavailable", "log text");
    expect(describeError(english, error)).toBe("Browser storage is unavailable in this session.");
  });

  it("fills the values of a narrower key", () => {
    const error: QuartzError = quartzError("path.exists", "log text", {
      key: "path.target_exists",
      values: { path: "main.tex" },
    });
    expect(describeError(english, error)).toBe("main.tex already exists.");
  });

  it("translates the path rule inside an unsafe archive path", async () => {
    const intl = createIntl({ locale: "pt-BR", messages: await loadMessages("pt-BR") });
    const error = quartzError("archive.invalid_path", "log text", {
      key: "archive.unsafe_path",
      values: { path: "../x", pathReason: "dot_segment" },
    });
    expect(describeError(intl, error)).toBe(
      'Caminho inseguro "../x": "." e ".." não são permitidos.',
    );
  });
});

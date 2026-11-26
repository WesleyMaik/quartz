import { describe, expect, it } from "vitest";
import { ExtraPackageSource, parseExtraIndex } from "./extra-packages";

describe("parseExtraIndex", () => {
  it("keeps valid packages and runtime files", () => {
    const index = parseExtraIndex({
      packages: { titlesec: { license: "mit", files: ["tex/latex/titlesec/titlesec.sty"] } },
    });
    expect(index?.get("titlesec")).toEqual(["tex/latex/titlesec/titlesec.sty"]);
  });

  it("drops traversal, absolute and unknown-tree paths", () => {
    const index = parseExtraIndex({
      packages: {
        evil: {
          files: [
            "tex/../../etc/passwd",
            "/tex/latex/x.sty",
            "doc/readme.txt",
            "tex/latex/./x.sty",
            "tex",
            "tex/latex/ok.sty",
          ],
        },
      },
    });
    expect(index?.get("evil")).toEqual(["tex/latex/ok.sty"]);
  });

  it("skips packages with invalid names or no safe files", () => {
    const index = parseExtraIndex({
      packages: { "../x": { files: ["tex/a.sty"] }, empty: { files: ["doc/a"] }, bad: {} },
    });
    expect(index?.size).toBe(0);
  });

  it("rejects shapes that are not an index", () => {
    expect(parseExtraIndex(null)).toBeUndefined();
    expect(parseExtraIndex({ packages: "x" })).toBeUndefined();
  });
});

const response = (body: BodyInit, ok = true) => new Response(body, { status: ok ? 200 : 404 });

describe("ExtraPackageSource", () => {
  const index = {
    packages: { xcolor: { files: ["tex/latex/xcolor/xcolor.sty", "dvips/xcolor/xcolor.pro"] } },
  };

  it("loads package files under the engine texmf root", async () => {
    const requests: string[] = [];
    const source = new ExtraPackageSource("https://q.test/extras/", async (url) => {
      requests.push(url);
      return url.endsWith("index.json") ? response(JSON.stringify(index)) : response("data");
    });
    const files = await source.load("xcolor");
    expect([...(files?.keys() ?? [])]).toEqual([
      "/texlive/texmf-dist/tex/latex/xcolor/xcolor.sty",
      "/texlive/texmf-dist/dvips/xcolor/xcolor.pro",
    ]);
    expect(
      new TextDecoder().decode(files?.get("/texlive/texmf-dist/tex/latex/xcolor/xcolor.sty")),
    ).toBe("data");
    expect(requests).toContain("https://q.test/extras/files/tex/latex/xcolor/xcolor.sty");
  });

  it("returns null for packages Quartz does not ship", async () => {
    const source = new ExtraPackageSource("https://q.test/extras/", async () =>
      response(JSON.stringify(index)),
    );
    expect(await source.load("tikz")).toBeNull();
    expect(await source.has("xcolor")).toBe(true);
  });

  it("reports nothing when the index is unavailable", async () => {
    const source = new ExtraPackageSource("https://q.test/extras/", async () =>
      response("", false),
    );
    expect(await source.load("xcolor")).toBeNull();
  });

  it("fetches a package once while it is cached", async () => {
    let fileRequests = 0;
    const source = new ExtraPackageSource("https://q.test/extras/", async (url) => {
      if (url.endsWith("index.json")) return response(JSON.stringify(index));
      fileRequests += 1;
      return response("data");
    });
    await Promise.all([source.load("xcolor"), source.load("xcolor")]);
    expect(fileRequests).toBe(2);
  });
});

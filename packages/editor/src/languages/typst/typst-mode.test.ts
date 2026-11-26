import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { type TypstState, typstMode } from "./typst-mode";

function tokenize(line: string, state: TypstState = typstMode.startState?.(2) as TypstState) {
  const stream = new StringStream(line, 2, 2);
  const tokens: [string, string | null][] = [];
  while (!stream.eol()) {
    const style = typstMode.token(stream, state);
    tokens.push([stream.current(), style]);
    stream.start = stream.pos;
  }
  return { tokens, state };
}

describe("typstMode", () => {
  it("highlights headings", () => {
    expect(tokenize("= Introduction").tokens).toEqual([["= Introduction", "heading"]]);
  });

  it("treats a #set statement as code until the end of the line", () => {
    const { tokens, state } = tokenize('#set page(paper: "a4")');
    expect(tokens[0]).toEqual(["#set", "keyword"]);
    expect(tokens).toContainEqual(["page", "variableName.function"]);
    expect(tokens).toContainEqual(['"a4"', "string"]);
    const next = tokenize("= Title", state);
    expect(next.tokens[0]).toEqual(["= Title", "heading"]);
  });

  it("ends inline function code when its brackets close", () => {
    const { state } = tokenize("#strong[bold] text");
    expect(state.inCode).toBe(false);
  });

  it("switches into and out of math", () => {
    const { tokens, state } = tokenize("$ x^2 $ done");
    expect(tokens[0]).toEqual(["$", "keyword"]);
    expect(state.mode).toBe("markup");
  });

  it("recognizes labels and references", () => {
    const { tokens } = tokenize("see @euler <euler>");
    expect(tokens).toContainEqual(["@euler", "link"]);
    expect(tokens).toContainEqual(["<euler>", "labelName"]);
  });

  it("keeps block comments across lines", () => {
    const first = tokenize("/* start");
    expect(first.state.inBlockComment).toBe(true);
    const second = tokenize("end */ text", first.state);
    expect(second.tokens[0]).toEqual(["end */", "comment"]);
  });
});

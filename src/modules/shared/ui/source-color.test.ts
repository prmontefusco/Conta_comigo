import { describe, expect, it } from "vitest";
import { sourceColor } from "../domain/source-color";

describe("source color", () => {
  it("keeps a chosen hex color", () => {
    expect(sourceColor("#db1717")).toBe("#db1717");
  });
  it("ignores unsupported legacy or malformed values", () => {
    expect(sourceColor("red; background:url(https://example.com)")).toBe("#64748b");
    expect(sourceColor()).toBe("#64748b");
  });
});

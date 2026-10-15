import { describe, it, expect } from "vitest";
import { safePushUrl } from "../lib/push";

describe("safePushUrl", () => {
  it("keeps in-app paths", () => {
    expect(safePushUrl("/?tab=accounts")).toBe("/?tab=accounts");
  });
  it("drops anything that could leave the app", () => {
    for (const url of ["https://evil.example", "//evil.example", "/\\\\evil.example", "javascript:alert(1)", "", 42, undefined]) {
      expect(safePushUrl(url)).toBe("/");
    }
  });
});

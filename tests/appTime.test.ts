import { describe, it, expect, beforeAll } from "vitest";

let appToday: typeof import("../lib/appTime").appToday;
let appTodayDate: typeof import("../lib/appTime").appTodayDate;

beforeAll(async () => {
  // APP_TIMEZONE is read when the module loads, so set it before importing
  process.env.APP_TIMEZONE = "America/New_York";
  ({ appToday, appTodayDate } = await import("../lib/appTime"));
});

describe("appToday", () => {
  it("uses the owner's time zone, not UTC", () => {
    // 02:00 UTC on Oct 7 is 10pm on Oct 6 in New York (EDT)
    const t = appToday(new Date("2026-10-07T02:00:00Z"));
    expect(t.iso).toBe("2026-10-06");
    expect(t.monthKey).toBe("2026-10");
    expect(appTodayDate(new Date("2026-10-07T02:00:00Z")).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
  it("rolls the month correctly at a month boundary", () => {
    expect(appToday(new Date("2026-11-01T03:00:00Z")).monthKey).toBe("2026-10");
  });
});

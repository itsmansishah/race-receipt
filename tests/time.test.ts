import { describe, expect, it } from "vitest";
import {
  compactDate,
  formatDistance,
  formatPace,
  formatReceiptDate,
  formatShortDate,
  formatTime,
  MARATHON_KM,
  normalizeTimeInput,
  parseTime,
} from "@/lib/time";

describe("parseTime", () => {
  it("parses HH:MM:SS and H:MM:SS", () => {
    expect(parseTime("03:42:18")).toBe(3 * 3600 + 42 * 60 + 18);
    expect(parseTime("3:42:18")).toBe(3 * 3600 + 42 * 60 + 18);
    expect(parseTime(" 2:05:00 ")).toBe(7500);
  });

  it("rejects blank or malformed input", () => {
    for (const bad of ["", "   ", "3", "3:42", "3:4:5", "3:60:00", "3:00:60", "abc", "1:2:3:4", "3:42:1"]) {
      expect(parseTime(bad), bad).toBeNull();
    }
  });
});

describe("formatTime", () => {
  it("zero-pads to HH:MM:SS", () => {
    expect(formatTime(0)).toBe("00:00:00");
    expect(formatTime(13338)).toBe("03:42:18");
    expect(formatTime(36000 + 59)).toBe("10:00:59");
  });
  it("round-trips with parseTime", () => {
    expect(formatTime(parseTime("4:01:09")!)).toBe("04:01:09");
  });
});

describe("normalizeTimeInput", () => {
  it("tidies typed times", () => {
    expect(normalizeTimeInput("3:42:18")).toBe("03:42:18");
    expect(normalizeTimeInput("34218")).toBe("03:42:18");
    expect(normalizeTimeInput("034218")).toBe("03:42:18");
    expect(normalizeTimeInput("2530")).toBe("00:25:30");
    expect(normalizeTimeInput("25:30")).toBe("00:25:30");
    expect(normalizeTimeInput("")).toBe("");
  });
  it("returns null for times it can't read", () => {
    expect(normalizeTimeInput("39999")).toBeNull();
    expect(normalizeTimeInput("soon")).toBeNull();
  });
});

describe("pace and distance", () => {
  it("formats marathon pace per mile and per km", () => {
    expect(formatPace(3.5 * 3600, MARATHON_KM, "mi")).toBe("8:01");
    expect(formatPace(3.5 * 3600, MARATHON_KM, "km")).toBe("4:59");
  });
  it("formats distance in either unit", () => {
    expect(formatDistance(MARATHON_KM, "mi")).toBe("26.2 MI");
    expect(formatDistance(MARATHON_KM, "km")).toBe("42.2 KM");
  });
});

describe("dates", () => {
  it("formats ISO dates without timezone drift", () => {
    expect(formatReceiptDate("2026-10-11")).toBe("OCT 11 2026");
    expect(formatShortDate("2026-01-05")).toBe("01.05.26");
    expect(compactDate("2026-10-11")).toBe("20261011");
    expect(formatReceiptDate("not a date")).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { clampPerPage, parsePageNum, pageWindow, totalPages, pageList, DEFAULT_PER_PAGE } from "./pagination";

describe("pagination", () => {
  it("clampPerPage keeps allowed values, else default", () => {
    expect(clampPerPage(25)).toBe(25);
    expect(clampPerPage(100)).toBe(100);
    expect(clampPerPage(33)).toBe(DEFAULT_PER_PAGE);
    expect(clampPerPage(undefined)).toBe(DEFAULT_PER_PAGE);
  });
  it("parsePageNum floors to 1", () => {
    expect(parsePageNum("3")).toBe(3);
    expect(parsePageNum("0")).toBe(1);
    expect(parsePageNum("-2")).toBe(1);
    expect(parsePageNum("abc")).toBe(1);
    expect(parsePageNum(undefined)).toBe(1);
  });
  it("pageWindow computes skip/take; ?perPage wins over cookie", () => {
    expect(pageWindow({ page: "2", perPage: "25" })).toEqual({ page: 2, perPage: 25, skip: 25, take: 25 });
    expect(pageWindow({ page: "1", cookiePerPage: 100 })).toEqual({ page: 1, perPage: 100, skip: 0, take: 100 });
    expect(pageWindow({ perPage: "50", cookiePerPage: 100 }).perPage).toBe(50);
    expect(pageWindow({}).perPage).toBe(DEFAULT_PER_PAGE);
  });
  it("totalPages rounds up, min 1", () => {
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(50, 50)).toBe(1);
    expect(totalPages(51, 50)).toBe(2);
    expect(totalPages(200, 50)).toBe(4);
  });
  it("pageList inserts ellipses around the current page", () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 5)).toEqual([1, 2, "…", 5]);
    expect(pageList(5, 20)).toEqual([1, "…", 4, 5, 6, "…", 20]);
    expect(pageList(20, 20)).toEqual([1, "…", 19, 20]);
  });
});

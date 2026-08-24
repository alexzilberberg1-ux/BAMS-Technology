import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/server/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the max within the window, then blocks", () => {
    let clock = 0;
    const limiter = new RateLimiter(3, 60_000, () => clock);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    // Independent key unaffected
    expect(limiter.allow("b")).toBe(true);
  });

  it("frees capacity once the window slides", () => {
    let clock = 0;
    const limiter = new RateLimiter(2, 60_000, () => clock);
    limiter.allow("a");
    limiter.allow("a");
    expect(limiter.allow("a")).toBe(false);
    clock += 61_000;
    expect(limiter.allow("a")).toBe(true);
  });
});

import { TextEncoder } from "util";
import { webcrypto } from "crypto";
import {
  checkCode,
  engageLock,
  forgetEverything,
  hasCode,
  lockRedirect,
  lockedUrl,
  lockoutMs,
  releaseLock,
  saveCode,
} from "./presentLock";

beforeAll(() => {
  Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });
  global.TextEncoder = TextEncoder;
});

beforeEach(() => localStorage.clear());

const LOCK = "/present?items=T1%2Cj%3AR1";

test("a locked device is pinned to its presentation; sign-in stays reachable", () => {
  expect(lockRedirect(null, "/inventory", "")).toBe(null);
  expect(lockRedirect(LOCK, "/present", "?items=T1%2Cj%3AR1")).toBe(null);
  expect(lockRedirect(LOCK, "/inventory", "")).toBe(LOCK);
  expect(lockRedirect(LOCK, "/", "")).toBe(LOCK);
  expect(lockRedirect(LOCK, "/present", "?items=T1%2CT2")).toBe(LOCK);
  expect(lockRedirect(LOCK, "/sign-in", "")).toBe(null);
  expect(lockRedirect(LOCK, "/sign-in/factor-one", "")).toBe(null);
  expect(lockRedirect(LOCK, "/sign-inventory", "")).toBe(LOCK);
});

test("waits grow after five misses and are capped", () => {
  expect(lockoutMs(4)).toBe(0);
  expect(lockoutMs(5)).toBe(30_000);
  expect(lockoutMs(6)).toBe(60_000);
  expect(lockoutMs(30)).toBe(3_600_000);
});

test("code: stored hashed, wrong tries lock out, right code clears", async () => {
  await saveCode("2468");
  expect(hasCode()).toBe(true);
  expect(localStorage.getItem("present.code")).not.toContain("2468");

  const t = 1_000_000;
  for (let i = 0; i < 4; i += 1) expect(await checkCode("0000", t)).toEqual({ ok: false, wait: 0 });
  expect(await checkCode("0000", t)).toEqual({ ok: false, wait: 30_000 });
  expect((await checkCode("2468", t + 1_000)).ok).toBe(false);
  expect(await checkCode("2468", t + 31_000)).toEqual({ ok: true, wait: 0 });

  engageLock(LOCK);
  expect(lockedUrl()).toBe(LOCK);
  releaseLock();
  expect(lockedUrl()).toBe(null);
  expect(hasCode()).toBe(true);
  forgetEverything();
  expect(hasCode()).toBe(false);
});

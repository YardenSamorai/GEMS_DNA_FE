import { isNetworkError, uploadFailure } from "./photoText";

const setOnline = (value) => Object.defineProperty(window.navigator, "onLine", { value, configurable: true });

afterEach(() => setOnline(true));

test("a dropped connection while online is not reported as missing internet", () => {
  setOnline(true);
  const dropped = new TypeError("Failed to fetch");
  expect(isNetworkError(dropped)).toBe(true);
  expect(uploadFailure(dropped)).toMatch(/החיבור לשרת נקטע/);
  expect(uploadFailure(dropped)).not.toMatch(/אינטרנט/);
});

test("an offline device is told to check the Wi-Fi", () => {
  setOnline(false);
  expect(uploadFailure(new TypeError("Failed to fetch"))).toMatch(/אין חיבור לאינטרנט/);
});

test("server replies keep their own messages", () => {
  setOnline(true);
  expect(uploadFailure(Object.assign(new Error("x"), { status: 401 }))).toMatch(/פג תוקף/);
  expect(uploadFailure(Object.assign(new Error("x"), { status: 413 }))).toMatch(/גדולה מדי/);
  expect(uploadFailure(Object.assign(new Error("x"), { name: "AbortError" }))).toMatch(/לא ענה בזמן/);
  expect(isNetworkError(Object.assign(new Error("x"), { status: 500 }))).toBe(false);
});

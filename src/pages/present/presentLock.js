/* Presentation lock. While a presentation is running the device is pinned to
 * that exact URL: every other page of the app (Back, the address bar, a new
 * tab, a reload) bounces back to it until the exit code is entered. The code
 * lives on this device only, salted and hashed. Forgetting it means signing
 * out, which needs the account password to undo. */

const CODE_KEY = "present.code";
const LOCK_KEY = "present.lock";
const ATTEMPTS_KEY = "present.attempts";

export const CODE_LENGTH = 4;

/* Signing back in must stay reachable from a locked device. */
const OPEN_PATHS = [/^\/sign-in(\/|$)/, /^\/sign-up(\/|$)/, /^\/sso-callback(\/|$)/];

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const write = (key, value) => {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
};

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const hashCode = async (salt, code) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${code}`)));

export const hasCode = () => Boolean(read(CODE_KEY)?.hash);

export const saveCode = async (code) => {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  write(CODE_KEY, { salt, hash: await hashCode(salt, code) });
  write(ATTEMPTS_KEY, null);
};

export const lockedUrl = () => read(LOCK_KEY)?.url || null;

export const engageLock = (url) => write(LOCK_KEY, { url, at: Date.now() });

export const releaseLock = () => {
  write(LOCK_KEY, null);
  write(ATTEMPTS_KEY, null);
};

/* The presentation staff last walked out of, in this tab. Going Back or
 * Forward onto it again shows it without locking the device a second time. */
const LEFT_KEY = "present.left";
export const markLeft = (url) => sessionStorage.setItem(LEFT_KEY, url);
export const wasLeft = (url) => sessionStorage.getItem(LEFT_KEY) === url;
export const clearLeft = () => sessionStorage.removeItem(LEFT_KEY);

export const forgetEverything = () => {
  write(LOCK_KEY, null);
  write(CODE_KEY, null);
  write(ATTEMPTS_KEY, null);
};

/* Where a locked device is allowed to be; null means stay. */
export const lockRedirect = (lock, pathname, search) => {
  if (!lock) return null;
  if (`${pathname}${search || ""}` === lock) return null;
  if (OPEN_PATHS.some((re) => re.test(pathname))) return null;
  return lock;
};

/* Safari's back swipe can restore an earlier page of the app from its page
 * cache, frozen as it was before the lock existed — no route renders, so the
 * gate in App never runs. Every page checks again when it is shown. */
export const installLockGuard = () => {
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    const to = lockRedirect(lockedUrl(), window.location.pathname, window.location.search);
    if (!to) return;
    document.documentElement.style.visibility = "hidden";
    window.location.replace(to);
  });
};

/* Five free tries, then the wait doubles with every miss: 30 s, 1 min, 2 min… capped at 1 h. */
export const lockoutMs = (failures) =>
  failures < 5 ? 0 : Math.min(30_000 * 2 ** (failures - 5), 60 * 60_000);

export const waitRemaining = (now = Date.now()) => Math.max(0, (read(ATTEMPTS_KEY)?.until || 0) - now);

export const checkCode = async (code, now = Date.now()) => {
  if (waitRemaining(now) > 0) return { ok: false, wait: waitRemaining(now) };
  const stored = read(CODE_KEY);
  if (stored?.hash && (await hashCode(stored.salt, code)) === stored.hash) {
    write(ATTEMPTS_KEY, null);
    return { ok: true, wait: 0 };
  }
  const failures = (read(ATTEMPTS_KEY)?.failures || 0) + 1;
  const wait = lockoutMs(failures);
  write(ATTEMPTS_KEY, { failures, until: now + wait });
  return { ok: false, wait };
};

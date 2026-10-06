// Lets Node load the app's CRA-style modules (extensionless relative imports).
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!relative || error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    for (const suffix of [".js", "/index.js"]) {
      try {
        return await next(specifier + suffix, context);
      } catch {
        /* try the next candidate */
      }
    }
    throw error;
  }
}

// The app's src/ files are ES modules without "type": "module".
export async function load(url, context, next) {
  if (url.startsWith("file:") && /\/src\/.+\.js$/.test(url)) {
    return next(url, { ...context, format: "module" });
  }
  return next(url, context);
}

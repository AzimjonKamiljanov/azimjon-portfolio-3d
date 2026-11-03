// Global client-side error and unhandled rejection tracker
export function initErrorTracking() {
  if (typeof window === "undefined") return;
  window.__errors = window.__errors || [];

  window.addEventListener("error", (e) => {
    window.__errors.push({
      msg: e.message,
      src: e.filename,
      line: e.lineno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    window.__errors.push({
      msg: e.reason?.message || String(e.reason),
    });
  });

  const _origConsoleError = console.error;
  console.error = function (...args) {
    window.__errors.push({
      msg: args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" "),
      src: "console.error",
    });
    _origConsoleError.apply(console, args);
  };
}

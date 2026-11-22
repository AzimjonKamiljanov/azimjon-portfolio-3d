/**
 * Cloudflare Turnstile integration for the Moon contact terminal.
 *
 * Everything here is driven by `GET /api/config`, which the Worker answers
 * from its own environment. That is deliberate: the previous design required a
 * build-time site key while the Worker enforced a runtime secret, so setting
 * the secret alone silently rejected every message that the form sent. With a
 * single runtime source of truth the widget and the verifier cannot disagree.
 *
 * When Turnstile is not configured, nothing is loaded and no external origin
 * is contacted — the honeypot and the Worker's rate limiter remain the only
 * anti-abuse layers, exactly as before.
 */

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";
const CONFIG_TIMEOUT_MS = 4000;

/** @type {Promise<{enabled: boolean, siteKey: string|null}>|null} */
let configPromise = null;
/** @type {Promise<void>|null} */
let scriptPromise = null;
let widgetId = null;

/**
 * Fetches the public runtime config once per page load. A failure is cached as
 * "disabled" rather than retried on every form open: if the config endpoint is
 * unreachable the challenge cannot work anyway, and the submission still has
 * to pass the Worker's own checks.
 */
export function loadTurnstileConfig() {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    const disabled = { enabled: false, siteKey: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
      const res = await fetch("/api/config", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      if (!res.ok) return disabled;

      const data = await res.json();
      const turnstile = data?.turnstile;
      if (!turnstile?.enabled || typeof turnstile.siteKey !== "string") {
        return disabled;
      }
      return { enabled: true, siteKey: turnstile.siteKey };
    } catch {
      // Offline, blocked, or no Worker in front of the dev server.
      return disabled;
    }
  })();

  return configPromise;
}

function loadScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing && window.turnstile) {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Turnstile script failed to load")),
    );
    if (!existing) document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Renders the widget into `container` if Turnstile is configured.
 * Resolves to true when a challenge is active for this page.
 */
export async function mountTurnstile(container) {
  if (!container) return false;

  const config = await loadTurnstileConfig();
  if (!config.enabled) {
    container.classList.add("hidden");
    return false;
  }

  try {
    await loadScript();
  } catch {
    // The widget could not load. Keep the form usable: the Worker will reject
    // the submission and the visitor is told to use a direct channel instead.
    container.classList.remove("hidden");
    container.dataset.turnstileState = "error";
    return false;
  }

  if (!window.turnstile) {
    container.dataset.turnstileState = "error";
    return false;
  }

  container.classList.remove("hidden");
  container.dataset.turnstileState = "ready";
  container.innerHTML = "";

  widgetId = window.turnstile.render(container, {
    sitekey: config.siteKey,
    theme: "dark",
    size: "flexible",
    action: "moon-terminal-contact",
  });

  return true;
}

/** The current challenge token, or null when Turnstile is inactive. */
export function getTurnstileToken() {
  if (!widgetId || !window.turnstile) return null;
  try {
    return window.turnstile.getResponse(widgetId) || null;
  } catch {
    return null;
  }
}

/** Tokens are single-use; reset after every submission attempt. */
export function resetTurnstile() {
  if (!widgetId || !window.turnstile) return;
  try {
    window.turnstile.reset(widgetId);
  } catch {
    // A reset failure only means the next submit needs a fresh widget.
  }
}

/** Removes the widget, e.g. when the terminal is re-rendered on language change. */
export function unmountTurnstile() {
  if (widgetId && window.turnstile) {
    try {
      window.turnstile.remove(widgetId);
    } catch {
      // Already gone.
    }
  }
  widgetId = null;
}

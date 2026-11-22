import {
  playUiClick,
  playUiTransmit,
  playUiSuccess,
  playUiError,
} from "../audio/soundscape.js";
import { translations } from "../i18n/translations.js";
import {
  mountTurnstile,
  getTurnstileToken,
  resetTurnstile,
  unmountTurnstile,
} from "./turnstile.js";

let currentContactType = "tg";

export function renderMoonTerminal(currentLang = "uz", overrideTexts = null) {
  const termTexts =
    overrideTexts ||
    translations.ui[currentLang]?.terminal ||
    translations.ui.uz.terminal;
  const container = document.getElementById("moon-terminal-container");
  if (!container) return;
  container.classList.remove("hidden");
  container.style.display = "block";

  const prevName = document.getElementById("terminal-name")?.value || "";
  const prevContact = document.getElementById("terminal-contact")?.value || "";
  const prevMsg = document.getElementById("terminal-message")?.value || "";

  const topicIcons = ["🤝", "💼", "⚡", "☕"];
  const topicKeys = [
    "topicCollab",
    "topicProject",
    "topicConsulting",
    "topicQuestion",
  ];

  let activeTopicIndex = -1;
  const topicMatch = prevMsg.match(/^\[(.*?)\]\s*/);
  if (topicMatch) {
    const inside = topicMatch[1];
    for (let i = 0; i < topicIcons.length; i++) {
      if (inside.includes(topicIcons[i])) {
        activeTopicIndex = i;
        break;
      }
    }
  }

  const quickChipsHtml = topicKeys
    .map((key, idx) => {
      const topicStr = termTexts[key] || key;
      const isActive = idx === activeTopicIndex ? " active" : "";
      return `<button type="button" class="topic-chip${isActive}" data-topic="${topicStr}">${topicStr}</button>`;
    })
    .join("");

  const placeholders = {
    tg: termTexts.contactPlaceholderTg || "@username",
    email: termTexts.contactPlaceholderEmail || "sizning@emailingiz.com",
    phone: termTexts.contactPlaceholderPhone || "+998 90 123 45 67",
  };

  const prefixes = {
    tg: "@",
    email: "📧",
    phone: "📞",
  };

  const contactPlaceholder =
    placeholders[currentContactType] || placeholders.tg;
  const contactPrefix = prefixes[currentContactType] || "@";

  container.innerHTML = `
        <div class="cyber-terminal">
            <div class="terminal-header">
                <div class="terminal-dots">
                    <span class="dot dot-red"></span>
                    <span class="dot dot-yellow"></span>
                    <span class="dot dot-green"></span>
                </div>
                <div class="terminal-title">
                    <span class="terminal-prompt">CYBER_UPLINK://</span>
                    <a href="https://t.me/CyberAgentNexus" target="_blank" rel="noopener noreferrer" class="terminal-channel" title="Telegram Botda Ochish">@CyberAgentNexus</a>
                </div>
                <span class="terminal-status-pill">${termTexts.statusOnline || "ONLINE"}</span>
            </div>
            
            <p class="terminal-intro">${termTexts.intro || "Moon Direct AI & Telegram Uplink Terminal"}</p>

            <div class="terminal-notice-box">
                <span class="notice-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
                <p class="notice-text">${termTexts.notice || "Mendan (Azimjondan) tezkor javob olish uchun ma'lumotlarni to'liq kiriting."}</p>
            </div>

            <div class="terminal-quick-topics">
                ${quickChipsHtml}
            </div>

            <form id="terminal-form" class="terminal-form" novalidate>
                <!-- Honeypot anti-spam trap (invisible to real visitors) -->
                <input type="text" name="_hp" id="terminal-hp" class="terminal-hp-input" tabindex="-1" autocomplete="off">

                <div class="terminal-field">
                    <label for="terminal-name">${termTexts.nameLabel || "F.I.SH / ISMINGIZ"}</label>
                    <div class="input-glow-wrap">
                        <span class="input-prefix"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                        <input type="text" id="terminal-name" placeholder="${termTexts.namePlaceholder || "Ismingiz..."}" maxlength="60" required autocomplete="name" value="${prevName}">
                    </div>
                </div>

                <div class="terminal-field">
                    <label for="terminal-contact">${termTexts.contactLabel || "ALOQA MA'LUMOTI"}</label>
                    <div class="terminal-type-tabs">
                        <button type="button" class="type-tab${currentContactType === "tg" ? " active" : ""}" data-type="tg">${termTexts.contactTypeTg || "Telegram (@username)"}</button>
                        <button type="button" class="type-tab${currentContactType === "email" ? " active" : ""}" data-type="email">${termTexts.contactTypeEmail || "Email Manzil"}</button>
                        <button type="button" class="type-tab${currentContactType === "phone" ? " active" : ""}" data-type="phone">${termTexts.contactTypePhone || "Telefon Raqam"}</button>
                    </div>
                    <div class="input-glow-wrap">
                        <span class="input-prefix" id="terminal-contact-prefix">${contactPrefix}</span>
                        <input type="text" id="terminal-contact" placeholder="${contactPlaceholder}" maxlength="80" required value="${prevContact}">
                    </div>
                </div>

                <div class="terminal-field">
                    <label for="terminal-message">${termTexts.messageLabel || "XABAR MATNI"}</label>
                    <div class="input-glow-wrap textarea-wrap">
                        <textarea id="terminal-message" rows="3" placeholder="${termTexts.messagePlaceholder || "Xabaringizni yozing..."}" maxlength="1000" required>${prevMsg}</textarea>
                        <div class="char-counter"><span id="char-count">${prevMsg.length}</span>/1000</div>
                    </div>
                </div>

                <!-- Cloudflare Turnstile. Rendered only when the Worker
                     reports the challenge as configured; otherwise it stays
                     hidden and no external origin is contacted. -->
                <div id="terminal-turnstile" class="terminal-turnstile hidden"></div>

                <button type="submit" id="terminal-submit-btn" class="terminal-send-btn">
                    <span class="send-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span>
                    <span id="terminal-send-text">${termTexts.sendBtn || "Xabarni Yuborish"}</span>
                </button>

                <div id="terminal-feedback" class="terminal-feedback hidden" aria-live="polite"></div>
            </form>

            <div class="terminal-direct-channels">
                <h4 class="channels-title">${termTexts.directChannelsTitle || "To'g'ridan-to'g'ri Aloqa Kanallari:"}</h4>
                <div class="channels-grid">
                    <a href="https://t.me/KamiljanovAzimjon" target="_blank" rel="noopener noreferrer" class="channel-btn channel-tg">
                        <span class="ch-info">
                            <span class="ch-name">Telegram Shaxsiy</span>
                            <span class="ch-val">@KamiljanovAzimjon</span>
                        </span>
                    </a>
                    <a href="mailto:azimjonkomiljonov907@gmail.com" class="channel-btn channel-email">
                        <span class="ch-info">
                            <span class="ch-name">Rasmiy Email</span>
                            <span class="ch-val">azimjonkomiljonov907@gmail.com</span>
                        </span>
                    </a>
                    <a href="https://t.me/CyberAgentNexus" target="_blank" rel="noopener noreferrer" class="channel-btn channel-voip">
                        <span class="ch-info">
                            <span class="ch-name">${termTexts.voipCallTitle || "Favqulodda Qo'ng'iroq"}</span>
                            <span class="ch-val">@CyberAgentNexus (AI & VoIP)</span>
                        </span>
                    </a>
                </div>
            </div>
        </div>
    `;

  // Type tab switcher
  container.querySelectorAll(".type-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      playUiClick();
      const type = tab.getAttribute("data-type");
      currentContactType = type;
      container
        .querySelectorAll(".type-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const prefixEl = document.getElementById("terminal-contact-prefix");
      if (prefixEl) prefixEl.innerText = prefixes[type] || "@";

      const contactInput = document.getElementById("terminal-contact");
      if (contactInput) {
        contactInput.placeholder = placeholders[type] || "";
        if (
          type === "tg" &&
          contactInput.value &&
          !contactInput.value.startsWith("@")
        ) {
          contactInput.value = `@${contactInput.value.replace(/^@/, "")}`;
        }
      }
    });
  });

  // Topic chips
  container.querySelectorAll(".topic-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      playUiClick();
      container
        .querySelectorAll(".topic-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      const topicStr = chip.getAttribute("data-topic");
      const msgArea = document.getElementById("terminal-message");
      if (msgArea) {
        const clean = msgArea.value.replace(/^\[.*?\]\s*/, "");
        msgArea.value = `[${topicStr}] ${clean}`;
        msgArea.dispatchEvent(new Event("input"));
        msgArea.focus();
      }
    });
  });

  // Char counter
  const msgArea = document.getElementById("terminal-message");
  const charCount = document.getElementById("char-count");
  if (msgArea && charCount) {
    msgArea.addEventListener("input", () => {
      charCount.innerText = String(msgArea.value.length);
    });
  }

  // Cloudflare Turnstile. A previous render may still hold a widget handle,
  // so tear the old one down before mounting into the fresh markup.
  unmountTurnstile();
  const turnstileHost = document.getElementById("terminal-turnstile");
  let turnstileActive = false;
  mountTurnstile(turnstileHost).then((active) => {
    turnstileActive = active;
  });

  // Form submission
  const form = document.getElementById("terminal-form");
  const feedback = document.getElementById("terminal-feedback");
  const submitBtn = document.getElementById("terminal-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      playUiTransmit();

      const name = document.getElementById("terminal-name")?.value.trim() || "";
      const contact =
        document.getElementById("terminal-contact")?.value.trim() || "";
      const message =
        document.getElementById("terminal-message")?.value.trim() || "";
      const hp = document.getElementById("terminal-hp")?.value || "";

      if (
        !name ||
        name.length < 2 ||
        !contact ||
        contact.length < 3 ||
        !message ||
        message.length < 3
      ) {
        playUiError();
        if (feedback) {
          feedback.className = "terminal-feedback feedback-error";
          feedback.innerText =
            termTexts.validationError ||
            "Barcha maydonlarni to'g'ri to'ldiring.";
          feedback.classList.remove("hidden");
        }
        return;
      }

      // A Turnstile token is single-use. Read it before the request and
      // reset the widget afterwards so a retry gets a fresh challenge.
      const turnstileToken = turnstileActive ? getTurnstileToken() : null;
      if (turnstileActive && !turnstileToken) {
        playUiError();
        if (feedback) {
          feedback.className = "terminal-feedback feedback-error";
          feedback.innerText =
            termTexts.turnstilePending ||
            "Xavfsizlik tekshiruvini kuting yoki qayta urinib ko'ring.";
          feedback.classList.remove("hidden");
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
      }

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            contact,
            message,
            lang: currentLang,
            _hp: hp,
            ...(turnstileToken
              ? { "cf-turnstile-response": turnstileToken }
              : {}),
          }),
        });

        const data = await res.json();
        if (res.ok && data.ok) {
          playUiSuccess();
          if (feedback) {
            feedback.className = "terminal-feedback feedback-success";
            feedback.innerText =
              data.message ||
              termTexts.success ||
              "Xabar muvaffaqiyatli yuborildi!";
            feedback.classList.remove("hidden");
          }
          form.reset();
          if (charCount) charCount.innerText = "0";
        } else {
          playUiError();
          if (feedback) {
            feedback.className = "terminal-feedback feedback-error";
            feedback.innerText =
              data.error || termTexts.error || "Xatolik yuz berdi.";
            feedback.classList.remove("hidden");
          }
        }
      } catch (_err) {
        playUiError();
        if (feedback) {
          feedback.className = "terminal-feedback feedback-error";
          feedback.innerText =
            termTexts.networkError || "Serverga ulanishda xatolik.";
          feedback.classList.remove("hidden");
        }
      } finally {
        if (turnstileActive) resetTurnstile();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
        }
      }
    });
  }
}

export function initTerminal() {
  const terminalInstance = {
    render: (lang, texts) => renderMoonTerminal(lang, texts),
  };
  if (typeof window !== "undefined") {
    window.__terminal = terminalInstance;
  }
  return terminalInstance;
}

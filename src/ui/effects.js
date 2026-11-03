const CYBER_DECRYPT_GLYPHS = "0123456789ABCDEF_#*!@%&<>/\\~+=";

export function animateDecryptedText(element, targetText, duration = 240) {
  if (!element || !targetText) return;
  const len = targetText.length;
  const startTime = performance.now();
  if (element.__decryptAnim) cancelAnimationFrame(element.__decryptAnim);

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const revealedCount = Math.floor(progress * len);
    let output = "";
    for (let i = 0; i < len; i++) {
      const char = targetText[i];
      if (
        char === " " ||
        char === "\n" ||
        char === "•" ||
        char === "-" ||
        char === "(" ||
        char === ")"
      ) {
        output += char;
      } else if (i < revealedCount) {
        output += char;
      } else {
        output +=
          CYBER_DECRYPT_GLYPHS[
            Math.floor(Math.random() * CYBER_DECRYPT_GLYPHS.length)
          ];
      }
    }
    element.textContent = output;
    if (progress < 1) {
      element.__decryptAnim = requestAnimationFrame(step);
    } else {
      element.textContent = targetText;
      element.__decryptAnim = null;
    }
  }
  element.__decryptAnim = requestAnimationFrame(step);
}

export function initSpotlightCards() {
  const cards = document.querySelectorAll(".catalog-card, .catalog-star-card");
  cards.forEach((card) => {
    if (card.__hasSpotlight) return;
    card.__hasSpotlight = true;
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--mouse-x", "-999px");
      card.style.setProperty("--mouse-y", "-999px");
    });
  });
}

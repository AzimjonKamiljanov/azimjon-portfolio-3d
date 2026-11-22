let audioCtx = null;
let isAudioMuted = true;
let ambientMusicAudio = null;

export function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();
  } catch (e) {
    console.warn("Audio Context init warning:", e);
  }
}

export const initSoundscape = initAudio;

// User interaction gesture listener to seamlessly unlock audio
if (typeof window !== "undefined") {
  ["touchstart", "touchend", "click", "pointerdown"].forEach((evtType) => {
    window.addEventListener(
      evtType,
      () => {
        if (audioCtx && audioCtx.state === "suspended" && !isAudioMuted) {
          audioCtx.resume().catch(() => {});
        }
      },
      { passive: true },
    );
  });
}

// Suspend AudioContext & pause ambient playback on tab hide to conserve CPU/battery
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (audioCtx && audioCtx.state === "running") {
        audioCtx.suspend().catch(() => {});
      }
      if (ambientMusicAudio && !ambientMusicAudio.paused) {
        ambientMusicAudio.pause();
      }
    } else if (!isAudioMuted) {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      if (ambientMusicAudio) {
        ambientMusicAudio.play().catch(() => {});
      }
    }
  });
}

export function playUiClick() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      1320,
      audioCtx.currentTime + 0.04,
    );
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiHover() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.012, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiOpen() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiClose() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiTransmit() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      1760,
      audioCtx.currentTime + 0.18,
    );
    gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiSuccess() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(1046.5, now);
    osc2.frequency.setValueAtTime(1318.5, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function playUiError() {
  if (isAudioMuted || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(105, now + 0.09);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // A single UI blip failing is never worth surfacing.
  }
}

export function isMuted() {
  return isAudioMuted;
}

export function playAmbientTrack() {
  if (!ambientMusicAudio) {
    try {
      ambientMusicAudio = new Audio("assets/space_ambient.mp3");
      ambientMusicAudio.loop = true;
      ambientMusicAudio.volume = 0.38;
    } catch (e) {
      console.warn("Ambient music init error:", e);
    }
  }
  if (ambientMusicAudio && !isAudioMuted) {
    ambientMusicAudio.play().catch(() => {});
  }
}

export function toggleAudioMute() {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  isAudioMuted = !isAudioMuted;
  if (isAudioMuted) {
    if (ambientMusicAudio) ambientMusicAudio.pause();
  } else {
    playAmbientTrack();
    playUiClick();
  }
  return isAudioMuted;
}

export function toggleAudio(langTextMap) {
  const muted = toggleAudioMute();
  const btn = document.getElementById("audio-toggle-btn");
  const icon = document.getElementById("audio-toggle-icon");
  const text = document.getElementById("audio-toggle-text");

  if (muted) {
    if (btn) btn.classList.add("audio-muted");
    if (icon)
      icon.innerHTML =
        '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
    if (text && langTextMap?.audioOff) text.innerText = langTextMap.audioOff;
  } else {
    if (btn) btn.classList.remove("audio-muted");
    if (icon)
      icon.innerHTML =
        '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    if (text && langTextMap?.audioOn) text.innerText = langTextMap.audioOn;
  }
}

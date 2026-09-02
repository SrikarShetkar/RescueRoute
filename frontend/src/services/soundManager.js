/**
 * soundManager.js — the ONLY place in the app that plays audio.
 *
 * Sounds are never bound to buttons or page loads. Every sound must be
 * requested with a reason that traces back to a real server-driven domain
 * event (a sound-plan item broadcast by the emergency engine).
 */

import sirenAudioSrc from "../assets/sounds/ambulance-siren.wav";

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone({ freq = 660, duration = 0.12, delay = 0, volume = 0.18, type = "sine" }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Soft, short, reassuring beep — reporter confirms, hospital/staff notices. */
export function playConfirm(reason) {
  tone({ freq: 660, duration: 0.14, volume: 0.16 });
  tone({ freq: 880, duration: 0.16, delay: 0.16, volume: 0.12 });
  console.log(` Confirm sound (${reason})`);
}

/** Short attention alert (2-3s) — new ambulance request, destination change. */
export function playAttention(reason) {
  const pattern = [880, 660, 880, 660];
  pattern.forEach((f, i) => {
    tone({ freq: f, duration: 0.22, delay: i * 0.22, volume: 0.3, type: "square" });
  });
  console.log(` Attention sound (${reason})`);
}

/* Siren: a looping audio element, started/stopped only on server siren events. */
let sirenEl = null;
let sirenReason = null;

export function stopSiren() {
  if (sirenEl) {
    try {
      sirenEl.pause();
      sirenEl.currentTime = 0;
    } catch {}
    sirenEl = null;
    sirenReason = null;
  }
}

export function playSiren(reason) {
  const reasonChanged = reason && reason !== sirenReason;
  sirenReason = reason;
  if (sirenEl && !reasonChanged) return; // already playing
  stopSiren();
  try {
    sirenEl = new Audio(sirenAudioSrc);
    sirenEl.loop = true;
    sirenEl.volume = 0.7;
    sirenEl.play().catch((e) => console.log("Siren play failed:", e));
  } catch (e) {
    console.log("Siren error:", e);
  }
  console.log(` Siren (${reason})`);
}

/** Play a single sound-plan item. Throws no errors; always safe to call. */
export function playSound({ sound, reason, ...rest }) {
  switch (sound) {
    case "confirm":
      playConfirm(reason);
      break;
    case "attention":
      playAttention(reason);
      break;
    case "siren":
      playSiren(reason);
      break;
    case "quiet":
    default:
      break;
  }
  return rest;
}

const soundManager = { playConfirm, playAttention, playSiren, stopSiren, playSound };

export default soundManager;
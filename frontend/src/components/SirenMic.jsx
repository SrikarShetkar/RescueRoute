import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "./Icon";
import "./SirenMic.css";

const FFT_SIZE = 256;
const SIREN_BAND_LO = 600;
const SIREN_BAND_HI = 1200;
const DETECTION_THRESHOLD = 0.18;

/**
 * SirenMic — listens for siren-like frequencies via the device microphone.
 * Uses Web Audio API AnalyserNode + FFT to isolate the 600–1200 Hz band
 * and fires onSirenDetected(true/false) when energy crosses a threshold.
 * Additive — works alongside the existing socket-driven siren:event.
 */
export default function SirenMic({ onSirenDetected }) {
  const [status, setStatus] = useState("idle");
  const [energy, setEnergy] = useState(0);
  const [sirenDetected, setSirenDetected] = useState(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const teardown = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    analyserRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("denied"); return; }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;
      setStatus("listening");

      const binCount = analyser.frequencyBinCount;
      const freqData = new Uint8Array(binCount);
      const binWidth = audioCtx.sampleRate / FFT_SIZE;
      const loBin = Math.floor(SIREN_BAND_LO / binWidth);
      const hiBin = Math.min(Math.ceil(SIREN_BAND_HI / binWidth), binCount - 1);

      const tick = () => {
        analyser.getByteFrequencyData(freqData);

        let sum = 0;
        for (let i = loBin; i <= hiBin; i++) sum += freqData[i];
        const bandLen = hiBin - loBin + 1;
        const bandEnergy = sum / (bandLen * 255);
        setEnergy(bandEnergy);

        const isSiren = bandEnergy > DETECTION_THRESHOLD;
        setSirenDetected((prev) => {
          if (prev !== isSiren) onSirenDetected?.(isSiren);
          return isSiren;
        });

        const canvas = canvasRef.current;
        if (canvas) {
          const c = canvas.getContext("2d");
          const w = canvas.width;
          const h = canvas.height;
          c.clearRect(0, 0, w, h);
          const barW = Math.max(1, w / binCount - 1);
          for (let i = 0; i < binCount; i++) {
            const val = freqData[i] / 255;
            const barH = val * h;
            const inBand = i >= loBin && i <= hiBin;
            c.fillStyle = inBand ? (val > 0.5 ? "#ff5c5c" : "#ffaa33") : "#2a3a4a";
            c.fillRect(i * (barW + 1), h - barH, barW, barH);
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setStatus("denied");
    }
  }, [onSirenDetected]);

  useEffect(() => () => teardown(), [teardown]);

  return (
    <div className={`smic ${sirenDetected ? "smic-alert" : ""}`}>
      <div className="smic-header">
        <Icon name="mic" size={14} />
        <span className="smic-title">Mic siren detection</span>
        <span className={`smic-status smic-${status}`}>
          {status === "idle" && "OFF"}
          {status === "requesting" && "REQUESTING\u2026"}
          {status === "listening" && (sirenDetected ? "SIREN DETECTED" : "LISTENING")}
          {status === "denied" && "BLOCKED"}
        </span>
      </div>
      {status === "idle" && (
        <button className="btn btn-ghost smic-start" onClick={start}>
          <Icon name="mic" size={13} /> Enable mic detection
        </button>
      )}
      {status === "requesting" && (
        <div className="smic-waiting">
          <span className="spin" /> Waiting for mic permission\u2026
        </div>
      )}
      {status === "listening" && (
        <>
          <canvas ref={canvasRef} className="smic-canvas" width={128} height={48} />
          <div className="smic-energy">
            <span className="smic-energy-label">600\u20131200 Hz</span>
            <div className="smic-bar">
              <div className="smic-bar-fill" style={{ width: `${Math.min(100, energy * 100)}%` }} />
            </div>
          </div>
        </>
      )}
      {status === "denied" && (
        <p className="smic-denied">
          Microphone blocked \u2014 siren alerts from the RescueRoute engine still work via socket.
        </p>
      )}
    </div>
  );
}

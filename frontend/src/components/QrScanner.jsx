import React, { useEffect, useRef, useState } from "react";
import "./QrScanner.css";

/**
 * QrScanner — Camera-based QR code scanner using html5-qrcode.
 * Requests camera permission, opens scanner, detects QR, returns token.
 */
export default function QrScanner({ onScan, onClose }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("init"); // init | requesting | scanning | detected | error
  const [errorMsg, setErrorMsg] = useState(null);
  const scannerInstance = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStatus("requesting");

      try {
        // Check camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (!cancelled) {
            setStatus("error");
            setErrorMsg("Camera not available on this device. Use vehicle number or Aadhaar fallback.");
          }
          return;
        }

        // Dynamically import html5-qrcode
        const { Html5Qrcode } = await import("html5-qrcode");

        if (cancelled) return;

        const containerId = "qr-scanner-container-" + Date.now();
        if (containerRef.current) {
          containerRef.current.id = containerId;
        }

        const scanner = new Html5Qrcode(containerId);
        scannerInstance.current = scanner;

        setStatus("scanning");

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (cancelled) return;
            setStatus("detected");
            try {
              scanner.stop().catch(() => {});
            } catch {}
            onScan(decodedText);
          },
          () => {} // ignore scan failures (no match yet)
        );
      } catch (err) {
        if (cancelled) return;
        console.error("QR Scanner error:", err);
        setStatus("error");
        if (err.toString().includes("Permission")) {
          setErrorMsg("Camera permission denied. Please allow camera access and try again, or use vehicle number / Aadhaar fallback.");
        } else if (err.toString().includes("NotAllowedError")) {
          setErrorMsg("Camera access was denied. You can use vehicle number or Aadhaar as alternatives.");
        } else {
          setErrorMsg("Unable to start camera scanner. Try using vehicle number or Aadhaar fallback.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (scannerInstance.current) {
        try {
          scannerInstance.current.stop().catch(() => {});
          scannerInstance.current.clear();
        } catch {}
        scannerInstance.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-panel">
        <div className="qr-scanner-header">
          <h3>Scan Emergency QR</h3>
          <button className="qr-scanner-close" onClick={onClose}>✕</button>
        </div>

        {status === "requesting" && (
          <div className="qr-scanner-status">
            <span className="spin" />
            <p>Requesting camera access…</p>
          </div>
        )}

        {status === "scanning" && (
          <div className="qr-scanner-active">
            <div className="qr-scanner-viewfinder">
              <div ref={containerRef} className="qr-scanner-container" />
              <div className="qr-scanner-frame">
                <span className="qr-corner tl" />
                <span className="qr-corner tr" />
                <span className="qr-corner bl" />
                <span className="qr-corner br" />
              </div>
            </div>
            <p className="qr-scanner-hint">Point camera at the QR code on the vehicle</p>
          </div>
        )}

        {status === "detected" && (
          <div className="qr-scanner-status detected">
            <span className="qr-detected-icon">✓</span>
            <p>QR Detected — fetching profiles…</p>
          </div>
        )}

        {status === "error" && (
          <div className="qr-scanner-status error">
            <span className="qr-error-icon">!</span>
            <p>{errorMsg || "Camera unavailable"}</p>
            <button className="btn btn-ghost" onClick={onClose}>
              Use Fallback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function QrScannerModal({ onClose, onScan }: { onClose: () => void; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let stopCamera: (() => void) | undefined;

    void import("@zxing/browser").then(async ({ BrowserQRCodeReader }) => {
      if (!videoRef.current || stopped) return;
      try {
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current, (result) => {
          if (!result || stopped) return;
          stopped = true;
          controls.stop();
          onScanRef.current(result.getText());
        });
        stopCamera = () => controls.stop();
        if (stopped) controls.stop();
      } catch {
        if (!stopped) setError("Ora could not access a camera. Allow camera access, then try again.");
      }
    });

    return () => { stopped = true; stopCamera?.(); };
  }, []);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal qr-scanner-modal" role="dialog" aria-modal="true" aria-label="Scan a case QR code"><header className="modal-header"><div><h2>Scan case QR</h2><p>Point the camera at an Ora case code.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close scanner"><X size={18} /></button></header><div className="qr-camera"><video ref={videoRef} muted playsInline /><span><i /><i /><i /><i /></span></div>{error ? <p className="form-error">{error}</p> : <p className="qr-scanner-status"><Camera size={16} />Looking for an Ora case code...</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button></div></section></div>;
}

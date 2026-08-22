"use client";

import { useEffect, useRef } from "react";

export default function RoundedQrCode({ value, size = 240 }: { value: string; size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();

    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (disposed || !containerRef.current) return;
      const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        type: "canvas",
        data: value,
        margin: 10,
        qrOptions: { errorCorrectionLevel: "H" },
        dotsOptions: { color: "#14695f", type: "rounded" },
        cornersSquareOptions: { color: "#0d5149", type: "extra-rounded" },
        cornersDotOptions: { color: "#0d5149", type: "dot" },
        backgroundOptions: { color: "#ffffff" },
      });
      qrCode.append(containerRef.current);
    });

    return () => { disposed = true; container.replaceChildren(); };
  }, [size, value]);

  return <div className="rounded-qr" ref={containerRef} aria-label="Case QR code" />;
}

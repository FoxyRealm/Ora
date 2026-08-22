"use client";

import { useEffect } from "react";

export default function OverlayScrollLock() {
  useEffect(() => {
    const updateScrollLock = () => {
      const hasOpenOverlay = Boolean(
        document.querySelector('[role="dialog"][aria-modal="true"]'),
      );
      document.documentElement.classList.toggle("overlay-open", hasOpenOverlay);
    };

    updateScrollLock();
    const observer = new MutationObserver(updateScrollLock);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("overlay-open");
    };
  }, []);

  return null;
}

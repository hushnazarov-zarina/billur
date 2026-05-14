"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface Props {
  onResult: (text: string) => void;
  /** When true the parent has finished processing the last result and the
   *  scanner can resume. */
  ready?: boolean;
}

const READER_ID = "qr-reader-region";

export function QrScanner({ onResult, ready = true }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Latch — ignore duplicate emits within this window
  const lastTextRef = useRef<{ text: string; at: number } | null>(null);

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(READER_ID, { verbose: false });
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (!ready) return;
          // Dedupe identical scans within 1.5s
          const now = Date.now();
          if (lastTextRef.current
              && lastTextRef.current.text === decodedText
              && now - lastTextRef.current.at < 1500) return;
          lastTextRef.current = { text: decodedText, at: now };
          onResult(decodedText);
        },
        () => { /* scan-failure callback fires constantly; ignore */ }
      );
      setActive(true);
    } catch (e: any) {
      setError(e?.message || "Kameraga kirish ruxsat berilmadi");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      const state = s.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await s.stop();
      }
    } catch { /* ignore */ }
    setActive(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      const s = scannerRef.current;
      if (!s) return;
      try {
        const state = s.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        s.stop()
  .catch(() => {})
  .finally(() => {
    try {
      s.clear();
    } catch {
      // ignore
    }
  });
        }
      } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square max-w-xs mx-auto rounded-2xl overflow-hidden bg-muted/40 border-4 border-dashed border-muted-foreground/30">
        <div id={READER_ID} className="absolute inset-0" />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-center p-4">
            <div>
              {starting ? (
                <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
              ) : (
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {starting ? "Kamera ochilmoqda..." : 'Kamerani yoqish uchun pastdagi tugmani bosing'}
              </p>
            </div>
          </div>
        )}
        {/* Corner guides (decorative) */}
        {active && (
          <>
            <div className="absolute top-3 left-3 w-7 h-7 border-l-4 border-t-4 border-primary rounded-tl-lg pointer-events-none" />
            <div className="absolute top-3 right-3 w-7 h-7 border-r-4 border-t-4 border-primary rounded-tr-lg pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-7 h-7 border-l-4 border-b-4 border-primary rounded-bl-lg pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-7 h-7 border-r-4 border-b-4 border-primary rounded-br-lg pointer-events-none" />
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}

      <div className="flex justify-center">
        {active ? (
          <Button variant="outline" onClick={stop}>
            <CameraOff className="mr-2 h-4 w-4" /> Kamerani o'chirish
          </Button>
        ) : (
          <Button onClick={start} disabled={starting}>
            <Camera className="mr-2 h-4 w-4" />
            {starting ? "Yoqilmoqda..." : "Kamerani yoqish"}
          </Button>
        )}
      </div>
    </div>
  );
}

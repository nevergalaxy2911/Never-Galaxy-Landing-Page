import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { logPortfolioClick } from "@/lib/portfolio-clicks.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  youtubeId: string;
  title: string;
  subtitle?: string;
  url: string;
};

/**
 * VideoFullscreenPlayer
 * 
 * Instead of a window-style modal, this component renders a hidden iframe
 * that immediately requests native browser fullscreen on mount. When the
 * user exits fullscreen, it triggers onClose to clean up the component state.
 * 
 * v2.0: Added error logging for Playback ID tracking and a user-facing 
 * error state with retry.
 */
export default function VideoFullscreenPlayer({
  open,
  onClose,
  youtubeId,
  title,
  url,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const log = useServerFn(logPortfolioClick);

  useEffect(() => {
    if (!open) return;
    log({ data: { slug: youtubeId, title, url, kind: "preview" } }).catch(() => {});
  }, [open, youtubeId, title, url, log]);

  // Handle YouTube PostMessages for error tracking
  useEffect(() => {
    if (!open) return;

    const handleMessage = (event: MessageEvent) => {
      // YouTube embeds send messages to the parent window
      if (event.origin !== "https://www.youtube.com" && event.origin !== "https://www.youtube-nocookie.com") return;
      
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        // Log interesting events or errors
        if (data.event === "infoDelivery" && data.info) {
          // You can track Playback IDs here if YouTube exposes them via PostMessage
          // Usually they are in the 'info' payload for debugging
        }

        // Catch explicit error states
        if (data.event === "onError" || (data.info && data.info.error)) {
          console.error(`[YouTube Error] ID: ${youtubeId}`, data);
          setError("Video playback failed. This could be due to embedding restrictions or a temporary YouTube error.");
        }
      } catch {
        // Not a JSON message we care about
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, youtubeId]);

  useEffect(() => {
    if (!open) return;
    setError(null); // Reset error on mount

    const container = containerRef.current;
    if (!container) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement && 
          !(document as any).mozFullScreenElement && 
          !(document as any).msFullscreenElement) {
        onClose();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    const enterFullscreen = async () => {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
      } catch (err) {
        console.error("Fullscreen request failed:", err);
      }
    };

    enterFullscreen();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      
      if (document.fullscreenElement === container) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      style={{ 
        opacity: document.fullscreenElement === containerRef.current ? 1 : 0,
        pointerEvents: document.fullscreenElement === containerRef.current ? 'auto' : 'none'
      }}
    >
      {!error ? (
        <iframe
          key={retryKey}
          ref={iframeRef}
          className="h-full w-full border-0"
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1&fs=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="max-w-md w-full p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-display uppercase tracking-widest text-white">Playback Error</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {error}
            </p>
            <p className="text-[10px] font-mono text-white/30">ID: {youtubeId}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { setError(null); setRetryKey(k => k + 1); }}
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-display text-[10px] uppercase tracking-[0.2em] hover:bg-white/90 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Try Again
            </button>
            <button 
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 bg-white/10 text-white/70 py-3 rounded-xl font-display text-[10px] uppercase tracking-[0.2em] hover:bg-white/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Close Player
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

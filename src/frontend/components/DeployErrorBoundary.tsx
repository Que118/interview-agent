// [DEPLOY] 线上异常兜底组件 — 不侵入任何原有组件
"use client";
import { useEffect, useState } from "react";

interface Props {
  children: React.ReactNode;
  onResourceError?: (resource: string, type: string) => void;
}

export default function DeployErrorBoundary({ children, onResourceError }: Props) {
  const [resourceErrors, setResourceErrors] = useState<string[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK" || target.tagName === "IMG")) {
        const src = (target as any).src || (target as any).href || "";
        if (src.includes("mediapipe") || src.includes("wasm") || src.includes("face_mesh")) {
          const msg = "\u9762\u90e8\u8bc6\u522b\u8d44\u6e90\u52a0\u8f7d\u5931\u8d25\uff0c\u5df2\u964d\u7ea7\u4e3a\u6a21\u62df\u6a21\u5f0f";
          setResourceErrors(prev => [...prev, msg]);
          setShowBanner(true);
          onResourceError?.(src, "mediapipe");
        }
      }
    };
    window.addEventListener("error", handler, true);
    return () => window.removeEventListener("error", handler, true);
  }, [onResourceError]);

  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason?.message?.includes("fetch") || e.reason?.message?.includes("network")) {
        setResourceErrors(prev => [...prev, "\u7f51\u7edc\u8fde\u63a5\u5f02\u5e38\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u5237\u65b0\u9875\u9762"]);
        setShowBanner(true);
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <>
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#d2991d22] border-b border-[#d2991d55] px-4 py-2 text-center">
          <span className="text-[#d2991d] text-xs font-medium">
            {resourceErrors[resourceErrors.length - 1]}
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="ml-3 text-[#8b949e] hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}
      {children}
    </>
  );
}

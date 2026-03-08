import { memo, type ReactNode } from "react";

interface GlassModalProps {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

export const GlassModal = memo(function GlassModal({ children, className, maxWidth }: GlassModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className={`relative w-full ${maxWidth || "max-w-md"} overflow-hidden p-6 ${className || ""}`}
        style={{
          borderRadius: 12,
          border: "1px solid var(--bg-border)",
          background: "var(--bg-elevated)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </div>
    </div>
  );
});

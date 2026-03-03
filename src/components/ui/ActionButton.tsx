import { memo } from "react";
import { Loader2 } from "lucide-react";

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText: string;
  text: string;
  icon: React.ReactNode;
}

export const ActionButton = memo(function ActionButton({
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  text,
  icon,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-action-button
      title={`${text} (Ctrl+Enter)`}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.35)]"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-neutral-900" strokeWidth={1.5} /> : icon}
      {loading ? loadingText : text}
    </button>
  );
});

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
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {loading ? loadingText : text}
    </button>
  );
});

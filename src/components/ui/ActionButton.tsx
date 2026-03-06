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
      className="btn-primary w-full"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-white dark:text-neutral-900" strokeWidth={1.5} /> : icon}
      {loading ? loadingText : text}
    </button>
  );
});

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
      <span className="btn-primary-icon" style={{ display: 'inline-flex', transition: 'transform 150ms ease' }}>
        {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" strokeWidth={1.5} /> : icon}
      </span>
      {loading ? loadingText : text}
    </button>
  );
});

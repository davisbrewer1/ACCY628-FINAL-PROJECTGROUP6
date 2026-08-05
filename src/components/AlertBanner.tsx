import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "warning" | "error";

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};

interface AlertBannerProps {
  title: string;
  message?: string;
  tone?: AlertTone;
  action?: ReactNode;
  onDismiss?: () => void;
}

export function AlertBanner({
  title,
  message,
  tone = "info",
  action,
  onDismiss,
}: AlertBannerProps) {
  return (
    <div
      className={`alert ${TONE_CLASSES[tone]} shadow-sm`}
      role="alert"
    >
      <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          {message ? <p className="text-sm opacity-90">{message}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {onDismiss ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onDismiss}
              aria-label="Dismiss alert"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";

// Confirmation dialog for destructive or important actions (Metaprompt §13).
// Escape or "Renunță" cancels; focus starts on the safe button.
export function Confirm(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="overlay" role="presentation" onClick={props.onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{props.title}</h2>
        <div className="dialog-body">{props.children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} onClick={props.onCancel}>
            Renunță
          </button>
          <button className={props.danger ? "danger" : "primary"} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

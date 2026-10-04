"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ChevronDown, CircleCheck, CircleX, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { notifyDataChanged } from "@/lib/data-bus";
import { translateError, type FriendlyError } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { shortenSignature } from "@/lib/format";
import { Button, CopyButton, ExplorerLink, Notice, Rows, cx, type Tone } from "@/components/ui";

type Phase = "review" | "pending" | "done" | "error";

export interface TxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Plain-language summary: what you give / get / pay. */
  rows: Array<{ label: ReactNode; value: ReactNode; emphasis?: boolean; tone?: Tone; hint?: ReactNode }>;
  /** Contextual warnings shown above the confirm button. */
  warnings?: Array<{ tone?: Tone; title?: string; text: ReactNode }>;
  /** Reasons the action can't run yet. Non-empty → confirm disabled and reasons shown. */
  blockers?: string[];
  /** Risk acknowledgement: when set, the user must tick it to enable confirm. */
  ack?: string;
  confirmLabel: string;
  /** Sends the transaction. Throw to show the error state. */
  action: () => Promise<{ signature: string }>;
  /** Runs after a confirmed transaction (refresh your data here). */
  onSuccess?: () => void | Promise<void>;
  successText?: string;
  /** Optional "what next" button on the success screen. */
  nextAction?: { label: string; onClick: () => void };
}

/**
 * The single transaction pattern for the whole app (docs/DESIGN.md §5):
 * review → waiting for wallet → done | failed (with translated error + retry).
 */
export function TxDialog(props: TxDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    rows,
    warnings = [],
    blockers = [],
    ack,
    confirmLabel,
    action,
    onSuccess,
    successText,
    nextAction,
  } = props;
  const t = useT();
  const [phase, setPhase] = useState<Phase>("review");
  const [acked, setAcked] = useState(false);
  const [armed, setArmed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  // Reset every time the dialog opens; arm the confirm button after a short beat
  // so a stray double-click can't sign something unread.
  useEffect(() => {
    if (!open) return;
    setPhase("review");
    setAcked(false);
    setSignature(null);
    setError(null);
    setArmed(false);
    const id = window.setTimeout(() => setArmed(true), 600);
    return () => window.clearTimeout(id);
  }, [open]);

  const confirm = useCallback(async () => {
    setPhase("pending");
    try {
      const { signature: sig } = await action();
      setSignature(sig);
      setPhase("done");
      notifyDataChanged();
      toast.success(successText ?? t("tx.done.title"), {
        description: shortenSignature(sig),
      });
      await onSuccess?.();
    } catch (e) {
      setError(translateError(e));
      setPhase("error");
    }
  }, [action, onSuccess, successText, t]);

  const canConfirm = armed && blockers.length === 0 && (!ack || acked);
  const busy = phase === "pending";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="av-overlay fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          onInteractOutside={(e) => busy && e.preventDefault()}
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
          className="av-dialog fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl sm:p-6"
          aria-describedby={undefined}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-ink">
                {phase === "done"
                  ? t("tx.done.title")
                  : phase === "error"
                    ? t("tx.failed.title")
                    : phase === "pending"
                      ? t("tx.waiting.title")
                      : title}
              </Dialog.Title>
              {phase === "review" && description && (
                <p className="mt-1 text-sm text-mute">{description}</p>
              )}
            </div>
            {!busy && (
              <Dialog.Close asChild>
                <button
                  aria-label={t("common.close")}
                  className="rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </Dialog.Close>
            )}
          </div>

          {phase === "review" && (
            <div className="space-y-4">
              <Rows rows={rows} />
              {warnings.map((w, i) => (
                <Notice key={i} tone={w.tone ?? "warn"} title={w.title}>
                  {w.text}
                </Notice>
              ))}
              {blockers.length > 0 && (
                <Notice tone="danger" title={t("tx.blocked")}>
                  <ul className="list-inside list-disc space-y-0.5">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {ack && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-sunken p-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={acked}
                    onChange={(e) => setAcked(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-emerald-500"
                  />
                  <span>{ack}</span>
                </label>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="secondary" className="sm:flex-1" onClick={() => onOpenChange(false)}>
                  {t("common.cancel")}
                </Button>
                <Button className="sm:flex-[1.6]" disabled={!canConfirm} onClick={confirm}>
                  <ShieldCheck className="size-4" aria-hidden />
                  {confirmLabel}
                </Button>
              </div>
              <p className="text-center text-xs text-faint">{t("tx.devnetNotice")}</p>
            </div>
          )}

          {phase === "pending" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <LoaderCircle className="size-10 animate-spin text-brand-strong" aria-hidden />
              <p className="max-w-xs text-sm text-mute">{t("tx.waiting.body")}</p>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CircleCheck className="size-12 text-brand-strong" aria-hidden />
                <p className="text-sm text-ink">{successText ?? t("tx.done.body")}</p>
              </div>
              {signature && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sunken px-4 py-3">
                  <div>
                    <p className="text-xs text-faint">{t("tx.signature")}</p>
                    <ExplorerLink kind="tx" value={signature} />
                  </div>
                  <CopyButton value={signature} />
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" className="sm:flex-1" onClick={() => onOpenChange(false)}>
                  {t("common.close")}
                </Button>
                {nextAction && (
                  <Button
                    className="sm:flex-1"
                    onClick={() => {
                      onOpenChange(false);
                      nextAction.onClick();
                    }}
                  >
                    {nextAction.label}
                  </Button>
                )}
              </div>
            </div>
          )}

          {phase === "error" && error && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <CircleX
                  className={cx("size-12", error.cancelled ? "text-warn" : "text-danger")}
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-ink">{t(error.titleKey)}</p>
                  <p className="mt-1 text-sm text-mute">{t(error.bodyKey)}</p>
                </div>
              </div>
              <details className="group rounded-xl border border-line bg-sunken">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-mute">
                  {t("common.technicalDetails")}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words px-4 pb-3 font-mono text-[11px] text-faint">
                  {error.technical}
                </pre>
              </details>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="secondary" className="sm:flex-1" onClick={() => onOpenChange(false)}>
                  {t("common.close")}
                </Button>
                <Button className="sm:flex-1" onClick={() => setPhase("review")}>
                  {t("common.retry")}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsDesktop, useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { TextInput } from "./inputs";

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[70] bg-[rgb(20_19_17/0.38)] backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
    />
  );
}

interface LayerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function DrawerPanel({ onClose, title, description, children, footer, className }: Omit<LayerProps, "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const desktop = useIsDesktop();
  const reduced = useReduced();
  const controls = useDragControls();
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, true, onClose);

  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : desktop
      ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
      : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  return (
    <motion.div
      ref={ref}
      data-layer
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      tabIndex={-1}
      {...motionProps}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      drag={!desktop && !reduced ? "y" : false}
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 600) onClose();
      }}
      className={cn(
        "fixed z-[71] flex flex-col bg-surface outline-none",
        desktop
          ? "inset-y-3 right-3 w-[min(460px,calc(100vw-24px))] rounded-xl border border-[var(--card-border)] shadow-drawer"
          : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl border-t border-[var(--card-border)] shadow-drawer",
        className,
      )}
    >
      {!desktop && (
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
      )}
      <header className={cn("flex items-start justify-between gap-3 px-5", desktop ? "pt-5" : "pt-1")}>
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-2xl leading-tight">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-sm text-muted">
              {description}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mr-2 -mt-1">
          <X className="size-5" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
    </motion.div>
  );
}

/** Bottom sheet on mobile (drag down to dismiss), side sheet on desktop. */
export function Drawer({ open, ...props }: LayerProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop key="bd" onClick={props.onClose} />
          <DrawerPanel key="panel" {...props} />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DialogPanel({ onClose, title, description, children, footer, className }: Omit<LayerProps, "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, true, onClose);
  return (
    <div className="pointer-events-none fixed inset-0 z-[71] grid place-items-center p-4">
      <motion.div
        ref={ref}
        data-layer
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={cn("card pointer-events-auto w-full max-w-md p-6 shadow-drawer outline-none", className)}
      >
        <h2 id={titleId} className="font-display text-2xl leading-tight">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-sm text-muted">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function Dialog({ open, ...props }: LayerProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop key="bd" onClick={props.onClose} />
          <DialogPanel key="panel" {...props} />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirm a destructive action; optionally require typing a word (e.g. "RESET"). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  requireText,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  requireText?: string;
  tone?: "danger" | "solid";
}) {
  const [typed, setTyped] = useState("");
  const ok = !requireText || typed.trim() === requireText;
  const close = () => {
    setTyped("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={tone}
            disabled={!ok}
            data-autofocus={requireText ? undefined : true}
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireText && (
        <label className="block text-sm">
          Type <span className="money rounded bg-surface-2 px-1.5 py-0.5 font-semibold">{requireText}</span> to confirm
          <TextInput
            data-autofocus
            className="mt-2"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ok) {
                onConfirm();
                close();
              }
            }}
            autoComplete="off"
          />
        </label>
      )}
    </Dialog>
  );
}

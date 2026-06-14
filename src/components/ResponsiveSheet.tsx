/**
 * 響應式容器：桌面以置中 Modal 呈現；手機改為底部 Bottom Sheet。
 * 符合需求 6.3：桌面小浮層在手機放大為 Modal / Bottom Sheet。
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useIsMobile } from '@/app/useMediaQuery';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function ResponsiveSheet({ open, title, onClose, children }: Props) {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={
          isMobile
            ? 'w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-base-100 p-5 pb-8 shadow-xl outline-none'
            : 'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-base-100 p-6 shadow-xl outline-none'
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle touch-target"
            onClick={onClose}
            aria-label="關閉"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

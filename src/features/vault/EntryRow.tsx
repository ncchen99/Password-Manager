import { useState } from 'react';
import {
  ChevronRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import type { ServiceEntry } from '@/types/entry';

interface Props {
  entry: ServiceEntry;
  onOpen: (entry: ServiceEntry) => void;
}

export function EntryRow({ entry, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const primary = entry.credentials[0];
  const usernamePreview = primary?.username;

  async function copyPassword(e: React.MouseEvent) {
    e.stopPropagation();
    if (!primary?.password) return;
    await navigator.clipboard.writeText(primary.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    // 安全：30 秒後嘗試清空剪貼簿
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000);
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-base-200 touch-target"
      >
        <div
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary"
          aria-hidden
        >
          {entry.service.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{entry.service}</div>
          <div className="truncate text-sm text-base-content/60">
            {usernamePreview || '（無帳號）'}
            {entry.tags.length > 0 && (
              <span className="ml-2 text-xs text-base-content/40">
                {entry.tags.map((t) => `#${t}`).join(' ')}
              </span>
            )}
          </div>
        </div>

        {primary?.password && (
          <span
            role="button"
            tabIndex={0}
            onClick={copyPassword}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') copyPassword(e as never);
            }}
            className="btn btn-ghost btn-sm btn-circle touch-target"
            aria-label="複製密碼"
          >
            {copied ? (
              <CheckIcon className="h-5 w-5 text-success" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </span>
        )}
        <ChevronRightIcon className="h-5 w-5 flex-none text-base-content/30" />
      </button>
    </li>
  );
}

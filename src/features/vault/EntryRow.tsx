import { useState } from 'react';
import { ChevronRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { ServiceEntry } from '@/types/entry';
import { ServiceIcon } from '@/components/ServiceIcon';

interface Props {
  entry: ServiceEntry;
  onOpen: (entry: ServiceEntry) => void;
}

export function EntryRow({ entry, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const primary = entry.credentials[0];
  const usernamePreview = primary?.username;
  const hasPassword = Boolean(primary?.password);

  async function copyPassword() {
    if (!primary?.password) return;
    await navigator.clipboard.writeText(primary.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    // 安全：30 秒後嘗試清空剪貼簿
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000);
  }

  return (
    <li className="flex items-center transition-colors hover:bg-base-200">
      {/* 點整列 → 複製密碼 */}
      <button
        type="button"
        onClick={copyPassword}
        disabled={!hasPassword}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left touch-target disabled:cursor-default"
        aria-label={hasPassword ? `複製「${entry.service}」的密碼` : entry.service}
      >
        <ServiceIcon entry={entry} />

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{entry.service}</div>
          <div className="truncate text-sm text-base-content/60">
            {usernamePreview || '（無帳號）'}
          </div>
          <div className="truncate text-sm text-base-content/40">
            {hasPassword ? (
              copied ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckIcon className="h-4 w-4" />
                  已複製
                </span>
              ) : (
                <span className="tracking-widest">••••••••</span>
              )
            ) : (
              '（無密碼）'
            )}
          </div>
        </div>
      </button>

      {/* 點箭頭 → 檢視 / 編輯 */}
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="btn btn-ghost btn-square h-full px-3 touch-target"
        aria-label={`檢視 / 編輯「${entry.service}」`}
      >
        <ChevronRightIcon className="h-5 w-5 flex-none text-base-content/30" />
      </button>
    </li>
  );
}

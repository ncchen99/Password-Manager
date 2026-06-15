import { useState } from 'react';
import { EyeIcon, EyeSlashIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Credential, ServiceEntry } from '@/types/entry';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { newId } from '@/lib/id';

interface Props {
  open: boolean;
  initial?: ServiceEntry;
  onClose: () => void;
  onSave: (entry: ServiceEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function blankCredential(): Credential {
  return { id: newId(), username: '', password: '', note: '' };
}

export function EntryForm({ open, initial, onClose, onSave, onDelete }: Props) {
  const [service, setService] = useState(initial?.service ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [creds, setCreds] = useState<Credential[]>(
    initial?.credentials?.length ? initial.credentials : [blankCredential()],
  );
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  function updateCred(id: string, patch: Partial<Credential>) {
    setCreds((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service.trim() || busy) return;
    setBusy(true);
    const now = Date.now();
    const entry: ServiceEntry = {
      id: initial?.id ?? newId(),
      service: service.trim(),
      aliases: initial?.aliases ?? [],
      url: url.trim() || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      credentials: creds
        .map((c) => ({
          ...c,
          username: c.username?.trim() || undefined,
          password: c.password || undefined,
          note: c.note?.trim() || undefined,
        }))
        .filter((c) => c.username || c.password || c.note),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await onSave(entry);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      title={initial ? '編輯條目' : '新增條目'}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="form-control">
          <span className="label-text mb-1">服務名稱 *</span>
          <input
            className="input input-bordered touch-target"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="例如 Facebook"
            autoFocus
            required
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">網址</span>
          <input
            className="input input-bordered touch-target"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="facebook.com"
            inputMode="url"
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1">標籤（逗號分隔）</span>
          <input
            className="input input-bordered touch-target"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="社群, 個人"
          />
        </label>

        <div className="divider text-xs text-base-content/50">帳密</div>

        {creds.map((c, i) => (
          <div key={c.id} className="space-y-2 bg-base-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-base-content/60">
                帳密 {i + 1}
              </span>
              {creds.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    setCreds((cs) => cs.filter((x) => x.id !== c.id))
                  }
                  aria-label="移除這組帳密"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              className="input input-bordered input-sm w-full touch-target"
              value={c.username ?? ''}
              onChange={(e) => updateCred(c.id, { username: e.target.value })}
              placeholder="帳號 / username"
              autoComplete="off"
            />
            <div className="relative">
              <input
                className="input input-bordered input-sm w-full pr-10 touch-target"
                type={show[c.id] ? 'text' : 'password'}
                value={c.password ?? ''}
                onChange={(e) => updateCred(c.id, { password: e.target.value })}
                placeholder="密碼"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShow((s) => ({ ...s, [c.id]: !s[c.id] }))}
                aria-label={show[c.id] ? '隱藏密碼' : '顯示密碼'}
              >
                {show[c.id] ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <input
              className="input input-bordered input-sm w-full touch-target"
              value={c.note ?? ''}
              onChange={(e) => updateCred(c.id, { note: e.target.value })}
              placeholder="備註"
            />
          </div>
        ))}

        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => setCreds((cs) => [...cs, blankCredential()])}
        >
          <PlusIcon className="h-4 w-4" />
          新增一組帳密
        </button>

        <button
          type="submit"
          className="btn btn-primary w-full touch-target"
          disabled={!service.trim() || busy}
        >
          {busy ? <span className="loading loading-spinner" /> : '儲存'}
        </button>

        {initial && onDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full text-error"
            onClick={async () => {
              if (confirm(`確定要刪除「${initial.service}」？此動作無法復原。`)) {
                await onDelete(initial.id);
                onClose();
              }
            }}
          >
            <TrashIcon className="h-4 w-4" />
            刪除此條目
          </button>
        )}
      </form>
    </ResponsiveSheet>
  );
}

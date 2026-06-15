import { useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Credential, CustomField, ServiceEntry } from '@/types/entry';
import { ResponsiveSheet } from '@/components/ResponsiveSheet';
import { canonicalServiceName } from '@/icons/match';
import { newId } from '@/lib/id';

interface Props {
  open: boolean;
  initial?: ServiceEntry;
  onClose: () => void;
  onSave: (entry: ServiceEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function blankCredential(): Credential {
  return { id: newId(), username: '', password: '', note: '', fields: [] };
}

export function EntryForm({ open, initial, onClose, onSave, onDelete }: Props) {
  const [service, setService] = useState(initial?.service ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [creds, setCreds] = useState<Credential[]>(
    initial?.credentials?.length
      ? initial.credentials.map((c) => ({ ...c, fields: c.fields ?? [] }))
      : [blankCredential()],
  );
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (initial?.credentials ?? []).map((c) => [c.id, Boolean(c.note)]),
    ),
  );
  const [advOpen, setAdvOpen] = useState(Boolean(initial?.url || initial?.tags?.length));
  const [busy, setBusy] = useState(false);

  function updateCred(id: string, patch: Partial<Credential>) {
    setCreds((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function updateField(credId: string, fieldId: string, patch: Partial<CustomField>) {
    setCreds((cs) =>
      cs.map((c) =>
        c.id === credId
          ? {
              ...c,
              fields: (c.fields ?? []).map((f) =>
                f.id === fieldId ? { ...f, ...patch } : f,
              ),
            }
          : c,
      ),
    );
  }

  function addField(credId: string) {
    setCreds((cs) =>
      cs.map((c) =>
        c.id === credId
          ? { ...c, fields: [...(c.fields ?? []), { id: newId(), label: '', value: '' }] }
          : c,
      ),
    );
  }

  function removeField(credId: string, fieldId: string) {
    setCreds((cs) =>
      cs.map((c) =>
        c.id === credId
          ? { ...c, fields: (c.fields ?? []).filter((f) => f.id !== fieldId) }
          : c,
      ),
    );
  }

  /** 服務名正規化：FB / 臉書 → Facebook（失焦時套用）。 */
  function normalizeService() {
    const canon = canonicalServiceName(service);
    if (canon && canon.name !== service.trim()) setService(canon.name);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service.trim() || busy) return;
    setBusy(true);
    const now = Date.now();

    // 服務名正規化 + 保留原輸入為別名（搜尋仍找得到）
    const raw = service.trim();
    const canon = canonicalServiceName(raw);
    const name = canon?.name ?? raw;
    const aliases = [...(initial?.aliases ?? [])];
    if (canon && canon.name !== raw && !aliases.includes(raw)) aliases.push(raw);

    const entry: ServiceEntry = {
      id: initial?.id ?? newId(),
      service: name,
      aliases,
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
          fields: (c.fields ?? [])
            .map((f) => ({ ...f, label: f.label.trim(), value: f.value.trim() }))
            .filter((f) => f.label || f.value),
        }))
        .map((c) => ({ ...c, fields: c.fields.length ? c.fields : undefined }))
        .filter((c) => c.username || c.password || c.note || c.fields?.length),
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

  const saveButton = (
    <button
      type="submit"
      form="entry-form"
      className="btn btn-primary btn-sm gap-1 touch-target"
      disabled={!service.trim() || busy}
    >
      {busy ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        <>
          <CheckIcon className="h-5 w-5" />
          儲存
        </>
      )}
    </button>
  );

  return (
    <ResponsiveSheet
      open={open}
      title={initial ? '編輯條目' : '新增條目'}
      onClose={onClose}
      headerAction={saveButton}
    >
      <form id="entry-form" onSubmit={onSubmit} className="space-y-4">
        <label className="form-control">
          <span className="label-text mb-1">服務名稱 *</span>
          <input
            className="input input-bordered touch-target"
            value={service}
            onChange={(e) => setService(e.target.value)}
            onBlur={normalizeService}
            placeholder="例如 Facebook（可輸入 FB、臉書）"
            autoFocus
            required
          />
        </label>

        {creds.map((c, i) => (
          <div key={c.id} className="space-y-2 bg-base-200 p-3">
            {creds.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-base-content/60">
                  帳密 {i + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setCreds((cs) => cs.filter((x) => x.id !== c.id))}
                  aria-label="移除這組帳密"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            <input
              className="input input-bordered input-sm w-full touch-target"
              value={c.username ?? ''}
              onChange={(e) => updateCred(c.id, { username: e.target.value })}
              placeholder="帳號（ID / Email / 電話皆可）"
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

            {/* 自訂欄位：理財密碼 / 卡片密碼 / 電話 / 代號… */}
            {(c.fields ?? []).map((f) => {
              const fkey = `${c.id}:${f.id}`;
              return (
                <div key={f.id} className="flex items-center gap-1.5">
                  <input
                    className="input input-bordered input-sm w-28 flex-none touch-target"
                    value={f.label}
                    onChange={(e) => updateField(c.id, f.id, { label: e.target.value })}
                    placeholder="標籤"
                    autoComplete="off"
                  />
                  <div className="relative flex-1">
                    <input
                      className="input input-bordered input-sm w-full pr-8 touch-target"
                      type={f.secret && !show[fkey] ? 'password' : 'text'}
                      value={f.value}
                      onChange={(e) => updateField(c.id, f.id, { value: e.target.value })}
                      placeholder="值"
                      autoComplete="off"
                    />
                    {f.secret && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle absolute right-0.5 top-1/2 -translate-y-1/2"
                        onClick={() => setShow((s) => ({ ...s, [fkey]: !s[fkey] }))}
                        aria-label={show[fkey] ? '隱藏' : '顯示'}
                      >
                        {show[fkey] ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-xs btn-square touch-target ${
                      f.secret ? 'text-primary' : 'text-base-content/40'
                    }`}
                    onClick={() => updateField(c.id, f.id, { secret: !f.secret })}
                    aria-label={f.secret ? '取消機密' : '標記為機密'}
                    title={f.secret ? '機密（遮蔽）' : '一般'}
                  >
                    {f.secret ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square touch-target"
                    onClick={() => removeField(c.id, f.id)}
                    aria-label="移除此欄位"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => addField(c.id)}
              >
                <PlusIcon className="h-4 w-4" />
                自訂欄位
              </button>
              {!noteOpen[c.id] && !c.note && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setNoteOpen((s) => ({ ...s, [c.id]: true }))}
                >
                  <PlusIcon className="h-4 w-4" />
                  備註
                </button>
              )}
            </div>

            {(noteOpen[c.id] || c.note) && (
              <textarea
                className="textarea textarea-bordered w-full text-sm touch-target"
                rows={2}
                value={c.note ?? ''}
                onChange={(e) => updateCred(c.id, { note: e.target.value })}
                placeholder="備註（可放較長的復原碼等）"
              />
            )}
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

        {/* 進階：網址、標籤（預設收合） */}
        <div className="border-t border-base-300 pt-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-between"
            onClick={() => setAdvOpen((v) => !v)}
            aria-expanded={advOpen}
          >
            <span>進階（網址、標籤）</span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${advOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advOpen && (
            <div className="space-y-3 pt-2">
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
            </div>
          )}
        </div>

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

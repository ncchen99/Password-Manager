/**
 * 服務頭像：方形灰階格子內，依序嘗試
 *   品牌 icon（simple-icons 精選）→ 分類字形 → 服務名前兩字。
 * 全程本機，永不連網。單色以 currentColor 上色，契合灰階介面。
 */
import { useMemo } from 'react';
import type { ServiceEntry } from '@/types/entry';
import { matchBrandSlug, matchConcept, BY_SLUG } from '@/icons/match';
import { CONCEPT_GLYPHS } from '@/icons/glyphs';

interface Props {
  entry: ServiceEntry;
  /** 方格邊長（Tailwind 尺寸 class 由父層控制時可忽略） */
  className?: string;
}

export function ServiceIcon({ entry, className = 'h-10 w-10' }: Props) {
  const resolved = useMemo(() => {
    const slug = matchBrandSlug(entry);
    if (slug) {
      const brand = BY_SLUG.get(slug);
      if (brand) return { kind: 'brand' as const, brand };
    }
    const concept = matchConcept(entry);
    if (concept && CONCEPT_GLYPHS[concept]) {
      return { kind: 'glyph' as const, Glyph: CONCEPT_GLYPHS[concept] };
    }
    return { kind: 'letters' as const };
  }, [entry]);

  return (
    <div
      className={`flex flex-none items-center justify-center bg-base-300 text-base-content/70 ${className}`}
      aria-hidden
    >
      {resolved.kind === 'brand' && (
        <svg
          viewBox="0 0 24 24"
          className="h-1/2 w-1/2"
          fill="currentColor"
          role="img"
          aria-label={resolved.brand.title}
        >
          <path d={resolved.brand.path} />
        </svg>
      )}
      {resolved.kind === 'glyph' && <resolved.Glyph className="h-1/2 w-1/2" />}
      {resolved.kind === 'letters' && (
        <span className="text-sm font-semibold uppercase">
          {entry.service.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import { searchEntries } from './searchEntries';
import type { ServiceEntry } from '@/types/entry';

function fb(): ServiceEntry {
  return {
    id: 'fb',
    service: 'Facebook',
    aliases: [],
    url: 'facebook.com',
    tags: [],
    credentials: [{ id: 'c', username: 'me@x.com' }],
    createdAt: 0,
    updatedAt: 0,
  };
}

function gh(): ServiceEntry {
  return {
    id: 'gh',
    service: 'GitHub',
    aliases: [],
    url: 'github.com',
    tags: ['工作'],
    credentials: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('別名 + 模糊搜尋', () => {
  const entries = [fb(), gh()];

  it.each(['臉書', 'FB', 'Facebook', 'facebok'])(
    '用「%s」能找到 Facebook',
    (q) => {
      const hits = searchEntries(q, entries);
      expect(hits[0]?.entry.id).toBe('fb');
    },
  );

  it('空字串回傳全部', () => {
    expect(searchEntries('', entries)).toHaveLength(2);
  });

  it('用標籤可搜尋', () => {
    const hits = searchEntries('工作', entries);
    expect(hits[0]?.entry.id).toBe('gh');
  });
});

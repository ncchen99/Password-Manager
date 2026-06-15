import { describe, expect, it } from 'vitest';
import { conceptsOf, semanticScore } from './semantic';
import { searchEntries } from './searchEntries';
import type { ServiceEntry } from '@/types/entry';

function entry(id: string, service: string, url?: string): ServiceEntry {
  return {
    id,
    service,
    aliases: [],
    url,
    tags: [],
    credentials: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('語意概念字典', () => {
  it('跨語近義對應到同一概念（網銀 / online banking / bank）', () => {
    expect(conceptsOf('網銀').has('banking')).toBe(true);
    expect(conceptsOf('Online Banking').has('banking')).toBe(true);
    expect(conceptsOf('bank').has('banking')).toBe(true);
  });

  it('無關詞不會誤判概念', () => {
    expect(conceptsOf('zxcv').size).toBe(0);
  });

  it('概念有交集才給分', () => {
    expect(semanticScore(new Set(['banking']), new Set(['banking']))).toBeGreaterThan(0);
    expect(semanticScore(new Set(['banking']), new Set(['social']))).toBe(0);
    expect(semanticScore(new Set(), new Set(['banking']))).toBe(0);
  });
});

describe('語意搜尋融合（lexical 失敗時補救）', () => {
  const entries = [
    entry('bank', 'Online Banking', 'mybank.example.com'),
    entry('fb', 'Facebook', 'facebook.com'),
  ];

  it('「網銀」能找到 Online Banking（純 lexical 找不到）', () => {
    const hits = searchEntries('網銀', entries);
    expect(hits.some((h) => h.entry.id === 'bank')).toBe(true);
    expect(hits.find((h) => h.entry.id === 'fb')).toBeUndefined();
  });

  it('精確命中仍排在語意近義之前', () => {
    const hits = searchEntries('facebook', [
      entry('bank', 'Online Banking'),
      entry('fb', 'Facebook'),
    ]);
    expect(hits[0]?.entry.id).toBe('fb');
  });
});

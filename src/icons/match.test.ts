import { describe, it, expect } from 'vitest';
import type { ServiceEntry } from '@/types/entry';
import { matchBrandSlug, matchConcept, canonicalServiceName } from './match';

function entry(partial: Partial<ServiceEntry>): ServiceEntry {
  return {
    id: 'x',
    service: '',
    aliases: [],
    tags: [],
    credentials: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('matchBrandSlug', () => {
  it('比對服務名（ascii）', () => {
    expect(matchBrandSlug(entry({ service: 'Facebook' }))).toBe('facebook');
    expect(matchBrandSlug(entry({ service: 'GitHub' }))).toBe('github');
    expect(matchBrandSlug(entry({ service: 'Spotify' }))).toBe('spotify');
  });

  it('比對網域', () => {
    expect(
      matchBrandSlug(entry({ service: '我的頁面', url: 'https://www.facebook.com/me' })),
    ).toBe('facebook');
    // 網域與 slug 不一致者由別名表補上
    expect(matchBrandSlug(entry({ service: '訂房', url: 'booking.com' }))).toBe(
      'bookingdotcom',
    );
  });

  it('比對中文別名 / 縮寫', () => {
    expect(matchBrandSlug(entry({ service: '臉書' }))).toBe('facebook');
    expect(matchBrandSlug(entry({ service: 'LINE' }))).toBe('line');
    expect(matchBrandSlug(entry({ service: '蝦皮購物' }))).toBe('shopee');
  });

  it('找不到品牌時回傳 null', () => {
    expect(matchBrandSlug(entry({ service: '某不知名服務 zxcv' }))).toBeNull();
  });
});

describe('matchConcept（分類字形後援）', () => {
  it('中文網銀 → banking（概念字典）', () => {
    expect(matchConcept(entry({ service: '玉山網銀' }))).toBe('banking');
    expect(matchConcept(entry({ service: '中華郵政存簿' }))).toBe('banking');
  });

  it('英文短名銀行 → banking（在地關鍵字）', () => {
    expect(matchConcept(entry({ service: 'CTBC Bank' }))).toBe('banking');
    expect(matchConcept(entry({ service: 'E.SUN' }))).toBe('banking');
  });

  it('完全無關 → null', () => {
    expect(matchConcept(entry({ service: 'zxcvqwer' }))).toBeNull();
  });
});

describe('canonicalServiceName（服務名正規化）', () => {
  it('縮寫 / 中文 / 官方名 → 官方品牌名', () => {
    expect(canonicalServiceName('FB')?.name).toBe('Facebook');
    expect(canonicalServiceName('臉書')?.name).toBe('Facebook');
    expect(canonicalServiceName('facebook')?.name).toBe('Facebook');
  });

  it('未知服務 → null（保留使用者原輸入）', () => {
    expect(canonicalServiceName('我的私人筆記XYZ')).toBeNull();
    expect(canonicalServiceName('')).toBeNull();
  });
});

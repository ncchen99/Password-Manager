import { describe, expect, it } from 'vitest';
import { parseImport, candidateToEntry } from './pipeline';
import type { ServiceEntry } from '@/types/entry';

describe('智慧匯入管線', () => {
  it('解析單筆 label:value 格式', () => {
    const text = [
      'Facebook',
      '帳號: me@example.com',
      '密碼: Sup3rS3cret!99',
      'https://facebook.com',
    ].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.service).toBe('Facebook');
    expect(c.fields.username).toBe('me@example.com');
    expect(c.fields.password).toBe('Sup3rS3cret!99');
    expect(c.fields.url).toBe('https://facebook.com');
    expect(c.needsReview).toBe(false);
  });

  it('空行分隔 → 多筆候選', () => {
    const text = [
      'Gmail',
      'user: alice@gmail.com',
      'pass: hunter2Goose!',
      '',
      'GitHub',
      'username: octocat',
      'password: P@ssw0rd-xyz',
    ].join('\n');
    const cands = parseImport(text);
    expect(cands).toHaveLength(2);
    expect(cands[0].fields.service).toBe('Gmail');
    expect(cands[1].fields.service).toBe('GitHub');
    expect(cands[1].fields.username).toBe('octocat');
  });

  it('分隔線 --- 切分多筆', () => {
    const text = [
      'Netflix / netflix.com',
      'kid@home.tv',
      'Watch!ng2024',
      '---',
      'Spotify',
      'me@home.tv',
      'Mus1c-stream$',
    ].join('\n');
    const cands = parseImport(text);
    expect(cands.length).toBe(2);
    expect(cands[0].fields.service?.toLowerCase()).toContain('netflix');
  });

  it('英文標籤與無標籤 email/url 自動歸位', () => {
    const text = [
      'Twitter',
      'bird@x.com',
      'Tw33t-machine!',
      'x.com',
    ].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.username).toBe('bird@x.com');
    expect(c.fields.password).toBe('Tw33t-machine!');
    expect(c.fields.url).toBe('https://x.com');
  });

  it('解析 otpauth:// 為 OTP', () => {
    const text = [
      'AWS',
      'root@corp.com',
      'L0ng-Random-Pw!!',
      'otpauth://totp/AWS:root@corp.com?secret=JBSWY3DPEHPK3PXP&issuer=AWS',
    ].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.otp).toContain('otpauth://');
  });

  it('缺密碼 → needsReview', () => {
    const text = ['SomeApp', 'user: john'].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.password).toBeUndefined();
    expect(c.needsReview).toBe(true);
  });

  it('由網域推導 service 名稱', () => {
    const text = ['https://dropbox.com', 'me@mail.com', 'Drop-the-b0x!'].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.service).toBe('Dropbox');
  });

  it('偵測與既有條目重複', () => {
    const existing: ServiceEntry[] = [
      {
        id: '1',
        service: 'Facebook',
        aliases: ['fb', '臉書'],
        tags: [],
        credentials: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ];
    const text = ['臉書', 'a@b.com', 'Reuse-pw-123!'].join('\n');
    const [c] = parseImport(text, existing);
    // service '臉書' 命中既有別名
    expect(c.duplicateOf).toBe('Facebook');
    expect(c.needsReview).toBe(true);
  });

  it('空輸入回傳空陣列', () => {
    expect(parseImport('')).toEqual([]);
    expect(parseImport('   \n\n  ')).toEqual([]);
  });

  it('candidateToEntry 產出合法 ServiceEntry', () => {
    const [c] = parseImport(['GitHub', 'octocat', 'C0de-rev1ew!'].join('\n'));
    const entry = candidateToEntry(c);
    expect(entry.service).toBe('GitHub');
    expect(entry.credentials).toHaveLength(1);
    expect(entry.credentials[0].password).toBe('C0de-rev1ew!');
    expect(entry.id).toBeTruthy();
  });
});

describe('彈性自訂欄位解析（真實雜亂資料）', () => {
  it('跨行標籤配對：標籤獨佔一行、值在下一行', () => {
    const text = [
      '台新證券',
      '密碼',
      'Gfu4394Xk',
      '電話下單密碼',
      '5493288',
      '卡片密碼',
      '3668263',
    ].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.password).toBe('Gfu4394Xk');
    const f = c.fields.fields ?? [];
    const phoneOrder = f.find((x) => x.label === '電話下單密碼');
    expect(phoneOrder?.value).toBe('5493288');
    expect(phoneOrder?.secret).toBe(true); // 含「密碼」→ 預設遮蔽
    expect(f.find((x) => x.label === '卡片密碼')?.value).toBe('3668263');
  });

  it('電話另存為「電話」欄位，標籤＋空白＋值（理財密碼）', () => {
    const text = ['Richart', 'nc@gmail.com', '0994394305', '理財密碼 14242'].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.username).toBe('nc@gmail.com');
    const f = c.fields.fields ?? [];
    expect(f.find((x) => x.label === '電話')?.value).toBe('0994394305');
    const wealth = f.find((x) => x.label === '理財密碼');
    expect(wealth?.value).toBe('14242');
    expect(wealth?.secret).toBe(true);
  });

  it('冒號分隔的未知標籤 → 自訂欄位', () => {
    const text = ['LINE商家', 'bussniss ID: Tuckin', 'aZq6@jerfNQaMZWv'].join('\n');
    const [c] = parseImport(text);
    expect(c.fields.fields?.find((x) => x.label === 'bussniss ID')?.value).toBe('Tuckin');
    expect(c.fields.password).toBe('aZq6@jerfNQaMZWv');
  });

  it('candidateToEntry 映射自訂欄位並正規化服務名（FB → Facebook）', () => {
    const [c] = parseImport(['FB', 'me@x.com', 'Passw0rd-9xy', '理財密碼 1234'].join('\n'));
    const entry = candidateToEntry(c);
    expect(entry.service).toBe('Facebook');
    expect(entry.aliases).toContain('FB');
    expect(entry.credentials[0].fields?.some((x) => x.label === '理財密碼' && x.value === '1234')).toBe(true);
  });
});

/**
 * 有限狀態機式的單區塊解析：把一個區塊的行序列轉成候選欄位 + 各欄位信心。
 * 規則導向、可解釋（每個決定都記 reason）。純本機。
 *
 * 除固定 6 欄（service/username/password/url/otp/note）外，亦保留「標籤未命中
 * 字典」的雜項欄位為自訂 fields（理財密碼、卡片密碼、電話下單密碼、代號…），
 * 並支援「標籤獨佔一行、值在下一行」與「標籤＋空白＋值」兩種真實世界格式。
 */
import type { FieldKey, ImportCustomField, ImportFields } from '@/types/import';
import { splitLabeled, toLines } from './canonicalize';
import { labelToField } from './labels';
import { domainStem } from '@/search/normalize';
import {
  isBareTotpSecret,
  isEmail,
  isOtpAuth,
  isPhone,
  isUrl,
  passwordLikeness,
} from './tokens';

export interface ParsedBlock {
  fields: ImportFields;
  confidence: Partial<Record<FieldKey, number>>;
  reasons: Partial<Record<FieldKey, string>>;
}

interface Row {
  /** 由明確分隔符（冒號/Tab/破折號）切出的標籤，可信度高。 */
  label?: string;
  /** 由啟發式（單字標籤）切出的標籤，需通過 isLabelToken 把關。 */
  heuristicLabel?: string;
  value: string;
}

/** 自訂標籤欄位常見後綴／關鍵字（用於判斷「像不像欄位標籤」）。 */
const SECRET_LABEL_RE = /密碼|通行碼|碼$|pin|cvv|secret|key|token|otp|金鑰/i;
/** 單字（無內部空白）標籤的後綴啟發。 */
const LABEL_SUFFIX_RE = /(密碼|帳號|帳戶|代號|號碼|編號|序號|信箱|郵箱|電話|提款|卡號|金鑰)$/;

/** 這一整行（單一 token）讀起來像不像「欄位標籤」。 */
function isLabelToken(line: string): boolean {
  const t = line.trim();
  if (!t || /\s/.test(t) || t.length > 12) return false;
  if (labelToField(t)) return true;
  return LABEL_SUFFIX_RE.test(t);
}

/** 「標籤＋空白＋值」：第一個 token 像標籤才切。否則回 null。 */
function leadingLabel(line: string): { label: string; value: string } | null {
  const m = line.trim().match(/^(\S{1,12})\s+(.+)$/);
  if (!m) return null;
  const [, head, rest] = m;
  if (isLabelToken(head)) return { label: head, value: rest.trim() };
  return null;
}

/** 自訂欄位是否預設遮蔽（密碼類）。 */
function isSecretField(label: string, value: string): boolean {
  if (SECRET_LABEL_RE.test(label)) return true;
  return passwordLikeness(value).score >= 0.5;
}

/** 把區塊行序列整理成 rows，處理三種標籤格式 + 跨行配對。 */
function toRows(lines: string[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 1) 明確分隔符（冒號/Tab/破折號）——高可信，直接信任標籤
    const sl = splitLabeled(line);
    if (sl.label) {
      rows.push({ label: sl.label, value: sl.value });
      continue;
    }
    // 2) 標籤＋空白＋值（如「理財密碼 14242」）——啟發式，需把關
    const lead = leadingLabel(line);
    if (lead) {
      rows.push({ heuristicLabel: lead.label, value: lead.value });
      continue;
    }
    // 3) 標籤獨佔一行、值在下一行（如「電話下單密碼」↵「5493288」）
    const next = lines[i + 1];
    if (isLabelToken(line) && next && !isLabelToken(next) && !splitLabeled(next).label) {
      rows.push({ heuristicLabel: line.trim(), value: next.trim() });
      i++;
      continue;
    }
    // 4) 純值行
    rows.push({ value: line.trim() });
  }
  return rows;
}

export function parseBlock(block: string): ParsedBlock {
  const lines = toLines(block);
  const rows = toRows(lines);
  const fields: ImportFields = {};
  const confidence: Partial<Record<FieldKey, number>> = {};
  const reasons: Partial<Record<FieldKey, string>> = {};
  const noteParts: string[] = [];
  const custom: ImportCustomField[] = [];

  const set = (key: FieldKey, value: string, conf: number, why: string) => {
    if (fields[key] !== undefined) return; // 先到先得（labeled 行通常在前）
    fields[key] = value;
    confidence[key] = conf;
    reasons[key] = why;
  };

  const addCustom = (label: string, value: string) => {
    if (!value.trim()) return;
    custom.push({ label: label.trim(), value: value.trim(), secret: isSecretField(label, value) });
  };

  // 第一遍：所有「有標籤」的 row。字典命中 → 固定欄；未命中 → 自訂欄位。
  for (const r of rows) {
    const label = r.label ?? r.heuristicLabel;
    if (label === undefined) continue;
    const field = labelToField(label);
    if (field) assignLabeled(field, r.value, set);
    else addCustom(label, r.value);
  }

  // 第二遍：無標籤 row 依內容型態判斷
  for (const r of rows) {
    if (r.label !== undefined || r.heuristicLabel !== undefined) continue;
    const v = r.value.trim();
    if (!v) continue;
    if (isOtpAuth(v)) {
      set('otp', v, 0.95, 'otpauth:// URI');
    } else if (isUrl(v)) {
      set('url', normalizeUrl(v), 0.8, '看起來是網址');
    } else if (isEmail(v)) {
      set('username', v, 0.72, 'email 格式');
    } else if (isBareTotpSecret(v)) {
      set('otp', v.replace(/\s/g, '').toUpperCase(), 0.6, 'base32 TOTP 種子');
    } else if (isPhone(v)) {
      addCustom('電話', v); // 電話另存為欄位，不再倒進備註
    } else {
      const pw = passwordLikeness(v);
      if (pw.score >= 0.5 && fields.password === undefined) {
        set('password', v, Math.min(0.85, 0.4 + pw.score * 0.5), pw.reasons.join('、'));
      } else if (fields.service === undefined && isServiceLike(v)) {
        set('service', v, 0.6, '首個非結構化短行，推測為服務名稱');
      } else {
        noteParts.push(v);
      }
    }
  }

  // 3) 補強：service 缺失 → 由網域推導
  if (fields.service === undefined && fields.url) {
    const stem = domainStem(fields.url);
    if (stem) {
      const titled = stem.charAt(0).toUpperCase() + stem.slice(1);
      set('service', titled, 0.5, '由網址網域推導');
    }
  }

  if (custom.length) fields.fields = custom;
  if (noteParts.length) {
    set('note', noteParts.join('\n'), 0.5, '未能歸類的剩餘文字');
  }

  return { fields, confidence, reasons };
}

/** 有標籤行：信任標籤，但用內容驗證並調整信心。 */
function assignLabeled(
  field: FieldKey,
  value: string,
  set: (k: FieldKey, v: string, c: number, w: string) => void,
) {
  switch (field) {
    case 'url':
      set('url', normalizeUrl(value), 0.92, '標籤指明網址');
      break;
    case 'otp':
      set('otp', isOtpAuth(value) ? value : value.replace(/\s/g, '').toUpperCase(), 0.9, '標籤指明 OTP');
      break;
    case 'password':
      set('password', value, 0.9, '標籤指明密碼');
      break;
    case 'username':
      set('username', value, isEmail(value) ? 0.95 : 0.88, '標籤指明帳號');
      break;
    case 'service':
      set('service', value, 0.9, '標籤指明服務名稱');
      break;
    case 'note':
      set('note', value, 0.85, '標籤指明備註');
      break;
  }
}

function normalizeUrl(v: string): string {
  const t = v.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** 服務名稱的弱啟發：不太長、不含明顯密碼符號雜訊。 */
function isServiceLike(v: string): boolean {
  if (v.length > 40) return false;
  // 純亂碼（高比例符號）不像服務名
  const symbolRatio = (v.match(/[^\w一-鿿\s.-]/g)?.length ?? 0) / v.length;
  return symbolRatio < 0.3;
}

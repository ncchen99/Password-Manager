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
const SECRET_LABEL_RE = /密碼|通行碼|碼$|pin|cvv|secret|key|token|otp|金鑰|recovery|備援|備用/i;
/** 單字（無內部空白）標籤的後綴啟發。 */
const LABEL_SUFFIX_RE = /(密碼|帳號|帳戶|代號|號碼|編號|序號|信箱|郵箱|電話|提款|卡號|金鑰)$/;
/** 多字（含空白）標籤的後綴啟發，如「postgres database password」「Recovery code」「github account」。 */
const PHRASE_LABEL_SUFFIX_RE = /(passwords?|passcode|passwd|pwd|account|login|secret|key|token|pin|codes?|recovery|備援碼?|備用碼?)$/i;
/** 標籤是否屬於「一個標籤、底下多個值」的清單型（如復原碼）。 */
const LIST_LABEL_RE = /(codes?|recovery|備援|備用)/i;

/** 去除標籤尾端的冒號（半形/全形），例如「PWD:」→「PWD」、「帳號：」→「帳號」。 */
function stripTrailingColon(s: string): string {
  return s.trim().replace(/[:：]\s*$/, '');
}

/** 這一整行（單一 token、無內部空白）讀起來像不像「欄位標籤」。允許尾端帶冒號（PWD:）。 */
function isLabelToken(line: string): boolean {
  const t = stripTrailingColon(line);
  if (!t || /\s/.test(t) || t.length > 12) return false;
  if (labelToField(t)) return true;
  return LABEL_SUFFIX_RE.test(t);
}

/** 含空白的「片語標籤」（如「Recovery code」「postgres database password」）。 */
function isPhraseLabel(line: string): boolean {
  const t = stripTrailingColon(line);
  if (!t || t.length > 40 || !/\s/.test(t)) return false;
  return PHRASE_LABEL_SUFFIX_RE.test(t) || LABEL_SUFFIX_RE.test(t);
}

/** 一整行是否為「純標籤行」（單字或片語），其值在後續行。 */
function isStandaloneLabel(line: string): boolean {
  return isLabelToken(line) || isPhraseLabel(line);
}

/** 這個值像不像「服務名稱標頭」：不是 email/url/電話/金鑰，且形似名稱。 */
function isServiceHeader(v: string): boolean {
  return (
    !isEmail(v) &&
    !isUrl(v) &&
    !isOtpAuth(v) &&
    !isPhone(v) &&
    !isBareTotpSecret(v) &&
    isServiceLike(v)
  );
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

/** 一行是否為「可作為某筆標籤之值」的純值行（非標籤、非 email/url/otp）。 */
function isPlainValueLine(line: string): boolean {
  if (isStandaloneLabel(line) || splitLabeled(line).label) return false;
  return !isEmail(line) && !isUrl(line) && !isOtpAuth(line);
}

/** 把區塊行序列整理成 rows，處理多種標籤格式 + 跨行配對。 */
export function toRows(lines: string[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 1) 明確分隔符（冒號/Tab/破折號）——高可信，直接信任標籤。
    //    例外：第一行的「未命中字典」標籤（如「valine : leanCloud」）不拆，
    //    整行留作服務名候選，避免服務名被當成自訂欄位而遺失。
    const sl = splitLabeled(line);
    if (sl.label && (labelToField(sl.label) || i > 0)) {
      rows.push({ label: sl.label, value: sl.value });
      continue;
    }

    // 第一行一律保留為純值行（服務名標頭），不做啟發式標籤切割。
    if (i > 0) {
      // 1b) 中文標籤緊貼值、無分隔符（如「代號f73244365」「密碼3245tfh69」）
      const glue = line.match(/^([一-鿿]{2,8})([A-Za-z0-9].*)$/);
      if (glue && isLabelToken(glue[1])) {
        rows.push({ heuristicLabel: glue[1], value: glue[2].trim() });
        continue;
      }
      // 2) 標籤＋空白＋值（如「理財密碼 14242」）——啟發式，需把關
      const lead = leadingLabel(line);
      if (lead) {
        rows.push({ heuristicLabel: lead.label, value: lead.value });
        continue;
      }
      // 3) 標籤獨佔一行、值在後續行（如「電話下單密碼」↵「5493288」、「PWD:」↵「值」、
      //    「Recovery code:」↵多行復原碼）。清單型標籤可收集多個值合併為一欄。
      if (isStandaloneLabel(line)) {
        const lbl = stripTrailingColon(line);
        const listMode = LIST_LABEL_RE.test(lbl);
        const vals: string[] = [];
        let j = i + 1;
        while (j < lines.length && isPlainValueLine(lines[j])) {
          vals.push(lines[j].trim());
          j++;
          if (!listMode) break; // 非清單型只取下一行一個值
        }
        if (vals.length) {
          rows.push({ heuristicLabel: lbl, value: vals.join('\n') });
          i = j - 1;
          continue;
        }
      }
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

  // 第二遍：無標籤 row。先抽首行作服務名標頭，再依型態歸位 url/otp/email，
  // 最後把剩餘未分類值「依出現順序」補上 帳號 → 密碼（符合「服務名↵ID↵密碼」直覺）。
  const plain = rows
    .filter((r) => r.label === undefined && r.heuristicLabel === undefined)
    .map((r) => r.value.trim())
    .filter(Boolean);

  // 服務標頭：區塊首個純值行，且形似服務名 → service。
  // 若緊接著的行也是「含空白的片語」且形似服務名（如分類「太空中心」↵實際服務
  // 「Git server」），視為標頭延續一併併入，避免被誤判成帳號/密碼候選。
  let startIdx = 0;
  if (fields.service === undefined && plain.length && isServiceHeader(plain[0])) {
    const headerParts = [stripTrailingColon(plain[0])];
    startIdx = 1;
    while (
      startIdx < plain.length &&
      /\s/.test(plain[startIdx]) &&
      isServiceHeader(plain[startIdx])
    ) {
      headerParts.push(stripTrailingColon(plain[startIdx]));
      startIdx++;
    }
    set('service', headerParts.join(' '), 0.6, '區塊首（多）行，推測為服務名稱');
  }

  // 電話與其餘未分類值依「原始出現順序」放進同一個待處理佇列，避免電話
  // （另外彙整、稍後處理）插隊搶走本該依序歸位的帳號／密碼。
  const pending: { value: string; isPhone: boolean }[] = [];
  for (let k = startIdx; k < plain.length; k++) {
    const v = plain[k];
    if (isOtpAuth(v)) {
      set('otp', v, 0.95, 'otpauth:// URI');
    } else if (isUrl(v)) {
      set('url', normalizeUrl(v), 0.8, '看起來是網址');
    } else if (isEmail(v)) {
      if (fields.username === undefined) set('username', v, 0.72, 'email 格式');
      else noteParts.push(v);
    } else if (isBareTotpSecret(v)) {
      set('otp', v.replace(/\s/g, '').toUpperCase(), 0.6, 'base32 TOTP 種子');
    } else if (isPhone(v)) {
      pending.push({ value: v, isPhone: true });
    } else {
      pending.push({ value: v, isPhone: false });
    }
  }

  // 帳號已由 email 確定時，剩餘的「非電話」值不再依出現順序硬塞密碼欄——
  // 挑「最像密碼」的一個作為密碼，其餘進備註。避免「email↵帳號文字↵真正
  // 密碼」這種三行區塊把不像密碼的帳號文字誤填進密碼欄、真正的密碼卻被
  // 擠到備註。電話一律留給下方順序迴圈處理（電話絕不當密碼）。
  if (fields.username !== undefined && fields.password === undefined) {
    const plainPending = pending.filter((p) => !p.isPhone);
    if (plainPending.length > 1) {
      let best = plainPending[0];
      let bestScore = -1;
      for (const p of plainPending) {
        const s = passwordLikeness(p.value).score;
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
      set('password', best.value, Math.min(0.85, 0.4 + bestScore * 0.5), '剩餘值中最像密碼');
      for (const p of plainPending) {
        if (p !== best) noteParts.push(p.value);
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (!pending[i].isPhone) pending.splice(i, 1);
      }
    }
  }

  // 依原始順序處理剩餘佇列：電話尚無帳號 → 當作帳號，否則存為「電話」欄位
  // （電話絕不當密碼）；其餘未分類值：明顯像密碼者優先填密碼，否則依序補
  // 帳號 → 密碼 → 備註。
  for (const item of pending) {
    if (item.isPhone) {
      if (fields.username === undefined) set('username', item.value, 0.55, '電話號碼作為帳號');
      else addCustom('電話', item.value);
      continue;
    }
    const v = item.value;
    const pw = passwordLikeness(v);
    if (pw.score >= 0.6 && fields.password === undefined) {
      set('password', v, Math.min(0.85, 0.4 + pw.score * 0.5), pw.reasons.join('、'));
    } else if (fields.username === undefined) {
      set('username', v, 0.45, '依出現順序推測為帳號');
    } else if (fields.password === undefined) {
      set('password', v, 0.45, '依出現順序推測為密碼');
    } else {
      noteParts.push(v);
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
      set('service', stripTrailingColon(value), 0.9, '標籤指明服務名稱');
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

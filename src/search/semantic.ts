/**
 * 語意層（概念字典）—— 全程本機、零網路、即時、可離線。
 *
 * 設計取捨：本專案最高原則是「離線優先、輕量、隱私」，可搜尋內容多為短小的
 * 多語服務標籤（Facebook / 網銀 / Gmail）。在此情境下，引入數十 MB、需向第三方
 * CDN 下載權重的 transformer 模型並不划算，且與離線精神相違。改以「策展式多語
 * 概念字典」對查詢與條目做概念標註，再與既有 lexical 搜尋融合，即可達成
 * 「網銀 ≈ online banking」這類跨語近義匹配，且 0 網路、體積極小。
 *
 * 擴充點：若日後要加入真正的 on-device embedding，可實作 `SemanticBackend`
 * 並在 `searchEntries` 融合其分數；本字典則作為離線降級基準（degradation）。
 */
import { normalize } from './normalize';

/** 概念 → 多語近義詞（值會在載入時正規化：小寫、去空白、全形轉半形） */
const CONCEPT_TERMS: Record<string, string[]> = {
  banking: [
    '銀行', '網銀', '網路銀行', '行動銀行', 'online banking', 'bank', 'banking',
    '信用卡', 'credit card', '金融', '理財', '存款', 'atm', '轉帳',
  ],
  email: [
    '電子郵件', '電郵', '信箱', '郵件', '電子信箱', 'email', 'mail',
    'gmail', 'outlook', 'hotmail', 'yahoo mail', 'proton mail',
  ],
  social: [
    '社群', '社交', '臉書', 'facebook', 'instagram', 'threads', 'twitter',
    '推特', '微博', 'weibo', 'linkedin', 'tiktok', '抖音', 'mastodon',
  ],
  messaging: [
    '通訊', '聊天', '即時通', '訊息', 'line', '賴', 'telegram', 'whatsapp',
    'messenger', 'discord', 'slack', 'wechat', '微信', 'signal',
  ],
  shopping: [
    '購物', '網購', '電商', '商城', 'shopping', 'shop', 'amazon', '亞馬遜',
    'shopee', '蝦皮', 'ebay', 'pchome', 'momo', '露天', 'taobao', '淘寶',
  ],
  streaming: [
    '串流', '影音', '影集', '追劇', 'netflix', '網飛', 'youtube', 'disney+',
    'spotify', '音樂', 'kkbox', 'apple music', 'twitch', 'hbo',
  ],
  work: [
    '工作', '公司', '辦公', 'work', 'office', 'jira', 'notion', 'confluence',
    'trello', 'asana', 'zoom', 'teams', '會議',
  ],
  cloud: [
    '雲端', '雲端硬碟', '備份', 'cloud', 'drive', 'dropbox', 'google drive',
    'onedrive', 'icloud', 'box', 'mega',
  ],
  gaming: [
    '遊戲', '電玩', 'game', 'gaming', 'steam', 'epic', 'playstation', 'psn',
    'xbox', 'nintendo', 'switch', 'riot', 'genshin',
  ],
  travel: [
    '旅遊', '訂房', '機票', '訂票', 'travel', 'booking', 'airbnb', 'agoda',
    'expedia', 'uber', 'klook', 'kkday',
  ],
  developer: [
    '開發', '程式', 'developer', 'github', 'gitlab', 'bitbucket', 'npm',
    'aws', 'azure', 'gcp', 'vercel', 'netlify', 'cloudflare', 'docker',
  ],
};

/** 正規化後的概念詞表（建一次） */
const CONCEPTS: { id: string; terms: string[] }[] = Object.entries(
  CONCEPT_TERMS,
).map(([id, terms]) => ({ id, terms: terms.map(normalize) }));

/** 判斷一段（已正規化）文字是否命中某個概念詞 */
function termHit(text: string, term: string): boolean {
  if (!text || !term) return false;
  if (text === term) return true;
  // 概念詞出現在文字中（如 'onlinebanking' 含 'banking'）
  if (term.length >= 2 && text.includes(term)) return true;
  // 使用者輸入為概念詞的前綴/子字串（如 'bank' ⊂ 'banking'）
  if (text.length >= 3 && term.includes(text)) return true;
  return false;
}

/** 取一段文字所對應的概念集合 */
export function conceptsOf(text: string): Set<string> {
  const t = normalize(text);
  const out = new Set<string>();
  if (!t) return out;
  for (const c of CONCEPTS) {
    if (c.terms.some((term) => termHit(t, term))) out.add(c.id);
  }
  return out;
}

/** 取多段文字（如一筆條目的所有可比對欄位）的概念聯集 */
export function conceptsOfAll(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    for (const id of conceptsOf(text)) out.add(id);
  }
  return out;
}

/**
 * 語意分數（0~1）：查詢概念與條目概念有交集即給固定加權。
 * 刻意低於 lexical 完全命中（1.0）與子字串命中（≥0.85），
 * 讓精確命中仍排在語意近義之前，但語意命中能越過門檻被看見。
 */
export const SEMANTIC_SCORE = 0.7;

export function semanticScore(
  queryConcepts: Set<string>,
  entryConcepts: Set<string>,
): number {
  if (queryConcepts.size === 0 || entryConcepts.size === 0) return 0;
  for (const id of queryConcepts) {
    if (entryConcepts.has(id)) return SEMANTIC_SCORE;
  }
  return 0;
}

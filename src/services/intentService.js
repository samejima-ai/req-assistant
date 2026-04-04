/**
 * intentService
 *
 * 責務: ユーザー入力のインテントを事前分析し、チャットAPIへの精度向上コンテキストを生成する
 *
 * ARC原則:
 * - geminiService の前処理として独立したサービスに分離（SRP）
 * - 失敗時は null を返してフォールバック（チャットAPIは影響を受けない）
 * - 軽量モデル + minimal thinking でコスト・レイテンシを最小化
 *
 * 処理フロー:
 *   ユーザー入力 → analyzeIntent() → IntentResult | null
 *   IntentResult → buildEnrichedMessage() → 付与済みメッセージ文字列
 *
 * Input:  userMessage: string, history: Message[]
 * Output: IntentResult | null（失敗時はnull）
 */
import { MODELS, THINKING } from './geminiConfig.js';
import { callGenerateContent } from './geminiClient.js';
import { getPrompt } from '../prompts/index.js';
import { hasApiKey } from './configService.js';

// 曖昧度がこの値以上の場合、ノード生成より逆質問を優先するよう指示する
const AMBIGUITY_THRESHOLD = 0.7;

// ---------- public ----------

/**
 * ユーザー入力のインテントを軽量モデルで分析する
 *
 * @param {string} userMessage
 * @param {Array<{role: string, content: string}>} history
 * @returns {Promise<IntentResult | null>} 失敗時は null（フォールバック）
 *
 * @typedef {{
 *   operationIntent: 'ADD_FEATURE'|'MODIFY_NODE'|'DELETE_NODE'|'CHANGE_FLOW'|'CLARIFY'|'CONFIRM',
 *   domain: 'EC'|'SOCIAL'|'B2B_TOOL'|'IOT'|'HEALTHCARE'|'GENERAL',
 *   ambiguityScore: number,
 *   summary: string,
 *   keyEntities: string[]
 * }} IntentResult
 */
export async function analyzeIntent(userMessage, history) {
  if (!hasApiKey()) return null;

  try {
    const systemPrompt = getPrompt('intent');
    const contents = buildIntentContents(history, userMessage);

    const { text } = await callGenerateContent({
      modelId: MODELS.intent,
      thinkingLevel: THINKING.intent,
      contents,
      systemPrompt,
      generationConfig: { responseMimeType: 'application/json' },
      timeoutMs: 10000,
    });

    return parseIntentResponse(text);
  } catch {
    // インテント分析の失敗はチャット本体に影響させない
    return null;
  }
}

/**
 * インテント分析結果をユーザーメッセージの前置きとして付与する
 *
 * @param {string} userMessage 元のユーザーメッセージ
 * @param {IntentResult} intent analyzeIntent() の戻り値
 * @returns {string} インテントコンテキストを付与したメッセージ
 */
export function buildEnrichedMessage(userMessage, intent) {
  const lines = [
    `[Intent: ${intent.operationIntent}]`,
    `[Domain: ${intent.domain}]`,
    `[Ambiguity: ${intent.ambiguityScore.toFixed(2)}]`,
    `[Summary: ${intent.summary}]`,
  ];

  if (intent.keyEntities?.length > 0) {
    lines.push(`[KeyEntities: ${intent.keyEntities.join(', ')}]`);
  }

  if (intent.ambiguityScore >= AMBIGUITY_THRESHOLD) {
    lines.push('[Instruction: ユーザーの意図が曖昧です。ノード生成より逆質問を優先してください]');
  }

  lines.push('', '---', '', userMessage);
  return lines.join('\n');
}

// ---------- private ----------

/**
 * インテント分析用のcontents配列を構築する
 * 直近の会話履歴（最大5ターン）をコンテキストとして付与する
 */
function buildIntentContents(history, userMessage) {
  // 直近5ターンのみ使用（インテント判定には最小限の文脈で十分）
  const recentHistory = history.slice(-5);

  return [
    ...recentHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
}

/**
 * インテント分析APIのレスポンスをパースする
 * @param {string} text
 * @returns {IntentResult}
 * @throws {Error} パース失敗時
 */
function parseIntentResponse(text) {
  // 1st try: そのままJSONパース
  try {
    return validateIntent(JSON.parse(text));
  } catch (_) { /* fall through */ }

  // 2nd try: Markdownコードブロック除去
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return validateIntent(JSON.parse(stripped));
  } catch (_) { /* fall through */ }

  throw new Error(`INTENT_PARSE_ERROR: ${text.slice(0, 100)}`);
}

/**
 * パース済みオブジェクトを安全なIntentResultに変換する
 * 不正な値はデフォルト値にフォールバックする
 */
function validateIntent(parsed) {
  const VALID_INTENTS = ['ADD_FEATURE', 'MODIFY_NODE', 'DELETE_NODE', 'CHANGE_FLOW', 'CLARIFY', 'CONFIRM'];
  const VALID_DOMAINS = ['EC', 'SOCIAL', 'B2B_TOOL', 'IOT', 'HEALTHCARE', 'GENERAL'];

  return {
    operationIntent: VALID_INTENTS.includes(parsed.operationIntent) ? parsed.operationIntent : 'CLARIFY',
    domain: VALID_DOMAINS.includes(parsed.domain) ? parsed.domain : 'GENERAL',
    ambiguityScore: typeof parsed.ambiguityScore === 'number'
      ? Math.max(0, Math.min(1, parsed.ambiguityScore))
      : 0.5,
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 40) : '',
    keyEntities: Array.isArray(parsed.keyEntities)
      ? parsed.keyEntities.filter(e => typeof e === 'string').slice(0, 10)
      : [],
  };
}

/**
 * intentService
 *
 * 責務: ユーザー入力のインテントを事前分析し、チャットAPIへの精度向上コンテキストを生成する
 */
import { PHASES } from './llmConfig.js';
import { callLLM } from './llmService.js';
import { getPrompt } from '../prompts/index.js';
import { hasApiKey } from './configService.js';

// 曖昧度がこの値以上の場合、ノード生成より逆質問を優先するよう指示する
const AMBIGUITY_THRESHOLD = 0.7;

// ---------- public ----------

/**
 * ユーザー入力のインテント分析を行う
 *
 * @param {string} userMessage
 * @param {Array<{role: string, content: string}>} history
 * @returns {Promise<import('./llmConfig.js').IntentResult | null>} 失敗時は null（フォールバック）
 */
export async function analyzeIntent(userMessage, history) {
  // いずれかのキーがあれば試行する (llmService側で詳細チェック)
  if (!hasApiKey('google') && !hasApiKey('openai') && !hasApiKey('anthropic')) return null;

  try {
    const systemPrompt = getPrompt('intent');
    
    // 直近5ターンのみ使用（インテント判定には最小限の文脈で十分）
    const recentHistory = history.slice(-5);

    const result = await callLLM({
      phaseId: PHASES.INTENT.id,
      history: recentHistory,
      userMessage,
      systemPrompt,
      options: { 
        responseFormat: { type: 'json_object' }
      }
    });

    if (!result.ok) throw new Error(result.message);

    return parseIntentResponse(result.value);
  } catch (e) {
    console.error('[intentService] Intent analysis failed:', e);
    return null;
  }
}

/**
 * インテント分析結果をユーザーメッセージの前置きとして付与する
 *
 * @param {string} userMessage 元のユーザーメッセージ
 * @param {import('./llmConfig.js').IntentResult} intent analyzeIntent() の戻り値
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
 * インテント分析APIのレスポンスをパースする
 */
function parseIntentResponse(text) {
  // 1st try: そのままJSONパース
  try {
    return validateIntent(JSON.parse(text));
  } catch { /* fall through */ }

  // 2nd try: Markdownコードブロック除去
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*$/, '').trim();
  try {
    return validateIntent(JSON.parse(stripped));
  } catch { /* fall through */ }

  throw new Error(`INTENT_PARSE_ERROR: ${text.slice(0, 100)}`);
}

/**
 * パース済みオブジェクトを安全な形式に変換する
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

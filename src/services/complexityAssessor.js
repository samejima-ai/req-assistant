/**
 * complexityAssessor
 *
 * 責務: reviewService が使用するモデルTierを決定するA+Bハイブリッド複雑性判定
 *
 * A: ルールベーススコア（同期・APIコストゼロ）
 *   ノード数・エッジ数・孤立ノード数・会話ターン数から数値スコアを算出
 *
 * B: 軽量モデルによる意味的判定（非同期・Flash-Lite 1呼び出し）
 *   Aで「曖昧ゾーン」と判定された場合のみ実行
 *   エラー時はTier3側にフォールバック（安全策）
 *
 * 判定結果:
 *   'simple'  → reviewLight モデル (Tier2: gemini-3-flash-preview)
 *   'complex' → reviewHeavy モデル (Tier3: gemini-3.1-pro-preview)
 */

import { MODELS, THINKING, COMPLEXITY_THRESHOLDS } from './geminiConfig.js';
import { callGenerateContent } from './geminiClient.js';

/**
 * A: ルールベーススコアを計算する（同期・コストゼロ）
 *
 * スコア計算式:
 *   ノード数 × 1.0 + エッジ数 × 0.5 + 孤立ノード数 × 2.0 + 会話ターン数 × 0.1
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @param {Array} messages
 * @returns {number}
 */
function calcComplexityScore(nodes, edges, messages) {
  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]));
  const isolatedCount = nodes.filter(n => !connectedIds.has(n.id)).length;

  return (
    nodes.length    * 1.0 +
    edges.length    * 0.5 +
    isolatedCount   * 2.0 +
    messages.length * 0.1
  );
}

/**
 * B: 軽量モデルによる意味的複雑性判定（非同期）
 * Aのスコアが曖昧ゾーン（simple閾値〜complex閾値）の場合のみ呼び出される
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @param {Array} messages
 * @returns {Promise<'simple'|'complex'>}
 */
async function semanticComplexityCheck(nodes, edges, messages) {
  const nodeTypes = [...new Set(nodes.map(n => n.type ?? n.data?.type ?? '不明'))].join(', ');

  const { text } = await callGenerateContent({
    modelId: MODELS.chat,           // Flash-Lite（最安値モデル）
    thinkingLevel: THINKING.complexity,  // 'minimal'
    contents: [{
      role: 'user',
      parts: [{ text:
        `設計の複雑性を判定してください。\n` +
        `ノード数: ${nodes.length}、エッジ数: ${edges.length}\n` +
        `会話ターン数: ${messages.length}\n` +
        `ノード種別: ${nodeTypes}\n` +
        `"simple" または "complex" の1単語のみ返してください。`
      }]
    }],
    timeoutMs: 10000,
  });

  return text.trim().toLowerCase().includes('complex') ? 'complex' : 'simple';
}

/**
 * A+Bハイブリッド複雑性判定（公開API）
 *
 * @param {Array} nodes    - ReactFlow Node[]
 * @param {Array} edges    - ReactFlow Edge[]
 * @param {Array} messages - チャット履歴
 * @returns {Promise<'simple'|'complex'>}
 */
export async function assessComplexity(nodes, edges, messages) {
  const score = calcComplexityScore(nodes, edges, messages);

  if (score < COMPLEXITY_THRESHOLDS.simple)  return 'simple';
  if (score >= COMPLEXITY_THRESHOLDS.complex) return 'complex';

  // 曖昧ゾーン: B判定へ。エラー時はTier3に昇格（安全策）
  try {
    return await semanticComplexityCheck(nodes, edges, messages);
  } catch (e) {
    console.warn('[complexityAssessor] semantic check failed, escalating to complex:', e);
    return 'complex';
  }
}

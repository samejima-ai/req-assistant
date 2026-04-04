/**
 * reviewService
 *
 * 責務: SystemContextから整合性レビューレポート（Markdown）を生成する
 */
import { ok } from '../types/result.js';
import { PHASES } from './llmConfig.js';
import { callLLM } from './llmService.js';
import { getPrompt } from '../prompts/index.js';
import { hasApiKey } from './configService.js';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// ---------- public ----------

/**
 * SystemContextから整合性レビューレポートを生成する
 *
 * @param {import('../types/systemContext.js').SystemContext} systemContext
 * @returns {Promise<import('../types/result.js').Result<string>>}
 */
export async function generateReview(systemContext) {
  const { nodes, edges } = systemContext;

  if (!nodes || nodes.length === 0) {
    return ok(buildEmptyReport());
  }

  if (!hasApiKey('google') && !hasApiKey('openai') && !hasApiKey('anthropic')) {
    return ok(buildMockReport(nodes, edges));
  }

  const systemPrompt = getPrompt('review');
  const userMessage = buildExtractionPrompt(systemContext);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callLLM({
        phaseId: PHASES.REVIEW.id,
        userMessage,
        systemPrompt,
        options: { maxTokens: 3000 }
      });

      if (!result.ok) throw new Error(result.message);

      return ok(cleanMarkdown(result.value));
    } catch (e) {
      lastError = e;
      retries--;
      if (retries > 0) {
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  console.error('[reviewService] API failed, falling back to mock:', lastError);
  return ok(buildMockReport(nodes, edges));
}

// ---------- private ----------

function buildExtractionPrompt(systemContext) {
  const { messages, nodes, edges } = systemContext;

  const nodeList = nodes.map(n => {
    const type = n.type ?? n.data?.type ?? '不明';
    const label = n.data?.label ?? n.id;
    const desc = n.data?.description ?? '';
    return `- ${label}(${n.id}) [${type}]${desc ? ': ' + desc : ''}`;
  }).join('\n');

  const edgeList = edges.map(e => {
    const label = e.label ?? e.data?.label ?? e.type ?? '';
    return `- ${e.source} --[${label}]--> ${e.target}`;
  }).join('\n');

  const conversationText = messages
    .map(m => `[${m.role === 'user' ? 'ユーザー' : 'アシスタント'}]: ${m.content}`)
    .join('\n\n');

  return `以下の設計データを分析し、整合性レビューレポートを生成してください。

## ノード一覧（${nodes.length}件）
${nodeList || '（なし）'}

## エッジ一覧（${edges.length}件）
${edgeList || '（なし）'}

## 会話履歴
${conversationText || '（なし）'}`;
}

function cleanMarkdown(text) {
  return text
    .replace(/^```markdown\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * APIキー未設定時のモック
 */
function buildMockReport(nodes, edges) {
  const actorCount = nodes.filter(n => n.type === 'Actor' || n.data?.type === 'Actor').length;
  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]));
  const isolatedNodes = nodes.filter(n => !connectedIds.has(n.id));

  const issues = [];
  if (actorCount === 0) issues.push('- ❌ Actorノードが定義されていません');
  if (isolatedNodes.length > 0) {
    isolatedNodes.forEach(n => issues.push(`- ⚠️ 孤立ノード: ${n.data?.label ?? n.id}(${n.id})`));
  }

  return `# 整合性レビューレポート

## 総合判定
${issues.length === 0 ? '問題なし ✅' : '問題あり ⚠️'}

## 自動チェック結果
${issues.length > 0 ? issues.join('\n') : '- 問題なし ✅'}

> ⚠️ APIキーが設定されていないため、簡易レポートを表示しています。`;
}

function buildEmptyReport() {
  return `# 整合性レビューレポート

> まだ設計ノードが追加されていません。`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

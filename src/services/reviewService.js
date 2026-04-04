/**
 * reviewService
 *
 * 責務: SystemContextから整合性レビューレポート（Markdown）を生成する
 *
 * ARC原則:
 * - requirementDocService と同じ retry + timeout + Result型パターンを踏襲
 * - APIキー未設定時はルールベース結果をそのままMarkdownに変換してフォールバック
 *
 * フェーズ1改修:
 * - 引数を (messages, nodes, edges) → SystemContext に統一
 *
 * フェーズ3改修:
 * - SYSTEM_PROMPT 定数を削除し、getPrompt('review') 経由で取得
 *
 * Input:  SystemContext
 * Output: Result<string>  (Markdown形式の整合性レビューレポート)
 */
import { ok, fail } from '../types/result.js';
import { MODELS, THINKING } from './geminiConfig.js';
import { callGenerateContent } from './geminiClient.js';
import { assessComplexity } from './complexityAssessor.js';
import { getPrompt } from '../prompts/index.js';
import { hasApiKey } from './configService.js';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 45000;

// ---------- public ----------

/**
 * SystemContextから整合性レビューレポートを生成する
 *
 * @param {import('../types/systemContext.js').SystemContext} systemContext
 * @returns {Promise<import('../types/result.js').Result<string>>}
 */
export async function generateReview(systemContext) {
  const { messages, nodes, edges } = systemContext;

  if (!nodes || nodes.length === 0) {
    return ok(buildEmptyReport());
  }

  if (!hasApiKey()) {
    return ok(buildMockReport(nodes, edges));
  }

  // A+Bハイブリッド複雑性判定でモデルTierを動的に決定
  const complexity = await assessComplexity(nodes, edges, messages).catch(() => 'complex');
  const modelId       = complexity === 'complex' ? MODELS.reviewHeavy : MODELS.reviewLight;
  const thinkingLevel = complexity === 'complex' ? THINKING.reviewHeavy : THINKING.reviewLight;

  const contents = buildContents(systemContext);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callApi(contents, modelId, thinkingLevel);
      return ok(result);
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

async function callApi(contents, modelId, thinkingLevel) {
  // フェーズ3: PromptRegistry からシステムプロンプトを取得
  const systemPrompt = getPrompt('review');

  const { text } = await callGenerateContent({
    modelId,
    thinkingLevel,
    contents,
    systemPrompt,
    generationConfig: { maxOutputTokens: 3000 },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  if (!text.trim()) {
    throw new Error('Empty response from API');
  }

  return cleanMarkdown(text);
}

function cleanMarkdown(text) {
  return text
    .replace(/^```markdown\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * フェーズ1改修: SystemContext 全体からコンテンツを組み立てる
 * nodes は ReactFlow形式 ({ id, type, data: { label, type, description } })
 *
 * @param {import('../types/systemContext.js').SystemContext} systemContext
 */
function buildContents(systemContext) {
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

  return [
    {
      role: 'user',
      parts: [{
        text: `以下の設計データを分析し、整合性レビューレポートを生成してください。

## ノード一覧（${nodes.length}件）
${nodeList || '（なし）'}

## エッジ一覧（${edges.length}件）
${edgeList || '（なし）'}

## 会話履歴
${conversationText || '（なし）'}`
      }]
    }
  ];
}

/**
 * APIキー未設定時のモック: ルールベースの結果を構造化して返す
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
${issues.length === 0 ? '問題なし ✅ — 基本的な構造チェックをパスしました' : issues.some(i => i.startsWith('- ❌')) ? '重大な問題あり ❌ — 修正が必要な問題が見つかりました' : '軽微な問題あり ⚠️ — いくつかの改善点があります'}

## 自動チェック結果
${issues.length > 0 ? issues.join('\n') : '- 問題なし ✅'}

## 推奨アクション
${issues.length > 0 ? '1. 上記の問題を修正してから再度レビューを実行してください' : '1. 会話を続けて要件をさらに深掘りしてください'}

> ⚠️ APIキーが設定されていないため、簡易レポートを表示しています。
> 右上の「設定」からGemini APIキーを設定すると、AIによる詳細な分析が可能になります。`;
}

function buildEmptyReport() {
  return `# 整合性レビューレポート

> まだ設計ノードが追加されていません。
> 左のチャットで要件を話し合ってノードが生成されたあと、再度レビューを実行してください。`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

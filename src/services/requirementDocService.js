/**
 * requirementDocService
 *
 * 責務: SystemContextから詳細要件定義書（Markdown）を生成する
 */
import { ok } from '../types/result.js';
import { PHASES } from './llmConfig.js';
import { callLLM } from './llmService.js';
import { getPrompt } from '../prompts/index.js';
import { serializeDomainForPrompt } from '../types/systemContext.js';
import { hasApiKey } from './configService.js';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// ---------- public ----------

/**
 * SystemContextから要件定義書を生成する
 *
 * @param {import('../types/systemContext.js').SystemContext} systemContext
 * @returns {Promise<import('../types/result.js').Result<string>>}
 */
export async function generateRequirementDoc(systemContext) {
  const { messages } = systemContext;

  if (!messages || messages.length <= 1) {
    return ok(buildEmptyDoc());
  }

  if (!hasApiKey('google') && !hasApiKey('openai') && !hasApiKey('anthropic')) {
    return ok(buildMockDoc(messages));
  }

  const userMessage = buildExtractionPrompt(systemContext);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const graphSnapshot = serializeDomainForPrompt(systemContext);
      const systemPrompt = getPrompt('requirementDoc', { graphSnapshot });

      const result = await callLLM({
        phaseId: PHASES.DOC.id,
        userMessage,
        systemPrompt,
        options: { maxTokens: 4096 }
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

  // 全リトライ失敗 → モック出力にフォールバック
  console.error('[requirementDocService] API failed, falling back to mock:', lastError);
  return ok(buildMockDoc(messages));
}

// ---------- private ----------

function buildExtractionPrompt(systemContext) {
  const { messages } = systemContext;

  // 会話履歴を1つのテキストにまとめて送る
  const conversationText = messages
    .map(m => `[${m.role === 'user' ? 'ユーザー' : 'アシスタント'}]: ${m.content}`)
    .join('\n\n');

  return `以下の会話履歴を分析し、詳細要件定義書を生成してください。\n\n---\n${conversationText}\n---`;
}

/**
 * APIレスポンスのMarkdownを整形（不要なコードブロック囲みを除去）
 */
function cleanMarkdown(text) {
  return text
    .replace(/^```markdown\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * APIキー未設定時のモック: 会話履歴を構造化して簡易要件定義書にする
 */
function buildMockDoc(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  const userRequirements = userMessages
    .map((m, i) => `${i + 1}. ${m.content}`)
    .join('\n');

  const aiSuggestions = assistantMessages
    .slice(1)  // 初期メッセージを除く
    .map((m, i) => `${i + 1}. ${m.content.slice(0, 120)}...`)
    .join('\n');

  return `# アプリ要件定義書

## 1. プロジェクト概要
- **アプリ名（仮称）**: （会話から自動推定 — API未接続のためモック出力）
- **目的・解決する課題**: ユーザーの発言から推定
- **ターゲットユーザー**: （未定義 — 追加ヒアリング推奨）

## 2. 機能要件
### 2.1 ユーザーの要望（原文）
${userRequirements || '（入力なし）'}

### 2.2 AIアシスタントの提案
${aiSuggestions || '（提案なし）'}

## 3. 画面構成
（未定義 — 追加ヒアリング推奨）

## 4. データ要件
（未定義 — 追加ヒアリング推奨）

## 5. 非機能要件
（未定義 — 追加ヒアリング推奨）

## 6. ビジネスルール・制約
（未定義 — 追加ヒアリング推奨）

## 7. 未決事項・追加ヒアリング項目
- 対象プラットフォーム（Web / モバイル / 両方）
- 認証方式
- データの永続化方式
- 外部システム連携の有無

> ⚠️ この要件定義書はAPIキーが設定されていないため、モック出力となっています。
> 右上の「設定」からGemini APIキーを設定すると、AIが詳細な要件定義書を自動的に生成します。`;
}

function buildEmptyDoc() {
  return `# アプリ要件定義書

> まだ会話が開始されていません。
> 左のチャットで要件を話し合ってノードが生成されたあと、再度エクスポートしてください。`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

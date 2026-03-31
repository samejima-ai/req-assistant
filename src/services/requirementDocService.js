/**
 * requirementDocService
 *
 * 責務: 会話履歴から詳細要件定義書（Markdown）を生成する
 *
 * ARC原則:
 * - 副作用（Gemini API通信）を閉じ込め、Result型で返却
 * - geminiService と同じ retry + timeout パターンを踏襲
 * - APIキー未設定時はモック（会話履歴の構造化変換）にフォールバック
 *
 * Input:  messages: Array<{role, content}>
 * Output: Result<string>  (Markdown形式の要件定義書)
 */
import { ok, fail } from '../types/result.js';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 45000; // 長文生成のため少し長め

const SYSTEM_PROMPT = `あなたは熟練のシステムアナリスト兼ITコンサルタントです。
ユーザーとAIアシスタントの会話履歴を分析し、以下のMarkdown構造で「詳細要件定義書」を生成してください。

このドキュメントは「開発の礎」であると同時に「ブレストの道具」です。
単に決まったことを書くだけでなく、エンジニアの視点で「ここが曖昧だ」「この仕様だと矛盾が生じる」といった懸念点を積極的に盛り込んでください。

---

# アプリ要件定義書

## 1. プロジェクト概要
- **アプリ名（仮称）**: 会話から推測されるアプリ名
- **目的・解決する課題**: 誰の、どんな負を解消するか
- **ターゲットユーザー**: ユーザー像とその利用シーン

## 2. 機能要件
### 2.1 必須機能（Must Have）
- 会話中で明確に定義されたコア機能
### 2.2 推奨機能（Should Have）
- ユーザー体験を向上させるために検討すべき機能
### 2.3 将来検討（Nice to Have）
- スコープ外だが将来的に拡張可能な要素

## 3. 画面構成
- 画面一覧（画面名: 役割・主要な入力項目/ボタン）
- ユーザー体験（UX）の勘所（「迷わせない工夫」など）

## 4. データ・ロジック要件
- 主要なデータ項目と関連性
- 複雑な計算・判定ロジックがあればその整理

## 5. 非機能要件（エンジニア視点での提言）
- パフォーマンス、セキュリティ、スケーラビリティへの配慮
- 会話にない場合でも「一般的モバイルアプリなら〜が必要」といった視点で記載

## 6. ビジネスルール・制約
- 運用フローや権限管理に関するルール

## 7. 【重要】未決事項・深掘りすべき点（ブレスト項目）
- **論理的矛盾**: Aと言いながらBと言っている箇所など
- **情報不足**: 実装するために追加で決める必要があること
- **AIからの提案**: 「こうすればもっと良くなる」という壁打ち案

---

【出力ルール】
- 純粋なMarkdownテキストのみを出力すること。
- 日本語で出力すること。
- 「未定義」で終わらせず、「一般的は〜ですが、どちらにしますか？」といった提案を添えること。`;

// ---------- public ----------

/**
 * 会話履歴から要件定義書を生成する
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<import('../types/result.js').Result<string>>}
 */
export async function generateRequirementDoc(messages) {
  if (!messages || messages.length <= 1) {
    return ok(buildEmptyDoc());
  }

  if (!API_KEY) {
    return ok(buildMockDoc(messages));
  }

  const contents = buildContents(messages);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callWithTimeout(contents);
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

  // 全リトライ失敗 → モック出力にフォールバック
  console.error('[requirementDocService] API failed, falling back to mock:', lastError);
  return ok(buildMockDoc(messages));
}

// ---------- private ----------

async function callWithTimeout(contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.3,  // 要件定義は正確性重視
          maxOutputTokens: 4096
        }
      })
    });

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text.trim()) {
      throw new Error('Empty response from API');
    }

    return cleanMarkdown(text);
  } finally {
    clearTimeout(timer);
  }
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

function buildContents(messages) {
  // 会話履歴を1つのテキストにまとめて送る
  const conversationText = messages
    .map(m => `[${m.role === 'user' ? 'ユーザー' : 'アシスタント'}]: ${m.content}`)
    .join('\n\n');

  return [
    {
      role: 'user',
      parts: [{
        text: `以下の会話履歴を分析し、詳細要件定義書を生成してください。\n\n---\n${conversationText}\n---`
      }]
    }
  ];
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

> ⚠️ この要件定義書はAPIキー未設定のためモック出力です。
> VITE_GEMINI_API_KEY を設定すると、AIが会話を分析して詳細な要件定義書を自動生成します。`;
}

function buildEmptyDoc() {
  return `# アプリ要件定義書

> まだ会話が開始されていません。
> 左のチャットで要件を話し合った後、再度エクスポートしてください。`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

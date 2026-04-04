/**
 * geminiService
 *
 * 責務: Gemini APIとの通信（副作用の分離）
 *
 * ARC原則:
 * - 副作用（fetch）をここに閉じ込め、呼び出し側は純粋なデータ変換のみ
 * - Result型でSuccess/Failureを明示し、例外を投げない
 * - リトライ（指数バックオフ）・タイムアウトを明文化
 *
 * フェーズ3改修:
 * - SYSTEM_PROMPT 定数を削除し、getPrompt('chat') 経由で取得するように変更
 * - PromptRegistry によりプロンプトが localStorage カスタム or デフォルトを自動選択する
 *
 * Output: Result<ExtractionResult>
 */
import { ok, fail } from '../types/result.js';
import { MODELS, THINKING } from './geminiConfig.js';
import { callGenerateContent } from './geminiClient.js';
import { getPrompt } from '../prompts/index.js';
import { analyzeIntent, buildEnrichedMessage } from './intentService.js';
import { buildSystemContext, serializeDomainForPrompt } from '../types/systemContext.js';
import { hasApiKey } from './configService.js';

// RL定数（明文化）
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

// ---------- public ----------

/**
 * Gemini APIを呼び出してノード+エッジを抽出する
 *
 * @param {Array<{role: string, content: string}>} history
 * @param {string} userMessage
 * @param {Array} [nodes] - 現在のキャンバスノード（グラフ状態コンテキスト用）
 * @param {Array} [edges] - 現在のキャンバスエッジ（グラフ状態コンテキスト用）
 * @param {((status: string) => void) | null} [onStatus] - 処理フェーズ通知コールバック
 * @returns {Promise<import('../types/result.js').Result<{chatReply: string, nodes: Array, edges: Array}>>}
 */
export async function extractRequirements(history, userMessage, nodes = [], edges = [], onStatus = null) {
  if (!hasApiKey()) {
    // APIキーなし → モックで即座に成功を返す
    return ok(getMockResponse(userMessage));
  }

  // インテント前処理: ユーザー入力を分析してコンテキストを付与する（失敗時はフォールバック）
  onStatus?.('インテントを分析中...');
  const intent = await analyzeIntent(userMessage, history);
  onStatus?.('設計図を生成中...');
  const enrichedMessage = intent ? buildEnrichedMessage(userMessage, intent) : userMessage;

  const contextNote = buildContextNote(nodes, edges);
  const contents = buildContents(history, enrichedMessage + contextNote);
  // 既存ノードIDをキャンバス状態から抽出（normalize()でエッジ検証に使う）
  const existingNodeIds = extractExistingNodeIds(nodes);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callApi(contents, existingNodeIds);
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

  // 全リトライ失敗 → Failure を返す（degraded success から変更）
  console.error('[geminiService] All retries failed, falling back to mock:', lastError);
  return fail(
    isNetworkError(lastError) ? 'NETWORK_ERROR' : 'API_ERROR',
    lastError?.message ?? 'Unknown error',
    true
  );
}

// ---------- private ----------

async function callApi(contents, existingNodeIds = new Set()) {
  // フェーズ3: PromptRegistry からシステムプロンプトを取得
  const systemPrompt = getPrompt('chat');

  const { text } = await callGenerateContent({
    modelId: MODELS.chat,
    thinkingLevel: THINKING.chat,
    contents,
    systemPrompt,
    generationConfig: { responseMimeType: 'application/json' },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  return parseResponse(text, existingNodeIds);
}

/**
 * JSON レスポンスをパースして ExtractionResult を返す
 * Input:  text: string (Geminiの生テキスト)
 * Output: {chatReply, nodes, edges}
 * @throws {Error} パース完全失敗時
 */
function parseResponse(text, existingNodeIds = new Set()) {
  // 1st try: そのままJSONパース
  try {
    const parsed = JSON.parse(text);
    return normalize(parsed, existingNodeIds);
  } catch (_) { /* fall through */ }

  // 2nd try: Markdownコードブロックを除去
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    return normalize(parsed, existingNodeIds);
  } catch (_) { /* fall through */ }

  // パース完全失敗
  throw new Error(`PARSE_ERROR: ${text.slice(0, 200)}`);
}

/**
 * パース済みオブジェクトを安全な形式に正規化
 * バリデーション: nodesの各idがedgesのsource/targetに存在するか検証
 *
 * @param {object} parsed - Geminiからのパース済みオブジェクト
 * @param {Set<string>} existingNodeIds - 過去の会話で生成済みのノードIDセット
 */
function normalize(parsed, existingNodeIds = new Set()) {
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

  // 今回のレスポンスのノードID + 過去の会話で既存のノードID を合計して検証
  const allValidNodeIds = new Set([...nodes.map(n => n.id), ...existingNodeIds]);

  // ID整合性バリデーション（存在しないIDを参照するエッジは除去）
  const edges = rawEdges.filter(e => {
    const valid = allValidNodeIds.has(e.source) && allValidNodeIds.has(e.target);
    if (!valid) {
      console.warn(`[geminiService] edge ${e.id} references unknown node (source:${e.source}, target:${e.target}), skipped`);
    }
    return valid;
  });

  return {
    chatReply: parsed.reply ?? '',
    nodes,
    edges
  };
}

/**
 * 現在のグラフ状態を構造化テキストとしてコンテキストノートに変換する
 * ノードのラベル・説明・型、エッジのフロー構造を Gemini に渡し、文脈理解を向上させる
 *
 * @param {Array} nodes - 現在のキャンバスノード
 * @param {Array} edges - 現在のキャンバスエッジ
 */
function buildContextNote(nodes, edges) {
  if (nodes.length === 0) return '';
  const ctx = buildSystemContext([], nodes, edges);
  return '\n\n---\n[現在の設計図（既存ノード/エッジ）]\n' + serializeDomainForPrompt(ctx);
}

/**
 * 現在のノード配列から既存ノードIDのSetを抽出する
 * （エッジ参照バリデーション用）
 *
 * @param {Array} nodes - 現在のキャンバスノード
 */
function extractExistingNodeIds(nodes) {
  return new Set(nodes.map(n => n.id));
}

function buildContents(history, text) {
  return [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text }] }
  ];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isNetworkError(e) {
  return e instanceof TypeError || e?.name === 'AbortError';
}

function getMockResponse(text) {
  if (text.includes('職人') || text.includes('日報') || text.includes('報告')) {
    return {
      chatReply: '現場の職人さん向けの作業報告アプリですね。右のボードに要素を整理しました。報告内容には写真やテキストなど、どのような項目が必要でしょうか？また、報告を受け取る管理者側の機能も必要ですか？',
      nodes: [
        { id: 'node_001', type: 'Actor', label: '現場の職人', description: '日報を入力する現場作業員' },
        { id: 'node_002', type: 'UI_Component', label: '日報入力画面', description: 'スマホで操作する日報入力フォーム' },
        { id: 'node_003', type: 'Data_Entity', label: '日報データ', description: '作業内容・写真・日時を含む日報' },
        { id: 'node_004', type: 'Action', label: '日報を送信', description: '入力した日報をサーバーに送信する' }
      ],
      edges: [
        { id: 'edge_001', source: 'node_001', target: 'node_002', type: 'actor_action', label: '日報を開く' },
        { id: 'edge_002', source: 'node_002', target: 'node_004', type: 'screen_transition', label: '送信ボタン押下' },
        { id: 'edge_003', source: 'node_004', target: 'node_003', type: 'data_flow', label: '日報を保存' }
      ]
    };
  }
  return {
    chatReply: 'なるほど、面白いアイデアですね！右のボードにキーワードを整理しました。このシステムを使うのはどのような方でしょうか？また、一番解決したい課題を教えていただけますか？',
    nodes: [
      { id: 'node_001', type: 'Actor', label: 'ユーザー', description: 'システムの主要利用者' },
      { id: 'node_002', type: 'UI_Component', label: 'メイン画面', description: 'アプリのメインUI' }
    ],
    edges: [
      { id: 'edge_001', source: 'node_001', target: 'node_002', type: 'actor_action', label: 'アプリを起動' }
    ]
  };
}

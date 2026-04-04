/**
 * geminiService
 *
 * 責務: AI（主に設計図抽出）との通信
 */
import { ok, fail } from '../types/result.js';
import { PHASES } from './llmConfig.js';
import { callLLM } from './llmService.js';
import { getPrompt } from '../prompts/index.js';
import { analyzeIntent, buildEnrichedMessage } from './intentService.js';
import { buildSystemContext, serializeDomainForPrompt } from '../types/systemContext.js';
import { hasApiKey } from './configService.js';

// RL定数
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// ---------- public ----------

/**
 * AIを呼び出してノード+エッジを抽出する
 */
export async function extractRequirements(history, userMessage, nodes = [], edges = [], onStatus = null) {
  if (!hasApiKey('google') && !hasApiKey('openai') && !hasApiKey('anthropic')) {
    // APIキーなし → モックで即座に成功を返す
    return ok(getMockResponse(userMessage));
  }

  // インテント前処理
  onStatus?.('インテントを分析中...');
  const intent = await analyzeIntent(userMessage, history);
  onStatus?.('設計図を生成中...');
  const enrichedMessage = intent ? buildEnrichedMessage(userMessage, intent) : userMessage;

  const contextNote = buildContextNote(nodes, edges);
  // 既存ノードIDをキャンバス状態から抽出
  const existingNodeIds = extractExistingNodeIds(nodes);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callApi(history, enrichedMessage + contextNote, existingNodeIds);
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

  console.error('[geminiService] All retries failed:', lastError);
  return fail(
    isNetworkError(lastError) ? 'NETWORK_ERROR' : 'API_ERROR',
    lastError?.message ?? 'Unknown error',
    true
  );
}

// ---------- private ----------

async function callApi(history, userMessage, existingNodeIds = new Set()) {
  const systemPrompt = getPrompt('chat');

  const result = await callLLM({
    phaseId: PHASES.EXTRACT.id,
    history,
    userMessage,
    systemPrompt,
    options: {
      responseFormat: { type: 'json_object' }
    }
  });

  if (!result.ok) throw new Error(result.message);

  return parseResponse(result.value, existingNodeIds);
}

/**
 * JSON レスポンスをパースして ExtractionResult を返す
 */
function parseResponse(text, existingNodeIds = new Set()) {
  // 1st try: そのままJSONパース
  try {
    const parsed = JSON.parse(text);
    return normalize(parsed, existingNodeIds);
  } catch { /* fall through */ }

  // 2nd try: Markdownコードブロックを除去
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    return normalize(parsed, existingNodeIds);
  } catch { /* fall through */ }

  throw new Error(`PARSE_ERROR: ${text.slice(0, 200)}`);
}

/**
 * パース済みオブジェクトを安全な形式に正規化
 */
function normalize(parsed, existingNodeIds = new Set()) {
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

  const allValidNodeIds = new Set([...nodes.map(n => n.id), ...existingNodeIds]);

  const edges = rawEdges.filter(e => {
    const valid = allValidNodeIds.has(e.source) && allValidNodeIds.has(e.target);
    if (!valid) {
      console.warn(`[geminiService] edge ${e.id} references unknown node, skipped`);
    }
    return valid;
  });

  return {
    chatReply: parsed.reply ?? '',
    nodes,
    edges
  };
}

function buildContextNote(nodes, edges) {
  if (nodes.length === 0) return '';
  const ctx = buildSystemContext([], nodes, edges);
  return '\n\n---\n[現在の設計図（既存ノード/エッジ）]\n' + serializeDomainForPrompt(ctx);
}

function extractExistingNodeIds(nodes) {
  return new Set(nodes.map(n => n.id));
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
      chatReply: '現場の職人さん向けの作業報告アプリですね。右のボードに要素を整理しました。',
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
    chatReply: 'アイデアを整理して右のボードにまとめました。',
    nodes: [
      { id: 'node_001', type: 'Actor', label: 'ユーザー', description: 'システムの主要利用者' },
      { id: 'node_002', type: 'UI_Component', label: 'メイン画面', description: 'アプリのメインUI' }
    ],
    edges: [
      { id: 'edge_001', source: 'node_001', target: 'node_002', type: 'actor_action', label: 'アプリを起動' }
    ]
  };
}

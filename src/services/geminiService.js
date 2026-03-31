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
 * Input:  history: Message[], userMessage: string
 * Output: Result<ExtractionResult>
 *
 * 依存: VITE_GEMINI_API_KEY (環境変数)
 * 制約: リトライ最大3回、バックオフ 1s→2s→4s、timeout 30s
 */
import { ok, fail } from '../types/result.js';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// RL定数（明文化）
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `あなたはモバイル/Webアプリ開発の要件定義の専門家です。
ユーザーとの対話からアプリ要件を分析し、必ず以下のJSONスキーマで返答してください。

JSONスキーマ:
{
  "reply": "ユーザーへの親身な返答と要件を深掘りする逆質問（日本語）",
  "nodes": [
    { "id": "node_001", "type": "Actor|UI_Component|Data_Entity|Action", "label": "表示名(10文字以内)", "description": "詳細説明" }
  ],
  "edges": [
    { "id": "edge_001", "source": "node_001", "target": "node_002", "type": "screen_transition|data_flow|actor_action|api_call", "label": "操作名・条件" }
  ]
}

ノードタイプの定義:
- "Actor": システムを使う人・組織（例: 現場職人、管理者、システム管理者）
- "UI_Component": アプリの画面・モーダル・ダイアログ（例: ログイン画面、日報入力フォーム、一覧画面）
- "Data_Entity": 永続化・送受信されるデータ（例: 日報、ユーザー、案件）
- "Action": システムが行う処理・バッチ・通知（例: 日報を保存、プッシュ通知を送信）

エッジタイプの定義:
- "screen_transition": UI_Component → UI_Component（画面遷移）
- "data_flow": データの入出力（Action ↔ Data_Entity など）
- "actor_action": Actor → UI_Component または Actor → Action（操作の起点）
- "api_call": 外部サービス・APIへの呼び出し

【設計整合性の必須ルール】
以下のルールに違反するノード・エッジは生成しないこと:
1. 孤立ノード禁止: 全てのノードは少なくとも1本のエッジで他のノードと接続すること
2. Actor必須: 必ず1つ以上のActorノードを持ち、Actorから始まるフローを持つこと
3. データの流れを明示: Data_Entityノードは必ずActionまたはUI_Componentとdata_flowエッジで繋ぐこと
4. 画面の入口と出口: UI_Componentノードは必ず「どこから来て、どこへ行くか」のエッジを持つこと（ただしトップ画面はActorからの入口だけでもよい）
5. ノード数の上限: 1ターンで追加するノードは最大6個まで。既存ノードへのエッジを優先し、無秩序に増やさないこと
6. ID整合性: source/targetには必ずnodes配列内に存在するidを指定すること。存在しないIDを参照してはいけない

【既存ノードの扱い】
- 会話履歴に既存ノードIDがある場合、それらに新しいエッジを追加することを優先すること
- 同じ概念の重複ノードを作らないこと（例: "ユーザー"と"現場職人"が同じActorなら1つに統合）

【品質基準】
- ラベルは10文字以内で具体的に（"画面"ではなく"日報入力画面"）
- descriptionは実装者が理解できる1文の説明
- 新規ノードIDはnode_NNN形式（3桁連番、既存の最大番号+1から）`;

// ---------- public ----------

/**
 * Gemini APIを呼び出してノード+エッジを抽出する
 *
 * @param {Array<{role: string, content: string}>} history
 * @param {string} userMessage
 * @returns {Promise<import('../types/result.js').Result<{chatReply: string, nodes: Array, edges: Array}>>}
 */
export async function extractRequirements(history, userMessage) {
  if (!API_KEY) {
    // APIキーなし → モックで即座に成功を返す
    return ok(getMockResponse(userMessage));
  }

  const contextNote = buildContextNote(history);
  const contents = buildContents(history, userMessage + contextNote);
  // 既存ノードIDを会話履歴から抽出（normalize()でエッジ検証に使う）
  const existingNodeIds = extractExistingNodeIds(history);

  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY_MS;
  let lastError = null;

  while (retries > 0) {
    try {
      const result = await callWithTimeout(contents, existingNodeIds);
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

  // 全リトライ失敗 → モックにフォールバック（Failure ではなく degraded success）
  console.error('[geminiService] All retries failed, falling back to mock:', lastError);
  return fail(
    isNetworkError(lastError) ? 'NETWORK_ERROR' : 'API_ERROR',
    lastError?.message ?? 'Unknown error',
    true
  );
}

// ---------- private ----------

async function callWithTimeout(contents, existingNodeIds = new Set()) {
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
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseResponse(text, existingNodeIds);
  } finally {
    clearTimeout(timer);
  }
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

function buildContextNote(history) {
  const ids = new Set();
  for (const msg of history) {
    for (const m of msg.content.matchAll(/node_\d{3}/g)) ids.add(m[0]);
  }
  return ids.size > 0 ? `\n既存ノードID: ${[...ids].join(', ')}` : '';
}

/**
 * 会話履歴から既存ノードIDのSetを抽出する
 * （geminiServiceが過去に生成したノードを認識するため）
 */
function extractExistingNodeIds(history) {
  const ids = new Set();
  for (const msg of history) {
    for (const m of msg.content.matchAll(/node_\d{3}/g)) ids.add(m[0]);
  }
  return ids;
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

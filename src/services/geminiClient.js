/**
 * geminiClient
 *
 * 責務: Gemini API generateContent への共通HTTPクライアント
 *
 * 各サービスで重複していた fetch + AbortController をここに集約する。
 * - モデルIDはパラメータとして受け取る（ルーティングは呼び出し側の責務）
 * - Thought signatures をレスポンスから分離して返す（Gemini 3 マルチターン対応）
 * - 失敗時は Error を throw する（Result型変換は各サービスが担う）
 *
 * Gemini 3 制約:
 * - temperature はデフォルト(1.0)から変更しない（公式推奨）
 * - thinking_level と thinking_budget を同一リクエストで併用しない（400エラー）
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini API generateContent を呼び出す
 *
 * @param {object}   options
 * @param {string}   options.modelId            - 使用するモデルID
 * @param {Array}    options.contents           - 会話履歴（Gemini contents 形式）
 * @param {string}   [options.systemPrompt]     - system instruction テキスト
 * @param {string}   [options.thinkingLevel]    - 'minimal'|'low'|'medium'|'high'
 * @param {object}   [options.generationConfig] - temperature 以外の生成設定
 * @param {number}   [options.timeoutMs=30000]
 * @returns {Promise<{ text: string, thoughtParts: Array }>}
 * @throws {Error} ネットワークエラー / HTTP エラー
 */
import { getApiKey } from './configService.js';

export async function callGenerateContent({
  modelId,
  contents,
  systemPrompt,
  thinkingLevel,
  generationConfig = {},
  timeoutMs = 30000,
}) {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/${modelId}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = { contents };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    // thinking_level と generationConfig を合成
    // Note: temperature は Gemini 3 公式推奨によりデフォルト(1.0)のまま設定しない
    const config = { ...generationConfig };
    if (thinkingLevel) {
      config.thinkingConfig = { thinkingLevel };
    }
    if (Object.keys(config).length > 0) {
      body.generationConfig = config;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    // Gemini 3: thought parts（推論シグネチャ）とテキスト parts を分離
    // thought parts はマルチターンの Function Calling で循環させる必要がある
    const thoughtParts = parts.filter(p => p.thought === true);
    const text = parts.filter(p => p.thought !== true).map(p => p.text ?? '').join('');

    return { text, thoughtParts };
  } finally {
    clearTimeout(timer);
  }
}

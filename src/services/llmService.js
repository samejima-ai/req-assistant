/**
 * llmService
 * 
 * 責務: 各種AIプロバイダー（Google, OpenAI, Anthropic等）への統一的な呼び出し
 * 
 * Vercel AI SDK を使用して、モデルの差異を吸収します。
 */

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

import { getApiKey, getPhaseModel } from './configService.js';
import { MODEL_LIST } from './llmConfig.js';
import { ok, fail } from '../types/result.js';

function getProvider(providerName, apiKey) {
  switch (providerName) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    case 'openai':
      return createOpenAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey });
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

/**
 * 汎用的なLLM呼び出し
 * 
 * @param {object} params
 * @param {string} params.phaseId - 'intent' | 'extract' | 'review'
 * @param {Array}  params.history - 会話履歴 [{role, content}]
 * @param {string} params.userMessage - 今回のメッセージ (履歴と結合される)
 * @param {string} [params.systemPrompt] - システムプロンプト
 * @param {object} [params.options] - 気温(temperature)等の追加設定
 * @returns {Promise<import('../types/result.js').Result<string>>}
 */
export async function callLLM({
  phaseId,
  history = [],
  userMessage,
  systemPrompt,
  options = {}
}) {
  // 1. フェーズに対応するモデル設定を取得
  const modelId = getPhaseModel(phaseId) || MODEL_LIST.find(m => m.isDefault).id;
  const modelMeta = MODEL_LIST.find(m => m.id === modelId);

  if (!modelMeta) {
    return fail('CONFIG_ERROR', `Model not found in registry: ${modelId}`);
  }

  // 2. APIキーを取得
  const apiKey = getApiKey(modelMeta.provider);
  
  // Debug log (masked)
  console.log(`[llmService] Using ${modelMeta.provider} key. Found: ${!!apiKey} (${apiKey?.slice(0, 5)}...)`);

  if (!apiKey) {
    return fail('AUTH_ERROR', `${modelMeta.provider} のAPIキーが設定されていません。右上の設定から入力してください。`);
  }

  // 3. メッセージ形式の変換 (Vercel AI SDK 形式)
  const messages = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ];

  try {
    const provider = getProvider(modelMeta.provider, apiKey);
    
    // 4. 実行 (generateText)
    const { text } = await generateText({
      model: provider(modelMeta.id), // provider is a function that returns a language model
      system: systemPrompt,
      messages,
      ...options
    });

    return ok(text);
  } catch (error) {
    console.error(`[llmService] Error calling ${modelId}:`, error);
    return fail(
      'API_ERROR',
      error.message || 'AIの呼び出し中にエラーが発生しました。',
      true // retryable
    );
  }
}

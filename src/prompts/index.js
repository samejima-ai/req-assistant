/**
 * PromptRegistry (src/prompts/index.js)
 *
 * 責務: 全エージェントプロンプトの集約管理・動的取得
 *
 * CDD原則（ルール外部化）:
 * - 各サービスは直接 SYSTEM_PROMPT 定数を持たず、このレジストリ経由で取得する
 * - localStorage にカスタムプロンプトが保存されている場合はそちらを優先する
 * - デフォルトプロンプトはコード内の各 *.prompt.js ファイルで管理される
 *
 * 将来拡張ポイント:
 * - ユーザーがUIからプロンプトを編集・保存できる「プロンプトエディタ」機能
 * - ドメイン特化型プロンプトのプリセット集（医療系、EC系、業務系など）
 * - 外部URLからプロンプトを非同期ロードする機能
 */

import { buildPrompt as buildChatPrompt }    from './chat.prompt.js';
import { buildPrompt as buildDocPrompt }     from './requirementDoc.prompt.js';
import { buildPrompt as buildReviewPrompt }  from './review.prompt.js';
import { buildPrompt as buildIntentPrompt }  from './intent.prompt.js';

const STORAGE_KEY_PREFIX = 'req-assistant-prompt-';

/** @type {Map<string, (variables?: object) => string>} */
const DEFAULT_BUILDERS = new Map([
  ['intent',         buildIntentPrompt],
  ['chat',           buildChatPrompt],
  ['requirementDoc', buildDocPrompt],
  ['review',         buildReviewPrompt],
]);

/**
 * 指定サービスのプロンプトを取得する
 *
 * 優先順位: localStorage カスタム > デフォルト（*.prompt.js）
 *
 * @param {string} serviceId - 'chat' | 'requirementDoc' | 'review'
 * @param {object} [variables] - テンプレート変数（graphSnapshot など）
 * @returns {string}
 */
export function getPrompt(serviceId, variables = {}) {
  // 1. localStorage のカスタムプロンプトを確認
  try {
    const custom = localStorage.getItem(`${STORAGE_KEY_PREFIX}${serviceId}`);
    if (custom) return custom;
  } catch {
    // localStorage 利用不可時はデフォルトにフォールバック
  }

  // 2. デフォルトビルダーを呼び出す
  const builder = DEFAULT_BUILDERS.get(serviceId);
  if (!builder) {
    console.warn(`[PromptRegistry] Unknown serviceId: "${serviceId}". Returning empty string.`);
    return '';
  }
  return builder(variables);
}

/**
 * カスタムプロンプトを localStorage に保存する
 *
 * @param {string} serviceId - 'chat' | 'requirementDoc' | 'review'
 * @param {string} promptText - カスタムプロンプト文字列
 */
export function registerCustomPrompt(serviceId, promptText) {
  try {
    if (!promptText || !promptText.trim()) {
      // 空文字列はカスタムプロンプトの削除（デフォルトに戻す）とみなす
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${serviceId}`);
    } else {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${serviceId}`, promptText);
    }
  } catch (e) {
    console.warn('[PromptRegistry] Failed to save custom prompt:', e);
  }
}

/**
 * 指定サービスのカスタムプロンプトを削除し、デフォルトに戻す
 *
 * @param {string} serviceId
 */
export function resetToDefault(serviceId) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${serviceId}`);
  } catch {
    // noop
  }
}

/**
 * 全サービスのカスタムプロンプトをクリアする
 */
export function resetAllToDefault() {
  ['intent', 'chat', 'requirementDoc', 'review'].forEach(id => resetToDefault(id));
}

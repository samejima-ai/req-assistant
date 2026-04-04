/**
 * configService
 * 
 * 責務: AIプロバイダーのAPIキーとフェーズ別モデル設定の管理
 * 
 * - getApiKey(provider): 指定プロバイダーのキーを取得
 * - setApiKey(provider, key, persist): キーを保存
 * - getPhaseModel(phaseId): 指定フェーズのモデルIDを取得
 * - setPhaseModel(phaseId, modelId): フェーズのモデル設定を保存
 */

const LEGACY_GEMINI_KEY = 'vibe-architect-gemini-api-key';
const API_KEYS_STORAGE_KEY = 'vibe-architect-api-keys';
const PHASE_MODELS_STORAGE_KEY = 'vibe-architect-phase-models';

/**
 * プロバイダーごとのAPIキーを取得
 * @param {string} provider - 'google' | 'openai' | 'anthropic'
 */
export function getApiKey(provider = 'google') {
  // 1. 各プロバイダー専用のストレージを確認
  const keysStr = localStorage.getItem(API_KEYS_STORAGE_KEY) || sessionStorage.getItem(API_KEYS_STORAGE_KEY);
  if (keysStr) {
    try {
      const keys = JSON.parse(keysStr);
      if (keys[provider]) return keys[provider];
    } catch (e) {
      console.error('Failed to parse API keys:', e);
    }
  }

  // 2. Google の場合はレガシーキーも確認
  if (provider === 'google') {
    const sessionKey = sessionStorage.getItem(LEGACY_GEMINI_KEY);
    if (sessionKey) return sessionKey;
    const localKey = localStorage.getItem(LEGACY_GEMINI_KEY);
    if (localKey) return localKey;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  // 3. 環境変数を確認 (VITE_OPENAI_API_KEY 等)
  const envKeyName = `VITE_${provider.toUpperCase()}_API_KEY`;
  return import.meta.env[envKeyName] || '';
}

/**
 * プロバイダーごとのAPIキーを保存
 */
export function setApiKey(provider, key, persist = false) {
  const storage = persist ? localStorage : sessionStorage;
  const otherStorage = persist ? sessionStorage : localStorage;

  // 既存のキー群を読み込み
  let keys = {};
  const existing = storage.getItem(API_KEYS_STORAGE_KEY) || otherStorage.getItem(API_KEYS_STORAGE_KEY);
  if (existing) {
    try { keys = JSON.parse(existing); } catch { /* ignore */ }
  }

  // キーを更新
  if (key) {
    keys[provider] = key;
  } else {
    delete keys[provider];
  }

  storage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  otherStorage.removeItem(API_KEYS_STORAGE_KEY); // 重複を避ける

  // レガシーキーとの同期 (Googleの場合)
  if (provider === 'google') {
    if (persist) {
      localStorage.setItem(LEGACY_GEMINI_KEY, key);
      sessionStorage.removeItem(LEGACY_GEMINI_KEY);
    } else {
      sessionStorage.setItem(LEGACY_GEMINI_KEY, key);
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    }
  }
}

/**
 * フェーズ（処理パート）ごとのモデルIDを取得
 */
export function getPhaseModel(phaseId) {
  const stored = localStorage.getItem(PHASE_MODELS_STORAGE_KEY);
  if (stored) {
    try {
      const models = JSON.parse(stored);
      if (models[phaseId]) return models[phaseId];
    } catch {
      // JSON parse failure
    }
  }

  // デフォルト値 (後ほど llmConfig と連携)
  // 初回は Gemini 1.5 Flash (legacy) や llmConfig のデフォルトを想定
  return null; 
}

/**
 * フェーズごとのモデルIDを保存
 */
export function setPhaseModel(phaseId, modelId) {
  let models = {};
  const existing = localStorage.getItem(PHASE_MODELS_STORAGE_KEY);
  if (existing) {
    try { models = JSON.parse(existing); } catch { /* ignore */ }
  }
  models[phaseId] = modelId;
  localStorage.setItem(PHASE_MODELS_STORAGE_KEY, JSON.stringify(models));
}

export function clearAllConfig() {
  localStorage.removeItem(API_KEYS_STORAGE_KEY);
  sessionStorage.removeItem(API_KEYS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_GEMINI_KEY);
  sessionStorage.removeItem(LEGACY_GEMINI_KEY);
  localStorage.removeItem(PHASE_MODELS_STORAGE_KEY);
}

export function hasApiKey(provider = 'google') {
  return !!getApiKey(provider);
}

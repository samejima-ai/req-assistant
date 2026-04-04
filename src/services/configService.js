/**
 * configService
 * 
 * 責務: Gemini APIキーの取得と保存（localStorage / sessionStorage / 環境変数）
 * 
 * - getApiKey(): 有効なキーを優先度の高い順に取得
 * - setApiKey(key, persist): キーを保存
 * - clearApiKey(): 保存されたキーを削除
 * - hasApiKey(): キーが設定されているか確認
 */

const STORAGE_KEY = 'vibe-architect-gemini-api-key';

export function getApiKey() {
  // 1. SessionStorage (一番セキュア、タブを閉じると消える)
  const sessionKey = sessionStorage.getItem(STORAGE_KEY);
  if (sessionKey) return sessionKey;

  // 2. LocalStorage (永続化)
  const localKey = localStorage.getItem(STORAGE_KEY);
  if (localKey) return localKey;

  // 3. 環境変数 (ビルド時またはVercelの設定)
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

/**
 * APIキーを保存する
 * @param {string} key APIキー
 * @param {boolean} persist localStorageに保存するかどうか
 */
export function setApiKey(key, persist = false) {
  if (persist) {
    localStorage.setItem(STORAGE_KEY, key);
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, key);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasApiKey() {
  return !!getApiKey();
}

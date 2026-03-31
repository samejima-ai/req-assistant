/**
 * Result型 - 全非同期処理のSuccess/Failureを型で表現する
 *
 * ARC原則: 標準化されたエラーハンドリング（RL）
 * 全ての非同期処理はこのResult型を返すことで、呼び出し側が
 * success/failure を明示的に処理することを強制する。
 *
 * @template T
 * @typedef {{ ok: true, value: T }} Success
 *
 * @typedef {'API_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR' | 'STORAGE_ERROR' | 'VALIDATION_ERROR'} ErrorCode
 *
 * @typedef {{ ok: false, code: ErrorCode, message: string, retryable: boolean }} Failure
 *
 * @template T
 * @typedef {Success<T> | Failure} Result
 */

/**
 * @template T
 * @param {T} value
 * @returns {Success<T>}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * @param {ErrorCode} code
 * @param {string} message
 * @param {boolean} [retryable]
 * @returns {Failure}
 */
export function fail(code, message, retryable = false) {
  return { ok: false, code, message, retryable };
}

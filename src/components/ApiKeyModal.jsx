/**
 * ApiKeyModal
 * 
 * 責務: Gemini APIキーの設定・保存・検証（初回アクセス時および設定変更用）
 * 
 * - APIキーの入力（マスク表示）
 * - 保存先（localStorage / sessionStorage）の選択
 * - 疎通確認（テスト実行）
 */

import { useState } from 'react';
import { setApiKey, clearApiKey, getApiKey } from '../services/configService.js';
import { callGenerateContent } from '../services/geminiClient.js';
import { MODELS } from '../services/geminiConfig.js';

const SpinnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export default function ApiKeyModal({ onClose, onConfigSaved }) {
  const [key, setKey] = useState(getApiKey());
  const [persist, setPersist] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'success' | 'error' | null

  const handleTestConnection = async () => {
    if (!key) return;
    setIsTesting(true);
    setTestResult(null);

    // 一時的にキーをセットしてテスト
    const originalKey = getApiKey();
    // 実際に保存せずに注入してテストするための仕組みがないので、configService経由で一時的にセットする
    setApiKey(key, false); 

    try {
      await callGenerateContent({
        modelId: MODELS.chat,
        contents: [{ role: 'user', parts: [{ text: 'connection test. reply with "ok"' }] }],
        timeoutMs: 10000
      });
      setTestResult('success');
    } catch (e) {
      console.error('API Test failed:', e);
      setTestResult('error');
      // 失敗した場合は元のキーに戻す（またはクリア）
      setApiKey(originalKey, false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!key) {
      clearApiKey();
    } else {
      setApiKey(key, persist);
    }
    onConfigSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <h2 className="text-xl font-bold text-gray-800">Gemini API 設定</h2>
          <p className="text-xs text-gray-500 mt-1">
            アプリの動作にはGoogle GeminiのAPIキーが必要です。
          </p>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-5">
          {/* API Key Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-24"
              />
              <button
                onClick={handleTestConnection}
                disabled={!key || isTesting}
                className="absolute right-2 top-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isTesting ? <SpinnerIcon /> : '疎通確認'}
              </button>
            </div>
            
            {testResult === 'success' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 animate-in fade-in slide-in-from-top-1">
                <CheckCircleIcon />
                <span>APIキーは有効です</span>
              </div>
            )}
            {testResult === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 animate-in fade-in slide-in-from-top-1">
                <AlertTriangleIcon />
                <span>接続に失敗しました。キーを確認してください</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              キーをお持ちでない場合は <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a> で無料で取得できます。
            </p>
          </div>

          {/* Persistence Toggle */}
          <div className="bg-gray-50 p-4 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="persist-key"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <div className="cursor-pointer" onClick={() => setPersist(!persist)}>
                <label className="block text-sm font-medium text-gray-700 cursor-pointer">
                  このデバイスに保存する（推奨）
                </label>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                  チェックを入れると、次回以降も自動的にキーを維持します（localStorageを使用）。チェックを外すとタブを閉じた際にクリアされます（sessionStorageを使用）。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 flex gap-3 text-amber-800">
            <div className="shrink-0 mt-0.5 font-bold text-sm">⚠️</div>
            <p className="text-[11px] leading-relaxed">
              APIキーはブラウザ内にのみ保存され、開発者には送信されません。
              共有PCなどでは保存しない（チェックを外す）ことをお勧めします。
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            設定を保存
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ApiKeyModal
 *
 * 責務: デスクトップ用 APIキー設定オーバーレイ
 * コンテンツは ApiKeyPanel に委譲。
 */
import ApiKeyPanel from './ApiKeyPanel.jsx';

export default function ApiKeyModal({ onClose, onConfigSaved }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <h2 className="text-xl font-bold text-gray-800">AI モデル設定</h2>
          <p className="text-xs text-gray-500 mt-1">
            処理目的に合わせたAIモデルの選択とAPIキーの設定を行います。
          </p>
        </div>
        <ApiKeyPanel onClose={onClose} onConfigSaved={onConfigSaved} embedded={false} />
      </div>
    </div>
  );
}

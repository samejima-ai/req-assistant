/**
 * ExportModal
 *
 * 責務: デスクトップ用 設計データ出力オーバーレイ
 * コンテンツは ExportPanel に委譲。
 */
import ExportPanel from './ExportPanel.jsx';

export default function ExportModal({ nodes, edges, requirementDoc, isUpdatingDoc, onUpdateRequirement, techConstraints, onUpdateTechConstraints, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div>
            <h2 className="text-lg font-bold text-gray-800">開発AI向け 設計データ出力</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              要件定義書 + 構造化JSONを結合してエージェントに投入可能
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <ExportPanel
          nodes={nodes}
          edges={edges}
          requirementDoc={requirementDoc}
          isUpdatingDoc={isUpdatingDoc}
          onUpdateRequirement={onUpdateRequirement}
          techConstraints={techConstraints}
          onUpdateTechConstraints={onUpdateTechConstraints}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

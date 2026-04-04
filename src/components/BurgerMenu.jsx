/**
 * BurgerMenu
 *
 * 責務: モバイル用ハンバーガーメニュー
 * スライドアップドロワー + アコーディオン3パネルで
 * APIキー設定・設計データ出力・リセットを提供する。
 *
 * Props:
 *   onResetConfirmed          - 確認なしで直接リセットするコールバック
 *   nodes, edges              - ExportPanel に渡すデータ
 *   requirementDoc            - 要件定義書テキスト
 *   isUpdatingDoc             - 要件定義書生成中フラグ
 *   onUpdateRequirement       - 要件定義書再生成コールバック
 *   techConstraints           - 技術制約テキスト
 *   onUpdateTechConstraints   - 技術制約更新コールバック
 */
import { useState, useEffect, useCallback } from 'react';
import ApiKeyPanel from './ApiKeyPanel.jsx';
import ExportPanel from './ExportPanel.jsx';

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const SettingsExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Cog (Settings) */}
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

function AccordionItem({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span>{icon}</span>
          {title}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px]' : 'max-h-0'}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function BurgerMenu({
  onResetConfirmed,
  nodes,
  edges,
  requirementDoc,
  isUpdatingDoc,
  onUpdateRequirement,
  techConstraints,
  onUpdateTechConstraints,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState(null); // 'settings' | 'export' | 'reset' | null
  const [confirmReset, setConfirmReset] = useState(false);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setConfirmReset(false);
  }, []);

  // ドロワー開閉でbodyスクロールを制御
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }
    return () => document.body.classList.remove('drawer-open');
  }, [isOpen]);

  const toggleAccordion = (key) => {
    setOpenAccordion(prev => prev === key ? null : key);
    if (key !== 'reset') setConfirmReset(false);
  };

  const handleReset = () => {
    onResetConfirmed();
    setConfirmReset(false);
    closeDrawer();
  };

  return (
    <>
      {/* ハンバーガーボタン (FAB) */}
      <button
        onClick={() => setIsOpen(v => !v)}
        aria-label="メニューを開く"
        className={`fixed bottom-[72px] left-4 z-50 w-14 h-14 flex items-center justify-center rounded-full focus:outline-none transition-all duration-200 ${isOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100 active:scale-90'}`}
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
        }}
      >
        <span className="text-white">
          <SettingsExportIcon />
        </span>
      </button>

      {/* バックドロップ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeDrawer}
        />
      )}

      {/* ドロワー */}
      <div
        className={`fixed inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          bottom: '56px',
          maxHeight: 'calc(90vh - 56px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* ドラッグハンドル */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">メニュー</h2>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="メニューを閉じる"
          >
            <CloseIcon />
          </button>
        </div>

        {/* アコーディオンリスト */}
        <div className="flex-1 overflow-y-auto">
          {/* 設定 */}
          <AccordionItem
            title="Gemini API 設定"
            icon="⚙️"
            isOpen={openAccordion === 'settings'}
            onToggle={() => toggleAccordion('settings')}
          >
            <div className="bg-gray-50/50">
              <ApiKeyPanel
                onClose={() => setOpenAccordion(null)}
                embedded={true}
              />
            </div>
          </AccordionItem>

          {/* 設計データ出力 */}
          <AccordionItem
            title="設計データを出力"
            icon="🚀"
            isOpen={openAccordion === 'export'}
            onToggle={() => toggleAccordion('export')}
          >
            <ExportPanel
              nodes={nodes}
              edges={edges}
              requirementDoc={requirementDoc}
              isUpdatingDoc={isUpdatingDoc}
              onUpdateRequirement={onUpdateRequirement}
              techConstraints={techConstraints}
              onUpdateTechConstraints={onUpdateTechConstraints}
              onClose={null}
            />
          </AccordionItem>

          {/* リセット */}
          <AccordionItem
            title="リセット"
            icon="🔄"
            isOpen={openAccordion === 'reset'}
            onToggle={() => toggleAccordion('reset')}
          >
            <div className="px-5 py-4">
              {!confirmReset ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">会話とキャンバスのすべてのデータを削除します。</p>
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full py-2.5 px-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    リセットする
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-red-600 mb-4">本当にリセットしますか？この操作は元に戻せません。</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                    >
                      はい、リセット
                    </button>
                  </div>
                </div>
              )}
            </div>
          </AccordionItem>
        </div>
      </div>
    </>
  );
}

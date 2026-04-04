/**
 * MobileNav
 *
 * 責務: モバイル用ボトムナビゲーションバー
 * チャットパネルとキャンバスパネルをアイコンタップで切り替える。
 *
 * Props:
 *   activePanel   - 'chat' | 'canvas'
 *   onSelectPanel - (panel: string) => void
 */

const ChatIcon = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const CanvasIcon = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" fill={active ? 'currentColor' : 'none'}></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

export default function MobileNav({ activePanel, onSelectPanel }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        onClick={() => onSelectPanel('chat')}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
          ${activePanel === 'chat' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        aria-label="チャット"
      >
        <ChatIcon active={activePanel === 'chat'} />
        <span className="text-[10px] font-medium">チャット</span>
      </button>
      <button
        onClick={() => onSelectPanel('canvas')}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
          ${activePanel === 'canvas' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        aria-label="キャンバス"
      >
        <CanvasIcon active={activePanel === 'canvas'} />
        <span className="text-[10px] font-medium">キャンバス</span>
      </button>
    </nav>
  );
}

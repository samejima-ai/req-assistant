/**
 * ChatPane
 *
 * 責務: メッセージ表示 + テキスト入力 + エラー通知
 *
 * ARC原則（疎結合）:
 * - ビジネスロジックを一切持たない純粋なUIコンポーネント
 * - 全ての状態とコールバックをpropsで受け取る
 * - 保存・API通信・セッション管理はApp/useChatSessionが担う
 *
 * Input:  messages, isLoading, error, onSendMessage, onClearError, onReset
 * Output: void (コールバック経由)
 */
import { useState, useRef, useEffect } from 'react';

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"></polyline>
    <path d="M3.51 15a9 9 0 1 0 .49-3.8"></path>
  </svg>
);

export default function ChatPane({ messages, isLoading, error, onSendMessage, onClearError, onReset }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="w-full h-full flex flex-col border-r border-gray-200 bg-gray-50/50 shadow-lg z-10 relative">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
            要件定義アシスタント
          </h1>
          <p className="text-xs text-gray-500 mt-1">作りたいものを教えてください</p>
        </div>
        <button
          onClick={onReset}
          title="リセット"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors mt-1"
        >
          <ResetIcon />
          リセット
        </button>
      </div>

      {/* エラーバナー（retryable時のみ表示） */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-600">
          <span>{error.code}: {error.message.slice(0, 60)}</span>
          <button onClick={onClearError} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none'
                }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="要件を入力..."
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

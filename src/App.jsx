/**
 * App
 *
 * 責務: アプリケーションのルートコンポーネント・Orchestrator
 *
 * ARC原則（OC による制御）:
 * - useCanvasStore  → nodes/edges の SSOT
 * - useChatSession  → 会話履歴 + API呼び出し
 * - 保存（副作用）  → messages変化時に store.persist() を呼ぶuseEffectに集約
 *                     ChatPane から保存ロジックを完全排除
 * - リセット        → store.reset() + clearSavedProject() のみ（window.reloadなし）
 *
 * 依存関係（依存関係の可視化）:
 * - useCanvasStore  ← useProjectStorage（localStorage）
 * - useChatSession  ← geminiService（Gemini API）
 * - CanvasPane      ← useAutoLayout, useWireframe（純粋計算）
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useCanvasStore } from './hooks/useCanvasStore.js';
import { useChatSession, INITIAL_MESSAGE } from './hooks/useChatSession.js';
import { loadSavedProject, clearSavedProject } from './hooks/useProjectStorage.js';
import { toFlowNode, toFlowEdge } from './utils/layoutUtils.js';
import ChatPane from './components/ChatPane.jsx';
import CanvasPane from './components/CanvasPane.jsx';
import ExportModal from './components/ExportModal.jsx';
import { generateRequirementDoc } from './services/requirementDocService.js';
import { usePaneResize } from './hooks/usePaneResize.js';

function loadInitialState() {
  const saved = loadSavedProject();
  return {
    nodes: saved?.nodes ?? [],
    edges: saved?.edges ?? [],
    messages: saved?.messages ?? [INITIAL_MESSAGE]
  };
}

export default function App() {
  // useRefで初回レンダリング時のみlocalStorageを読む（再レンダリングで再実行しない）
  const initialRef = useRef(null);
  if (!initialRef.current) initialRef.current = loadInitialState();
  const initial = initialRef.current;

  const [showExport, setShowExport] = useState(false);
  const { chatWidthPercent, handleMouseDown } = usePaneResize();

  // SSOT: ノード/エッジの全操作はこのストア経由
  const store = useCanvasStore(initial.nodes, initial.edges, initial.messages);

  // 会話セッション: ノード/エッジ更新はstoreに委譲
  const chat = useChatSession(store.mergeNodesEdges, initial.messages);

  // 要件定義ドキュメントの状態 (ライブプレビュー & エクスポート用)
  const [requirementDoc, setRequirementDoc] = useState('');
  const [isUpdatingDoc, setIsUpdatingDoc] = useState(false);

  // 要件定義の更新関数
  // chat.messages は引数で受け取る設計にして、useCallback依存から外す（循環参照を回避）
  const handleUpdateRequirement = useCallback(async (msgs) => {
    if (isUpdatingDoc) return;
    setIsUpdatingDoc(true);
    const result = await generateRequirementDoc(msgs);
    if (result.ok) {
      setRequirementDoc(result.value);
    }
    setIsUpdatingDoc(false);
  }, [isUpdatingDoc]);

  // 副作用の集約: messages または nodes/edges が変化したらlocalStorageに保存
  useEffect(() => {
    if (chat.messages.length > 1) {
      store.persist(chat.messages);

      // AIの返答が完了したら要件定義書をバックグラウンドで更新
      const lastMessage = chat.messages[chat.messages.length - 1];
      if (lastMessage.role === 'assistant' && !chat.isLoading) {
        handleUpdateRequirement(chat.messages);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.isLoading, store.nodes, store.edges]);

  const handleReset = useCallback(() => {
    if (!window.confirm('会話とキャンバスをリセットしますか？')) return;
    clearSavedProject();
    store.reset();
    // messagesリセット: useChatSessionのsetMessagesを利用
    chat.setMessages([INITIAL_MESSAGE]);
  }, [store, chat]);

  // CanvasPane/ExportModal から引数なしで呼ばれるラッパー（最新のmessagesを自動で渡す）
  const handleUpdateRequirementNow = useCallback(() => {
    handleUpdateRequirement(chat.messages);
  }, [handleUpdateRequirement, chat.messages]);

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden">
      {/* ChatPane: 幅はドラッグで可変 */}
      <div style={{ width: `${chatWidthPercent}%`, flexShrink: 0 }} className="flex flex-col min-w-0">
        <ChatPane
          messages={chat.messages}
          isLoading={chat.isLoading}
          error={chat.error}
          onSendMessage={chat.sendMessage}
          onClearError={chat.clearError}
          onReset={handleReset}
        />
      </div>

      {/* ドラッグハンドル */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors duration-150 z-30"
        title="ドラッグしてペイン幅を調整"
      />
      <CanvasPane
        nodes={store.nodes}
        edges={store.edges}
        onUpdateNodeData={store.updateNodeData}
        onRemoveNode={store.removeNode}
        onAddEdge={store.addEdge}
        onNodeDragStop={(nodeId, position) => {
          // ドラッグ後の位置をストアに反映（保存対象）
          store.setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, position } : n
          ));
        }}
        onShowExport={() => setShowExport(true)}
        requirementDoc={requirementDoc}
        isUpdatingDoc={isUpdatingDoc}
        onUpdateRequirement={handleUpdateRequirementNow}
      />
      {showExport && (
        <ExportModal
          nodes={store.nodes}
          edges={store.edges}
          messages={chat.messages}
          requirementDoc={requirementDoc}
          isUpdatingDoc={isUpdatingDoc}
          onUpdateRequirement={handleUpdateRequirementNow}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

/**
 * App
 *
 * 責務: アプリケーションのルートコンポーネント・薄いUI Shell
 *
 * フェーズ1+2改修後のARC原則:
 * - useCanvasStore  → nodes/edges の SSOT
 * - useChatSession  → 会話履歴 + API呼び出し
 * - useAgentOrchestrator → LLM副作用の集約（要件定義書更新・レビュー生成）
 *                           useEffect によるLLM処理は useAgentOrchestrator に移譲済み
 * - 保存（副作用）  → messages変化時に store.persist() を呼ぶuseEffectに集約
 *                     このuseEffectのみが App.jsx に残る（LLM処理は含まない）
 * - リセット        → store.reset() + clearSavedProject() + agent.reset()
 *
 * 依存関係:
 * - useCanvasStore  ← useProjectStorage（localStorage）
 * - useChatSession  ← geminiService（Gemini API）
 * - useAgentOrchestrator ← requirementDocService, reviewService（Gemini API）
 *                          ← buildSystemContext（SSOT統合）
 * - CanvasPane      ← useAutoLayout, useWireframe（純粋計算）
 */
import { useCallback, useState, useEffect } from 'react';
import { useCanvasStore } from './hooks/useCanvasStore.js';
import { useChatSession, INITIAL_MESSAGE } from './hooks/useChatSession.js';
import { loadSavedProject, clearSavedProject } from './hooks/useProjectStorage.js';
import { useAgentOrchestrator } from './hooks/useAgentOrchestrator.js';
import ChatPane from './components/ChatPane.jsx';
import CanvasPane from './components/CanvasPane.jsx';
import ExportModal from './components/ExportModal.jsx';
import { usePaneResize } from './hooks/usePaneResize.js';
import { useConsistencyCheck } from './hooks/useConsistencyCheck.js';

function loadInitialState() {
  const saved = loadSavedProject();
  return {
    nodes: saved?.nodes ?? [],
    edges: saved?.edges ?? [],
    messages: saved?.messages ?? [INITIAL_MESSAGE]
  };
}

export default function App() {
  // 初回のみlocalStorageから読み込む
  const [initial] = useState(() => loadInitialState());

  const [showExport, setShowExport] = useState(false);
  const { chatWidthPercent, handleMouseDown } = usePaneResize();

  // SSOT: ノード/エッジの全操作はこのストア経由
  const store = useCanvasStore(initial.nodes, initial.edges, initial.messages);

  // 会話セッション: ノード/エッジ更新はstoreに委譲
  // ゲッター経由で現在のキャンバス状態をgeminiServiceに渡す（クロージャ問題を回避）
  const chat = useChatSession(
    store.mergeNodesEdges,
    initial.messages,
    () => ({ nodes: store.nodes, edges: store.edges })
  );

  // ルールベース自動整合性チェック（毎ターン自動実行・同期処理）
  const consistencyResult = useConsistencyCheck(store.nodes, store.edges);

  // フェーズ2: LLM副作用の集約（要件定義書更新・レビュー生成）
  // App.jsx から useEffect ベースのLLM処理を完全排除し、ここに委譲
  const agent = useAgentOrchestrator(
    chat.messages,
    chat.isLoading,
    store.nodes,
    store.edges
  );

  // 永続化のみの副作用（LLM処理は含まない・useAgentOrchestratorに移譲済み）
  // 永続化のみの副作用
  useEffect(() => {
    if (chat.messages.length > 1) {
      store.persist(chat.messages);
    }
  }, [chat.messages, store.persist]);

  const handleReset = useCallback(() => {
    if (!window.confirm('会話とキャンバスをリセットしますか？')) return;
    clearSavedProject();
    store.reset();
    chat.setMessages([INITIAL_MESSAGE]);
    chat.setInputText('');
    agent.reset();
  }, [store, chat, agent]);

  const handlePushToChat = useCallback((text) => {
    chat.setInputText(prev => {
      const separator = prev.trim() ? '\n' : '';
      return prev + separator + text;
    });
  }, [chat]);

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden">
      {/* ChatPane: 幅はドラッグで可変 */}
      <div style={{ width: `${chatWidthPercent}%`, flexShrink: 0 }} className="flex flex-col min-w-0">
        <ChatPane
          messages={chat.messages}
          isLoading={chat.isLoading}
          thinkingStatus={chat.thinkingStatus}
          error={chat.error}
          onSendMessage={chat.sendMessage}
          onClearError={chat.clearError}
          onReset={handleReset}
          inputText={chat.inputText}
          onInputChange={chat.setInputText}
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
        onUpdateEdgeData={store.updateEdgeData}
        onRemoveEdge={store.removeEdge}
        onNodeDragStop={(nodeId, position) => {
          store.setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, position } : n
          ));
        }}
        onShowExport={() => setShowExport(true)}
        requirementDoc={agent.requirementDoc}
        isUpdatingDoc={agent.isUpdatingDoc}
        onUpdateRequirement={agent.requestRequirementUpdate}
        consistencyResult={consistencyResult}
        reviewReport={agent.reviewReport}
        isGeneratingReview={agent.isGeneratingReview}
        onGenerateReview={agent.requestReview}
        onPushToChat={handlePushToChat}
      />
      {showExport && (
        <ExportModal
          nodes={store.nodes}
          edges={store.edges}
          requirementDoc={agent.requirementDoc}
          isUpdatingDoc={agent.isUpdatingDoc}
          onUpdateRequirement={agent.requestRequirementUpdate}
          techConstraints={agent.techConstraints}
          onUpdateTechConstraints={agent.setTechConstraints}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

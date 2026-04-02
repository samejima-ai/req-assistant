/**
 * useChatSession
 *
 * 責務: 会話履歴の管理 + Gemini API呼び出しの調停
 *
 * ARC原則:
 * - 副作用（API通信）は geminiService に委譲
 * - Result型でSuccess/Failureを明示的に処理
 * - ノード/エッジへの変換は layoutUtils に委譲（純粋関数）
 *
 * Input:  onUpdate(nodes, edges) callback, initialMessages[]
 * Output: { messages, isLoading, error, sendMessage, clearError }
 *
 * 依存: geminiService, layoutUtils
 */
import { useState, useCallback, useRef } from 'react';
import { extractRequirements } from '../services/geminiService.js';
import { toFlowNode, toFlowEdge } from '../utils/layoutUtils.js';

export const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'こんにちは！アプリ開発の要件定義アシスタントです。\n作りたいアプリについて、思いつくままに教えてください。\n例：「現場の職人さんがスマホで日報を書けるようにしたい」など、ふんわりとした内容で大丈夫です。'
};

/**
 * @param {(nodes: import('reactflow').Node[], edges: import('reactflow').Edge[]) => void} onUpdate
 * @param {Array} [initialMessages]
 * @param {(() => { nodes: Array, edges: Array }) | null} [getNodesEdges] - 現在のキャンバス状態ゲッター
 */
export function useChatSession(onUpdate, initialMessages, getNodesEdges = null) {
  const [messages, setMessages] = useState(initialMessages ?? [INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  // エラー状態: { code, message, retryable } | null
  const [error, setError] = useState(null);
  // getNodesEdges は毎レンダーで変わりうるため ref で保持してクロージャ問題を回避
  const getNodesEdgesRef = useRef(getNodesEdges);
  getNodesEdgesRef.current = getNodesEdges;

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    const userMessage = { role: 'user', content: text };
    // 不変: 新しい配列を生成（次回API呼び出し用に変数に保持）
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);
    setThinkingStatus('');

    // 現在のキャンバス状態を取得（ゲッターが未設定の場合は空配列）
    const { nodes = [], edges = [] } = getNodesEdgesRef.current?.() ?? {};

    // Success path（nextMessagesを渡すことでクロージャによる古い参照を回避）
    const result = await extractRequirements(nextMessages, text, nodes, edges, setThinkingStatus);

    if (result.ok) {
      const { chatReply, nodes, edges } = result.value;

      setMessages(prev => [...prev, { role: 'assistant', content: chatReply }]);

      if (nodes.length > 0 || edges.length > 0) {
        const flowNodes = nodes.map(n => toFlowNode(n));
        const flowEdges = edges.map(e => toFlowEdge(e));
        onUpdate(flowNodes, flowEdges);
      }
    } else {
      // Failure path: エラーをstateに格納（例外を投げない）
      setError({ code: result.code, message: result.message, retryable: result.retryable });

      const errorMsg = result.retryable
        ? 'APIに接続できませんでした。しばらくしてから再試行してください。'
        : 'エラーが発生しました。入力内容を確認してもう一度お試しください。';

      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    }

    setThinkingStatus('');
    setIsLoading(false);
  }, [messages, isLoading, onUpdate]);

  return { messages, setMessages, inputText, setInputText, isLoading, thinkingStatus, error, clearError, sendMessage };
}

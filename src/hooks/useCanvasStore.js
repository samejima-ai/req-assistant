/**
 * useCanvasStore
 *
 * ARC原則に基づくキャンバス状態の単一ストア。
 * - nodes/edges の SSOT（Single Source of Truth）をここに集約
 * - CanvasPane の ReactFlow 内編集（ドラッグ・インライン編集）も
 *   このストアを経由して反映し、App/CanvasPane の二重管理を解消
 * - 副作用（localStorage保存）はここで一元管理
 *
 * Input:  initialNodes[], initialEdges[]  (localStorageから復元)
 * Output: nodes, edges, および各種mutate関数
 */
import { useState, useCallback } from 'react';
import { saveProject } from './useProjectStorage.js';

/**
 * @param {import('reactflow').Node[]} initialNodes
 * @param {import('reactflow').Edge[]} initialEdges
 * @param {Array}                      initialMessages
 */
export function useCanvasStore(initialNodes, initialEdges, initialMessages) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // ---------- mutate ----------

  /**
   * 新規ノード/エッジをマージ（IDが重複するものはスキップ）
   * Input:  ReactFlow Node[], ReactFlow Edge[]
   * Output: void（内部状態を不変的に更新）
   */
  const mergeNodesEdges = useCallback((newNodes, newEdges) => {
    setNodes(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      return [...prev, ...newNodes.filter(n => !existingIds.has(n.id))];
    });
    setEdges(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      return [...prev, ...newEdges.filter(e => !existingIds.has(e.id))];
    });
  }, []);

  /**
   * CanvasPaneのReactFlow内部からノード変更を受け取る（ドラッグ・インライン編集）
   * ReactFlow の onNodesChange に渡す代わりにこれを使う
   * Input:  ReactFlow NodeChange[]
   * Output: void
   */
  const applyNodeChanges = useCallback((changes) => {
    setNodes(prev => {
      // position変更と data変更（インライン編集）を不変的に適用
      return prev.map(node => {
        const change = changes.find(c => c.id === node.id);
        if (!change) return node;
        if (change.type === 'position' && change.position) {
          return { ...node, position: change.position };
        }
        if (change.type === 'remove') return null;
        return node;
      }).filter(Boolean);
    });
  }, []);

  /**
   * CanvasPaneのReactFlow内部からエッジ変更を受け取る
   */
  const applyEdgeChanges = useCallback((changes) => {
    setEdges(prev => {
      return prev.map(edge => {
        const change = changes.find(c => c.id === edge.id);
        if (!change) return edge;
        if (change.type === 'remove') return null;
        return edge;
      }).filter(Boolean);
    });
  }, []);

  /**
   * ノード1件のdataを更新（インライン編集の結果反映用）
   * Input:  nodeId: string, newData: Partial<NodeData>
   */
  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes(prev =>
      prev.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n)
    );
  }, []);

  /**
   * ノードとそれに繋がるエッジを削除
   * Input:  nodeId: string
   */
  const removeNode = useCallback((nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, []);

  /**
   * 手動でエッジを追加（ReactFlow の onConnect から）
   */
  const addEdge = useCallback((edge) => {
    setEdges(prev => {
      if (prev.find(e => e.id === edge.id)) return prev;
      return [...prev, edge];
    });
  }, []);

  /**
   * 全状態をリセット（不変: 新しい空配列を生成）
   */
  const reset = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  /**
   * 現在のnodes/edges/messagesをlocalStorageに保存
   * messagesはuseChatSessionが持つため、呼び出し側から渡す
   * Input:  messages: Array
   */
  const persist = useCallback((messages) => {
    saveProject(nodes, edges, messages);
  }, [nodes, edges]);

  return {
    nodes,
    edges,
    setNodes,      // ReactFlowProviderのuseNodesState代替として直接渡す
    setEdges,
    mergeNodesEdges,
    applyNodeChanges,
    applyEdgeChanges,
    updateNodeData,
    removeNode,
    addEdge,
    reset,
    persist,
  };
}

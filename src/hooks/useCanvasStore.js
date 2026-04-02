/**
 * useCanvasStore
 *
 * ARC原則に基づくキャンバス状態の単一ストア。
 * - nodes/edges の SSOT（Single Source of Truth）をここに集約
 * - CanvasPane の ReactFlow 内編集（ドラッグ・インライン編集）も
 *   このストアを経由して反映し、App/CanvasPane の二重管理を解消
 * - 副作用（localStorage保存）はここで一元管理
 *
 * Input:  initialNodes[], initialEdges[] (localStorageから復元)
 * Output: nodes, edges, および各種mutate関数
 */
import { useState, useCallback } from 'react';
import { saveProject } from './useProjectStorage.js';

export function useCanvasStore(initialNodes, initialEdges) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // ---------- mutate ----------

  /**
   * 新規ノード/エッジをマージ（IDが重複するものはスキップ）
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
   * CanvasPaneのReactFlow内部からノード変更を受け取る
   */
  const applyNodeChanges = useCallback((changes) => {
    setNodes(prev => {
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
   * ノード1件のdataを更新
   */
  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes(prev =>
      prev.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n)
    );
  }, []);

  /**
   * エッジ1件のプロパティを更新（種別変更など）
   */
  const updateEdgeData = useCallback((edgeId, newData) => {
    setEdges(prev =>
      prev.map(e => e.id === edgeId ? { ...e, ...newData } : e)
    );
  }, []);

  /**
   * ノードとそれに繋がるエッジを削除
   */
  const removeNode = useCallback((nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, []);

  /**
   * エッジ1件を削除
   */
  const removeEdge = useCallback((edgeId) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  /**
   * 手動でエッジを追加
   */
  const addEdge = useCallback((edge) => {
    setEdges(prev => {
      if (prev.find(e => e.id === edge.id)) return prev;
      return [...prev, edge];
    });
  }, []);

  /**
   * 全状態をリセット
   */
  const reset = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  /**
   * localStorageに保持
   */
  const persist = useCallback((messages) => {
    saveProject(nodes, edges, messages);
  }, [nodes, edges]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    mergeNodesEdges,
    applyNodeChanges,
    applyEdgeChanges,
    updateNodeData,
    updateEdgeData,
    removeNode,
    removeEdge,
    addEdge,
    reset,
    persist,
  };
}

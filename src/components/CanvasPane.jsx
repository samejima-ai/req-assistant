/**
 * CanvasPane
 *
 * 責務: ReactFlow によるノード/エッジの描画 + ユーザーインタラクション
 *
 * ARC原則:
 * - レイアウト計算 → useAutoLayout に委譲
 * - ワイヤーフレーム生成 → useWireframe に委譲
 * - Mermaid図生成 → useMermaidDiagram に委譲
 * - ノード/エッジの状態変更 → useCanvasStore のコールバック経由（直接setNodes不可）
 * - onUpdateData を data に注入することで NodeBase がストアを直接触らない構造を維持
 *
 * Input:  nodes[], edges[] (useCanvasStoreから), 各コールバック
 * Output: void (コールバック経由で親ストアを更新)
 */
import ReactFlow, {
  Controls, MiniMap, Background, BackgroundVariant,
  MarkerType, ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAutoLayout } from '../hooks/useAutoLayout.js';
import { useWireframe } from '../hooks/useWireframe.js';
import { useMermaidDiagram } from '../hooks/useMermaidDiagram.js';
import { marked } from 'marked';

// marked の設定（改行を<br>に変換）
marked.setOptions({ breaks: true, gfm: true });

/**
 * MarkdownをHTMLドキュメント文字列に変換（iframe srcDoc用）
 */
function markdownToHtmlDoc(md) {
  if (!md) return '';
  const body = marked.parse(md);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1f2937; line-height: 1.7; padding: 20px 24px; margin: 0; }
  h1 { font-size: 1.25rem; font-weight: 700; color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px; }
  h2 { font-size: 1.05rem; font-weight: 700; color: #1d4ed8; margin-top: 20px; margin-bottom: 10px; }
  h3 { font-size: 0.9rem; font-weight: 600; color: #374151; margin-top: 14px; margin-bottom: 6px; }
  p { margin: 6px 0; }
  ul, ol { padding-left: 1.4em; margin: 6px 0; }
  li { margin: 3px 0; position: relative; padding-right: 30px; }
  li:hover .action-btn { opacity: 1; }
  .action-btn { 
    position: absolute; right: 0; top: 0; opacity: 0; 
    cursor: pointer; background: #3b82f6; color: white; border: none; 
    border-radius: 4px; font-size: 10px; padding: 2px 6px; 
    transition: opacity 0.2s;
  }
  strong { color: #111827; }
  em { color: #6b7280; }
  code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 0.85em; }
  pre { background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 8px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  /* TBDセクション強調 */
  h2:has(+ ul li strong) { color: #dc2626; }
  .tbd-marker { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 2px 6px; font-size: 0.75em; color: #dc2626; font-weight: 700; }
</style>
</head>
<body>
${body}
<script>
  // リストアイテムに「チャットに送る」ボタンを動的に追加
  document.querySelectorAll('li').forEach(li => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerText = '提案';
    btn.onclick = () => {
      window.parent.postMessage(
        { type: 'push_to_chat', text: li.innerText.replace('提案', '').trim() },
        window.location.origin
      );
    };
    li.appendChild(btn);
  });
</script>
</body>
</html>`;
}

import ActorNode from './nodes/ActorNode.jsx';
import UIComponentNode from './nodes/UIComponentNode.jsx';
import DataEntityNode from './nodes/DataEntityNode.jsx';
import ActionNode from './nodes/ActionNode.jsx';
import TransitionEdge from './edges/TransitionEdge.jsx';
import DataFlowEdge from './edges/DataFlowEdge.jsx';
import ActionEdge from './edges/ActionEdge.jsx';

const nodeTypes = {
  Actor: ActorNode,
  UI_Component: UIComponentNode,
  Data_Entity: DataEntityNode,
  Action: ActionNode
};

const edgeTypes = {
  screen_transition: TransitionEdge,
  data_flow: DataFlowEdge,
  actor_action: ActionEdge,
  api_call: TransitionEdge
};

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed }
};

/**
 * @param {{
 *   nodes: import('reactflow').Node[],
 *   edges: import('reactflow').Edge[],
 *   onUpdateNodeData: (nodeId: string, data: object) => void,
 *   onRemoveNode: (nodeId: string) => void,
 *   onAddEdge: (edge: import('reactflow').Edge) => void,
 *   onUpdateEdgeData: (edgeId: string, data: object) => void,
 *   onRemoveEdge: (edgeId: string) => void,
 *   onNodeDragStop: (nodeId: string, position: {x,y}) => void,
 *   onShowExport: () => void,
 *   requirementDoc: string,
 *   isUpdatingDoc: boolean,
 *   onUpdateRequirement: () => void,
 *   consistencyResult: { issues: Array, summary: { errors: number, warnings: number } },
 *   reviewReport: string,
 *   isGeneratingReview: boolean,
 *   onGenerateReview: () => void,
 *   onPushToChat: (text: string) => void,
 * }} props
 */
function CanvasPane({
  nodes, edges, onUpdateNodeData, onRemoveNode, onAddEdge,
  onUpdateEdgeData, onRemoveEdge, onNodeDragStop, onShowExport,
  requirementDoc, isUpdatingDoc, onUpdateRequirement,
  consistencyResult, reviewReport, isGeneratingReview,
  onGenerateReview, onPushToChat,
  isMobile = false
}) {
  const [rightPanel, setRightPanel] = useState('none'); // 'none', 'wireframe', 'requirement', 'review', 'diagram'
  const [activeEdgeType, setActiveEdgeType] = useState('screen_transition');
  const [diagramSubTab, setDiagramSubTab] = useState('flow'); // 'flow', 'er'
  const [showLegend, setShowLegend] = useState(false);

  // iframeからのメッセージ（チャットへの流し込み）をハンドル
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'push_to_chat') {
        onPushToChat(event.data.text);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPushToChat]);
  const [showDiagramCode, setShowDiagramCode] = useState(false);
  // 双方向編集: クリックされたノードのIDを管理
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingNodeLabel, setEditingNodeLabel] = useState('');

  // モバイルではTB（縦フロー）、デスクトップではLR（横フロー）
  const layoutDirection = isMobile ? 'TB' : 'LR';

  // レイアウト計算（SRP: useAutoLayoutに委譲）
  const { layoutedNodes, updatePosition } = useAutoLayout(nodes, edges, layoutDirection);

  // ワイヤーフレーム生成（SRP: useWireframeに委譲）
  const wireframeHtml = useWireframe(layoutedNodes);

  // Mermaid図生成（SRP: useMermaidDiagramに委譲）
  const { flowSvg, erSvg, flowCode, erCode } = useMermaidDiagram(nodes, edges, layoutDirection);

  // onUpdateData を各ノードの data に注入（NodeBase → ストアの橋渡し）
  // useMemoでメモ化: layoutedNodesまたはonUpdateNodeDataが変わったときのみ再生成
  const nodesWithCallback = useMemo(
    () => layoutedNodes.map(n => ({
      ...n,
      data: { ...n.data, onUpdateData: onUpdateNodeData }
    })),
    [layoutedNodes, onUpdateNodeData]
  );

  const onConnect = useCallback(
    (params) => {
      const edge = {
        ...params,
        id: `edge_manual_${Date.now()}`,
        type: activeEdgeType,
        markerEnd: { type: MarkerType.ArrowClosed }
      };
      onAddEdge(edge);
    },
    [onAddEdge, activeEdgeType]
  );

  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault();
    const choice = window.prompt(`エッジ操作を選択:\n1: 削除\n2: 画面遷移に変更\n3: データフローに変更\n4: 操作に変更\n5: API呼び出しに変更\nその他: キャンセル`);

    if (choice === '1') {
      onRemoveEdge(edge.id);
    } else if (choice === '2') {
      onUpdateEdgeData(edge.id, { type: 'screen_transition' });
    } else if (choice === '3') {
      onUpdateEdgeData(edge.id, { type: 'data_flow' });
    } else if (choice === '4') {
      onUpdateEdgeData(edge.id, { type: 'actor_action' });
    } else if (choice === '5') {
      onUpdateEdgeData(edge.id, { type: 'api_call' });
    }
  }, [onRemoveEdge, onUpdateEdgeData]);

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    if (window.confirm(`「${node.data.label}」を削除しますか？`)) {
      onRemoveNode(node.id);
    }
  }, [onRemoveNode]);

  const handleNodeDragStop = useCallback((e, node) => {
    updatePosition(node.id, node.position);
    onNodeDragStop?.(node.id, node.position);
  }, [updatePosition, onNodeDragStop]);

  const toolbarBtnClass = (isActive, accentBg, accentBorder) => {
    if (isMobile) {
      return `w-9 h-9 flex items-center justify-center rounded-full shadow-md border transition-colors ${
        isActive ? `${accentBg} text-white border-transparent` : 'bg-white/90 border-gray-300 text-gray-600'
      }`;
    }
    return `flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg shadow-sm transition-colors ${
      isActive ? `${accentBg} text-white ${accentBorder} hover:opacity-90` : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
    }`;
  };

  return (
    <div className={`flex-1 min-w-0 h-full relative ${isMobile ? 'pb-14' : ''}`}>
      {/* ツールバー */}
      <div className={`absolute top-4 right-4 z-10 flex ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
        {(flowSvg || erSvg) && (
          <button
            onClick={() => setRightPanel(p => p === 'diagram' ? 'none' : 'diagram')}
            className={toolbarBtnClass(rightPanel === 'diagram', 'bg-indigo-600', 'border-indigo-600')}
            title="フロー図"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M5 9v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M12 12v3"/>
            </svg>
            {!isMobile && 'フロー図'}
          </button>
        )}
        {wireframeHtml && (
          <button
            onClick={() => setRightPanel(p => p === 'wireframe' ? 'none' : 'wireframe')}
            className={toolbarBtnClass(rightPanel === 'wireframe', 'bg-purple-600', 'border-purple-600')}
            title="ワイヤー"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            {!isMobile && 'ワイヤー'}
          </button>
        )}
        <button
          onClick={() => setRightPanel(p => p === 'requirement' ? 'none' : 'requirement')}
          className={toolbarBtnClass(rightPanel === 'requirement', 'bg-blue-600', 'border-blue-600')}
          title="要件定義"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          {!isMobile && '要件定義'}
        </button>

        {/* レビューボタン */}
        <button
          onClick={() => setRightPanel(p => p === 'review' ? 'none' : 'review')}
          className={`relative ${toolbarBtnClass(rightPanel === 'review', 'bg-amber-600', 'border-amber-600')}`}
          title="レビュー"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          {!isMobile && 'レビュー'}
          {((consistencyResult?.summary?.errors ?? 0) + (consistencyResult?.summary?.warnings ?? 0)) > 0 && rightPanel !== 'review' && (
            <span className={`absolute ${isMobile ? '-top-1 -right-1 w-4 h-4 text-[9px]' : '-top-1.5 -right-1.5 w-5 h-5 text-[10px]'} bg-red-500 text-white font-bold rounded-full flex items-center justify-center`}>
              {(consistencyResult?.summary?.errors ?? 0) + (consistencyResult?.summary?.warnings ?? 0)}
            </span>
          )}
        </button>
        
        {/* 解説/凡例ボタン */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={toolbarBtnClass(showLegend, 'bg-gray-800', 'border-gray-800')}
          title="解説と接続設定"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {!isMobile && '解説'}
        </button>

        {!isMobile && (
          <button
            onClick={onShowExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            設計データを出力
          </button>
        )}
      </div>

      {/* 凡例 & エッジ種別選択 (ポップオーバー) */}
      {showLegend && (
        <div className={`absolute top-16 right-4 z-20 bg-white/95 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-2xl text-xs text-gray-600 flex flex-col gap-3 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-1">
            <span className="font-bold text-gray-800">キャンバス解説</span>
            <button onClick={() => setShowLegend(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div>
            <div className="font-semibold text-gray-700 mb-2">ノード種別</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 flex-shrink-0"></span>アクター</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 flex-shrink-0"></span>処理</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-pink-100 border border-pink-300 flex-shrink-0"></span>UI / 画面</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 flex-shrink-0"></span>データ</div>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-2">
            <div className="font-semibold text-gray-700 mb-2">接続種別 (選択して作成)</div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => { setActiveEdgeType('screen_transition'); !isMobile && setShowLegend(false); }}
                className={`group flex items-center justify-between p-2 rounded transition-all ${activeEdgeType === 'screen_transition' ? 'bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-0.5 ${activeEdgeType === 'screen_transition' ? 'bg-blue-600' : 'bg-blue-400 opacity-60'}`}></span>
                  <span className={activeEdgeType === 'screen_transition' ? 'font-bold text-blue-700' : ''}>画面遷移</span>
                </div>
                {activeEdgeType === 'screen_transition' && <span className="text-blue-500 text-[10px]">✓</span>}
              </button>
              <button
                onClick={() => { setActiveEdgeType('data_flow'); !isMobile && setShowLegend(false); }}
                className={`group flex items-center justify-between p-2 rounded transition-colors ${activeEdgeType === 'data_flow' ? 'bg-green-50 ring-1 ring-green-500' : 'hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-0.5 border-t border-dashed ${activeEdgeType === 'data_flow' ? 'bg-green-600 border-green-600' : 'bg-green-400 border-green-400 opacity-60'}`}></span>
                  <span className={activeEdgeType === 'data_flow' ? 'font-bold text-green-700' : ''}>データフロー</span>
                </div>
                {activeEdgeType === 'data_flow' && <span className="text-green-500 text-[10px]">✓</span>}
              </button>
              <button
                onClick={() => { setActiveEdgeType('actor_action'); !isMobile && setShowLegend(false); }}
                className={`group flex items-center justify-between p-2 rounded transition-colors ${activeEdgeType === 'actor_action' ? 'bg-yellow-50 ring-1 ring-yellow-500' : 'hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-0.5 ${activeEdgeType === 'actor_action' ? 'bg-yellow-600' : 'bg-yellow-400 opacity-60'}`}></span>
                  <span className={activeEdgeType === 'actor_action' ? 'font-bold text-yellow-700' : ''}>操作</span>
                </div>
                {activeEdgeType === 'actor_action' && <span className="text-yellow-500 text-[10px]">✓</span>}
              </button>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 border-t border-gray-50 pt-2 italic">
            キャンバス上のノード/エッジを右クリックで削除・変更できます
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodesWithCallback}
        edges={edges}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // CanvasPane は ReactFlow の内部状態変更を親ストアに委譲するため
        // onNodesChange/onEdgesChange は使わない（ストアがSSOT）
      >
        <Controls />
        {!isMobile && (
          <MiniMap nodeColor={(n) => {
            const colors = { Actor: '#fef08a', UI_Component: '#fbcfe8', Data_Entity: '#bbf7d0', Action: '#bfdbfe' };
            return colors[n.type] ?? '#e5e7eb';
          }} />
        )}
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbd5e1" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-base font-medium">左のチャットで要件を話すと、ここに設計図が構築されます</p>
        </div>
      )}

      {/* サイドパネル（タブ切り替え） */}
      {rightPanel !== 'none' && (
        <div className={`absolute top-0 right-0 bottom-0 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col ${isMobile ? 'left-0 w-full' : 'w-96'}`}>
          <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex gap-1 p-1 bg-gray-200 rounded-lg">
              {(flowSvg || erSvg) && (
                <button
                  onClick={() => setRightPanel('diagram')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rightPanel === 'diagram' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  フロー図
                </button>
              )}
              <button
                onClick={() => setRightPanel('requirement')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rightPanel === 'requirement' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                要件定義
              </button>
              <button
                onClick={() => setRightPanel('wireframe')}
                disabled={!wireframeHtml}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rightPanel === 'wireframe' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-30`}
              >
                ワイヤー
              </button>
              <button
                onClick={() => setRightPanel('review')}
                className={`relative px-3 py-1 text-xs font-bold rounded-md transition-all ${rightPanel === 'review' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                レビュー
                {(() => {
                  const total = (consistencyResult?.summary?.errors ?? 0) + (consistencyResult?.summary?.warnings ?? 0);
                  return total > 0 && rightPanel !== 'review' ? (
                    <span className={`absolute ${isMobile ? '-top-1 -right-1 w-4 h-4 text-[9px]' : '-top-1 -right-1 w-4 h-4 text-[9px]'} bg-red-500 text-white font-bold rounded-full flex items-center justify-center`}>{total}</span>
                  ) : null;
                })()}
              </button>
            </div>
            <button
              onClick={() => setRightPanel('none')}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {rightPanel === 'diagram' ? (
              <>
                {/* サブタブ: 画面フロー / ER図 */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => setDiagramSubTab('flow')}
                      className={`px-3 py-1 text-xs font-bold rounded transition-all ${diagramSubTab === 'flow' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      画面フロー
                    </button>
                    <button
                      onClick={() => setDiagramSubTab('er')}
                      disabled={!erSvg}
                      className={`px-3 py-1 text-xs font-bold rounded transition-all ${diagramSubTab === 'er' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-30`}
                    >
                      ER図
                    </button>
                  </div>
                  <button
                    onClick={() => setShowDiagramCode(v => !v)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded transition-colors"
                  >
                    {showDiagramCode ? 'プレビュー' : 'コードを見る'}
                  </button>
                </div>

                <div className="flex-1 overflow-auto">
                  {showDiagramCode ? (
                    <pre className="p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap">
                      {diagramSubTab === 'flow' ? (flowCode || 'UI_Componentノードを追加すると生成されます') : (erCode || 'Data_Entityノードを追加すると生成されます')}
                    </pre>
                  ) : (
                    <div className="p-3">
                      {(diagramSubTab === 'flow' ? flowSvg : erSvg) ? (
                        <>
                          {/* SVGをReactツリーに直接埋め込み → クリックで双方向編集 */}
                          <div
                            className="mermaid-svg-container"
                            style={{ cursor: 'default' }}
                            dangerouslySetInnerHTML={{ __html: diagramSubTab === 'flow' ? flowSvg : erSvg }}
                            onClick={(e) => {
                              // useMermaidDiagramがSVG後処理でdata-node-id属性を注入済み。
                              // id属性パターン照合より安定しており、チャットターンが増えてもstaleにならない。
                              const el = e.target.closest('[data-node-id]');
                              if (!el) return;
                              const nodeId = el.getAttribute('data-node-id');
                              const matchedNode = nodes.find(n => n.id === nodeId);
                              if (!matchedNode) return;
                              setEditingNodeId(matchedNode.id);
                              setEditingNodeLabel(matchedNode.data.label ?? '');
                            }}
                          />
                          <p className="text-[10px] text-gray-400 mt-2 text-center">ノードをクリックするとラベルを編集できます</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 text-center mt-8">
                          {diagramSubTab === 'flow' ? 'UI_Componentノードを追加すると生成されます' : 'Data_Entityノードを追加すると生成されます'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 双方向編集モーダル */}
                {editingNodeId && (
                  <div className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center" onClick={() => setEditingNodeId(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-5 w-72" onClick={e => e.stopPropagation()}>
                      <h4 className="text-sm font-bold text-gray-800 mb-3">ノードを編集</h4>
                      <label className="text-xs text-gray-500 font-medium">ラベル</label>
                      <input
                        type="text"
                        value={editingNodeLabel}
                        onChange={e => setEditingNodeLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            onUpdateNodeData(editingNodeId, { label: editingNodeLabel });
                            setEditingNodeId(null);
                          }
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        autoFocus
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                      />
                      <div className="flex gap-2 mt-4 justify-end">
                        <button
                          onClick={() => setEditingNodeId(null)}
                          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => {
                            onUpdateNodeData(editingNodeId, { label: editingNodeLabel });
                            setEditingNodeId(null);
                          }}
                          className="px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                          更新
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : rightPanel === 'wireframe' ? (
              <iframe className="flex-1 w-full border-none" srcDoc={wireframeHtml} title="wireframe" sandbox="allow-same-origin" />
            ) : rightPanel === 'review' ? (
              <>
                {/* レビューパネルヘッダー */}
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    整合性レビュー
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* ルールベース自動チェック結果 */}
                  <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">自動チェック結果</p>
                    {!consistencyResult || consistencyResult.issues.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        問題は検出されませんでした
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {consistencyResult.issues.map(issue => (
                          <li key={issue.id} className={`group flex items-start gap-1.5 text-xs rounded px-2 py-1.5 ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-800'}`}>
                            <span className="flex-shrink-0 mt-0.5">{issue.severity === 'error' ? '✗' : '⚠'}</span>
                            <span className="flex-1">{issue.message}</span>
                            <button
                              onClick={() => onPushToChat(`【修正依頼】${issue.message}`)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/5 rounded transition-opacity"
                              title="チャットに送る"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* AI深掘りレビュー */}
                  <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">AIによる詳細レビュー</p>
                    <button
                      onClick={onGenerateReview}
                      disabled={isGeneratingReview}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingReview ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          分析中...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          AIに詳細レビューを依頼
                        </>
                      )}
                    </button>
                  </div>

                  {/* AIレビューレポート表示 */}
                  <div className="flex-1 relative overflow-hidden" style={{ minHeight: '200px' }}>
                    {!reviewReport && !isGeneratingReview ? (
                      <div className="p-4 text-xs text-gray-400 text-center">
                        ボタンを押すとAIが矛盾・不足を詳細分析します
                      </div>
                    ) : (
                      <>
                        {isGeneratingReview && (
                          <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                              分析中...
                            </div>
                          </div>
                        )}
                        {reviewReport && (
                          <iframe
                            className="absolute inset-0 w-full h-full border-none"
                            srcDoc={markdownToHtmlDoc(reviewReport)}
                            title="review-report"
                            sandbox="allow-same-origin"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ヘッダー */}
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    要件定義書プレビュー
                  </h3>
                  <button
                    onClick={onUpdateRequirement}
                    disabled={isUpdatingDoc}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    {isUpdatingDoc ? '更新中...' : '最新に更新'}
                  </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 relative overflow-hidden">
                  {!requirementDoc && !isUpdatingDoc ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-xs text-gray-400 mb-4">会話を始めるとここに要件がまとまります</p>
                      <button
                        onClick={onUpdateRequirement}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow hover:bg-blue-700"
                      >
                        要件定義を生成
                      </button>
                    </div>
                  ) : (
                    <>
                      {isUpdatingDoc && (
                        <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            更新中...
                          </div>
                        </div>
                      )}
                      <iframe
                        className="absolute inset-0 w-full h-full border-none"
                        srcDoc={markdownToHtmlDoc(requirementDoc)}
                        title="requirement-doc-preview"
                        sandbox="allow-same-origin"
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CanvasPaneWrapper(props) {
  return (
    <ReactFlowProvider>
      <CanvasPane {...props} />
    </ReactFlowProvider>
  );
}

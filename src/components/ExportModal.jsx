/**
 * ExportModal
 *
 * 責務: 構造化JSON + 要件定義書の生成・表示・MP出力コピー
 *
 * ARC原則:
 * - 要件定義書の生成は requirementDocService に委譲
 * - Mermaid生成は mermaidFlowGenerator / mermaidErGenerator に委譲
 * - 3タブ構成（JSON / 要件定義書 / MP出力）でユーザーに選択肢を提供
 * - MP出力 = 要件定義書 + 画面フロー図(Mermaid) + ER図(Mermaid) + 技術制約 → 1ボタンコピー
 *
 * Input:  nodes, edges, messages, techConstraints, onClose
 * Output: void (クリップボードへの副作用のみ)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateScreenFlowMermaid } from '../utils/mermaidFlowGenerator.js';
import { generateErMermaid } from '../utils/mermaidErGenerator.js';

// ---------- Icons ----------
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

const SpinnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

// ---------- Tab定義 ----------
const TABS = [
  { id: 'json', label: '構造化JSON', icon: '{ }' },
  { id: 'doc', label: '要件定義書', icon: '📋' },
  { id: 'mp', label: 'MP出力', icon: '🚀' },
];

/**
 * MP（Manifest Prompt）全体をMarkdown文字列に組み立てる
 */
function assembleMp({ requirementDoc, flowCode, erCode, techConstraints }) {
  const sections = [];
  if (requirementDoc) sections.push(requirementDoc);
  if (flowCode) sections.push(`## 画面フロー図\n\`\`\`mermaid\n${flowCode}\n\`\`\``);
  if (erCode) sections.push(`## ERダイアグラム\n\`\`\`mermaid\n${erCode}\n\`\`\``);
  if (techConstraints) sections.push(`## 技術スタック・制約\n${techConstraints}`);
  return sections.join('\n\n---\n\n');
}

/**
 * @param {{
 *   nodes: import('reactflow').Node[],
 *   edges: import('reactflow').Edge[],
 *   requirementDoc: string,
 *   isUpdatingDoc: boolean,
 *   onUpdateRequirement: () => void,
 *   techConstraints: string,
 *   onUpdateTechConstraints: (value: string) => void,
 *   onClose: () => void
 * }} props
 */
export default function ExportModal({ nodes, edges, requirementDoc, isUpdatingDoc, onUpdateRequirement, techConstraints, onUpdateTechConstraints, onClose }) {
  const [activeTab, setActiveTab] = useState('mp');
  const [copied, setCopied] = useState(false);

  // Mermaidコード生成（純粋関数をuseMemoでキャッシュ）
  const flowCode = useMemo(() => generateScreenFlowMermaid(nodes, edges), [nodes, edges]);
  const erCode = useMemo(() => generateErMermaid(nodes, edges), [nodes, edges]);

  // ---------- JSON生成（既存ロジック） ----------
  const groupedEntities = nodes.reduce((acc, node) => {
    const key = node.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(node.data.label);
    return acc;
  }, {});

  const relationships = edges.map(e => ({
    from: nodes.find(n => n.id === e.source)?.data?.label ?? e.source,
    to: nodes.find(n => n.id === e.target)?.data?.label ?? e.target,
    type: e.type,
    label: e.label ?? ''
  }));

  const exportData = {
    project_context: 'ユーザーヒアリングから抽出された要件定義',
    extracted_entities: {
      actors: groupedEntities['Actor'] ?? [],
      ui_components: groupedEntities['UI_Component'] ?? [],
      data_entities: groupedEntities['Data_Entity'] ?? [],
      actions: groupedEntities['Action'] ?? []
    },
    relationships
  };

  const jsonText = JSON.stringify(exportData, null, 2);

  // ---------- MP出力テキスト ----------
  const mpText = assembleMp({ requirementDoc, flowCode, erCode, techConstraints });

  // モーダル表示時にドキュメントが空なら自動生成を開始
  useEffect(() => {
    if (!requirementDoc && !isUpdatingDoc) {
      onUpdateRequirement();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- コピー ----------
  const handleCopy = useCallback(() => {
    let text;
    switch (activeTab) {
      case 'json':
        text = jsonText;
        break;
      case 'doc':
        text = requirementDoc || '（生成中）';
        break;
      case 'mp':
      default:
        text = mpText || '（生成中）';
        break;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeTab, jsonText, requirementDoc, mpText]);

  // ---------- タブごとのコンテンツ ----------
  const renderContent = () => {
    switch (activeTab) {
      case 'json':
        return (
          <pre className="whitespace-pre-wrap text-sm font-mono text-emerald-300 leading-relaxed">
            {jsonText}
          </pre>
        );
      case 'doc':
        if (isUpdatingDoc) return <LoadingSkeleton />;
        return (
          <div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
            {requirementDoc}
          </div>
        );
      case 'mp':
      default:
        return (
          <div className="space-y-4">
            {/* 技術スタック入力 */}
            <div>
              <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                技術スタック・制約 <span className="text-gray-600 normal-case font-normal">(任意)</span>
              </label>
              <textarea
                value={techConstraints}
                onChange={e => onUpdateTechConstraints(e.target.value)}
                placeholder="例: React + TypeScript、Firebase Firestore、iOS/Android両対応"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-xs text-gray-500 mb-2 font-semibold tracking-wide uppercase">── 要件定義書 ──</div>
              {isUpdatingDoc ? (
                <LoadingSkeleton />
              ) : (
                <div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
                  {requirementDoc || '（会話を始めると自動生成されます）'}
                </div>
              )}
            </div>

            {flowCode && (
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2 font-semibold tracking-wide uppercase">── 画面フロー図 ──</div>
                <pre className="whitespace-pre-wrap text-sm font-mono text-indigo-300 leading-relaxed">
                  {`\`\`\`mermaid\n${flowCode}\n\`\`\``}
                </pre>
              </div>
            )}

            {erCode && (
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2 font-semibold tracking-wide uppercase">── ERダイアグラム ──</div>
                <pre className="whitespace-pre-wrap text-sm font-mono text-green-300 leading-relaxed">
                  {`\`\`\`mermaid\n${erCode}\n\`\`\``}
                </pre>
              </div>
            )}

            {techConstraints && (
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2 font-semibold tracking-wide uppercase">── 技術スタック・制約 ──</div>
                <div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">{techConstraints}</div>
              </div>
            )}
          </div>
        );
    }
  };

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

        {/* タブ */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative
                ${activeTab === tab.id
                  ? 'text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-900 text-gray-100">
          {renderContent()}
        </div>

        {/* フッター */}
        <div className="px-5 py-3.5 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500 max-w-xs">
              ※ 結合出力をAIエージェントのプロンプトとして渡すと、文脈のロスなく開発を開始できます
            </p>
            {activeTab !== 'json' && (
              <button
                onClick={onUpdateRequirement}
                disabled={isUpdatingDoc}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-300 hover:border-blue-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {isUpdatingDoc ? <SpinnerIcon /> : <RefreshIcon />}
                再構成
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={isUpdatingDoc && activeTab !== 'json'}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm
                ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                } disabled:opacity-50`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'コピー完了！' : (activeTab === 'mp' ? 'MP全体をコピー' : 'コピー')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub Components ----------

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
        <SpinnerIcon />
        <span>会話履歴を分析して要件定義書を生成中…</span>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-700/50 rounded w-1/3" />
          <div className="h-3 bg-gray-800/50 rounded w-full" />
          <div className="h-3 bg-gray-800/50 rounded w-5/6" />
          <div className="h-3 bg-gray-800/50 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * useAgentOrchestrator
 *
 * 責務: AIの会話完了を検知し、バックグラウンドで要件定義書更新・レビュー生成をキューイング
 *
 * フェーズ2の核心:
 * - App.jsx の useEffect（LLM副作用）を完全に置き換える
 * - UIレンダリングのライフサイクルとLLMバッチ処理を分離する
 * - Race Condition を防止: メッセージ数をセンチネルとして同一ターンの重複発火を防ぐ
 *
 * ARC原則:
 * - 副作用（API通信）は requirementDocService / reviewService に委譲（SRP）
 * - SystemContext を介してSSOTからデータを受け取る（CDD）
 * - useRef でセンチネル管理: 前回発火時のメッセージ数を記録し重複を排除
 *
 * Input:  messages, isLoading, nodes, edges, requirementDoc
 * Output: { requirementDoc, isUpdatingDoc, reviewReport, isGeneratingReview, requestReview, requestRequirementUpdate }
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { generateRequirementDoc } from '../services/requirementDocService.js';
import { generateReview } from '../services/reviewService.js';
import { buildSystemContext } from '../types/systemContext.js';

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {boolean} isLoading - チャットのAPI呼び出し中フラグ
 * @param {Array} nodes - useCanvasStore のノード
 * @param {Array} edges - useCanvasStore のエッジ
 */
export function useAgentOrchestrator(messages, isLoading, nodes, edges) {
  const [requirementDoc, setRequirementDoc] = useState('');
  const [isUpdatingDoc, setIsUpdatingDoc] = useState(false);
  const [reviewReport, setReviewReport] = useState('');
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);

  // センチネル: 前回の要件定義書更新をトリガーしたメッセージ数を記録
  // これにより「同じターンで2回発火」を防ぐ
  const lastTriggeredAtRef = useRef(0);

  // AbortController: 前回のリクエストが残っていればキャンセルする
  const docAbortRef = useRef(null);

  /**
   * 要件定義書の更新（内部処理）
   * @param {import('../types/systemContext.js').SystemContext} ctx
   * @param {AbortSignal} [signal] - キャンセルシグナル（将来拡張用）
   */
  const updateDoc = useCallback(async (ctx) => {
    // 前回のリクエストをキャンセル（Race Condition防止）
    if (docAbortRef.current) {
      docAbortRef.current.abort();
    }
    docAbortRef.current = new AbortController();

    setIsUpdatingDoc(true);
    try {
      const result = await generateRequirementDoc(ctx);
      if (result.ok) {
        setRequirementDoc(result.value);
      }
    } finally {
      setIsUpdatingDoc(false);
    }
  }, []);

  // AIの返答が完了した瞬間（isLoading: true → false、かつ最後のメッセージがassistant）を検知
  useEffect(() => {
    // ガード条件:
    // 1. まだ会話がない（初期メッセージのみ）
    // 2. ローディング中（まだ返答が完了していない）
    // 3. 最後のメッセージがAI返答でない
    // 4. 同じメッセージ数で既に発火済み（重複防止）
    if (messages.length <= 1) return;
    if (isLoading) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    if (lastTriggeredAtRef.current === messages.length) return;

    // センチネルを更新（このターンで発火済みとマーク）
    lastTriggeredAtRef.current = messages.length;

    // SystemContext を組み立てて要件定義書をバックグラウンド更新
    const ctx = buildSystemContext(messages, nodes, edges, requirementDoc);
    updateDoc(ctx);
  }, [messages, isLoading, nodes, edges, requirementDoc, updateDoc]);

  /**
   * 要件定義書の手動更新（CanvasPane / ExportModal の「最新に更新」ボタン用）
   */
  const requestRequirementUpdate = useCallback(() => {
    if (isUpdatingDoc) return;
    const ctx = buildSystemContext(messages, nodes, edges, requirementDoc);
    updateDoc(ctx);
  }, [isUpdatingDoc, messages, nodes, edges, requirementDoc, updateDoc]);

  /**
   * 整合性レビューの手動生成（「AIに詳細レビューを依頼」ボタン用）
   */
  const requestReview = useCallback(async () => {
    if (isGeneratingReview) return;
    setIsGeneratingReview(true);
    try {
      const ctx = buildSystemContext(messages, nodes, edges, requirementDoc);
      const result = await generateReview(ctx);
      if (result.ok) {
        setReviewReport(result.value);
      }
    } finally {
      setIsGeneratingReview(false);
    }
  }, [isGeneratingReview, messages, nodes, edges, requirementDoc]);

  /**
   * リセット（App.jsx の handleReset から呼ばれる）
   */
  const reset = useCallback(() => {
    setRequirementDoc('');
    setReviewReport('');
    setIsUpdatingDoc(false);
    setIsGeneratingReview(false);
    lastTriggeredAtRef.current = 0;
    if (docAbortRef.current) docAbortRef.current.abort();
  }, []);

  return {
    requirementDoc,
    isUpdatingDoc,
    reviewReport,
    isGeneratingReview,
    requestRequirementUpdate,
    requestReview,
    reset,
  };
}

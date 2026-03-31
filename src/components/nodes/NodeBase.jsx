/**
 * NodeBase
 *
 * 責務: ノードのUI描画とインライン編集UI
 *
 * ARC原則（入出力の明確化）:
 * - 編集確定時に onUpdateData(nodeId, {label, description}) を呼び出す
 * - 内部でuseReactFlow().setNodes を直接呼ばず、コールバック経由で親（useCanvasStore）へ委譲
 * - これにより ReactFlowProvider 外でも NodeBase を使えるようになり、
 *   App の flowNodes との二重管理問題を解消
 *
 * Input:  id, data, selected, colorClass, ..., onUpdateData
 * Output: void (onUpdateData callback)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

export default function NodeBase({ id, data, selected, colorClass, borderClass, labelColorClass, typeLabel, handles, onUpdateData }) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const [editDesc, setEditDesc] = useState(data.description ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 外部からdataが更新されたとき編集バッファをリセット
  useEffect(() => {
    if (!editing) {
      setEditLabel(data.label);
      setEditDesc(data.description ?? '');
    }
  }, [data.label, data.description, editing]);

  const commitEdit = useCallback(() => {
    // editingがfalseのとき（onBlurが2重発火した場合）は早期リターン
    if (!editing) return;
    setEditing(false);
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setEditLabel(data.label);
      return;
    }
    // 変化がある場合のみコールバック（不変）
    if (trimmed !== data.label || editDesc.trim() !== (data.description ?? '')) {
      onUpdateData?.(id, { label: trimmed, description: editDesc.trim() });
    }
  }, [editing, id, editLabel, editDesc, data.label, data.description, onUpdateData]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') {
      setEditing(false);
      setEditLabel(data.label);
      setEditDesc(data.description ?? '');
    }
  };

  return (
    <div
      className={`${colorClass} border-2 ${selected ? borderClass.selected : borderClass.normal} rounded-lg shadow-md px-3 py-2 w-44 min-h-[72px] flex flex-col justify-center items-center text-center select-none group relative`}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className={`!${handles.color}`} />
      <Handle type="source" position={Position.Right} className={`!${handles.color}`} />
      {handles.topBottom && <>
        <Handle type="target" position={Position.Top} className={`!${handles.color}`} />
        <Handle type="source" position={Position.Bottom} className={`!${handles.color}`} />
      </>}

      <div className={`text-xs font-semibold ${labelColorClass} mb-1`}>{typeLabel}</div>

      {editing ? (
        <div className="w-full flex flex-col gap-1" onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            className="w-full text-sm text-center bg-white border border-gray-300 rounded px-1 py-0.5 outline-none"
            placeholder="ラベル"
          />
          <input
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            className="w-full text-xs text-center bg-white border border-gray-300 rounded px-1 py-0.5 outline-none text-gray-500"
            placeholder="説明（任意）"
          />
          <div className="text-xs text-gray-400 mt-0.5">Enter で確定 / Esc でキャンセル</div>
        </div>
      ) : (
        <>
          <div className="text-sm font-medium text-gray-800 break-words leading-tight w-full">{data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500 mt-1 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
              {data.description}
            </div>
          )}
          <div className="absolute -bottom-5 left-0 right-0 text-center text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            ダブルクリックで編集
          </div>
        </>
      )}
    </div>
  );
}

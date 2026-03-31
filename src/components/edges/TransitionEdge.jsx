import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export default function TransitionEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, label, markerEnd, style
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 12
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd}
        style={{ stroke: '#3b82f6', strokeWidth: 2, ...style }} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none bg-blue-50 border border-blue-200 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

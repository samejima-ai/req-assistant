import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export default function DataFlowEdge({
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
        style={{ stroke: '#22c55e', strokeWidth: 2, strokeDasharray: '6 3', ...style }} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none bg-green-50 border border-green-200 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

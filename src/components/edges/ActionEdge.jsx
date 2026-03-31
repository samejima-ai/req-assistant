import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export default function ActionEdge({
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
        style={{ stroke: '#f59e0b', strokeWidth: 2, ...style }} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

import NodeBase from './NodeBase.jsx';
export default function ActorNode({ id, data, selected }) {
  return <NodeBase id={id} data={data} selected={selected}
    colorClass="bg-yellow-100" borderClass={{ normal: 'border-yellow-300', selected: 'border-yellow-500' }}
    labelColorClass="text-yellow-700" typeLabel="アクター"
    handles={{ color: 'bg-yellow-400', topBottom: false }}
    onUpdateData={data.onUpdateData} />;
}

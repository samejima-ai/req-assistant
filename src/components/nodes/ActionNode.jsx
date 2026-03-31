import NodeBase from './NodeBase.jsx';
export default function ActionNode({ id, data, selected }) {
  return <NodeBase id={id} data={data} selected={selected}
    colorClass="bg-blue-100" borderClass={{ normal: 'border-blue-300', selected: 'border-blue-500' }}
    labelColorClass="text-blue-700" typeLabel="処理 / アクション"
    handles={{ color: 'bg-blue-400', topBottom: false }}
    onUpdateData={data.onUpdateData} />;
}

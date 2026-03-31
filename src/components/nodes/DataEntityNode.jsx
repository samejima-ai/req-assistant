import NodeBase from './NodeBase.jsx';
export default function DataEntityNode({ id, data, selected }) {
  return <NodeBase id={id} data={data} selected={selected}
    colorClass="bg-green-100" borderClass={{ normal: 'border-green-300', selected: 'border-green-500' }}
    labelColorClass="text-green-700" typeLabel="データ"
    handles={{ color: 'bg-green-400', topBottom: false }}
    onUpdateData={data.onUpdateData} />;
}

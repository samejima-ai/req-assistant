import NodeBase from './NodeBase.jsx';
export default function UIComponentNode({ id, data, selected }) {
  return <NodeBase id={id} data={data} selected={selected}
    colorClass="bg-pink-100" borderClass={{ normal: 'border-pink-300', selected: 'border-pink-500' }}
    labelColorClass="text-pink-700" typeLabel="UI / 画面"
    handles={{ color: 'bg-pink-400', topBottom: true }}
    onUpdateData={data.onUpdateData} />;
}

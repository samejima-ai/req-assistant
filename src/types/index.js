/**
 * @typedef {'Actor' | 'UI_Component' | 'Data_Entity' | 'Action'} NodeType
 * @typedef {'screen_transition' | 'data_flow' | 'actor_action' | 'api_call'} EdgeType
 *
 * @typedef {Object} NodeData
 * @property {string} id
 * @property {NodeType} type
 * @property {string} label
 * @property {string} [description]
 * @property {Record<string, string>} [attributes]
 *
 * @typedef {Object} EdgeData
 * @property {string} id
 * @property {string} source  - NodeData.id
 * @property {string} target  - NodeData.id
 * @property {EdgeType} type
 * @property {string} [label]
 * @property {string} [condition]
 *
 * @typedef {Object} ExtractionResult
 * @property {NodeData[]} nodes
 * @property {EdgeData[]} edges
 * @property {string[]} [clarification_needed]
 */

export {};

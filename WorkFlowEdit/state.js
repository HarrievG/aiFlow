// --- START OF FILE state.js ---
// Use a single state object to easily pass around or manage reactivity later
export const state = {
	// Core data for the *currently loaded* workflow/agent
	currentWorkflow: null, // The full WorkflowConfig object from the backend
	currentAgentId: null, // The ID of the agent currently being edited

	// Node editor data (part of currentWorkflow.orchestration_graph)
	nodes: {}, // { nodeId: { id, x, y, element, title, agentId, inputs: { socketId: {...} }, outputs: { socketId: {...} } } }
	links: {}, // { linkId: { id, fromNode, fromSocket, toNode, toSocket, element } }

	// Counters for *new* nodes/links created in the UI *before* saving to workflow object
	nodeIdCounter: 0,
	linkIdCounter: 0,

	// Viewport state (part of currentWorkflow.view_state)
	panX: 0,
	panY: 0,
	zoomLevel: 1.0,

	// Interaction states
	draggedNode: null,
	isDraggingNode: false,
	dragStartX: 0,
	dragStartY: 0,
	dragInitialNodeX: 0,
	dragInitialNodeY: 0,

	isPanning: false,
	panStartX: 0,
	panStartY: 0,

	isLinking: false,
	linkStartSocketInfo: null, // { nodeId, socketId, element, type: 'input'/'output' }
	tempLinkElement: null,

	isReconnecting: false,
	reconnectOriginInfo: null, // { nodeId, socketId, type, element, linkIds: [], originalSocketData }

	// Editor settings
	currentFlowDirection: 'horizontal', // 'horizontal' or 'vertical'

	// Filesystem Browser State
	currentFilesystemPath: '.', // Start in the current directory of the backend process

	// WebSocket State
	isConnected: false,

	currentViewId: null,

	// For context-aware output editor
	currentEditingContext: 'workflow', // Can be 'workflow' or 'agent'
	currentEditingAgentId: null // Stores agent ID if currentEditingContext is 'agent'
};

// Functions to modify state (optional, but good practice)
// These counters are for generating *temporary* UI IDs before saving to the workflow graph structure
export function getNextNodeId() {
	return `ui-node-${state.nodeIdCounter++}`;
}

export function getNextLinkId() {
	return `ui-link-${state.linkIdCounter++}`;
}

export function setNodeIdCounter(value) {
	state.nodeIdCounter = value;
}

export function setLinkIdCounter(value) {
	state.linkIdCounter = value;
}
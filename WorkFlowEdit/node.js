// --- START OF FILE node.js ---
import * as dom from './dom.js';
import { state, getNextNodeId } from './state.js';
import { screenToWorkspace } from './utils.js';
import { updateLinksForNode } from './link.js';
import { handleSocketMouseDown, handleLinkMouseUp, handleSocketMouseEnter, handleSocketMouseLeave } from './interactions.js'; // Import interaction handlers
import { editAgent } from './main.js'; // Import editAgent function

function createSocketElement(id, name, type) {
	const socketWrapper = document.createElement('div');
	socketWrapper.classList.add('node-socket');
	socketWrapper.dataset.socketId = id; // Store id for reference

	const point = document.createElement('div');
	point.classList.add('socket-point');
	point.classList.add(type); // 'input' or 'output'
	point.dataset.socketId = id; // Make it easy to find socket data

	const label = document.createElement('span');
	label.classList.add('socket-label');
	label.textContent = name;

	// Structure based on flow direction (though CSS handles visual layout)
	if (state.currentFlowDirection === 'horizontal') {
		if (type === 'input') {
			socketWrapper.appendChild(point);
			socketWrapper.appendChild(label);
		} else {
			socketWrapper.appendChild(label);
			socketWrapper.appendChild(point);
		}
	} else { // Vertical
		if (type === 'input') {
			socketWrapper.appendChild(point);
			socketWrapper.appendChild(label);
		} else {
			socketWrapper.appendChild(label);
			socketWrapper.appendChild(point);
		}
	}


	return socketWrapper;
}

// Modified createNode to accept agentId and optional inputs/outputs
export function createNode(id = null, x, y, agentId, title = null, inputs = [], outputs = []) {
	if (x === undefined || y === undefined) {
		const editorRect = dom.nodeEditor.getBoundingClientRect();
		const viewCenterX = editorRect.width / 2;
		const viewCenterY = editorRect.height / 2;
		const workspaceCoords = screenToWorkspace(editorRect.left + viewCenterX, editorRect.top + viewCenterY);
		x = workspaceCoords.x ; // Adjust for default node width
		y = workspaceCoords.y ; // Adjust for default node height
	}

	const nodeElement = dom.nodeTemplate.content.firstElementChild.cloneNode(true);
	const nodeId = id || getNextNodeId(); // Use UI specific ID counter
	nodeElement.id = nodeId;
	nodeElement.style.left = `${x}px`;
	nodeElement.style.top = `${y}px`;
	nodeElement.classList.add(state.currentFlowDirection === 'vertical' ? 'flow-vertical' : 'flow-horizontal');
	nodeElement.dataset.agentId = agentId; // Store the linked agent ID on the DOM element

	const header = nodeElement.querySelector('.node-header');
	header.textContent = title || `Node ${nodeId.split('-')[1]}`;

	// Store basic node data first
	const nodeData = {
		id: nodeId,
		x,
		y,
		element: nodeElement,
		title: header.textContent,
		agentId: agentId, // Store the linked agent ID in state
		inputs: {},
		outputs: {}
	};
	state.nodes[nodeId] = nodeData; // Add to global state

	// --- Create Sockets ---
	const inputsContainer = nodeElement.querySelector('.node-inputs');
	const outputsContainer = nodeElement.querySelector('.node-outputs');

	// Default sockets if none provided
	if (inputs.length === 0 && outputs.length === 0) {
		// Default sockets for generic nodes
		inputs = [{ name: 'In' }]; // Assuming default input doesn't need a type for now
		outputs = [{ name: 'Out', value_type: 'any' }]; // Default output with a value_type
		// TODO: Logic here to create sockets based on agent type/config
		// e.g., FlowMaster might have specific input/output sockets based on its state machine definition
	}

	inputs.forEach((inputDef, index) => {
		// Use a consistent socket ID format that includes node ID and index/name
		const socketId = `input-${inputDef.name || index}`; // Use name if available, fallback to index
		const socketElement = createSocketElement(socketId, inputDef.name || `Input ${index}`, 'input');
		inputsContainer.appendChild(socketElement);
		const socketPoint = socketElement.querySelector('.socket-point'); // Get the point
		nodeData.inputs[socketId] = { // Store socket data keyed by socketId
			id: socketId,
			name: inputDef.name || `Input ${index}`,
			// value_type: inputDef.value_type || 'any', // Assuming inputs might also have types in the future
			nodeId: nodeId,
			element: socketPoint,
			links: []
		};
		// Add listeners to the socket point
		socketPoint.addEventListener('mouseup', handleLinkMouseUp); // For completing a normal link
		socketPoint.addEventListener('mousedown', handleSocketMouseDown); // For Shift+Click Reconnect or normal link start
		socketPoint.addEventListener('mouseenter', handleSocketMouseEnter);
		socketPoint.addEventListener('mouseleave', handleSocketMouseLeave);
	});

	outputs.forEach((outputDef, index) => {
		const socketId = `output-${outputDef.name || index}`; // Use name if available, fallback to index
		const socketElement = createSocketElement(socketId, outputDef.name || `Output ${index}`, 'output');
		outputsContainer.appendChild(socketElement);
		const socketPoint = socketElement.querySelector('.socket-point'); // Get the point
		nodeData.outputs[socketId] = { // Store socket data keyed by socketId
			id: socketId,
			name: outputDef.name || `Output ${index}`,
			nodeId: nodeId,
			element: socketPoint,
			links: []
		};
		// Add listeners to the socket point
		// socketPoint.addEventListener('mouseup', handleLinkMouseUp); // Outputs don't complete links
		socketPoint.addEventListener('mousedown', handleSocketMouseDown); // For Shift+Click Reconnect or normal link start
		socketPoint.addEventListener('mouseenter', handleSocketMouseEnter);
		socketPoint.addEventListener('mouseleave', handleSocketMouseLeave);
	});


	// Add node drag listener to the header
	header.addEventListener('mousedown', startNodeDrag);

	// Add double-click listener to the node (or header) to edit the agent
	nodeElement.addEventListener('dblclick', () => {
		const linkedAgentId = nodeElement.dataset.agentId;
		if (linkedAgentId) {
			editAgent(linkedAgentId);
		} else {
			console.warn('Node is not linked to an agent.');
		}
	});


	dom.workspace.appendChild(nodeElement);
	return nodeElement;
}


// --- Node Dragging Logic ---
export function startNodeDrag(e) {
	if (e.target !== e.currentTarget && e.currentTarget.classList.contains('node')) return;
	// Prevent starting node drag when starting link/reconnect drag from socket
	if (e.target.classList.contains('socket-point')) return;

	e.stopPropagation(); // Prevent editor panning

	if (e.button !== 0) return; // Only left click

	const targetNode = e.currentTarget.closest('.node');
	if (!targetNode) return;

	state.draggedNode = targetNode;
	state.draggedNode.classList.add('dragging');
	state.isDraggingNode = true;

	state.dragStartX = e.clientX;
	state.dragStartY = e.clientY;
	// Ensure state reflects current style before drag, falling back to 0
	const nodeState = state.nodes[state.draggedNode.id];
	state.dragInitialNodeX = nodeState?.x ?? parseFloat(state.draggedNode.style.left || 0);
	state.dragInitialNodeY = nodeState?.y ?? parseFloat(state.draggedNode.style.top || 0);

	document.addEventListener('mousemove', dragNode);
	document.addEventListener('mouseup', stopNodeDrag);
}

function dragNode(e) {
	if (!state.isDraggingNode || !state.draggedNode) return;

	const dx = e.clientX - state.dragStartX;
	const dy = e.clientY - state.dragStartY;
	const deltaWorkspaceX = dx / state.zoomLevel;
	const deltaWorkspaceY = dy / state.zoomLevel;

	let newX = state.dragInitialNodeX + deltaWorkspaceX;
	let newY = state.dragInitialNodeY + deltaWorkspaceY;

	state.draggedNode.style.left = `${newX}px`;
	state.draggedNode.style.top = `${newY}px`;

	const nodeId = state.draggedNode.id;
	// Update node position in central state
	if (state.nodes[nodeId]) {
		state.nodes[nodeId].x = newX;
		state.nodes[nodeId].y = newY;
	}

	// Update connected links
	updateLinksForNode(nodeId);
}

function stopNodeDrag(e) {
	if (!state.isDraggingNode) return;

	// Update links one last time in case of micro-movements on mouseup
	if (state.draggedNode) {
		// Ensure final position is stored
		const finalX = parseFloat(state.draggedNode.style.left || 0);
		const finalY = parseFloat(state.draggedNode.style.top || 0);
		const nodeId = state.draggedNode.id;
		if (state.nodes[nodeId]) {
			state.nodes[nodeId].x = finalX;
			state.nodes[nodeId].y = finalY;
		}
		updateLinksForNode(nodeId);
		state.draggedNode.classList.remove('dragging');
	}

	state.isDraggingNode = false;
	state.draggedNode = null;

	document.removeEventListener('mousemove', dragNode);
	document.removeEventListener('mouseup', stopNodeDrag);
}
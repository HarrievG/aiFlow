// --- START OF FILE node.js ---
import * as dom from './dom.js';
import { state, getNextNodeId } from './state.js';
import { screenToWorkspace } from './utils.js';
import { updateLinksForNode } from './link.js';
import { handleSocketMouseDown, handleLinkMouseUp, handleSocketMouseEnter, handleSocketMouseLeave } from './interactions.js'; // Import interaction handlers
import { editAgent } from './main.js'; // Import editAgent function

function createSocketElement(id, name, type, flowDirection) {
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
	if (flowDirection === 'horizontal') {
		if (type === 'input') {
			socketWrapper.appendChild(point);
			socketWrapper.appendChild(label);
		} else {
			socketWrapper.appendChild(label);
			socketWrapper.appendChild(point);
		}
	} else { // Vertical
		if (type === 'input') {
			socketWrapper.appendChild(point); // Point first for inputs (top)
			socketWrapper.appendChild(label);
		} else { // Outputs will be below title, so label first (top) then point (bottom) for vertical consistency if needed.
			// However, the plan specifies inputs above title for vertical.
			// Outputs are not explicitly mentioned to be above/below title in vertical,
			// but standard vertical flow usually has inputs top, outputs bottom.
			// For now, let's keep outputs also point first for vertical, assuming they'd be at the bottom of the node.
			// CSS will ultimately determine the final visual positioning.
			socketWrapper.appendChild(point);
			socketWrapper.appendChild(label);
		}
	}


	return socketWrapper;
}

function toggleNodeOrientation(nodeId) {
	const nodeData = state.nodes[nodeId];
	if (!nodeData) return;

	const newOrientation = nodeData.flowDirection === 'horizontal' ? 'vertical' : 'horizontal';
	nodeData.flowDirection = newOrientation;
	nodeData.element.classList.toggle('flow-horizontal');
	nodeData.element.classList.toggle('flow-vertical');

	// Update toggle button icon
	const toggleButton = nodeData.element.querySelector('.node-orientation-toggle');
	if (toggleButton) {
		toggleButton.innerHTML = newOrientation === 'horizontal' ? '&#8645;' : '&#8644;'; // Show icon for the target state
		// If current is horizontal (meaning newOrientation will be vertical), show horizontal arrows to indicate switch TO horizontal
		// If current is vertical (meaning newOrientation will be horizontal), show vertical arrows to indicate switch TO vertical
		toggleButton.innerHTML = nodeData.flowDirection === 'horizontal' ? '&#8645;' : '&#8644;';
		// Corrected logic: The icon should represent the action to switch.
		// If current is horizontal, button shows "switch to vertical" (vertical arrow).
		// If current is vertical, button shows "switch to horizontal" (horizontal arrow).
		toggleButton.innerHTML = nodeData.flowDirection === 'horizontal' ? '&#8645;' /* up-down arrow (represents vertical) */ : '&#8644;' /* left-right arrow (represents horizontal) */;

	}

	// Re-render sockets or adjust classes as needed.
	// For simplicity, we can remove and re-add sockets.
	// Or, more efficiently, just update their layout via CSS and potentially minor DOM adjustments if structure must change.
	// The current createSocketElement already structures based on flowDirection, so we might need to re-create them.
	// Let's try updating classes first, and if layout is complex, then re-create.

	const inputsContainer = nodeData.element.querySelector('.node-inputs');
	const outputsContainer = nodeData.element.querySelector('.node-outputs');

	// Clear existing sockets
	inputsContainer.innerHTML = '';
	outputsContainer.innerHTML = '';

	// Recreate sockets with the new orientation
	// Need to iterate over the stored socket definitions in nodeData.inputs and nodeData.outputs
	Object.values(nodeData.inputs).forEach(inputDef => {
		const socketElement = createSocketElement(inputDef.id, inputDef.name, 'input', newOrientation);
		inputsContainer.appendChild(socketElement);
		const socketPoint = socketElement.querySelector('.socket-point');
		inputDef.element = socketPoint; // Update element reference
		socketPoint.addEventListener('mouseup', handleLinkMouseUp);
		socketPoint.addEventListener('mousedown', handleSocketMouseDown);
		socketPoint.addEventListener('mouseenter', handleSocketMouseEnter);
		socketPoint.addEventListener('mouseleave', handleSocketMouseLeave);
	});

	Object.values(nodeData.outputs).forEach(outputDef => {
		const socketElement = createSocketElement(outputDef.id, outputDef.name, 'output', newOrientation);
		outputsContainer.appendChild(socketElement);
		const socketPoint = socketElement.querySelector('.socket-point');
		outputDef.element = socketPoint; // Update element reference
		socketPoint.addEventListener('mousedown', handleSocketMouseDown);
		socketPoint.addEventListener('mouseenter', handleSocketMouseEnter);
		socketPoint.addEventListener('mouseleave', handleSocketMouseLeave);
	});

	updateLinksForNode(nodeId); // Update links as socket positions might change
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
	// Default to horizontal, specific class will be added based on nodeData.flowDirection
	// nodeElement.classList.add(state.currentFlowDirection === 'vertical' ? 'flow-vertical' : 'flow-horizontal');
	nodeElement.dataset.agentId = agentId; // Store the linked agent ID on the DOM element

	const header = nodeElement.querySelector('.node-header');
	// header.textContent = title || `Node ${nodeId.split('-')[1]}`; // Clear existing content before adding span and button
	header.innerHTML = ''; // Clear existing content

	const titleTextSpan = document.createElement('span');
	titleTextSpan.classList.add('node-title-text');
	titleTextSpan.textContent = title || `Node ${nodeId.split('-')[1]}`;
	header.appendChild(titleTextSpan);

	// Add toggle button to header
	const toggleButton = document.createElement('button');
	toggleButton.classList.add('node-orientation-toggle');
	toggleButton.innerHTML = '&#8645;'; // Up/Down arrow for toggle
	toggleButton.title = 'Toggle Orientation';
	toggleButton.addEventListener('click', (e) => {
		e.stopPropagation(); // Prevent node drag
		toggleNodeOrientation(nodeId);
	});
	header.appendChild(toggleButton);


	// Store basic node data first
	const nodeData = {
		id: nodeId,
		x,
		y,
		element: nodeElement,
		title: header.textContent,
		agentId: agentId, // Store the linked agent ID in state
		flowDirection: 'horizontal', // Default to horizontal
		inputs: {},
		outputs: {}
	};
	state.nodes[nodeId] = nodeData; // Add to global state
	nodeElement.classList.add(nodeData.flowDirection === 'vertical' ? 'flow-vertical' : 'flow-horizontal');


	// --- Create Sockets ---
	const inputsContainer = nodeElement.querySelector('.node-inputs');
	const outputsContainer = nodeElement.querySelector('.node-outputs');

	// Add default "Any" input
	const defaultAnyInput = { name: 'Any', type: 'any' }; // Added type for potential future use
	let finalInputs = [defaultAnyInput, ...inputs];

	// Default sockets if none provided (after adding "Any")
	if (finalInputs.length === 1 && outputs.length === 0) { // Only "Any" input, no other inputs/outputs
		// Default output for generic nodes if no outputs were defined
		outputs = [{ name: 'Out' }];
	}


	finalInputs.forEach((inputDef, index) => {
		// Use a consistent socket ID format that includes node ID and index/name
		const socketId = `input-${inputDef.name.replace(/\s+/g, '-')}-${index}`; // Sanitize name for ID
		const socketElement = createSocketElement(socketId, inputDef.name || `Input ${index}`, 'input', nodeData.flowDirection);
		inputsContainer.appendChild(socketElement);
		const socketPoint = socketElement.querySelector('.socket-point'); // Get the point
		nodeData.inputs[socketId] = { // Store socket data keyed by socketId
			id: socketId,
			name: inputDef.name || `Input ${index}`,
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
		const socketId = `output-${outputDef.name.replace(/\s+/g, '-')}-${index}`; // Sanitize name for ID
		const socketElement = createSocketElement(socketId, outputDef.name || `Output ${index}`, 'output', nodeData.flowDirection);
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
	nodeElement.addEventListener('dblclick', (e) => {
		if (e.target.classList.contains('node-orientation-toggle')) return; // Don't edit agent if toggle is clicked
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
	// Prevent starting node drag when clicking on the toggle button
	if (e.target.classList.contains('node-orientation-toggle')) return;
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
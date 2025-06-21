import * as dom from './dom.js';
import { state } from './state.js';
import { SVG_NS } from './config.js';
import { getSocketPosition, screenToWorkspace } from './utils.js';
import { createLink, updateLinkPath, calculateLinkPath, removeLink } from './link.js';

// --- Combined Socket Mouse Down Handler ---
export function handleSocketMouseDown(e) {
	if (e.button !== 0) return;
	e.stopPropagation();

	const socketElement = e.currentTarget;
	const socketId = socketElement.dataset.socketId;
	const nodeId = socketElement.closest('.node').id;
	const isOutput = socketElement.classList.contains('output');
	const socketType = isOutput ? 'output' : 'input';

	if (e.shiftKey) {
		startReconnection(e, socketElement, nodeId, socketId, socketType);
	} else if (isOutput) {
		startLinkDrag(e, socketElement, nodeId, socketId);
	}
}
// --- Linking Logic ---
function startLinkDrag(e, startSocketElement, nodeId, socketId) {
	state.isLinking = true;
	state.linkStartSocketInfo = { nodeId, socketId, element: startSocketElement, type: 'output' };
	state.tempLinkElement = document.createElementNS(SVG_NS, 'path');
	state.tempLinkElement.setAttribute('class', 'dragging-link-temp');
	dom.svgLayer.appendChild(state.tempLinkElement);
	updateTempLink(e.clientX, e.clientY);
	document.addEventListener('mousemove', dragLink);
	document.addEventListener('mouseup', cancelLinkDrag);
}
function dragLink(e) {
	if (!state.isLinking || !state.tempLinkElement) return;
	updateTempLink(e.clientX, e.clientY);
}
export function handleLinkMouseUp(e) {
	if (!state.isLinking || !state.linkStartSocketInfo || state.linkStartSocketInfo.type !== 'output') {
		return;
	}
	const endSocketElement = e.currentTarget;
	const endSocketId = endSocketElement.dataset.socketId;
	const endNodeId = endSocketElement.closest('.node').id;

	if (endNodeId === state.linkStartSocketInfo.nodeId) {
		console.warn("Cannot link node to itself.");
		// Ensure finishLinking is called even on self-link attempt
		finishLinking(); // Call cleanup
		return;
	}
	e.stopPropagation();
	createLink(state.linkStartSocketInfo.nodeId, state.linkStartSocketInfo.socketId, endNodeId, endSocketId);
	// finishLinking is called inside createLink or cancelLinkDrag
}

function cancelLinkDrag(e) {
	if (!state.isLinking) return;
	const targetIsInput = e.target.classList?.contains('socket-point') && e.target.classList?.contains('input');
	const targetNodeId = e.target.closest('.node')?.id;
	const isValidTarget = targetIsInput && targetNodeId !== state.linkStartSocketInfo?.nodeId;

	if (!isValidTarget) {
		if (targetIsInput && targetNodeId === state.linkStartSocketInfo?.nodeId) {
			console.log("Link cancelled (attempted self-link).");
		} else if (e.target !== state.linkStartSocketInfo?.element) {
			// Avoid logging cancellation if mouseup is on the start socket itself
			// which can happen if the click was very short.
			// console.log("Link cancelled (dropped elsewhere).");
		}
	}
	// Always finish linking, whether successful drop (handled by handleLinkMouseUp)
	// or cancellation (handled here).
	finishLinking();
}

function finishLinking() {
	if (!state.isLinking) return; // Prevent double execution
	state.isLinking = false;
	if (state.tempLinkElement) {
		state.tempLinkElement.remove();
		state.tempLinkElement = null;
	}
	state.linkStartSocketInfo = null;
	document.removeEventListener('mousemove', dragLink);
	document.removeEventListener('mouseup', cancelLinkDrag);
}

function updateTempLink(endScreenX, endScreenY) {
	if (!state.linkStartSocketInfo || !state.tempLinkElement) return;
	const startPos = getSocketPosition(state.linkStartSocketInfo.element);
	const endPos = screenToWorkspace(endScreenX, endScreenY);
	const pathData = calculateLinkPath(startPos, endPos);
	state.tempLinkElement.setAttribute('d', pathData);
}

// --- Reconnecting Logic (Shift+Click) ---
function startReconnection(e, socketElement, nodeId, socketId, socketType) {
	const socketData = state.nodes[nodeId]?.[socketType === 'input' ? 'inputs' : 'outputs']?.[socketId];
	// Only start if there are links to reconnect
	if (!socketData || socketData.links.length === 0) return;

	state.isReconnecting = true;
	dom.nodeEditor.classList.add('reconnecting');
	// Store a copy of the link IDs array
	state.reconnectOriginInfo = {
		nodeId,
		socketId,
		type: socketType,
		element: socketElement,
		linkIds: [...socketData.links], // Store a copy
		originalSocketData: socketData
	};

	// Add class to links being reconnected, but DON'T clear the path yet
	state.reconnectOriginInfo.linkIds.forEach(linkId => {
		const link = state.links[linkId];
		if (link?.element) {
			// link.element.setAttribute('d', ''); // REMOVED - We will update 'd' in dragReconnection
			link.element.classList.add('reconnecting-link');
		}
	});

	// Initial update to follow mouse immediately
	dragReconnection(e);

	document.addEventListener('mousemove', dragReconnection);
	document.addEventListener('mouseup', handleReconnectMouseUp);
}

function dragReconnection(e) {
	if (!state.isReconnecting || !state.reconnectOriginInfo) return;

	const mousePos = screenToWorkspace(e.clientX, e.clientY);
	const originType = state.reconnectOriginInfo.type;

	state.reconnectOriginInfo.linkIds.forEach(linkId => {
		const link = state.links[linkId];
		if (!link || !link.element) return;

		let fixedSocketPos;
		let movingEndPos = mousePos; // The end attached to the mouse

		try {
			if (originType === 'output') {
				// Origin is output, the 'to' socket is fixed
				const toNode = state.nodes[link.toNode];
				const toSocket = toNode?.inputs[link.toSocket];
				if (!toSocket?.element) throw new Error(`Target socket ${link.toSocket} not found for link ${linkId}`);
				fixedSocketPos = getSocketPosition(toSocket.element);
				// Path goes from mouse (new origin) to fixed socket
				link.element.setAttribute('d', calculateLinkPath(movingEndPos, fixedSocketPos));
			} else { // originType === 'input'
				// Origin is input, the 'from' socket is fixed
				const fromNode = state.nodes[link.fromNode];
				const fromSocket = fromNode?.outputs[link.fromSocket];
				if (!fromSocket?.element) throw new Error(`Source socket ${link.fromSocket} not found for link ${linkId}`);
				fixedSocketPos = getSocketPosition(fromSocket.element);
				// Path goes from fixed socket to mouse (new target)
				link.element.setAttribute('d', calculateLinkPath(fixedSocketPos, movingEndPos));
			}
		} catch (error) {
			console.warn(`Error updating reconnecting link ${linkId}: ${error.message}. Skipping update.`);
			// Optionally remove the link here if the error is critical
			// removeLink(linkId);
		}
	});
}

function handleReconnectMouseUp(e) {
	if (!state.isReconnecting || !state.reconnectOriginInfo) return; // Added check for reconnectOriginInfo

	const targetElement = e.target;
	const targetSocketElement = targetElement.classList.contains('socket-point') ? targetElement : null;

	let success = false; // Assume failure initially

	if (targetSocketElement) {
		const targetSocketId = targetSocketElement.dataset.socketId;
		const targetNodeId = targetSocketElement.closest('.node').id;
		const targetSocketType = targetSocketElement.classList.contains('input') ? 'input' : 'output';
		const targetNode = state.nodes[targetNodeId]; // Get target node data
		const targetSocketData = targetNode?.[targetSocketType === 'input' ? 'inputs' : 'outputs']?.[targetSocketId];

		const originType = state.reconnectOriginInfo.type;
		const originNodeId = state.reconnectOriginInfo.nodeId;
		const originSocketId = state.reconnectOriginInfo.socketId;

		// --- Validation ---
		const isValidType = (originType === 'output' && targetSocketType === 'input') || (originType === 'input' && targetSocketType === 'output');
		const isDifferentNodeOrSocket = !(targetNodeId === originNodeId && targetSocketId === originSocketId); // Allow reconnecting to different socket on same node
		const isSameSocket = targetNodeId === originNodeId && targetSocketId === originSocketId;
		const targetExists = !!targetSocketData; // Check if target socket data exists

		if (!targetExists) {
			console.error("Reconnect failed: Target socket data not found.");
		} else if (isSameSocket) {
			console.log("Reconnect cancelled (dropped back on origin).");
			// success remains false -> will trigger snap-back
		} else if (!isValidType) {
			console.warn(`Cannot reconnect: Origin is ${originType}, target must be ${originType === 'output' ? 'input' : 'output'}.`);
		}
		// Removed the !isDifferentNode check to allow reconnecting to a different socket on the *same* node if types match
		// else if (!isDifferentNode) {
		//     console.warn("Cannot reconnect: Target socket cannot be on the originating node.");
		// }
		else {
			// --- Perform Reconnection ---
			console.log(`Reconnecting ${state.reconnectOriginInfo.linkIds.length} links from ${originNodeId}:${originSocketId} to ${targetNodeId}:${targetSocketId}`);
			const originSocketData = state.reconnectOriginInfo.originalSocketData;

			// Use a temporary array to avoid issues while iterating and modifying
			const linkIdsToReconnect = [...state.reconnectOriginInfo.linkIds];

			linkIdsToReconnect.forEach(linkId => {
				const link = state.links[linkId];
				if (!link) return; // Link might have been deleted somehow

				// 1. Remove from original socket's link list
				const indexInOrigin = originSocketData.links.indexOf(linkId);
				if (indexInOrigin > -1) {
					originSocketData.links.splice(indexInOrigin, 1);
				} else {
					console.warn(`Link ${linkId} not found in original socket ${originSocketId} list during reconnect.`);
				}

				// 2. Update link data
				if (originType === 'output') {
					link.toNode = targetNodeId;
					link.toSocket = targetSocketId;
				} else { // originType === 'input'
					link.fromNode = targetNodeId;
					link.fromSocket = targetSocketId;
				}

				// 3. Add to target socket's link list
				targetSocketData.links.push(linkId);

				// 4. Visual cleanup and final redraw
				link.element?.classList.remove('reconnecting-link');
				updateLinkPath(linkId); // Redraw in final position
			});
			success = true; // Mark as successful
		}
		// *** End of the if/else if/else chain for validation ***
	} // *** End of 'if (targetSocketElement)' block ***

	// --- Handle Cancellation / Invalid Drop (Snap Back) ---
	if (!success) { // Only run snap back if reconnection wasn't successful
		if (!targetSocketElement) {
			// console.log("Reconnect cancelled (dropped elsewhere)."); // Can be noisy
		} // Other specific errors logged above

		// Snap back logic: Redraw links to their original positions
		if (state.reconnectOriginInfo?.linkIds) { // Check if info exists before accessing
			state.reconnectOriginInfo.linkIds.forEach(linkId => {
				const link = state.links[linkId];
				if (link) {
					link.element?.classList.remove('reconnecting-link');
					updateLinkPath(linkId); // Redraw using original link data
				}
			});
		}
	}

	// Cleanup always runs
	finishReconnection();
} // *** End of handleReconnectMouseUp function ***

function finishReconnection() {
	if (!state.isReconnecting) return; // Prevent double execution
	state.isReconnecting = false;
	dom.nodeEditor.classList.remove('reconnecting');

	// Ensure all potentially affected links have the class removed
	if (state.reconnectOriginInfo?.linkIds) {
		state.reconnectOriginInfo.linkIds.forEach(linkId => {
			state.links[linkId]?.element?.classList.remove('reconnecting-link');
		});
	}

	state.reconnectOriginInfo = null;
	document.removeEventListener('mousemove', dragReconnection);
	document.removeEventListener('mouseup', handleReconnectMouseUp);
}

// --- Hover Effects ---
export function handleSocketMouseEnter(e) {
	const targetSocketElement = e.currentTarget;
	const targetSocketId = targetSocketElement.dataset.socketId;
	const targetNodeId = targetSocketElement.closest('.node').id;
	const targetType = targetSocketElement.classList.contains('input') ? 'input' : 'output';

	// Normal Linking Hover
	if (state.isLinking && state.linkStartSocketInfo) {
		if (targetType === 'input' && targetNodeId !== state.linkStartSocketInfo.nodeId) {
			targetSocketElement.style.backgroundColor = '#4CAF50'; // Green: Valid target
		} else if (targetType === 'input') { // Self-link attempt or output hover
			targetSocketElement.style.backgroundColor = '#F44336'; // Red: Invalid target
		}
	}
	// Reconnecting Hover
	else if (state.isReconnecting && state.reconnectOriginInfo) {
		const originType = state.reconnectOriginInfo.type;
		const originNodeId = state.reconnectOriginInfo.nodeId;
		const originSocketId = state.reconnectOriginInfo.socketId;
		const isValidType = (originType === 'output' && targetType === 'input') || (originType === 'input' && targetType === 'output');
		const isSameSocket = targetNodeId === originNodeId && targetSocketId === originSocketId;

		if (isSameSocket) {
			targetSocketElement.style.backgroundColor = '#aaaaaa'; // Grey: Origin socket
		} else if (isValidType) { // Allow reconnecting to different socket on same node
			targetSocketElement.style.backgroundColor = '#FF9800'; // Orange: Valid reconnect target
		} else {
			targetSocketElement.style.backgroundColor = '#F44336'; // Red: Invalid type
		}
	}
}
export function handleSocketMouseLeave(e) {
	e.currentTarget.style.backgroundColor = ''; // Reset background color
}
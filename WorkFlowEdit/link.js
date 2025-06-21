// --- START OF FILE link.js ---
import { SVG_NS } from './config.js';
import { state, getNextLinkId } from './state.js';
import { getSocketPosition } from './utils.js';
import * as dom from './dom.js';

// Calculate SVG path data (Bezier curve)
export function calculateLinkPath(startPos, endPos) {
	const dx = endPos.x - startPos.x;
	const dy = endPos.y - startPos.y;

	// Control point calculation (simple horizontal/vertical bias)
	let cp1x, cp1y, cp2x, cp2y;

	if (state.currentFlowDirection === 'horizontal') {
		const curveIntensity = Math.min(Math.max(Math.abs(dx) * 0.6, 50), 200); // Adjust multiplier and clamps
		cp1x = startPos.x + curveIntensity;
		cp1y = startPos.y;
		cp2x = endPos.x - curveIntensity;
		cp2y = endPos.y;
	} else { // Vertical
		const curveIntensity = Math.min(Math.max(Math.abs(dy) * 0.6, 50), 200);
		cp1x = startPos.x;
		cp1y = startPos.y + curveIntensity;
		cp2x = endPos.x;
		cp2y = endPos.y - curveIntensity;
	}

	// M = Move to start, C = Cubic Bezier curve to end
	return `M ${startPos.x} ${startPos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endPos.x} ${endPos.y}`;
}

export function updateLinkPath(linkId) {
	const link = state.links[linkId];
	if (!link) return;

	const fromNode = state.nodes[link.fromNode];
	const toNode = state.nodes[link.toNode];
	if (!fromNode || !toNode) {
		console.warn(`Node not found for link ${linkId}, removing link.`);
		removeLink(linkId); // Clean up broken link
		return;
	}

	const startSocket = fromNode.outputs[link.fromSocket];
	const endSocket = toNode.inputs[link.toSocket];

	if (!startSocket || !endSocket || !startSocket.element || !endSocket.element) {
		console.warn(`Socket not found for link ${linkId}, removing link.`);
		removeLink(linkId); // Clean up broken link
		return;
	}

	const startPos = getSocketPosition(startSocket.element);
	const endPos = getSocketPosition(endSocket.element);

	const pathData = calculateLinkPath(startPos, endPos);
	if (link.element) {
		link.element.setAttribute('d', pathData);
	} else {
		console.warn(`Link element not found for ${linkId} during update.`);
	}
}

// Update all links connected to a specific node
export function updateLinksForNode(nodeId) {
	const node = state.nodes[nodeId];
	if (!node) return;

	const affectedLinks = new Set(); // Use Set to avoid duplicates

	// Collect links connected to this node's inputs
	Object.values(node.inputs).forEach(input => {
		input.links.forEach(linkId => affectedLinks.add(linkId));
	});
	// Collect links connected to this node's outputs
	Object.values(node.outputs).forEach(output => {
		output.links.forEach(linkId => affectedLinks.add(linkId));
	});

	// Update the path for each affected link
	affectedLinks.forEach(linkId => {
		if (state.links[linkId]) { // Check if link still exists
			updateLinkPath(linkId);
		}
	});
}

export function createLink(fromNodeId, fromSocketId, toNodeId, toSocketId, id = null) {
	const linkId = id || getNextLinkId();

	// Check if link already exists (simple check)
	if (state.links[linkId]) return; // Or update if needed?
	// More robust check: Does a link between these specific sockets already exist?
	const existingLink = Object.values(state.links).find(l =>
		l.fromNode === fromNodeId && l.fromSocket === fromSocketId &&
		l.toNode === toNodeId && l.toSocket === toSocketId
	);
	if (existingLink) {
		console.warn("Link already exists between these sockets.");
		return null; // Indicate failure
	}

	const linkElement = document.createElementNS(SVG_NS, 'path');
	linkElement.setAttribute('id', linkId);
	linkElement.dataset.linkId = linkId; // For potential interaction later
	dom.svgLayer.appendChild(linkElement);

	const linkData = {
		id: linkId,
		fromNode: fromNodeId,
		fromSocket: fromSocketId,
		toNode: toNodeId,
		toSocket: toSocketId,
		element: linkElement
	};
	state.links[linkId] = linkData;

	// Update socket connection info
	state.nodes[fromNodeId]?.outputs[fromSocketId]?.links.push(linkId);
	state.nodes[toNodeId]?.inputs[toSocketId]?.links.push(linkId);

	// Draw the path
	updateLinkPath(linkId);
	console.log("Link created:", linkId);
	return linkData;
}

export function removeLink(linkId) {
	const link = state.links[linkId];
	if (!link) return;

	// Remove from socket lists
	const fromNode = state.nodes[link.fromNode];
	const toNode = state.nodes[link.toNode];
	if (fromNode && fromNode.outputs[link.fromSocket]) {
		const outIdx = fromNode.outputs[link.fromSocket].links.indexOf(linkId);
		if (outIdx > -1) fromNode.outputs[link.fromSocket].links.splice(outIdx, 1);
	}
	if (toNode && toNode.inputs[link.toSocket]) {
		const inIdx = toNode.inputs[link.toSocket].links.indexOf(linkId);
		if (inIdx > -1) toNode.inputs[link.toSocket].links.splice(inIdx, 1);
	}

	// Remove SVG element
	link.element?.remove();

	// Remove from links object
	delete state.links[linkId];
	// console.log("Removed link:", linkId);
}
// --- END OF FILE link.js ---
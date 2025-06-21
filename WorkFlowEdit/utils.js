// --- START OF FILE utils.js ---
import * as dom from './dom.js';
import { state } from './state.js';

export function updateWorkspaceTransform() {
	const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomLevel})`;
	dom.workspace.style.transform = transform;
	dom.svgLayer.style.transform = transform; // Apply same transform to SVG layer container
}

export function screenToWorkspace(screenX, screenY) {
	const editorRect = dom.nodeEditor.getBoundingClientRect();
	const relativeX = screenX - editorRect.left;
	const relativeY = screenY - editorRect.top;
	const workspaceX = (relativeX - state.panX) / state.zoomLevel;
	const workspaceY = (relativeY - state.panY) / state.zoomLevel;
	return { x: workspaceX, y: workspaceY };
}

// Gets the center position of a socket element relative to the workspace origin
export function getSocketPosition(socketElement) {
	const nodeElement = socketElement.closest('.node');
	if (!nodeElement) return { x: 0, y: 0 }; // Should not happen

	// Ensure node position is up-to-date in state if relying on it,
	// but using getBoundingClientRect is generally more reliable for current rendering.
	// const nodeState = state.nodes[nodeElement.id];

	const socketRect = socketElement.getBoundingClientRect(); // Position on screen
	const editorRect = dom.nodeEditor.getBoundingClientRect(); // Editor position on screen

	// Calculate center of socket relative to top-left of the editor (in screen pixels)
	const socketCenterXScreen = socketRect.left + socketRect.width / 2;
	const socketCenterYScreen = socketRect.top + socketRect.height / 2;

	// Convert screen coordinates to workspace coordinates
	return screenToWorkspace(socketCenterXScreen, socketCenterYScreen);
}
// --- END OF FILE utils.js ---
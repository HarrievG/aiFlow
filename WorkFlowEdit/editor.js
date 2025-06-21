// --- START OF FILE editor.js ---
import * as dom from './dom.js';
import { state } from './state.js';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY } from './config.js';
import { updateWorkspaceTransform } from './utils.js';
import { updateLinkPath } from './link.js';

// --- Panning Logic ---
export function startPan(e) {
	// Prevent panning if starting on node, during linking, or during reconnecting
	if (e.button !== 1 && (e.button !== 0 || state.isDraggingNode || state.isLinking || state.isReconnecting)) return;
	if (e.target.closest('.node')) return; // Don't pan when clicking node/socket

	state.isPanning = true;
	state.panStartX = e.clientX;
	state.panStartY = e.clientY;
	dom.nodeEditor.classList.add('panning');
	document.addEventListener('mousemove', pan);
	document.addEventListener('mouseup', stopPan);
	e.preventDefault();
}

function pan(e) {
	if (!state.isPanning) return;

	const dx = e.clientX - state.panStartX;
	const dy = e.clientY - state.panStartY;
	state.panX += dx;
	state.panY += dy;
	state.panStartX = e.clientX;
	state.panStartY = e.clientY;

	updateWorkspaceTransform();
	// OPTIMIZATION: Could potentially update link positions without recalculating
	// paths if SVG transform is used directly, but recalculating is simpler for now.
	Object.values(state.links).forEach(link => updateLinkPath(link.id));
}

function stopPan(e) {
	if (!state.isPanning) return;
	state.isPanning = false;
	dom.nodeEditor.classList.remove('panning');
	document.removeEventListener('mousemove', pan);
	document.removeEventListener('mouseup', stopPan);
}

// --- Zooming Logic ---
export function handleZoom(e) {
	e.preventDefault();
	const editorRect = dom.nodeEditor.getBoundingClientRect();
	// Mouse position relative to editor top-left
	const mouseX = e.clientX - editorRect.left;
	const mouseY = e.clientY - editorRect.top;

	// Calculate mouse position in workspace coordinates before zoom
	const mouseBeforeZoomX = (mouseX - state.panX) / state.zoomLevel;
	const mouseBeforeZoomY = (mouseY - state.panY) / state.zoomLevel;

	// Calculate new zoom level
	const delta = -e.deltaY * ZOOM_SENSITIVITY;
	const newZoomLevelUnclamped = state.zoomLevel * (1 + delta);
	const newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoomLevelUnclamped));

	// If zoom didn't change (due to clamping), exit
	if (newZoomLevel === state.zoomLevel) return;

	// Calculate new pan position to keep mouse position stationary in workspace
	state.panX = mouseX - mouseBeforeZoomX * newZoomLevel;
	state.panY = mouseY - mouseBeforeZoomY * newZoomLevel;
	state.zoomLevel = newZoomLevel;

	updateWorkspaceTransform();
	// Update all links after zoom
	Object.values(state.links).forEach(link => updateLinkPath(link.id));
}

export function resetView() {
	state.panX = 0;
	state.panY = 0;
	state.zoomLevel = 1.0;
	updateWorkspaceTransform();
}
// --- END OF FILE editor.js ---
import * as dom from './dom.js';
import { state, setNodeIdCounter, setLinkIdCounter } from './state.js';
import { createNode } from './node.js';
import { createLink, removeLink, updateLinksForNode, updateLinkPath } from './link.js';
import { resetView } from './editor.js';
import { updateWorkspaceTransform } from './utils.js';
import { sendApiRequest } from './websocket.js'; // Import sendApiRequest
import { sendApiRequest_fs } from './websocket_fs.js'; // Import sendApiRequest
import { editAgent, deleteAgent, editWorkflow, deleteWorkflow, clearWorkspaceAndWorkflow, executeWorkflow, runWorkflow } from './main.js'; // Import functions from main.js

// --- View Management ---
export function showView(viewId,resetScroll = true) {
	const isHome = viewId === 'home';
	//dom.nodeEditorContainer.classList.add('hidden');
	document.querySelectorAll('.view').forEach(view => {
		view.classList.remove('active');
	});

	
	let domView = document.getElementById(`${viewId}-view`);
	domView.classList.add('active');
	if (resetScroll)
		domView.scrollTop = 0;

	const isNodeEditor = !document.getElementById(`node-editor-container`).classList.contains('hidden');
	if (isNodeEditor && isHome)
		dom.nodeEditorContainer.classList.add("hidden");

	// Toggle editor controls visibility
	const isEditorView = viewId === 'workflow-editor';
	document.querySelectorAll('.editor-control').forEach(control => {
		control.style.display = isEditorView ? isNodeEditor ? 'inline-flex' : '' : 'none';
	});

	// If switching to home, refresh the list
	if (viewId === 'home') {
		sendApiRequest('listWorkflows', {}, renderWorkflowList);
	} else if (viewId === 'filesystem') {
		navigateToPath(state.currentFilesystemPath);
	} else if (viewId === 'structured-outputs') {

		// Dynamically set the title of the shared output editor
		const outputEditorTitle = dom.outputsView.querySelector('h2'); // Assuming the h2 is the main title
		if (outputEditorTitle) {
			if (state.currentEditingContext === 'agent' && state.currentWorkflow && state.currentWorkflow.agents && state.currentWorkflow.agents[state.currentEditingAgentId]) {
				const agentName = state.currentWorkflow.agents[state.currentEditingAgentId].name;
				outputEditorTitle.textContent = `Outputs for Agent: ${agentName}`;
			} else if (state.currentEditingContext === 'workflow') {
				outputEditorTitle.textContent = 'Workflow Outputs';
			} else {
				outputEditorTitle.textContent = 'Structured Outputs'; // Default/fallback
			}
		}
	}

	state.currentViewId = viewId
}

// --- Flow Direction ---
export function setFlowDirection(direction) {
	state.currentFlowDirection = direction;
	// Note: workspace classes are handled by node.js createNode and updateLinksForNode
	// dom.workspace.classList.toggle('flow-vertical', direction === 'vertical');
	// dom.workspace.classList.toggle('flow-horizontal', direction === 'horizontal');
	// Update all nodes to apply the correct class
	Object.values(state.nodes).forEach(node => {
		node.element.classList.toggle('flow-vertical', direction === 'vertical');
		node.element.classList.toggle('flow-horizontal', direction === 'horizontal');
		// Re-render links as socket positions might change relative to node origin
		updateLinksForNode(node.id);
	});
	// Update all links (simpler for now than tracking which nodes changed)
	Object.values(state.links).forEach(link => updateLinkPath(link.id));
}

// --- Rendering Functions ---
// Functions populateWorkflowDetails, getWorkflowDetails, and renderAgentList have been moved to workflowEditorView.js

export function renderWorkflowList(response) {
	const workflowListUl = dom.workflowListUl;
	workflowListUl.innerHTML = ''; // Clear current list
	if (response.status === 'success' && response.payload.workflows) {
		response.payload.workflows.forEach(workflow => {
			const li = document.createElement('li');
			li.textContent = workflow.name;
			li.dataset.workflowId = workflow.id;

			const actionsDiv = document.createElement('div');
			actionsDiv.classList.add('workflow-actions');

			const runBtn = document.createElement('button');
			runBtn.textContent = 'Run';
			runBtn.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent li click
				runWorkflow(workflow);// workflow.id, workflow.name);
			});

			const editBtn = document.createElement('button');
			editBtn.textContent = 'Edit';
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent li click
				editWorkflow(workflow.id);
			});

			const deleteBtn = document.createElement('button');
			deleteBtn.textContent = 'Delete';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent li click
				deleteWorkflow(workflow.id);
			});

			actionsDiv.appendChild(runBtn);
			actionsDiv.appendChild(editBtn);
			actionsDiv.appendChild(deleteBtn);
			li.appendChild(actionsDiv);

			// Add click listener to the list item itself to load/edit
			// li.addEventListener('click', () => editWorkflow(workflow.id)); // Already handled by edit button

			workflowListUl.appendChild(li);
		});
	} else {
		console.error('Failed to load workflow list:', response.payload.message);
		const li = document.createElement('li');
		li.textContent = 'Error loading workflows.';
		workflowListUl.appendChild(li);
	}
}

// Agent editor functions (populateAgentDetails, getAgentDetails, renderAvailableTools)
// have been moved to agentEditorView.js

//Filesystem Browser Rendering and Navigation
export function navigateToPath(path) {
	state.currentFilesystemPath = path;
	dom.currentPathDiv.textContent = path;
	dom.filesystemListUl.innerHTML = '<li>Loading...</li>'; // Show loading indicator
	// Disable "Up Directory" button if at root (simple check for '.' or '/')
	// This is a basic check; a more robust check might involve backend info
	const isRoot = path === '.' || path === '/' || path.endsWith(':\\'); // Basic check for Windows roots
	dom.goUpBtn.disabled = isRoot;


	sendApiRequest_fs('listDir', { path: path }, (response) => {
		const filesystemListUl = dom.filesystemListUl;
		filesystemListUl.innerHTML = ''; // Clear loading indicator

		if (response.status === 'success' && response.payload.entries) {
			if (response.payload.entries.length === 0) {
				const li = document.createElement('li');
				li.textContent = 'Directory is empty.';
				filesystemListUl.appendChild(li);
				return;
			}

			// Sort entries: directories first, then files, both alphabetically
			response.payload.entries.sort((a, b) => {
				if (a.is_directory && !b.is_directory) return -1;
				if (!a.is_directory && b.is_directory) return 1;
				return a.name.localeCompare(b.name);
			});


			response.payload.entries.forEach(entry => {
				const li = document.createElement('li');
				// li.textContent = entry.name; // Removed textContent directly on li
				li.dataset.entryName = entry.name; // Store name
				li.dataset.isDirectory = entry.is_directory; // Store type

				// Create a span for the name to control its flex behavior
				const nameSpan = document.createElement('span');
				nameSpan.classList.add('entry-name');
				nameSpan.textContent = entry.name;
				li.appendChild(nameSpan);


				if (entry.is_directory) {
					li.classList.add('directory');
					li.addEventListener('click', () => {
						// Construct the new path by joining current path and entry name
						// Use a simple join; backend should handle path normalization
						const newPath = state.currentFilesystemPath === '.' ? entry.name : `${state.currentFilesystemPath}/${entry.name}`;
						navigateToPath(newPath);
					});
				} else {
					li.classList.add('file');
					if (entry.size !== undefined) {
						const sizeSpan = document.createElement('span');
						sizeSpan.classList.add('entry-size');
						sizeSpan.textContent = `(${formatBytes(entry.size)})`; // Format size
						li.appendChild(sizeSpan);
					}
					li.addEventListener('click', () => {
						// Handle file click (e.g., read file content)
						const filePath = state.currentFilesystemPath === '.' ? entry.name : `${state.currentFilesystemPath}/${entry.name}`;
						console.log('Clicked file:', filePath);
						// Example: Read file content (optional)
						sendApiRequest_fs('readFile', { path: filePath }, (readResponse) => {
							if (readResponse.status === 'success') {
								alert(`Content of ${entry.name}:\n\n${readResponse.payload.content.substring(0, 500)}...`); // Show first 500 chars
							} else {
								alert('Failed to read file: ' + (readResponse.payload?.message || 'Unknown error'));
							}
						});
					});
				}

				filesystemListUl.appendChild(li);
			});
		} else {
			console.error('Failed to list directory:', response.payload.message);
			const li = document.createElement('li');
			li.textContent = 'Error listing directory: ' + (response.payload?.message || 'Unknown error');
			filesystemListUl.appendChild(li);
		}
	});
}

// Helper function to format bytes for display
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Add listener for the "Up Directory" button
dom.goUpBtn.addEventListener('click', () => {
	// Simple path manipulation for going up
	// This assumes '/' as separator; backend should handle OS specifics
	const currentPath = state.currentFilesystemPath;
	const lastSlashIndex = currentPath.lastIndexOf('/');
	const lastBackslashIndex = currentPath.lastIndexOf('\\'); // Also check for backslash (Windows)

	let parentPath;
	if (lastSlashIndex > lastBackslashIndex) { // Use the last separator found
		parentPath = currentPath.substring(0, lastSlashIndex);
	} else if (lastBackslashIndex > -1) {
		parentPath = currentPath.substring(0, lastBackslashIndex);
	} else {
		// No separator found, must be a single name or '.'
		parentPath = '.'; // Go up from a single name to '.'
	}

	// Handle root cases: if parentPath becomes empty or just a drive letter like "C:", go to root "."
	if (parentPath === '' || /^[a-zA-Z]:$/.test(parentPath)) {
		parentPath = '.';
	}

	// Prevent navigating up from the effective root '.'
	if (currentPath !== '.') {
		navigateToPath(parentPath);
	} else {
		console.log("Already at root directory.");
	}
});
// --- Node Editor UI Functions ---
/**
Clears all nodes and links from the editor UI and resets the state.
@param {boolean} confirm - Whether to ask the user for confirmation.
*/
export function clearWorkspace(confirm = true) {
	if (confirm && !window.confirm('Are you sure you want to clear the entire workspace?')) {
		return;
	}
	// Clear DOM
	dom.workspace.innerHTML = '';
	dom.svgLayer.innerHTML = '';
	// Clear state
	state.nodes = {};
	state.links = {};
	setNodeIdCounter(0);
	setLinkIdCounter(0);
	// Reset view
	resetView();
	console.log("Workspace cleared.");
}
// Reset view function (kept from original ui.js)
export function resetView_ui() {
	state.panX = 0;
	state.panY = 0;
	state.zoomLevel = 1.0;
	updateWorkspaceTransform();
}

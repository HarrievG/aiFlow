// WorkFlowEdit/workflowEditorView.js
// This module will encapsulate the view logic for the Workflow Editor.
import * as dom from './dom.js';
import { sendApiRequest } from './websocket.js';
import { state } from './state.js';
import { editAgent, deleteAgent } from './main.js';

// DOM element references will be stored here
export const elements = { // Exporting for now, can be un-exported if only used internally
	workflowEditorViewElement: null,
	workflowIdInput: null,
	workflowNameInput: null,
	workflowQueryTextarea: null,
	workflowServiceList: null,
	saveWorkflowDetailsBtn: null,
	executeWorkflowBtn: null,
	manageAgentsBtn: null,
	manageWorkflowArgsBtn: null,
	editGraphBtn: null,
	executionStatusDiv: null,
	agentManagementContainer: null,
	addAgentBtn: null,
	agentListUl: null,
};

// Store callbacks passed during init
const callbacks = {
	setFlowDirection: null,
};

/**
 * Initializes the WorkflowEditorView module.
 * Queries and stores references to DOM elements within the workflow editor view.
 * @param {object} options - Configuration options.
 * @param {function} options.setFlowDirectionCallback - Callback function to set flow direction.
 */
export function init(options = {}) {
	const viewElement = document.getElementById('workflow-editor-view');
	if (!viewElement) {
		console.error("WorkflowEditorView: Main #workflow-editor-view element not found.");
		return;
	}
	elements.workflowEditorViewElement = viewElement;

	elements.workflowIdInput = document.getElementById('workflow-id');
	elements.workflowNameInput = document.getElementById('workflow-name');
	elements.workflowQueryTextarea = document.getElementById('workflow-query');
	elements.workflowServiceList = document.getElementById('workflow-service-type');
	elements.saveWorkflowDetailsBtn = document.getElementById('save-workflow-details-btn');
	elements.executeWorkflowBtn = document.getElementById('execute-workflow-btn');
	elements.manageAgentsBtn = document.getElementById('manage-agents-btn');
	elements.manageWorkflowArgsBtn = document.getElementById('manage-workflow-arguments-btn'); // Corrected ID
	elements.editGraphBtn = document.getElementById('edit-graph-btn');
	elements.executionStatusDiv = document.getElementById('execution-status');
	elements.agentManagementContainer = document.getElementById('agent-management-container');
	elements.addAgentBtn = document.getElementById('add-agent-btn'); // This is within agentManagementContainer
	elements.agentListUl = document.getElementById('agent-list'); // This is within agentManagementContainer

	// Store callbacks
	if (options.setFlowDirectionCallback) {
		callbacks.setFlowDirection = options.setFlowDirectionCallback;
	} else {
		console.warn("WorkflowEditorView: setFlowDirectionCallback not provided during init.");
	}

	// Verify all elements are found (optional, good for debugging)
	for (const key in elements) {
		if (elements[key] === null && key !== 'workflowEditorViewElement') { // workflowEditorViewElement is checked above
			console.warn(`WorkflowEditorView: Element with ID for '${key}' was not found.`);
		}
	}
	 console.log("WorkflowEditorView initialized and DOM elements queried.");
}
export function populateWorkflowDetails(workflow) {
	if (!elements.workflowIdInput) {
		console.error("populateWorkflowDetails: View not initialized or workflowIdInput not found.");
		return;
	}

	if (workflow.id) {
		elements.workflowIdInput.value = workflow.id;
		elements.workflowIdInput.removeAttribute("shouldClearOnSend");
	} else {
		elements.workflowIdInput.value = 'New Workflow (ID assigned on save)';
		elements.workflowIdInput.setAttribute("shouldClearOnSend", "true");
	}

	elements.workflowNameInput.value = workflow.name || '';
	elements.workflowQueryTextarea.value = workflow.query || '';

	// Clear existing options before populating
	elements.workflowServiceList.innerHTML = '';

	// Populate service list (logic from original ui.js)
	// This part still uses sendApiRequest, which is fine.
	sendApiRequest('listServices', {}, (response) => {
		if (response.status === 'success') {
			if (response.payload.items && response.payload.items.length) {
				response.payload.items.forEach(entry => {
					const option = document.createElement('option');
					option.value = entry.id; // Use ID as value for easier retrieval
					option.textContent = entry.name;
					option.selected = entry.id === workflow.service_id;
					elements.workflowServiceList.appendChild(option);
				});
			} else {
				const option = document.createElement('option');
				option.textContent = 'No service context defined yet.';
				elements.workflowServiceList.appendChild(option);
			}
		} else {
			console.error('Failed to list services for workflow:', response.payload ? response.payload.message : 'Unknown error');
			const option = document.createElement('option');
			option.textContent = 'Error loading services.';
			elements.workflowServiceList.appendChild(option);
		}
	});


	elements.executionStatusDiv.textContent = ''; // Clear status on load

	// Set radio buttons based on view state (using dom from ui.js for now)
	if (workflow.view_state?.flowDirection === 'vertical') {
		dom.flowVerticalRadio.checked = true;
	} else {
		dom.flowHorizontalRadio.checked = true;
	}
	// setFlowDirection is still in ui.js, this creates a circular dependency if ui.js imports from here.
	// This suggests setFlowDirection might need to be passed in or handled differently.
	// For now, we'll call it, but this needs review in step 5.
	// setFlowDirection(workflow.view_state?.flowDirection || 'horizontal'); // Original call
	if (callbacks.setFlowDirection) {
		callbacks.setFlowDirection(workflow.view_state?.flowDirection || 'horizontal');
	} else {
		console.error("populateWorkflowDetails: setFlowDirection callback is not available.");
	}
}

export function getWorkflowDetails() {
	if (!state.currentWorkflow) return null;
	if (!elements.workflowNameInput) {
		console.error("getWorkflowDetails: View not initialized or workflowNameInput not found.");
		return null;
	}
	state.currentWorkflow.name = elements.workflowNameInput.value;
	state.currentWorkflow.query = elements.workflowQueryTextarea.value;
	state.currentWorkflow.service_id = elements.workflowServiceList.value;
	// Note: ID is read-only, agents/graph are managed separately
	return state.currentWorkflow;
}

export function renderAgentList(agents) {
	if (!elements.agentListUl) {
		console.error("renderAgentList: View not initialized or agentListUl not found.");
		return;
	}
	elements.agentListUl.innerHTML = ''; // Clear current list
	if (!agents || Object.keys(agents).length === 0) {
		const li = document.createElement('li');
		li.textContent = 'No agents defined yet.';
		elements.agentListUl.appendChild(li);
		return;
	}

	Object.values(agents).forEach(agent => {
		const li = document.createElement('li');
		li.textContent = `${agent.name} (${agent.type})`;
		li.dataset.agentId = agent.id;

		const actionsDiv = document.createElement('div');
		actionsDiv.classList.add('agent-actions');

		const editBtn = document.createElement('button');
		editBtn.textContent = 'Edit';
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation(); // Prevent li click
			editAgent(agent.id); // Uses imported editAgent
		});

		const deleteBtn = document.createElement('button');
		deleteBtn.textContent = 'Delete';
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation(); // Prevent li click
			deleteAgent(agent.id); // Uses imported deleteAgent
		});

		actionsDiv.appendChild(editBtn);
		actionsDiv.appendChild(deleteBtn);
		li.appendChild(actionsDiv);

		elements.agentListUl.appendChild(li);
	});
}

// Helper function to clear the execution status
export function clearExecutionStatus() {
    if (elements.executionStatusDiv) {
        elements.executionStatusDiv.textContent = '';
    }
}

// Helper function to update the execution status
export function updateExecutionStatus(message, isError = false) {
    if (elements.executionStatusDiv) {
        elements.executionStatusDiv.textContent = message;
        elements.executionStatusDiv.style.color = isError ? 'red' : '#90ee90'; // Or your preferred error/success colors
    }
}

console.log("WorkflowEditorView module loaded");
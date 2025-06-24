// WorkFlowEdit/agentEditorView.js
// This module will encapsulate the view logic for the Agent Editor.

console.log("AgentEditorView module loaded");

// DOM element references will be stored here
export const elements = {
	agentEditorViewElement: null,
	agentIdInput: null,
	agentNameInput: null,
	agentTypeSelect: null,
	agentPromptTextarea: null,
	agentToolsDiv: null,
	// Add other agent-specific elements here if any (e.g., save button, back button, etc.
	// though their event listeners might still be in main.js, the elements themselves can be here)
	saveAgentDetailsBtn: null,
	editAgentOutputsBtn: null,
	// backToWorkflowBtn: null, // This is in dom.js, and its listener is in main.js, might be too general to move here
};

/**
 * Initializes the AgentEditorView module.
 * Queries and stores references to DOM elements within the agent editor view.
 */
export function init() {
	elements.agentEditorViewElement = document.getElementById('agent-editor-view');
	if (!elements.agentEditorViewElement) {
		console.error("AgentEditorView: Main #agent-editor-view element not found.");
		// No return here, allow other elements to be queried if the main one is missing for some reason during dev
	}

	elements.agentIdInput = document.getElementById('agent-id');
	elements.agentNameInput = document.getElementById('agent-name');
	elements.agentTypeSelect = document.getElementById('agent-type');
	elements.agentPromptTextarea = document.getElementById('agent-prompt');
	elements.agentToolsDiv = document.getElementById('agent-tools');
	elements.saveAgentDetailsBtn = document.getElementById('save-agent-details-btn'); // Often listeners are in main.js, but element can be here
	elements.editAgentOutputsBtn = document.getElementById('edit-agent-outputs-btn');


	for (const key in elements) {
		if (elements[key] === null) {
			// console.warn(`AgentEditorView: Element for '${key}' was not found.`);
		}
	}
	// console.log("AgentEditorView initialized and DOM elements queried.");
}

// Import state if getAgentDetails relies on it (it does in the original ui.js version)
import { state } from './state.js';

export function populateAgentDetails(agent) {
	if (!elements.agentIdInput) {
		console.error("populateAgentDetails: View not initialized or agentIdInput not found.");
		return;
	}
	elements.agentIdInput.value = agent.id || 'New Agent (ID assigned on save)';
	elements.agentNameInput.value = agent.name || '';
	elements.agentTypeSelect.value = agent.type || 'generic';
	elements.agentPromptTextarea.value = agent.prompt || '';
	// Tools and Sub-agents are handled by renderAvailableTools or other functions
}

// Function to get data from agent details form
export function getAgentDetails() {
	// This function modifies the agent object from the global state.
	// Consider if the agent object should be passed in and returned,
	// or if this view module is allowed to modify global state directly.
	// For now, keeping original behavior of modifying state.currentWorkflow.agents[state.currentAgentId].
	if (!state.currentWorkflow || !state.currentAgentId) return null;
	const agent = state.currentWorkflow.agents[state.currentAgentId];
	if (!agent) return null;

	if (!elements.agentNameInput) {
		console.error("getAgentDetails: View not initialized or agentNameInput not found.");
		return agent; // Return original agent if view elements are missing
	}

	agent.name = elements.agentNameInput.value;
	agent.type = elements.agentTypeSelect.value;
	agent.prompt = elements.agentPromptTextarea.value;

	// Collect selected tools
	agent.tools = [];
	if (elements.agentToolsDiv) {
		elements.agentToolsDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
			agent.tools.push({ name: checkbox.value });
		});
	} else {
		console.error("getAgentDetails: agentToolsDiv not found.");
	}
	// Sub-agents logic would go here if implemented in this view

	return agent; // Return the modified agent object
}

export function renderAvailableTools(availableTools, selectedTools = []) {
	if (!elements.agentToolsDiv) {
		console.error("renderAvailableTools: View not initialized or agentToolsDiv not found.");
		return;
	}
	elements.agentToolsDiv.innerHTML = ''; // Clear current list
	const selectedToolNames = new Set(selectedTools.map(t => t.name));

	if (!availableTools || availableTools.length === 0) {
		elements.agentToolsDiv.textContent = 'No tools available.';
		return;
	}

	availableTools.forEach(tool => {
		const label = document.createElement('label');
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = tool.name;
		if (selectedToolNames.has(tool.name)) {
			checkbox.checked = true;
		}
		label.appendChild(checkbox);
		label.appendChild(document.createTextNode(` ${tool.name}`)); // Added space for better readability

		const descriptionSpan = document.createElement('span');
		descriptionSpan.classList.add('tool-description');
		descriptionSpan.textContent = ` (${tool.description || 'No description'})`;
		label.appendChild(descriptionSpan);

		elements.agentToolsDiv.appendChild(label);
		elements.agentToolsDiv.appendChild(document.createElement('br')); // Simple layout
	});
}

// WorkFlowEdit/agentEditorView.js
// This module will encapsulate the view logic for the Agent Editor.

import { sendApiRequest } from './websocket.js';

console.log("AgentEditorView module loaded");

let agentServiceListPopulated = false;

// DOM element references will be stored here
export const elements = {
	agentEditorViewElement: null,
	agentIdInput: null,
	agentNameInput: null,
	agentTypeSelect: null,
	agentPromptTextarea: null,
	agentToolsDiv: null,

	saveAgentDetailsBtn: null,
	editAgentOutputsBtn: null,
	backToWorkflowBtn: null,
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
	elements.agentServiceList = document.getElementById('agent-service-type');
	elements.agentToolsDiv = document.getElementById('agent-tools');
	elements.saveAgentDetailsBtn = document.getElementById('save-agent-details-btn'); // Often listeners are in main.js, but element can be here
	elements.editAgentOutputsBtn = document.getElementById('edit-agent-outputs-btn');
	elements.backToWorkflowBtn = document.getElementById('back-to-workflow-btn'); // General navigation button

	for (const key in elements) {
		if (elements[key] === null) {
			 console.warn(`AgentEditorView: Element for '${key}' was not found.`);
		}
	}
	// console.log("AgentEditorView initialized and DOM elements queried.");

	
	elements.saveAgentDetailsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentAgentId) return;
		// Update the specific agent in the current workflow state
		const agentId = state.currentAgentId;
		
		const agent = getAgentDetails(); // This function should retrieve the agent from state and update it
	
		if (agent) {
	
			sendApiRequest('saveAgent', agent, (response) => {
				if (response.status === 'success') {
					console.log('Agent saved (with outputs):', response.payload.agent_id);
				} else {
					console.error('Save failed:', response.payload.message);
					alert('Error saving agent: ' + response.payload.message);
				}
			});
	
			console.log('Agent details updated in state (including outputs):', agent);
			alert('Agent saved');
		}
	});
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

	if ( ! agentServiceListPopulated )
	{	
		sendApiRequest('listServices', {}, (response) => {
			if (response.status === 'success') {
				if (response.payload.items && response.payload.items.length) {
					response.payload.items.forEach(entry => {
						const option = document.createElement('option');
						option.value = entry.id; // Use ID as value for easier retrieval
						option.textContent = entry.name;
	
						if (agent.service_id)
							option.selected = entry.id === agent.service_id;
						else
							option.selected = entry.id === state.currentWorkflow.service_id; 
	
						elements.agentServiceList.appendChild(option);
					});
				} else {
					const option = document.createElement('option');
					option.textContent = 'No service context defined yet.';
					elements.agentServiceList.appendChild(option);
				}
				agentServiceListPopulated = true;
			} else {
				console.error('Failed to list services for agent:', response.payload ? response.payload.message : 'Unknown error');
				const option = document.createElement('option');
				option.textContent = 'Error loading services.';
				elements.agentServiceList.appendChild(option);
			}
		});
	}else
	{
		if (agent.service_id)
		{
			Array.from(elements.agentServiceList.options).forEach(service_option => {
				service_option.selected = service_option.value === agent.service_id;
			});
		}
	}

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
	agent.service_id = elements.agentServiceList.value;
	
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
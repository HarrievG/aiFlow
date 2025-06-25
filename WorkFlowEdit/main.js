import * as dom from './dom.js';
import { state, setNodeIdCounter, setLinkIdCounter } from './state.js';
import { createNode } from './node.js';
import { startPan, handleZoom } from './editor.js';
import { setFlowDirection, showView, renderWorkflowList, clearWorkspace } from './ui.js'; // Removed workflow specific and agent specific
import {
    init as initWorkflowEditorView,
    populateWorkflowDetails as populateWorkflowDetailsView,
    renderAgentList as renderAgentListView,
    getWorkflowDetails as getWorkflowDetailsView,
    updateExecutionStatus,
	clearExecutionStatus,
	elements as domWorkflowEdit
} from './workflowEditorView.js';
import {
    init as initAgentEditorView,
    populateAgentDetails as populateAgentDetailsView,
    getAgentDetails as getAgentDetailsView,
	renderAvailableTools as renderAvailableToolsView,
	elements as domAgentEdit
} from './agentEditorView.js';
import { handleSocketMouseDown } from './interactions.js';
import { initWebSocket, sendApiRequest, subscribeToEvent } from './websocket.js';
import { initWebSocket_fs, sendApiRequest_fs, subscribeToEvent_fs } from './websocket_fs.js';
import { initArgumentsEditor, renderArguments } from './arguments_editor.js';
import { initExecuteWorkflowModal, showExecuteWorkflowModal } from './workflow_modal.js'; // Import modal logic
import { createLink } from './link.js';
import { updateWorkspaceTransform } from './utils.js';
import { initOutputEditor, renderOutputs } from './output_editor.js';


document.addEventListener('DOMContentLoaded', () => {

	// --- WebSocket Initialization ---
	initWebSocket_fs('ws://localhost:8889'); // Connect to the C++ filesystem backend
	initWebSocket('ws://localhost:8888'); // Connect to the C++ backend

	// --- Initializer Calls ---
	initArgumentsEditor();
	initOutputEditor();
	initWorkflowEditorView({ setFlowDirectionCallback: setFlowDirection }); // Already here from previous refactor
	initAgentEditorView(); // Add this line

	initExecuteWorkflowModal(); // Initialize modal event listeners

	// --- Event Listeners ---

	// Global UI Buttons
	dom.homeBtn.addEventListener('click', () => showView('home',false));

	// Home View Buttons
	dom.createWorkflowBtn.addEventListener('click', () => {
		// Create a new empty workflow structure in state and show the editor
		state.currentWorkflow = {
			id: '', // Will be assigned by backend on save
			name: 'New Workflow',
			query: '',
			agents: {},
			flow_director_agent_id: null,
			flow_master_agent_id: null,
			orchestration_graph: { nodes: {}, links: {} },
			view_state: { panX: 0, panY: 0, zoomLevel: 1.0, flowDirection: 'horizontal', nodeIdCounter: 0, linkIdCounter: 0 },
			arguments: {}
		};
		showView('workflow-editor');
		populateWorkflowDetailsView(state.currentWorkflow);
		clearExecutionStatus(); // Clear status for new workflow

		// Hide graph/agent views initially
		dom.nodeEditorContainer.classList.add('hidden');
		domWorkflowEdit.agentManagementContainer.classList.add('hidden');
		// Reset editor state for new workflow
		clearWorkspace(false); // Clear UI elements without confirmation
		setFlowDirection('horizontal'); // Default for new workflow
		dom.flowHorizontalRadio.checked = true;
	});

	// Browse Files Button
	dom.browseFilesBtn.addEventListener('click', () => {
		showView('filesystem');
		// The navigateToPath('.') call is now handled inside showView('filesystem')
	});

	// Workflow Editor Buttons
	domWorkflowEdit.saveWorkflowDetailsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) return;

		// Update state from form

		// Use getWorkflowDetailsView to update state.currentWorkflow from the form
		// This also handles the shouldClearOnSend attribute internally if needed, or can be adapted.
		// For now, assuming getWorkflowDetailsView correctly updates the state.currentWorkflow object.
		const updatedWorkflow = getWorkflowDetailsView(); // This updates state.currentWorkflow
		if (!updatedWorkflow) {
			console.error("Failed to get workflow details from view.");
			return;
		}

		// The ID logic for "shouldClearOnSend" might need to be inside getWorkflowDetailsView or handled carefully here.
		// If workflowIdInput is managed by workflowEditorView, its state should be read there.
		// Let's assume getWorkflowDetailsView handles this. If not, it's a refinement.
		// If workflowIdInput.value is empty after getWorkflowDetailsView and it was a new workflow,
		// it implies it should be treated as a new one by the backend.

		// If the ID was 'New Workflow (ID assigned on save)' and is now empty, backend assigns ID.
		// If an ID exists, it's an update.
		// This logic is largely unchanged other than how state.currentWorkflow is populated.

		sendApiRequest('saveWorkflow', state.currentWorkflow, (response) => {
			if (response.status === 'success') {
				console.log('Workflow saved:', response.payload.workflow_id);
				state.currentWorkflow.id = response.payload.workflow_id; // Update ID if new
				// Update the view with the new ID
				if (populateWorkflowDetailsView && typeof populateWorkflowDetailsView === 'function') {
					populateWorkflowDetailsView(state.currentWorkflow);
				}
				alert('Workflow saved successfully!');
			} else {
				console.error('Save failed:', response.payload.message);
				alert('Error saving workflow: ' + response.payload.message);
			}
		});
	});

	domWorkflowEdit.executeWorkflowBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentWorkflow.id) {
			alert('Please save the workflow first.');
			return;
		}
		// Ensure the latest query from the textarea is in the state
		const currentDetails = getWorkflowDetailsView(); // This updates state.currentWorkflow
		if (!currentDetails) {
			console.error("Failed to get workflow details for execution.");
			return;
		}

		if (!state.currentWorkflow.query || !state.currentWorkflow.query.trim()) {
			alert('Please enter an initial query for execution.');
			return;
		}

		updateExecutionStatus('Starting execution...', false);

		sendApiRequest('executeWorkflow', {
			workflow_id: state.currentWorkflow.id,
			initial_query: state.currentWorkflow.query
		}, (response) => {
			if (response.status === 'success') {
				console.log('Workflow execution started:', response.payload.message);
				updateExecutionStatus('Execution started: ' + response.payload.message, false);
			} else {
				console.error('Execution failed to start:', response.payload.message);
				updateExecutionStatus('Error starting execution: ' + response.payload.message, true);
			}
		});
	});

	domWorkflowEdit.manageAgentsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		dom.nodeEditorContainer.classList.add('hidden');
		domWorkflowEdit.agentManagementContainer.classList.remove('hidden');
		renderAgentListView(state.currentWorkflow.agents);
	});

	domWorkflowEdit.manageWorkflowArgsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		showView('arguments');

		if (!state.currentWorkflow.arguments)
			state.currentWorkflow.arguments = {}
		renderArguments(state.currentWorkflow.arguments); // Populate the view with current arguments when shown
	});
	domWorkflowEdit.editGraphBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		domWorkflowEdit.agentManagementContainer.classList.add('hidden');
		dom.nodeEditorContainer.classList.remove('hidden');
		// Load the graph state into the editor
		loadLayout(state.currentWorkflow); // Pass the workflow object
		showView('workflow-editor'); // Ensure editor controls are shown
	});

	domWorkflowEdit.addAgentBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) return;
		const newAgentId = `agent-${Date.now()}`; // Simple unique ID
		state.currentWorkflow.agents[newAgentId] = {
			id: newAgentId,
			name: 'New Agent',
			type: 'generic',
			prompt: '',
			tools: [],
			sub_agents: [],
			outputs: { format: { type: 'object', properties: {}, required: [] } } // Initialize outputs
		};
		renderAgentListView(state.currentWorkflow.agents); // Refresh list
		// Optionally jump directly to editing the new agent
		editAgent(newAgentId);
	});

	// Agent Editor Buttons
	domAgentEdit.editAgentOutputsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentAgentId) {
			alert('No agent selected for editing outputs.');
			return;
		}
		const agent = state.currentWorkflow.agents[state.currentAgentId];
		if (!agent) {
			alert('Current agent data not found.');
			return;
		}
		// Ensure outputs structure exists (should be by addAgent/editAgent, but defensive)
		if (!agent.outputs || typeof agent.outputs.format !== 'object') {
			agent.outputs = { format: { type: 'object', properties: {}, required: [] } };
		}

		state.currentEditingContext = 'agent';
		state.currentEditingAgentId = state.currentAgentId;
		renderOutputs(agent.outputs); // from output_editor.js
		showView('structured-outputs');
	});

	domAgentEdit.saveAgentDetailsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentAgentId) return;
		// Update the specific agent in the current workflow state
		const agentId = state.currentAgentId;
		// Use getAgentDetailsView to update the agent object in state from the form
		const agent = getAgentDetailsView(); // This function should retrieve the agent from state and update it

		if (agent) {
			// agent object is already updated by getAgentDetailsView with form values and tools.
			// Sub-agents logic would go here if implemented.
			// agent.outputs is already part of the 'agent' object due to direct state manipulation by output_editor.js
			// or should be handled by getAgentDetailsView if it were to manage outputs form too.

			sendApiRequest('saveAgent', agent, (response) => {
				if (response.status === 'success') {
					console.log('Agent saved (with outputs):', response.payload.agent_id);
					// If agent ID was newly assigned by backend (though not typical for agents in this app structure)
					// state.currentWorkflow.agents[agentId].id = response.payload.agent_id;
					// populateAgentDetailsView(agent); // Re-populate to reflect any backend changes, if necessary
				} else {
					console.error('Save failed:', response.payload.message);
					alert('Error saving agent: ' + response.payload.message);
				}
			});

			console.log('Agent details updated in state (including outputs):', agent);
			alert('Agent saved');
		}
	});

	domAgentEdit.backToWorkflowBtn.addEventListener('click', () => {
		showView('workflow-editor',false);
		// Ensure the correct sub-view (agents or graph) is shown
		if (!dom.nodeEditorContainer.classList.contains('hidden')) {
			domWorkflowEdit.agentManagementContainer.classList.add('hidden');
		} else {
			dom.nodeEditorContainer.classList.add('hidden');
			domWorkflowEdit.agentManagementContainer.classList.remove('hidden');
		}
	});

	// Flow Master Editor Buttons
	dom.backToWorkflowFromFlowmasterBtn.addEventListener('click', () => {
		showView('workflow-editor');
		// Ensure the correct sub-view (agents or graph) is shown
		if (!dom.nodeEditorContainer.classList.contains('hidden')) {
			domWorkflowEdit.agentManagementContainer.classList.add('hidden');
		} else {
			dom.nodeEditorContainer.classList.add('hidden');
			domWorkflowEdit.agentManagementContainer.classList.remove('hidden');
		}
	});

	// Node Editor Interactions (from original FlowEdit)
	dom.nodeEditor.addEventListener('mousedown', startPan); // Panning on background
	dom.nodeEditor.addEventListener('wheel', handleZoom, { passive: false }); // Zooming

	// Node Editor Controls
	dom.addNodeBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentWorkflow.agents) {
			alert("Please load a workflow with agents first.");
			return;
		}

		const agents = state.currentWorkflow.agents;
		const agentList = Object.values(agents);

		if (agentList.length === 0) {
			alert("This workflow has no agents. Please create an agent first.");
			return;
		}

		// Create a prompt message with agent options
		let promptMessage = "Select an agent for the new node:\n\n";
		const agentMap = {};
		agentList.forEach((agent, index) => {
			const displayIndex = index + 1;
			promptMessage += `${displayIndex}: ${agent.name} (${agent.type})\n`;
			agentMap[displayIndex] = agent;
		});

		const selection = prompt(promptMessage);
		if (selection === null || selection === "") return; // User cancelled or entered nothing

		const selectedAgent = agentMap[selection];
		if (!selectedAgent) {
			alert("Invalid selection.");
			return;
		}

		// Create the node, linked to the selected agent.
		// Dynamically create outputs based on selectedAgent's definition
		let nodeOutputs = [];
		if (selectedAgent.outputs && selectedAgent.outputs.format && selectedAgent.outputs.format.properties) {
			for (const outputName in selectedAgent.outputs.format.properties) {
				const outputDetails = selectedAgent.outputs.format.properties[outputName];
				nodeOutputs.push({
					name: outputName,
					value_type: outputDetails.type || 'any'
				});
			}
		}
		// If no outputs defined on agent, createNode will use its internal default.
		// Otherwise, pass the dynamic outputs.
		// An explicit default input can also be passed if desired:
		// const nodeInputs = [{ name: 'In' }];

		createNode(null, undefined, undefined, selectedAgent.id, selectedAgent.name, [], nodeOutputs);
	});

	dom.flowHorizontalRadio.addEventListener('change', () => {
		if (dom.flowHorizontalRadio.checked) {
			setFlowDirection('horizontal');
		}
	});
	dom.flowVerticalRadio.addEventListener('change', () => {
		if (dom.flowVerticalRadio.checked) {
			setFlowDirection('vertical');
		}
	});

	dom.saveBtn.addEventListener('click', saveLayoutToWorkflow);
	dom.clearBtn.addEventListener('click', () => clearWorkspace(true));
	dom.editOutputsCtrlBtn.addEventListener('click', () => { // This is the GLOBAL outputs button from graph view
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		// Ensure workflow outputs structure exists
		if (!state.currentWorkflow.outputs || typeof state.currentWorkflow.outputs.format !== 'object') {
			state.currentWorkflow.outputs = { format: { type: 'object', properties: {}, required: [] } };
		}

		state.currentEditingContext = 'workflow';
		state.currentEditingAgentId = null;
		renderOutputs(state.currentWorkflow.outputs); // from output_editor.js
		showView('structured-outputs');
	});

	// --- Initial View ---
	showView('home');

	console.log("aiFlow Editor Initialized");

	// --- WebSocket Event Subscriptions ---
	subscribeToEvent('workflowExecutionStatus', (payload) => {
		console.log('Execution Status Update:', payload);
		if (state.currentWorkflow && state.currentWorkflow.id === payload.workflow_id) {
			let statusText = `Status: ${payload.status}`;
			if (payload.current_task) statusText += `\nCurrent Task: ${payload.current_task}`;
			if (payload.output) statusText += `\nOutput: ${payload.output}`;
			if (payload.error) statusText += `\nError: ${payload.error}`;
			// dom.executionStatusDiv.textContent = statusText;
			updateExecutionStatus(statusText, payload.error ? true : false);
		}
	});

	subscribeToEvent('logMessage', (payload) => {
		console.log(`[Backend Log - ${payload.level}] ${payload.message}`);
	});
});

// Helper function to navigate to agent editor
export function editAgent(agentId) {
	if (!state.currentWorkflow || !state.currentWorkflow.agents[agentId]) {
		console.error('Agent not found:', agentId);
		return;
	}
	state.currentAgentId = agentId; // Store the ID of the agent being edited
	const agent = state.currentWorkflow.agents[agentId];

	// Ensure agent.outputs exists and has the basic structure
	// This handles cases where an agent might be loaded from a backend that didn't have this field,
	// or if it's an older workflow being loaded.
	if (typeof agent.outputs === 'undefined') {
		console.log(`Initializing outputs for agent ${agentId} as it was undefined.`);
		agent.outputs = { format: { type: 'object', properties: {}, required: [] } };
	} else if (agent.outputs === null || typeof agent.outputs.format !== 'object' ||
	           !agent.outputs.format.hasOwnProperty('properties') || !agent.outputs.format.hasOwnProperty('required')) {
		console.warn(`Correcting malformed outputs structure for agent ${agentId}. Current value:`, JSON.stringify(agent.outputs));
		agent.outputs = { format: { type: 'object', properties: {}, required: [] } };
	}


	if (agent.type === 'master') {
		// Show specialized Flow Master editor
		showView('flowmaster-editor');
		// TODO: Populate specialized editor fields
	} else {
		// Show generic Agent editor
		showView('agent-editor');
		populateAgentDetailsView(agent); // Use the new view function
		// Request available tools from backend to populate tool list
		sendApiRequest('listAvailableTools', {}, (response) => {
			if (response.status === 'success') {
				renderAvailableToolsView(response.payload.tools, agent.tools); // Use the new view function
			} else {
				console.error('Failed to list available tools:', response.payload.message);
			}
		});
	}
}

// Helper function to delete an agent
export function deleteAgent(agentId) {
	if (!state.currentWorkflow || !state.currentWorkflow.agents[agentId]) {
		console.error('Agent not found for deletion:', agentId);
		return;
	}
	if (confirm(`Are you sure you want to delete agent "${state.currentWorkflow.agents[agentId].name}"? This will also remove any nodes using this agent from the graph.`)) {
		const workflow = state.currentWorkflow;
		const graph = workflow.orchestration_graph;

		if (graph && graph.nodes) {
			// Find nodes associated with the agent
			const nodesToDelete = Object.keys(graph.nodes).filter(nodeId => graph.nodes[nodeId].agent_id === agentId);

			// Find links connected to those nodes
			const linksToDelete = new Set();
			if (graph.links) {
				Object.keys(graph.links).forEach(linkId => {
					const link = graph.links[linkId];
					if (nodesToDelete.includes(link.from_node_id) || nodesToDelete.includes(link.to_node_id)) {
						linksToDelete.add(linkId);
					}
				});
			}

			// Delete the links and nodes from the workflow object
			linksToDelete.forEach(linkId => delete graph.links[linkId]);
			nodesToDelete.forEach(nodeId => delete graph.nodes[nodeId]);
		}

		// Delete the agent itself
		delete workflow.agents[agentId];

		// Refresh the agent list UI
		renderAgentListView(workflow.agents);

		// If the graph editor is visible, reload it to reflect the changes
		if (!dom.nodeEditorContainer.classList.contains('hidden')) {
			loadLayout(workflow);
		}

		alert('Agent deleted from memory. Remember to save the workflow!');
	}
}

// Helper function to delete a workflow
export function deleteWorkflow(workflowId) {
	if (confirm(`Are you sure you want to delete workflow "${workflowId}"?`)) {
		sendApiRequest('deleteWorkflow', { workflow_id: workflowId });
		sendApiRequest('listWorkflows', {}, renderWorkflowList);
	}
}

// Helper function to edit a workflow (load it)
export function editWorkflow(workflowId) {
	sendApiRequest('getWorkflow', { workflow_id: workflowId }, (response) => {
		if (response.status === 'success') {
			state.currentWorkflow = response.payload; // Store loaded workflow
			showView('workflow-editor');
			populateWorkflowDetailsView(state.currentWorkflow);
			clearExecutionStatus(); // Clear status when loading a new workflow
			// Default to showing the agent list after loading
			dom.nodeEditorContainer.classList.add('hidden');
			domWorkflowEdit.agentManagementContainer.classList.remove('hidden');
			renderAgentListView(state.currentWorkflow.agents);
			// Note: Graph is loaded when user clicks "Edit Graph"
		} else {
			console.error('Failed to load workflow:', response.payload.message);
			alert('Error loading workflow: ' + response.payload.message);
		}
	});
}

export function executeWorkflow(workflowId) {

	sendApiRequest('getWorkflow', { workflow_id: workflowId }, (response) => {
		if (response.status === 'success') {
			var currentWorkflow = response.payload;

			sendApiRequest('executeWorkflow', {
				workflow_id: workflowId,
				initial_query: currentWorkflow.query // Corrected from initialQuery to query
			}, (response) => {
				if (response.status === 'success') {
					console.log('Workflow execution started:', response.payload.message);
					updateExecutionStatus('Execution started...', false);
				} else {
					console.error('Execution failed to start:', response.payload.message);
					updateExecutionStatus('Error starting execution: ' + response.payload.message, true);
				}
			});

			// Note: Graph is loaded when user clicks "Edit Graph"
		} else {
			console.error('Failed to load workflow:', response.payload.message);
			alert('Error loading workflow: ' + response.payload.message);
		}
	});



}

// Helper function to run a workflow with a one time user query 
export function runWorkflow(workflow) { //workflowId,workflowName) {
	// Show the modal to get the query
	showExecuteWorkflowModal(workflow);
}

// Override the original clearWorkspace to also clear workflow state
export function clearWorkspaceAndWorkflow(confirm = true) {
	clearWorkspace(confirm); // Clear UI nodes/links
	state.currentWorkflow = null; // Clear workflow data
	state.currentAgentId = null;
	// Clear workflow details form
	// This should now be handled by populateWorkflowDetailsView with an empty/null object
	// or a dedicated clearWorkflowDetailsView function if created.
	// For now, we can call populateWorkflowDetailsView with a shell object.
	populateWorkflowDetailsView({ name: '', query: '', view_state: { flowDirection: 'horizontal' } });
	clearExecutionStatus();

	dom.nodeEditorContainer.classList.add('hidden');
	domWorkflowEdit.agentManagementContainer.classList.add('hidden');
	// Go back to home view
	showView('home',false);
}

// Override the original saveLayout to save to the workflow object
export function saveLayoutToWorkflow() {
	if (!state.currentWorkflow) {
		console.error("No current workflow to save layout to.");
		return;
	}

	// Save view state
	state.currentWorkflow.view_state = {
		panX: state.panX,
		panY: state.panY,
		zoomLevel: state.zoomLevel,
		flowDirection: state.currentFlowDirection,
		nodeIdCounter: state.nodeIdCounter,
		linkIdCounter: state.linkIdCounter
	};

	// Save node data from UI state to workflow graph structure
	state.currentWorkflow.orchestration_graph.nodes = {};
	for (const nodeId in state.nodes) {
		const node = state.nodes[nodeId];
		if (node.agentId) { // Only save nodes linked to an agent
			state.currentWorkflow.orchestration_graph.nodes[nodeId] = {
				id: nodeId,
				agent_id: node.agentId, // Store the linked agent ID
				x: node.x,
				y: node.y
			};
		} else {
			console.warn(`Node ${nodeId} has no linked agentId. Skipping save to graph.`);
		}
	}

	// Save link data from UI state to workflow graph structure
	state.currentWorkflow.orchestration_graph.links = {};
	for (const linkId in state.links) {
		const link = state.links[linkId];
		state.currentWorkflow.orchestration_graph.links[linkId] = {
			id: linkId,
			from_node_id: link.fromNode,
			from_socket_id: link.fromSocket,
			to_node_id: link.toNode,
			to_socket_id: link.toSocket
		};
	}

	console.log('Layout saved to current workflow object!');
	alert('Graph layout saved to workflow in memory. Remember to save the workflow details!');
}

// Function to load the graph from the workflow object into the editor
export function loadLayout(workflow) {
	if (!workflow || !workflow.orchestration_graph) {
		console.error("Cannot load layout: Invalid workflow or orchestration graph.");
		return;
	}

	// 1. Clear existing workspace and state
	clearWorkspace(false); // Don't confirm when loading

	const graph = workflow.orchestration_graph;
	const viewState = workflow.view_state || {};

	// 2. Set view state (pan, zoom, counters, flow direction)
	state.panX = viewState.panX || 0;
	state.panY = viewState.panY || 0;
	state.zoomLevel = viewState.zoomLevel || 1.0;
	setNodeIdCounter(viewState.nodeIdCounter || 0);
	setLinkIdCounter(viewState.linkIdCounter || 0);

	const flowDirection = viewState.flowDirection || 'horizontal';
	setFlowDirection(flowDirection);
	if (flowDirection === 'vertical') {
		dom.flowVerticalRadio.checked = true;
	} else {
		dom.flowHorizontalRadio.checked = true;
	}

	updateWorkspaceTransform();

	// 3. Create nodes
	if (graph.nodes) {
		for (const nodeId in graph.nodes) {
			const nodeData = graph.nodes[nodeId];
			const agent = workflow.agents[nodeData.agent_id];
			if (!agent) {
				console.warn(`Agent with ID ${nodeData.agent_id} not found for node ${nodeId}. Skipping node creation.`);
				continue;
			}
			// Dynamically create inputs and outputs based on agent definition
			let inputs = [{ name: 'In' }]; // Default input, can be customized if agent definition supports it
			let outputs = [];

			if (agent.outputs && agent.outputs.format && agent.outputs.format.properties) {
				for (const outputName in agent.outputs.format.properties) {
					const outputDetails = agent.outputs.format.properties[outputName];
					outputs.push({
						name: outputName,
						value_type: outputDetails.type || 'any' // Use defined type or default to 'any'
					});
				}
			}

			// If no outputs were defined on the agent, provide a default one.
			if (outputs.length === 0) {
				outputs.push({ name: 'Out', value_type: 'any' });
			}

			createNode(nodeData.id, nodeData.x, nodeData.y, nodeData.agent_id, agent.name, inputs, outputs);
		}
	}

	// 4. Create links
	if (graph.links) {
		for (const linkId in graph.links) {
			const linkData = graph.links[linkId];
			createLink(linkData.from_node_id, linkData.from_socket_id, linkData.to_node_id, linkData.to_socket_id, linkData.id);
		}
	}

	console.log("Layout loaded into editor.");
}
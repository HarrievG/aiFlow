import * as dom from './dom.js';
import { state, setNodeIdCounter, setLinkIdCounter } from './state.js';
import { createNode } from './node.js';
import { startPan, handleZoom } from './editor.js';
import { setFlowDirection, showView, renderWorkflowList, renderAgentList, populateWorkflowDetails, populateAgentDetails, getWorkflowDetails, getAgentDetails, renderAvailableTools, clearWorkspace } from './ui.js';
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

	initExecuteWorkflowModal(); // Initialize modal event listeners

	// --- Event Listeners ---

	// Global UI Buttons
	dom.homeBtn.addEventListener('click', () => showView('home'));

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
		populateWorkflowDetails(state.currentWorkflow);

		// Hide graph/agent views initially
		dom.nodeEditorContainer.classList.add('hidden');
		dom.agentManagementContainer.classList.add('hidden');
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
	dom.saveWorkflowDetailsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) return;

		// Update state from form

		if (dom.workflowIdInput.getAttribute("shouldClearOnSend")) {
			dom.workflowIdInput.removeAttribute("shouldClearOnSend")
			dom.workflowIdInput.value = ''
		}

		state.currentWorkflow.id = dom.workflowIdInput.value;
		state.currentWorkflow.name = dom.workflowNameInput.value;
		state.currentWorkflow.query = dom.workflowQueryTextarea.value;

		var selIdx = dom.workflowServiceList.selectedIndex;
		state.currentWorkflow.service_id = dom.workflowServiceList[selIdx].getAttribute("service_id");

		sendApiRequest('saveWorkflow', state.currentWorkflow, (response) => {
			if (response.status === 'success') {
				console.log('Workflow saved:', response.payload.workflow_id);
				state.currentWorkflow.id = response.payload.workflow_id; // Update ID if new
				dom.workflowIdInput.value = state.currentWorkflow.id;
				alert('Workflow saved successfully!');
			} else {
				console.error('Save failed:', response.payload.message);
				alert('Error saving workflow: ' + response.payload.message);
			}
		});
	});

	dom.executeWorkflowBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentWorkflow.id) {
			alert('Please save the workflow first.');
			return;
		}
		const initialQuery = dom.workflowQueryTextarea.value;
		if (!initialQuery.trim()) {
			alert('Please enter an initial query for execution.');
			return;
		}
		// Update query in state before executing
		state.currentWorkflow.query = initialQuery;

		sendApiRequest('executeWorkflow', {
			workflow_id: state.currentWorkflow.id,
			initial_query: initialQuery
		}, (response) => {
			if (response.status === 'success') {
				console.log('Workflow execution started:', response.payload.message);
				dom.executionStatusDiv.textContent = 'Execution started...';
			} else {
				console.error('Execution failed to start:', response.payload.message);
				dom.executionStatusDiv.textContent = 'Error starting execution: ' + response.payload.message;
			}
		});
	});

	dom.manageAgentsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		dom.nodeEditorContainer.classList.add('hidden');
		dom.agentManagementContainer.classList.remove('hidden');
		renderAgentList(state.currentWorkflow.agents);
	});

	dom.manageWorkflowArgsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		showView('arguments');

		if (!state.currentWorkflow.arguments)
			state.currentWorkflow.arguments = {}
		renderArguments(state.currentWorkflow.arguments); // Populate the view with current arguments when shown
	});
	dom.editGraphBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('Load or create a workflow first.');
			return;
		}
		dom.agentManagementContainer.classList.add('hidden');
		dom.nodeEditorContainer.classList.remove('hidden');
		// Load the graph state into the editor
		loadLayout(state.currentWorkflow); // Pass the workflow object
		showView('workflow-editor'); // Ensure editor controls are shown
	});

	dom.addAgentBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) return;
		const newAgentId = `agent-${Date.now()}`; // Simple unique ID
		state.currentWorkflow.agents[newAgentId] = {
			id: newAgentId,
			name: 'New Agent',
			type: 'generic',
			prompt: '',
			tools: [],
			sub_agents: []
		};
		renderAgentList(state.currentWorkflow.agents); // Refresh list
		// Optionally jump directly to editing the new agent
		editAgent(newAgentId);
	});

	// Agent Editor Buttons
	dom.saveAgentDetailsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow || !state.currentAgentId) return;
		// Update the specific agent in the current workflow state
		const agentId = state.currentAgentId;
		const agent = state.currentWorkflow.agents[agentId];
		if (agent) {
			agent.name = dom.agentNameInput.value;
			agent.type = dom.agentTypeSelect.value;
			agent.prompt = dom.agentPromptTextarea.value;
			// Collect selected tools
			agent.tools = [];
			dom.agentToolsDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
				agent.tools.push({ name: checkbox.value });
			});

			// Sub-agents logic would go here if implemented


			sendApiRequest('saveAgent', agent, (response) => {
				if (response.status === 'success') {
					console.log('agent saved:', response.payload.agent_id);
				} else {
					console.error('Save failed:', response.payload.message);
					alert('Error saving agent: ' + response.payload.message);
				}
			});

			console.log('Agent details updated in state:', agent);
			alert('Agent saved');

			// No need to save workflow immediately, user clicks workflow save button
		}
	});

	dom.backToWorkflowBtn.addEventListener('click', () => {
		showView('workflow-editor');
		// Ensure the correct sub-view (agents or graph) is shown
		if (!dom.nodeEditorContainer.classList.contains('hidden')) {
			dom.agentManagementContainer.classList.add('hidden');
		} else {
			dom.nodeEditorContainer.classList.add('hidden');
			dom.agentManagementContainer.classList.remove('hidden');
		}
	});

	// Flow Master Editor Buttons
	dom.backToWorkflowFromFlowmasterBtn.addEventListener('click', () => {
		showView('workflow-editor');
		// Ensure the correct sub-view (agents or graph) is shown
		if (!dom.nodeEditorContainer.classList.contains('hidden')) {
			dom.agentManagementContainer.classList.add('hidden');
		} else {
			dom.nodeEditorContainer.classList.add('hidden');
			dom.agentManagementContainer.classList.remove('hidden');
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
		// createNode will place it in the center of the view.
		createNode(null, undefined, undefined, selectedAgent.id, selectedAgent.name);
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
	dom.editOutputsCtrlBtn.addEventListener('click', () => {
		dom.nodeEditorContainer.classList.add('hidden');
		showView('structured-outputs');
		renderOutputs(state.currentWorkflow.outputs);
	});
	dom.editOutputsCtrlBtn.addEventListener('click', () => {

	});

	// --- Initial View ---
	showView('home'); // Start on the home page

	console.log("aiFlow Editor Initialized (Modular)");

	// --- WebSocket Event Subscriptions ---
	subscribeToEvent('workflowExecutionStatus', (payload) => {
		console.log('Execution Status Update:', payload);
		if (state.currentWorkflow && state.currentWorkflow.id === payload.workflow_id) {
			let statusText = `Status: ${payload.status}`;
			if (payload.current_task) statusText += `\nCurrent Task: ${payload.current_task}`;
			if (payload.output) statusText += `\nOutput: ${payload.output}`;
			if (payload.error) statusText += `\nError: ${payload.error}`;
			dom.executionStatusDiv.textContent = statusText;
		}
	});

	subscribeToEvent('logMessage', (payload) => {
		console.log(`[Backend Log - ${payload.level}] ${payload.message}`);
		// Optionally display these in a log panel in the UI
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

	if (agent.type === 'master') {
		// Show specialized Flow Master editor
		showView('flowmaster-editor');
		// TODO: Populate specialized editor fields
	} else {
		// Show generic Agent editor
		showView('agent-editor');
		populateAgentDetails(agent);
		// Request available tools from backend to populate tool list
		sendApiRequest('listAvailableTools', {}, (response) => {
			if (response.status === 'success') {
				renderAvailableTools(response.payload.tools, agent.tools);
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
		renderAgentList(workflow.agents);

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
			populateWorkflowDetails(state.currentWorkflow);
			// Default to showing the agent list after loading
			dom.nodeEditorContainer.classList.add('hidden');
			dom.agentManagementContainer.classList.remove('hidden');
			renderAgentList(state.currentWorkflow.agents);
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
				initial_query: currentWorkflow.initialQuery
			}, (response) => {
				if (response.status === 'success') {
					console.log('Workflow execution started:', response.payload.message);
					dom.executionStatusDiv.textContent = 'Execution started...';
				} else {
					console.error('Execution failed to start:', response.payload.message);
					dom.executionStatusDiv.textContent = 'Error starting execution: ' + response.payload.message;
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
	dom.workflowIdInput.value = '';
	dom.workflowNameInput.value = '';
	dom.workflowQueryTextarea.value = '';
	dom.executionStatusDiv.textContent = '';
	dom.nodeEditorContainer.classList.add('hidden');
	dom.agentManagementContainer.classList.add('hidden');
	// Go back to home view
	showView('home');
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
			// Sockets are hardcoded for now, but this is how you'd make them dynamic
			const inputs = [{ name: 'In' }];
			const outputs = [{ name: 'Out' }];

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
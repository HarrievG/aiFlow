import * as dom from './dom.js';
import { sendApiRequest } from './websocket.js';

// --- Workflow Execution Modal Logic ---

let currentWorkflowForExecution = null;

/**
 * Helper to create an input field for a given argument.
 * @param {string} key - The name of the argument.
 * @param {string} value - The default value of the argument.
 * @returns {HTMLElement} The div element containing the label and input.
 */
function createArgumentInput(key, value) {
	const pairDiv = document.createElement('div');
	pairDiv.classList.add('modal-argument-pair');

	const label = document.createElement('label');
	label.htmlFor = `modal-arg-${key}`;
	label.textContent = key;

	const input = document.createElement('input');
	input.type = 'text';
	input.id = `modal-arg-${key}`;
	input.dataset.argKey = key; // Store key for later retrieval
	input.value = value || '';
	input.placeholder = `Enter value for ${key}...`;

	pairDiv.appendChild(label);
	pairDiv.appendChild(input);

	return pairDiv;
}

/**
 * Shows the modal to get a query and execute a workflow.
 * It dynamically populates the modal with inputs for exposed arguments.
 * @param {object} workflow - The workflow object (must contain id and name).
 */
export function showExecuteWorkflowModal(workflow) {
	currentWorkflowForExecution = workflow;
	dom.modalTitleTxt.innerText = workflow.name;

	// Clear previous dynamic content and state
	dom.modalArgumentsContainer.innerHTML = '';
	dom.modalQueryContainer.style.display = 'none';
	dom.modalQueryInput.value = '';

	// Show the modal
	if (dom.executeWorkflowModal) {
		dom.executeWorkflowModal.classList.add('active');
	}

	// Fetch full workflow details to get the arguments
	sendApiRequest('getWorkflow', {
		workflow_id: workflow.id,
	}, (response) => {
		if (response.status === 'success') {
			const workflowDetails = response.payload;
			const args = workflowDetails.arguments || {};

			// Process all arguments to build the modal UI
			for (const key in args) {
				if (Object.prototype.hasOwnProperty.call(args, key)) {
					const arg = args[key];

					if (key === 'InitialQuery') {
						if (arg.exposed) {
							// If InitialQuery is exposed, show the input and pre-populate it
							dom.modalQueryContainer.style.display = 'block';
							dom.modalQueryInput.value = arg.value || '';
						}
						// If InitialQuery is not exposed, we do nothing; its value is used implicitly.
					} else if (arg.exposed) {
						// For any other exposed argument, create an input field
						const inputElement = createArgumentInput(key, arg.value);
						dom.modalArgumentsContainer.appendChild(inputElement);
					}
				}
			}

			// Fallback: If there was no 'InitialQuery' argument defined at all,
			// show the default query input so the user can always provide one.
			if (!args.hasOwnProperty('InitialQuery')) {
				dom.modalQueryContainer.style.display = 'block';
			}

		} else {
			console.error('Failed to get workflow details:', response.payload.message);
			alert('Error: Could not load workflow details to run.');
			hideExecuteWorkflowModal();
		}
	});
}

/**
 * Hides the "Execute Workflow" modal.
 */
function hideExecuteWorkflowModal() {
	if (dom.executeWorkflowModal) {
		dom.executeWorkflowModal.classList.remove('active');
	}
	currentWorkflowForExecution = null;
}

/**
 * Initializes all event listeners for the "Execute Workflow" modal.
 * This should be called once when the application starts.
 */
export function initExecuteWorkflowModal() {
	// Event listener for the "Run Now!" button inside the modal
	if (dom.modalRunNowBtn) {
		dom.modalRunNowBtn.addEventListener('click', () => {
			if (!currentWorkflowForExecution) {
				alert('Error: No workflow selected for execution.');
				hideExecuteWorkflowModal();
				return;
			}

			const workflowId = currentWorkflowForExecution.id;
			const runtimeArguments = {};
			let initialQuery = '';

			// 1. Collect initial query if its input is visible
			if (dom.modalQueryContainer.style.display !== 'none') {
				initialQuery = dom.modalQueryInput.value.trim();
				if (!initialQuery) {
					alert('Please enter an initial query.');
					return; // Don't close modal, let user enter query
				}
				runtimeArguments['InitialQuery'] = initialQuery;
			}

			// 2. Collect values from all other dynamically added argument inputs
			const argInputs = dom.modalArgumentsContainer.querySelectorAll('input[data-arg-key]');
			argInputs.forEach(input => {
				const key = input.dataset.argKey;
				const value = input.value;
				runtimeArguments[key] = value;
			});

			// 3. Send the execution request with all runtime arguments
			sendApiRequest('executeWorkflow', {
				workflow_id: workflowId,
				initial_query: initialQuery,   // Send separately for convenience/logging
				arguments: runtimeArguments    // Send the complete map of runtime arguments
			}, (response) => {
				if (response.status === 'success') {
					console.log('Workflow execution started:', response.payload.message);
					alert('Workflow execution started!');
				} else {
					console.error('Execution failed to start:', response.payload.message);
					alert('Error starting execution: ' + response.payload.message);
				}
			});

			// Hide the modal after sending the request
			hideExecuteWorkflowModal();
		});
	}

	// Event listener for the modal close button
	if (dom.modalCloseButton) {
		dom.modalCloseButton.addEventListener('click', hideExecuteWorkflowModal);
	}

	// Close modal if user clicks on the background overlay
	if (dom.executeWorkflowModal) {
		dom.executeWorkflowModal.addEventListener('click', (e) => {
			if (e.target === dom.executeWorkflowModal) {
				hideExecuteWorkflowModal();
			}
		});
	}
}
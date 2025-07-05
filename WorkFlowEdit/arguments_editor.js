// --- START OF FILE arguments_editor.js ---
import * as dom from './dom.js';
import { state } from './state.js';
import { showView } from './ui.js';

// Function to render a single argument pair row
function renderArgumentPair(key = '', value = '', exposed = false, transient = false) {
	const pairDiv = document.createElement('div');
	pairDiv.classList.add('argument-pair');

	const exposeInput = document.createElement('input');
	exposeInput.type = 'checkbox';
	exposeInput.checked = exposed;
	exposeInput.title = 'Expose argument to sub-graphs';

	const exposeLable = document.createElement('label');
	exposeLable.innerText = '👁';

	
	const updateExposeColor = () => {
		if (exposeInput.checked)
			exposeLable.style.color = 'rgb(0,125,0)'
		else
			exposeLable.style.color = 'rgb(25,0,0)'
	};

	updateExposeColor();

	exposeInput.addEventListener('click', () => {
		updateExposeColor();
	});
	exposeLable.appendChild(exposeInput);

	const transientInput = document.createElement('input');
	transientInput.type = 'checkbox';
	transientInput.checked = transient;
	transientInput.title = 'Transient arguments are not saved with the workflow';

	const transientLabel = document.createElement('label');
	transientLabel.innerText = 'T'; // Simple 'T' for Transient

	const updateTransientColor = () => {
		if (transientInput.checked)
			transientLabel.style.color = 'rgb(0,0,125)' // Blue for transient
		else
			transientLabel.style.color = 'rgb(25,0,0)' // Dark red if not
	};

	updateTransientColor();
	transientInput.addEventListener('click', () => {
		updateTransientColor();
	});
	transientLabel.appendChild(transientInput);


	const keyInput = document.createElement('input');
	keyInput.type = 'text';
	keyInput.placeholder = 'Argument Name ';
	keyInput.value = key;
	keyInput.dataset.role = 'key'; // For easier selection

	const valueInput = document.createElement('input');
	valueInput.type = 'text';
	valueInput.placeholder = 'Argument Value';
	valueInput.value = value;
	valueInput.dataset.role = 'value'; // For easier selection

	const removeBtn = document.createElement('button');
	removeBtn.textContent = 'Remove';
	removeBtn.classList.add('remove-argument-btn');
	removeBtn.addEventListener('click', () => {
		pairDiv.remove();
	});

	pairDiv.appendChild(exposeLable);
	pairDiv.appendChild(transientLabel); // Add the transient label and checkbox
	pairDiv.appendChild(keyInput);
	// Simple text node for ":" separator for visual clarity, styled by flex spacing
	pairDiv.appendChild(document.createTextNode(': ')); 
	pairDiv.appendChild(valueInput);
	pairDiv.appendChild(removeBtn);

	return pairDiv;
}

// Function to render all arguments from state into the UI
export function renderArguments(args) {
	if (!dom.argumentsListContainer) {
		console.warn('Arguments list container not found.');
		return;
	}
	dom.argumentsListContainer.innerHTML = ''; // Clear existing entries

	if (Object.keys(args).length === 0) {
		// If no arguments, add one empty row for the user to start with
		dom.argumentsListContainer.appendChild(renderArgumentPair());
	} else {
		for (const key in args) {
			if (Object.prototype.hasOwnProperty.call(args, key)) {
				const { value, exposed, transient } = args[key]; // Add transient here

				dom.argumentsListContainer.appendChild(renderArgumentPair(key, value, exposed, transient)); // Pass transient to render
			}
		}
	}
}

// Function to save arguments from UI input fields to the global state
function saveArgumentsFromUI() {
	if (!dom.argumentsListContainer) {
		console.warn('Arguments list container not found. Cannot save.');
		return;
	}
	const newArgs = {};
	const pairDivs = dom.argumentsListContainer.querySelectorAll('.argument-pair');

	pairDivs.forEach(pairDiv => {
		const keyInput = pairDiv.querySelector('input[data-role="key"]');
		const valueInput = pairDiv.querySelector('input[data-role="value"]');
		// Correctly select the checkboxes by a more specific attribute if possible, or by order/class
		// Assuming exposeInput is the first checkbox and transientInput is the second one if no other selectors are added.
		// It's better to add specific data-attributes or classes to them in renderArgumentPair.
		// For now, let's assume they are the only checkboxes or can be distinguished.
		// Let's refine this by adding data-attributes in renderArgumentPair for robustness.
		// Updated renderArgumentPair to include titles, we can use those, or add data-attributes.
		// Adding data-attributes for clarity:
		// In renderArgumentPair: exposeInput.dataset.argType = 'exposed'; transientInput.dataset.argType = 'transient';
		const exposedInput = pairDiv.querySelector('input[type="checkbox"][title*="Expose"]'); // More specific
		const transientInput = pairDiv.querySelector('input[type="checkbox"][title*="Transient"]'); // More specific


		if (keyInput && valueInput) {
			const key = keyInput.value.trim();
			const value = valueInput.value.trim(); // Values are stored as strings
			const exposed = exposedInput ? exposedInput.checked : false;
			const transient = transientInput ? transientInput.checked : false; // Get transient state

			if (key) { // Only save if the key is not empty
				newArgs[key] = {
					value, exposed, transient // Add transient to saved object
				};
			}
		}
	});

	state.currentWorkflow.arguments = newArgs;
	state.globalArguments = newArgs;
	console.log('Global arguments saved to state:', state.currentWorkflow.arguments);
	alert('Arguments saved in memory!');
	// If backend persistence is needed, an API call would be made here:
	// sendApiRequest('saveGlobalArguments', { arguments: state.globalArguments }, (response) => { ... });
}

// Initialize event listeners for the arguments view controls
export function initArgumentsEditor() {
	if (dom.manageArgumentsBtn) {
		dom.manageArgumentsBtn.addEventListener('click', () => {
			showView('arguments');
			renderArguments({}); // Populate the view with current arguments when shown
		});
	}

	if (dom.addArgumentPairBtn) {
		dom.addArgumentPairBtn.addEventListener('click', () => {
			if (dom.argumentsListContainer) {
				dom.argumentsListContainer.appendChild(renderArgumentPair());
			} else {
				console.warn('Arguments list container not found. Cannot add new pair.');
			}
		});
	}

	if (dom.saveArgumentsBtn) {
		dom.saveArgumentsBtn.addEventListener('click', saveArgumentsFromUI);
	}

	if (dom.backToWorkflowFromArgumentsBtn) {
		dom.backToWorkflowFromArgumentsBtn.addEventListener('click', () => {
			showView('workflow-editor',false);
		});
	}
}
// --- END OF FILE arguments_editor.js ---
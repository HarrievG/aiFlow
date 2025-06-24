// --- START OF FILE arguments_editor.js ---
import * as dom from './dom.js';
import { state } from './state.js';
import { showView } from './ui.js';

// Function to render a single argument pair row
function renderArgumentPair(key = '', value = '', exposed = false) {
	const pairDiv = document.createElement('div');
	pairDiv.classList.add('argument-pair');

	const exposeInput = document.createElement('input');
	exposeInput.type = 'checkbox';
	exposeInput.checked = exposed;

	const exposeLable = document.createElement('label');
	exposeLable.innerText = '👁';

	
	const updateColor = () => {
		if (exposeInput.checked)
			exposeLable.style.color = 'rgb(0,125,0)'
		else
			exposeLable.style.color = 'rgb(25,0,0)'
	};

	updateColor();

	exposeInput.addEventListener('click', () => {
		updateColor();
	});
	exposeLable.appendChild(exposeInput)

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
				const { value, exposed } = args[key];

				dom.argumentsListContainer.appendChild(renderArgumentPair(key, value, exposed));
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
		const exposedInput = pairDiv.querySelector('input[type="checkbox"]');

		if (keyInput && valueInput) {
			const key = keyInput.value.trim();
			const value = valueInput.value.trim(); // Values are stored as strings
			const exposed = exposedInput ? exposedInput.checked : false; // Check if the argument is exposed

			if (key) { // Only save if the key is not empty
				newArgs[key] = {
					value, exposed
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
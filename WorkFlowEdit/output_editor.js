import * as dom from './dom.js';
import { state } from './state.js';
import { sendApiRequest } from './websocket.js';
import { showView } from './ui.js';

// --- Outputs Editor / Structured Output Designer ---

/**
 * Initializes the event listeners for the Outputs editor view.
 */
export function initOutputEditor() {
	dom.addOutputPairBtn.addEventListener('click', () => {
		// Add a new root-level property to the format object
		if (!state.currentWorkflow.outputs) {
			state.currentWorkflow.outputs = { format: { type: 'object', properties: {}, required: [] } };
		}

		const newKey = `new_property_${Object.keys(state.currentWorkflow.outputs.format.properties).length}`;
		state.currentWorkflow.outputs.format.properties[newKey] = { type: 'string' }; // Default to string
		renderOutputs(state.currentWorkflow.outputs);
	});

	dom.saveOutputsBtn.addEventListener('click', () => {
		// The state is already updated by the input event listeners.
		// We just need to send the current state to the backend.
		if (!state.currentWorkflow) {
			alert('No workflow loaded.');
			return;
		}
		// The save is part of the main workflow save, but we can provide feedback.
		console.log('Outputs saved to local workflow state:', state.currentWorkflow.outputs);
		alert('Outputs saved in memory. Remember to save the entire workflow to persist changes.');
	});

	dom.backToWorkflowFromOutputsBtn.addEventListener('click', () => {
		// This is a simplified navigation, assuming the user was in the workflow editor.
		// A more robust solution might track navigation history.
		//const event = new CustomEvent('show-view', { detail: { viewId: 'workflow-editor' } });
		//document.dispatchEvent(event);

		showView('workflow-editor');
	});
}

/**
 * Renders the entire Outputs/structured output editor.
 * @param {object} args - The Outputs object from the workflow, expected to have a 'format' property.
 */
export function renderOutputs(args) {
	const container = dom.outputsListContainer;
	container.innerHTML = ''; // Clear previous content

	// Ensure the basic structure exists
	if (!args || !args.format || args.format.type !== 'object') {
		// Create a default structure if it's missing or invalid
		args = {
			format: {
				type: 'object',
				properties: {},
				required: []
			}
		};
		if (state.currentWorkflow) {
			state.currentWorkflow.outputs = args;
		}
	}

	const format = args.format;
	const properties = format.properties || {};
	const required = new Set(format.required || []);

	for (const key in properties) {
		if (Object.hasOwnProperty.call(properties, key)) {
			const property = properties[key];
			const propertyElement = createPropertyElement(key, property, required.has(key), [key]);
			container.appendChild(propertyElement);
		}
	}
}

/**
 * Creates a DOM element for a single property in the JSON schema.
 * This function is recursive for nested objects.
 * @param {string} key - The name of the property.
 * @param {object} property - The schema object for the property.
 * @param {boolean} isRequired - Whether the property is in the 'required' array.
 * @param {string[]} path - The path to this property from the root (e.g., ['user', 'address']).
 * @returns {HTMLElement} The created DOM element for the property.
 */
function createPropertyElement(key, property, isRequired, path) {
	const propDiv = document.createElement('div');
	propDiv.classList.add('output-pair');
	if (path.length > 1) {
		propDiv.style.marginLeft = `${(path.length - 1) * 20}px`;
		propDiv.classList.add('nested-property');
	}

	// --- Key Input ---
	const keyInput = document.createElement('input');
	keyInput.type = 'text';
	keyInput.value = key;
	keyInput.placeholder = 'Property Name';
	keyInput.addEventListener('change', (e) => {
		const newKey = e.target.value;
		if (newKey === key || !newKey) return;
		updatePropertyKey(path, newKey);
		renderOutputs(state.currentWorkflow.outputs); // Re-render to reflect change
	});

	// --- Type Selector ---
	const typeSelect = document.createElement('select');
	const types = ['string', 'number', 'boolean', 'object', 'array'];
	types.forEach(t => {
		const option = document.createElement('option');
		option.value = t;
		option.textContent = t.charAt(0).toUpperCase() + t.slice(1);
		if (t === property.type) {
			option.selected = true;
		}
		typeSelect.appendChild(option);
	});
	typeSelect.addEventListener('change', (e) => {
		const newType = e.target.value;
		updatePropertyValue(path, 'type', newType);
		// If changing to object/array, add default structure
		if (newType === 'object') {
			updatePropertyValue(path, 'properties', {});
			updatePropertyValue(path, 'required', []);
		} else if (newType === 'array') {
			updatePropertyValue(path, 'items', { type: 'string' }); // Default array of strings
		}
		renderOutputs(state.currentWorkflow.outputs); // Re-render to show new fields
	});

	// --- Required Checkbox ---
	const requiredLabel = document.createElement('label');
	requiredLabel.textContent = 'Required';
	const requiredCheckbox = document.createElement('input');
	requiredCheckbox.type = 'checkbox';
	requiredCheckbox.checked = isRequired;
	requiredCheckbox.addEventListener('change', (e) => {
		const isChecked = e.target.checked;
		updateRequiredStatus(path, isChecked);
	});
	requiredLabel.prepend(requiredCheckbox);


	// --- Remove Button ---
	const removeBtn = document.createElement('button');
	removeBtn.textContent = 'Remove';
	removeBtn.classList.add('remove-output-btn');
	removeBtn.addEventListener('click', () => {
		deleteProperty(path);
		renderOutputs(state.currentWorkflow.outputs);
	});

	propDiv.appendChild(keyInput);
	propDiv.appendChild(typeSelect);
	propDiv.appendChild(requiredLabel);
	propDiv.appendChild(removeBtn);

	// --- Handle Nested Structures ---
	if (property.type === 'object') {
		const nestedContainer = document.createElement('div');
		nestedContainer.classList.add('nested-container');
		const subProperties = property.properties || {};
		const subRequired = new Set(property.required || []);

		for (const subKey in subProperties) {
			const subProperty = subProperties[subKey];
			const subElement = createPropertyElement(subKey, subProperty, subRequired.has(subKey), [...path, subKey]);
			nestedContainer.appendChild(subElement);
		}

		const addSubBtn = document.createElement('button');
		addSubBtn.textContent = 'Add Property';
		addSubBtn.classList.add('add-sub-property-btn');
		addSubBtn.addEventListener('click', () => {
			const newSubKey = `new_sub_${Object.keys(subProperties).length}`;
			updatePropertyValue([...path, newSubKey], 'type', 'string'); // Add as string by default
			renderOutputs(state.currentWorkflow.outputs);
		});
		nestedContainer.appendChild(addSubBtn);
		propDiv.appendChild(nestedContainer);

	} else if (property.type === 'array') {
		const arrayContainer = document.createElement('div');
		arrayContainer.classList.add('nested-container', 'array-items-container');
		const itemsSchema = property.items || { type: 'string' };

		const itemsLabel = document.createElement('span');
		itemsLabel.textContent = 'Items Type:';
		arrayContainer.appendChild(itemsLabel);

		const itemsTypeSelect = document.createElement('select');
		// For simplicity, only allowing primitive types in arrays for now. Can be expanded.
		const itemTypes = ['string', 'number', 'boolean'];
		itemTypes.forEach(t => {
			const option = document.createElement('option');
			option.value = t;
			option.textContent = t.charAt(0).toUpperCase() + t.slice(1);
			if (t === itemsSchema.type) {
				option.selected = true;
			}
			itemsTypeSelect.appendChild(option);
		});
		itemsTypeSelect.addEventListener('change', (e) => {
			updatePropertyValue(path, 'items', { type: e.target.value });
			renderOutputs(state.currentWorkflow.outputs);
		});
		arrayContainer.appendChild(itemsTypeSelect);
		propDiv.appendChild(arrayContainer);
	}

	return propDiv;
}


// --- Helper functions to manipulate the state object ---

function getPropertyRef(path) {
	let current = state.currentWorkflow.outputs.format.properties;
	for (let i = 0; i < path.length - 1; i++) {
		current = current[path[i]].properties;
	}
	return current;
}

function getParentRequiredRef(path) {
	let current = state.currentWorkflow.outputs.format;
	for (let i = 0; i < path.length - 1; i++) {
		current = current.properties[path[i]];
	}
	if (!current.required) {
		current.required = [];
	}
	return current.required;
}

function updatePropertyValue(path, key, value) {
	const propName = path[path.length - 1];
	const parent = getPropertyRef(path);
	if (!parent[propName]) {
		parent[propName] = {};
	}
	parent[propName][key] = value;
}

function updatePropertyKey(path, newKey) {
	const oldKey = path[path.length - 1];
	const parent = getPropertyRef(path);
	if (parent[newKey]) {
		alert('Error: Property with this name already exists.');
		return;
	}
	parent[newKey] = parent[oldKey];
	delete parent[oldKey];

	// Update required array if necessary
	const requiredArray = getParentRequiredRef(path);
	const reqIndex = requiredArray.indexOf(oldKey);
	if (reqIndex > -1) {
		requiredArray[reqIndex] = newKey;
	}
}

function deleteProperty(path) {
	const key = path[path.length - 1];
	const parent = getPropertyRef(path);
	delete parent[key];

	// Remove from required array
	const requiredArray = getParentRequiredRef(path);
	const reqIndex = requiredArray.indexOf(key);
	if (reqIndex > -1) {
		requiredArray.splice(reqIndex, 1);
	}
}

function updateRequiredStatus(path, isRequired) {
	const key = path[path.length - 1];
	const requiredArray = getParentRequiredRef(path);
	const reqIndex = requiredArray.indexOf(key);

	if (isRequired && reqIndex === -1) {
		requiredArray.push(key);
	} else if (!isRequired && reqIndex > -1) {
		requiredArray.splice(reqIndex, 1);
	}
}
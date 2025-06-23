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
		let targetOutputsObject;
		if (state.currentEditingContext === 'agent' && state.currentWorkflow && state.currentWorkflow.agents && state.currentWorkflow.agents[state.currentEditingAgentId]) {
			targetOutputsObject = state.currentWorkflow.agents[state.currentEditingAgentId].outputs;
		} else if (state.currentEditingContext === 'workflow' && state.currentWorkflow) {
			targetOutputsObject = state.currentWorkflow.outputs;
		} else {
			console.error('Cannot add output pair: Invalid context or missing data.');
			alert('Error: Could not determine where to add the output item.');
			return;
		}

		if (!targetOutputsObject) { // Should be initialized by calling functions
			console.error('Target outputs object is null/undefined before adding pair.');
			targetOutputsObject = { format: { type: 'object', properties: {}, required: [] } };
			// Assign it back if it was workflow outputs
			if (state.currentEditingContext === 'workflow') state.currentWorkflow.outputs = targetOutputsObject;
			// For agent, it should have been initialized when agent was loaded/created.
		}
        if (!targetOutputsObject.format) targetOutputsObject.format = { type: 'object', properties: {}, required: [] };
        if (!targetOutputsObject.format.properties) targetOutputsObject.format.properties = {};


		const newKey = `new_property_${Object.keys(targetOutputsObject.format.properties).length}`;
		targetOutputsObject.format.properties[newKey] = { type: 'string' };
		renderOutputs(targetOutputsObject); // Pass the specific object
	});

	dom.saveOutputsBtn.addEventListener('click', () => {
		if (!state.currentWorkflow) {
			alert('No workflow loaded.');
			return;
		}
		if (state.currentEditingContext === 'agent') {
			if (!state.currentEditingAgentId || !state.currentWorkflow.agents[state.currentEditingAgentId]) {
				alert('Error: No agent selected for saving outputs.');
				return;
			}
			console.log('Agent outputs saved to local agent state:', state.currentWorkflow.agents[state.currentEditingAgentId].outputs);
			alert('Agent outputs saved in memory. Remember to save the agent details to persist these changes.');
		} else {
			console.log('Workflow outputs saved to local workflow state:', state.currentWorkflow.outputs);
			alert('Workflow outputs saved in memory. Remember to save the entire workflow to persist changes.');
		}
	});

	dom.backToWorkflowFromOutputsBtn.addEventListener('click', () => {
		if (state.currentEditingContext === 'agent') {
			showView('agent-editor'); // Go back to the agent editor
		} else {
			showView('workflow-editor'); // Default back to workflow editor (graph view or details)
		}
	});
}

/**
 * Renders the entire Outputs/structured output editor.
 * @param {object} dataObject - The specific outputs object to render (e.g., workflow.outputs or agent.outputs).
 */
export function renderOutputs(dataObject) {
	const container = dom.outputsListContainer;
	container.innerHTML = ''; // Clear previous content

	if (!dataObject || !dataObject.format || dataObject.format.type !== 'object') {
		// Initialize if it's somehow malformed or null. The calling context should ensure it's valid.
		dataObject = { format: { type: 'object', properties: {}, required: [] } };
		// Note: This change to dataObject might not persist if the original reference wasn't updated by the caller.
		// It's better if the caller (e.g., in main.js) ensures dataObject is always valid.
		console.warn("RenderOutputs called with invalid dataObject. Initializing locally for render.");
	}

	const format = dataObject.format;
	const properties = format.properties || {};
	const required = new Set(format.required || []);

    if (Object.keys(properties).length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = "No output items defined yet. Click 'Add Item' to start.";
        container.appendChild(emptyMsg);
    } else {
        for (const key in properties) {
            if (Object.hasOwnProperty.call(properties, key)) {
                const property = properties[key];
                const propertyElement = createPropertyElement(key, property, required.has(key), [key], dataObject);
                container.appendChild(propertyElement);
            }
        }
    }
}

/**
 * Creates a DOM element for a single property in the JSON schema.
 * This function is recursive for nested objects.
 * @param {string} key - The name of the property.
 * @param {object} property - The schema object for the property.
 * @param {boolean} isRequired - Whether the property is in the 'required' array.
 * @param {string[]} path - The path to this property from the root.
 * @param {object} dataObject - The specific outputs object being edited.
 * @returns {HTMLElement} The created DOM element for the property.
 */
function createPropertyElement(key, property, isRequired, path, dataObject) {
	const propDiv = document.createElement('div');
	propDiv.classList.add('output-pair');
	if (path.length > 1) {
		propDiv.style.marginLeft = `${(path.length - 1) * 20}px`;
		propDiv.classList.add('nested-property');
	}

	const keyInput = document.createElement('input');
	keyInput.type = 'text';
	keyInput.value = key;
	keyInput.placeholder = 'Property Name';
	keyInput.addEventListener('change', (e) => {
		const newKey = e.target.value;
		if (newKey === key || !newKey) return;
		updatePropertyKey(path, newKey, dataObject);
		renderOutputs(dataObject);
	});

	const typeSelect = document.createElement('select');
	const types = ['string', 'number', 'boolean', 'object', 'array'];
	types.forEach(t => {
		const option = document.createElement('option');
		option.value = t;
		option.textContent = t.charAt(0).toUpperCase() + t.slice(1);
		if (t === property.type) option.selected = true;
		typeSelect.appendChild(option);
	});
	typeSelect.addEventListener('change', (e) => {
		const newType = e.target.value;
		updatePropertyValue(path, 'type', newType, dataObject);
		if (newType === 'object') {
			updatePropertyValue(path, 'properties', {}, dataObject);
			updatePropertyValue(path, 'required', [], dataObject);
		} else if (newType === 'array') {
			updatePropertyValue(path, 'items', { type: 'string' }, dataObject);
		}
		renderOutputs(dataObject);
	});

	const requiredLabel = document.createElement('label');
	requiredLabel.innerText = '❕︎  ';


	const requiredCheckbox = document.createElement('input');
	requiredCheckbox.type = 'checkbox';
	requiredCheckbox.checked = isRequired;


	const updateColor = () => {
		console.error('requiredCheckbox.checked', requiredCheckbox.checked);
		if (requiredCheckbox.checked)
			requiredLabel.style.color =  '#c0392b'
		else
			requiredLabel.style.color = '#010101'
	};
	updateColor();

	requiredCheckbox.addEventListener('click', (e) => {
		updateRequiredStatus(path, e.target.checked, dataObject);
		updateColor();
		// renderOutputs(dataObject); // Usually not needed just for required status
	});
	requiredLabel.appendChild(requiredCheckbox);

	const removeBtn = document.createElement('button');
	removeBtn.textContent = 'Remove';
	removeBtn.classList.add('remove-output-btn');
	removeBtn.addEventListener('click', () => {
		deleteProperty(path, dataObject);
		renderOutputs(dataObject);
	});

	propDiv.appendChild(keyInput);
	propDiv.appendChild(typeSelect);
	propDiv.appendChild(requiredLabel);
	propDiv.appendChild(removeBtn);

	if (property.type === 'object') {
		const nestedContainer = document.createElement('div');
		nestedContainer.classList.add('nested-container');
		const subProperties = property.properties || {};
		const subRequired = new Set(property.required || []);
		for (const subKey in subProperties) {
			const subProperty = subProperties[subKey];
			const subElement = createPropertyElement(subKey, subProperty, subRequired.has(subKey), [...path, subKey], dataObject);
			nestedContainer.appendChild(subElement);
		}
		const addSubBtn = document.createElement('button');
		addSubBtn.textContent = 'Add Property';
		addSubBtn.classList.add('add-sub-property-btn');
		addSubBtn.addEventListener('click', () => {
			const newSubKey = `new_sub_${Object.keys(subProperties).length}`;
            // Ensure the parent object 'properties' exists before adding to it
            let parentPropObj = getPropertyRef(path, dataObject)[path[path.length-1]];
            if (!parentPropObj.properties) { // parentPropObj is the object itself, e.g. property = {type: 'object'}
                parentPropObj.properties = {};
            }
			updatePropertyValue([...path, newSubKey], 'type', 'string', dataObject);
			renderOutputs(dataObject);
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
		const itemTypes = ['string', 'number', 'boolean'];
		itemTypes.forEach(t => {
			const option = document.createElement('option');
			option.value = t;
			option.textContent = t.charAt(0).toUpperCase() + t.slice(1);
			if (t === itemsSchema.type) option.selected = true;
			itemsTypeSelect.appendChild(option);
		});
		itemsTypeSelect.addEventListener('change', (e) => {
			updatePropertyValue(path, 'items', { type: e.target.value }, dataObject);
			renderOutputs(dataObject);
		});
		arrayContainer.appendChild(itemsTypeSelect);
		propDiv.appendChild(arrayContainer);
	}
	return propDiv;
}

// --- Helper functions to manipulate the provided dataObject ---

function getPropertyRef(path, dataObject) {
	let current = dataObject.format.properties;
	for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) { // Defensive: create path if it doesn't exist
            current[path[i]] = { type: 'object', properties: {}, required: [] };
        }
		current = current[path[i]].properties;
        if (!current) { // If properties itself is missing after drilling down
            current = {}; // This assignment might be lost if not careful with references
            // This indicates an issue with how parent objects are structured or initialized
            console.error("getPropertyRef: encountered undefined properties at path", path.slice(0, i+1));
            // To fix, ensure objects always have .properties, e.g. current[path[i]].properties = {}
            // For now, we'll let it potentially fail or operate on a temporary object
        }
	}
	return current;
}

function getParentRequiredRef(path, dataObject) {
	let current = dataObject.format;
	for (let i = 0; i < path.length - 1; i++) {
        if (!current.properties[path[i]]) { // Defensive
             current.properties[path[i]] = { type: 'object', properties: {}, required: [] };
        }
		current = current.properties[path[i]];
	}
	if (!current.required) {
		current.required = [];
	}
	return current.required;
}

function updatePropertyValue(path, key, value, dataObject) {
	const propName = path[path.length - 1];
	const parentProperties = getPropertyRef(path, dataObject); // This gets parent's 'properties' object
	if (!parentProperties[propName]) {
		parentProperties[propName] = {};
	}
	parentProperties[propName][key] = value;

    // If setting type to 'object', initialize 'properties' and 'required'
    if (key === 'type' && value === 'object') {
        if (!parentProperties[propName].properties) {
            parentProperties[propName].properties = {};
        }
        if (!parentProperties[propName].required) {
            parentProperties[propName].required = [];
        }
    }
    // If setting type to 'array', initialize 'items'
    else if (key === 'type' && value === 'array') {
        if (!parentProperties[propName].items) {
            parentProperties[propName].items = { type: 'string' }; // Default to array of strings
        }
    }
}

function updatePropertyKey(path, newKey, dataObject) {
	const oldKey = path[path.length - 1];
	const parentProperties = getPropertyRef(path, dataObject);
	if (newKey !== oldKey && parentProperties[newKey]) {
		alert('Error: Property with this name already exists in this object.');
		return;
	}
    if (oldKey === newKey) return;

	parentProperties[newKey] = parentProperties[oldKey];
	delete parentProperties[oldKey];

	const requiredArray = getParentRequiredRef(path, dataObject);
	const reqIndex = requiredArray.indexOf(oldKey);
	if (reqIndex > -1) {
		requiredArray.splice(reqIndex, 1, newKey); // Replace oldKey with newKey
	}
}

function deleteProperty(path, dataObject) {
	const key = path[path.length - 1];
	const parentProperties = getPropertyRef(path, dataObject);
	delete parentProperties[key];

	const requiredArray = getParentRequiredRef(path, dataObject);
	const reqIndex = requiredArray.indexOf(key);
	if (reqIndex > -1) {
		requiredArray.splice(reqIndex, 1);
	}
}

function updateRequiredStatus(path, isChecked, dataObject) {
	const key = path[path.length - 1];
	const requiredArray = getParentRequiredRef(path, dataObject);
	const reqIndex = requiredArray.indexOf(key);
	if (isChecked && reqIndex === -1) {
		requiredArray.push(key);
	} else if (!isChecked && reqIndex > -1) {
		requiredArray.splice(reqIndex, 1);
	}
}
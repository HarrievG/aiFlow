export const nodeEditor = document.getElementById('node-editor');
export const workspace = document.getElementById('workspace');
export const svgLayer = document.getElementById('link-svg-layer');
export const addNodeBtn = document.getElementById('add-node-btn');
export const saveBtn = document.getElementById('save-btn');
export const loadBtn = document.getElementById('load-btn');
export const backCtrlBtn = document.getElementById('back-control-btn'); 
export const editOutputsCtrlBtn = document.getElementById('outputs-control-btn');

export const clearBtn = document.getElementById('clear-btn');
export const flowHorizontalRadio = document.getElementById('flow-horizontal');
export const flowVerticalRadio = document.getElementById('flow-vertical');
export const nodeTemplate = document.getElementById('node-template');

// Main UI content
export const mainContentDiv = document.getElementById('main-content');

// Home View
export const homeView = document.getElementById('home-view');
export const createWorkflowBtn = document.getElementById('create-workflow-btn');
export const workflowListUl = document.getElementById('workflow-list');

// Workflow Editor View
export const workflowEditorView = document.getElementById('workflow-editor-view');
export const nodeEditorContainer = document.getElementById('node-editor-container');


// Agent Editor View
export const agentEditorView = document.getElementById('agent-editor-view');

// Flow Master Editor View
export const flowmasterEditorView = document.getElementById('flowmaster-editor-view');
export const saveFlowmasterDetailsBtn = document.getElementById('save-flowmaster-details-btn');
export const backToWorkflowFromFlowmasterBtn = document.getElementById('back-to-workflow-from-flowmaster-btn');

// Global Home Button
export const homeBtn = document.getElementById('home-btn');

//Filesystem Browser
export const browseFilesBtn = document.getElementById('browse-files-btn');
export const filesystemView = document.getElementById('filesystem-view');
export const filesystemControlsDiv = document.getElementById('filesystem-controls');
export const goUpBtn = document.getElementById('go-up-btn');
export const currentPathDiv = document.getElementById('current-path');
export const filesystemListUl = document.getElementById('filesystem-list');

// Arguments View
export const manageArgumentsBtn = document.getElementById('manage-arguments-btn');
export const argumentsView = document.getElementById('arguments-view');
export const argumentsListContainer = document.getElementById('arguments-list-container');
export const addArgumentPairBtn = document.getElementById('add-argument-pair-btn');
export const saveArgumentsBtn = document.getElementById('save-arguments-btn');
export const backToWorkflowFromArgumentsBtn = document.getElementById('back-to-workflow-from-arguments-btn');


export const outputsView = document.getElementById('structured-outputs-view');
export const outputsListContainer = document.getElementById('outputs-list-container');
export const addOutputPairBtn = document.getElementById('add-output-pair-btn');
export const saveOutputsBtn = document.getElementById('save-outputs-btn');
export const backToWorkflowFromOutputsBtn = document.getElementById('back-to-workflow-from-outputs-btn');


//Workflow Execution Modal Elements
export const executeWorkflowModal = document.getElementById('execute-workflow-modal');
export const modalQueryContainer = document.getElementById('modal-query-container');
export const modalQueryLabel = document.getElementById('modal-query-label');
export const modalQueryInput = document.getElementById('modal-query-input');
export const modalArgumentsContainer = document.getElementById('modal-arguments-container');
export const modalRunNowBtn = document.getElementById('modal-run-now-btn');
export const modalTitleTxt = document.getElementById('modal-title-txt');
export const modalCloseButton = executeWorkflowModal ? executeWorkflowModal.querySelector('.close-button') : null; // Find the close button

import { state } from './state.js';
import { showView } from './ui.js'; // Use showView for navigation on connection status
// Import other UI update functions as needed for events
import { renderWorkflowList } from './ui.js';


let websocket = null;
let nextRequestId = 1;
const pendingRequests = new Map(); // Map request ID to { resolve, reject, callback }
const eventListeners = new Map(); // Map event type to array of callbacks

export function initWebSocket_fs(url) {
	if (websocket) {
		console.warn('WebSocket already initialized.');
		return;
	}

	websocket = new WebSocket(url);

	websocket.onopen = () => {
		console.log('FS_WebSocket connected.');
		state.isConnected = true;
	};

	websocket.onmessage = (event) => {
		console.log('WebSocket message received:', event.data);
		try {
			const message = JSON.parse(event.data);

			// Check if it's a response (has 'id') or an event (has 'type')
			if (message.hasOwnProperty('id')) {
				// It's a response
				const requestId = message.id;
				if (pendingRequests.has(requestId)) {
					const { resolve, reject, callback } = pendingRequests.get(requestId);
					pendingRequests.delete(requestId);

					if (message.result.status === 'success') {
						console.log(`Request ${requestId} succeeded.`);
						if (callback) callback(message.result); // Call the specific callback first
						if (resolve) resolve(message); // Then resolve the promise
					} else {
						console.error(`Request ${requestId} failed:`, message.result.payload.message);
						if (callback) callback(message); // Still call callback on error? Or separate error callback?
						if (reject) reject(new Error(message.payload.message)); // Reject the promise
					}
				} else {
					console.warn(`Received response for unknown request ID: ${requestId}`);
				}
			} else if (message.hasOwnProperty('type')) {
				// It's an event
				const eventType = message.type;
				if (eventListeners.has(eventType)) {
					eventListeners.get(eventType).forEach(callback => {
						try {
							callback(message.payload); // Pass the payload to the event listener
						} catch (e) {
							console.error(`Error in event listener for type "${eventType}":`, e);
						}
					});
				} else {
					console.warn(`Received unhandled event type: ${eventType}`);
				}
			} else {
				console.warn('Received message with unknown format:', message);
			}

		} catch (e) {
			console.error('Failed to parse WebSocket message:', e, event.data);
		}
	};

	websocket.onerror = (error) => {
		console.error('WebSocket error:', error);
		state.isConnected = false;
		// Display an error message to the user
		alert('WebSocket connection error. Please ensure the backend is running.');
		// Maybe disable UI elements that require connection
	};

	websocket.onclose = (event) => {
		console.log('WebSocket closed:', event.code, event.reason);
		state.isConnected = false;
		// Display a message to the user
		alert('WebSocket connection closed.');
		// Maybe disable UI elements or try to reconnect
	};
}

export function sendApiRequest_fs(command, payload = {}, callback = null) {
	if (!websocket || websocket.readyState !== WebSocket.OPEN) {
		console.error('WebSocket is not connected.');
		// alert('Cannot send request: WebSocket not connected.');
		// Optionally return a rejected promise
		return Promise.reject(new Error('WebSocket not connected'));
	}

	const requestId = nextRequestId++;
	const request = {
		id: requestId,
		method: command,
		params: payload
	};

	//const request = {
	//	id: requestId,
	//	method: "rpcCall",
	//	params: { command, payload }
	//};

	const jsonRequest = JSON.stringify(request);

	// Create a promise for this request
	const promise = new Promise((resolve, reject) => {
		pendingRequests.set(requestId, { resolve, reject, callback });
	});

	try {
		websocket.send(jsonRequest);
		console.log(`Sent request ${requestId}: ${command}`);
		return promise; // Return the promise
	} catch (e) {
		console.error(`Failed to send request ${requestId}: ${command}`, e);
		pendingRequests.delete(requestId); // Clean up pending request
		// Reject the promise immediately
		const error = new Error(`Failed to send WebSocket message: ${e.message}`);
		if (callback) callback({ status: 'error', payload: { message: error.message } });
		return Promise.reject(error);
	}
}

export function subscribeToEvent_fs(eventType, callback) {
	if (!eventListeners.has(eventType)) {
		eventListeners.set(eventType, []);
	}
	eventListeners.get(eventType).push(callback);
	console.log(`Subscribed to event: ${eventType}`);
}

export function unsubscribeFromEvent_fs(eventType, callback) {
	if (eventListeners.has(eventType)) {
		const listeners = eventListeners.get(eventType);
		const index = listeners.indexOf(callback);
		if (index > -1) {
			listeners.splice(index, 1);
			console.log(`Unsubscribed from event: ${eventType}`);
		}
		if (listeners.length === 0) {
			eventListeners.delete(eventType);
		}
	}
}
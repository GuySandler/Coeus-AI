// MyAPI constant can be defined here if background needs to construct URLs,
// but for now, index.html sends the full URL.

async function get(url) {
	let response; // Declare response here to access it in catch if needed
	try {
		response = await fetch(url);
		if (!response.ok) {
			// Try to get error message from response body if possible
			let errorBody = null;
			try {
				errorBody = await response.text(); // or response.json() if applicable
			} catch (e) { /* ignore if can't read body */ }
			throw new Error(`Response status: ${response.status}. Body: ${errorBody || 'N/A'}`);
		}
		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Background GET error:", error.message);
		// It's important to return an error structure that the caller can understand
		return { error: error.message, status: response ? response.status : null };
	}
}

async function post(url, data) {
	let response; // Declare response here to access it in catch if needed
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
		if (!response.ok) {
			// Try to get error message from response body if possible
			let errorBody = null;
			try {
				errorBody = await response.text(); // or response.json() if applicable
			} catch (e) { /* ignore if can't read body */ }
			throw new Error(`Response status: ${response.status}. Body: ${errorBody || 'N/A'}`);
		}
		const json = await response.json();
		return json;
	} catch (error) {
		console.error("Background POST error:", error.message);
		// Return an error structure
		return { error: error.message, status: response ? response.status : null };
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "post") {
		post(request.url, request.data)
			.then(response => sendResponse(response))
			.catch(error => sendResponse({ error: error.message }));
		return true; // Indicates that the response will be sent asynchronously
	} else if (request.action === "get") {
		get(request.url)
			.then(response => sendResponse(response))
			.catch(error => sendResponse({ error: error.message }));
		return true; // Indicates that the response will be sent asynchronously
	} else if (request.action === "getCanvasUrl") {
		// Get the Canvas URL from the active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0] && tabs[0].url) {
				const url = new URL(tabs[0].url);
				if (url.hostname.includes('instructure.com')) {
					sendResponse({ canvasUrl: url.hostname });
				} else {
					sendResponse({ canvasUrl: null });
				}
			} else {
				sendResponse({ canvasUrl: null });
			}
		});
		return true; // Indicates that the response will be sent asynchronously
	}
});

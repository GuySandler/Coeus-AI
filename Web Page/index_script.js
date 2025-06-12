const MyAPI = "http://localhost:3000"; // Changed from 0.0.0.0 to localhost
let state = "setup";
let setupStep = 0;
const setupConfig = {
	canvasUrl: null,
	apiKey: null
};

document.getElementById("input").addEventListener("keypress", async (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		await send();
		document.getElementById("input").value = "";
	}
});

// Add event listener for the send button
document.getElementById("sendButton").addEventListener("click", async () => {
	await send();
	document.getElementById("input").value = ""; // Clear input after send, similar to Enter key press
});

// Settings menu functionality
document.getElementById("settings-button").addEventListener("click", (e) => {
	e.stopPropagation();
	const menu = document.getElementById("settings-menu");
	menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// Close settings menu when clicking outside
document.addEventListener("click", (e) => {
	const menu = document.getElementById("settings-menu");
	const button = document.getElementById("settings-button");
	if (!menu.contains(e.target) && !button.contains(e.target)) {
		menu.style.display = "none";
	}
});

// Add event listeners for settings menu items
document.addEventListener("DOMContentLoaded", () => {
	const settingsMenuItems = document.querySelectorAll(".settings-menu-item");
	settingsMenuItems.forEach(item => {
		item.addEventListener("click", (e) => {
			const action = e.target.getAttribute("data-action");
			switch(action) {
				case "clearChatHistory":
					clearChatHistory();
					break;
				case "clearAllData":
					clearAllData();
					break;
				case "restartSetup":
					restartSetup();
					break;
			}
		});
	});
});

const chat = document.getElementById("chat");
const chatHistory = [];

// move person talking to top
function addToChat(text, fromwho, side, replaceable = false) {
	const div = document.createElement("div");
	if (replaceable) {
		div.id = "toreplace";
	}
	let color = fromwho.toLowerCase() === "you" ? "#f8f3b8" : "#38456b";
	let textColor = fromwho.toLowerCase() === "you" ? "#1d357d" : "white";
	div.style.clear = "both";
	div.innerHTML = `<div>
		<p style="margin:0;color:white;float:${side};position:relative;margin-bottom:5px;font-size:12px;opacity:0.8;">${fromwho}</p>
		<div style="clear:both;"></div>
		<p style="margin:0;float:${side};background:${color};padding: 10px;border-radius: 10px;display: inline-block;color:${textColor};margin-bottom: 10px;max-width:60%;overflow-y:auto;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto;">
			${text}
		</p>
	</div>`;
	chat.appendChild(div);

	if (!replaceable) {
		chatHistory.push({ role: fromwho.toLowerCase(), content: text });
	}
	chat.scrollTop = chat.scrollHeight;
}

let CanvasProfile;
async function handleSetup(message) {
	switch(setupStep) {
		case 0:
			// Skip URL input if we already detected it
			if (setupConfig.canvasUrl) {
				setupConfig.apiKey = message;
				addToChat(message, "You", "right");
				await wait(750);
				addToChat("building your profile...", "Coeus", "left");
				CanvasProfile = await chrome.runtime.sendMessage({
					action: "post",
					url: MyAPI + "/buildcanvas",
					data: {"key": setupConfig.apiKey, "url": setupConfig.canvasUrl}
				});
				if (CanvasProfile.error) {
					console.error("Error building canvas profile:", CanvasProfile.error);
					addToChat("Sorry, there was an error building your profile. Please check the console.", "Coeus", "left");
					return;
				}
				addToChat("Done!", "Coeus", "left");
				console.log(CanvasProfile);

				const items = ["No period 0", "No period 1", "No period 7"];
				for (const course of CanvasProfile.courses) {
					items.push(course.name);
				}
				const periods = await createDragDropPopup(items);
				await setStorage("periods", JSON.stringify(periods));
				console.log("Saved periods to storage:", periods);
				await wait(750);

				addToChat("Great! I have all the information I need.", "Coeus", "left");
				await setStorage("canvasUrl", setupConfig.canvasUrl);
				await setStorage("apiKey", setupConfig.apiKey);
				await setStorage("id", CanvasProfile.id);
				await setStorage("CanvasProfile", JSON.stringify(CanvasProfile));
				await setStorage("lastCheckupTime", new Date().getTime());

				addToChat("Setup complete! You can now ask me questions.", "Coeus", "left");
				state = "chat";
			} else {
				// Fallback to manual URL input
				setupConfig.canvasUrl = message;
				addToChat(message, "You", "right");
				await wait(750);
				addToChat(`What is your Canvas API key? (get it <a target="_blank" href="https://${setupConfig.canvasUrl}/profile/settings">here</a>)`, "Coeus", "left");
				setupStep++;
			}
			break;
		case 1:
			setupConfig.apiKey = message;
			addToChat(message, "You", "right");
			await wait(750);
			addToChat("building your profile...", "Coeus", "left");
			CanvasProfile = await chrome.runtime.sendMessage({
				action: "post",
				url: MyAPI + "/buildcanvas",
				data: {"key": setupConfig.apiKey, "url": setupConfig.canvasUrl}
			});
			if (CanvasProfile.error) {
				console.error("Error building canvas profile:", CanvasProfile.error);
				addToChat("Sorry, there was an error building your profile. Please check the console.", "Coeus", "left");
				return;
			}
			addToChat("Done!", "Coeus", "left");
			console.log(CanvasProfile);

			const items = ["No period 0", "No period 1", "No period 7"];
			for (const course of CanvasProfile.courses) {
				items.push(course.name);
			}
			const periods = await createDragDropPopup(items);
			await setStorage("periods", JSON.stringify(periods));
			console.log("Saved periods to storage:", periods);
			await wait(750);

			addToChat("Great! I have all the information I need.", "Coeus", "left");
			await setStorage("canvasUrl", setupConfig.canvasUrl);
			await setStorage("apiKey", setupConfig.apiKey);
			await setStorage("id", CanvasProfile.id);
			await setStorage("CanvasProfile", JSON.stringify(CanvasProfile));
			await setStorage("lastCheckupTime", new Date().getTime());

			addToChat("Setup complete! You can now ask me questions.", "Coeus", "left");
			state = "chat";
			break;
	}

}

async function AskGemini(prompt) {
	const url = `${MyAPI}/askgemini`;
	addToChat(prompt, "You", "right");
	addToChat("Thinking...", "Coeus", "left", true);

	let userContext = ""; // Initialize empty

	// Retrieve CanvasProfile
	let profile = CanvasProfile;
	if (!profile) {
		const canvasProfileStorage = await getStorage("CanvasProfile");
		if (canvasProfileStorage) {
			try {
				profile = JSON.parse(canvasProfileStorage);
			} catch (e) {
				console.error("Error parsing CanvasProfile from storage:", e);
			}
		}
	}

	// Retrieve periods
	let periods = null;
	const periodsStorage = await getStorage("periods");
	console.log("Raw periods storage:", periodsStorage); // Debug log
	if (periodsStorage) {
		try {
			periods = JSON.parse(periodsStorage);
			console.log("Retrieved periods from storage:", periods); // Debug log
		} catch (e) {
			console.error("Error parsing periods from storage:", e);
		}
	} else {
		console.log("No periods storage found"); // Debug log
	}

	// Build user context
	if (profile) {
		userContext += `User's name: ${profile.name}. `;
	} else {
		userContext += "User's profile: (Not available). ";
	}

	if (periods) {
		userContext += "Schedule: ";
		let hasSchedule = false;
		for (const periodKey in periods) {
			if (periods[periodKey] && periods[periodKey] !== null && periods[periodKey] !== "null") {
				// Convert period0 -> "Period 0", period1 -> "Period 1", etc.
				const periodNumber = periodKey.replace('period', '');
				const periodName = `Period ${periodNumber}`;
				userContext += `${periodName}: ${periods[periodKey]}, `;
				hasSchedule = true;
			}
		}
		if (hasSchedule) {
			userContext = userContext.slice(0, -2) + ". "; // Remove trailing comma and space
		} else {
			userContext += "(No courses assigned to periods). ";
		}
	} else {
		userContext += "User's schedule: (Not available). ";
	}

	console.log("Final user context:", userContext); // Debug log

	const data = {
		prompt: prompt,
		history: chatHistory,
		personalContext: userContext
	};

	const response = await chrome.runtime.sendMessage({
		action: "post",
		url: url,
		data: data
	});

	if (response.error) {
		console.error("Error asking Gemini:", response.error);
		const toreplace = document.getElementById("toreplace");
		if (toreplace) {
			toreplace.innerHTML = `<div>
				<p style="margin:0;color:white;float:left;position:relative;margin-bottom:5px;font-size:12px;opacity:0.8;">Coeus</p>
				<div style="clear:both;"></div>
				<p style="margin:0;float:left;background:#38456b;padding: 10px;border-radius: 10px;display: inline-block;color:white;margin-bottom: 10px;max-width:60%;overflow-y:auto;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto;">
					Sorry, an error occurred.
				</p>
			</div>`;
			toreplace.removeAttribute('id');
		}
		return;
	}

	const toreplace = document.getElementById("toreplace");
	if (toreplace) {
		const formattedAnswer = formatAIResponse(response.answer);
		toreplace.innerHTML = `<div>
			<p style="margin:0;color:white;float:left;position:relative;margin-bottom:5px;font-size:12px;opacity:0.8;">Coeus</p>
			<div style="clear:both;"></div>
			<p style="margin:0;float:left;background:#38456b;padding: 10px;border-radius: 10px;display: inline-block;color:white;margin-bottom: 10px;max-width:60%;overflow-y:auto;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto;">
				${formattedAnswer}
			</p>
		</div>`;
		toreplace.removeAttribute('id');
		chatHistory.push({ role: 'Coeus', content: response.answer });
	}
}

// Function to format AI response text
function formatAIResponse(text) {
	// First, handle code blocks (```code```) before other formatting
	text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
	
	// Handle inline code (`code`) 
	text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
	
	// Convert ~~strikethrough~~ to <del>
	text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
	
	// Convert **bold** to <strong>
	text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	
	// Convert *italic* to <em> (but not if it's part of ** or list items)
	text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
	
	// Convert line breaks to temporary markers first
	text = text.replace(/\n/g, '|||LINEBREAK|||');
	
	// Convert bullet points (* item) to <li> - handle both cases with and without space after *
	text = text.replace(/(?:^|\|\|\|LINEBREAK\|\|\|)\* (.+?)(?=\|\|\|LINEBREAK\|\|\||$)/g, '<li>$1</li>');
	
	// Wrap consecutive <li> items in <ul> - improved regex
	text = text.replace(/(<li>.*?<\/li>)(?:\|\|\|LINEBREAK\|\|\|(<li>.*?<\/li>))*/g, (match) => {
		// Remove line break markers within the match
		const cleanMatch = match.replace(/\|\|\|LINEBREAK\|\|\|/g, '');
		return '<ul>' + cleanMatch + '</ul>';
	});
	
	// Convert remaining line break markers to <br>
	text = text.replace(/\|\|\|LINEBREAK\|\|\|/g, '<br>');
	
	// Clean up any multiple <br> tags
	text = text.replace(/(<br>\s*){2,}/g, '<br><br>');
	
	return text;
}

async function send() {
	const prompt = document.getElementById("input").value;
	if (prompt === "") return;

	if (state === "setup") {
		await handleSetup(prompt);
	} else if (state === "checkup") {
		await handleCheckup(prompt);
	} else if (state === "chat") {
		await AskGemini(prompt);
	}

	document.getElementById("input").value = "";
}

async function setup() {
	const savedUrl = await getStorage("canvasUrl");
	const savedKey = await getStorage("apiKey");
	const savedPeriods = await getStorage("periods");

	// Check if we have all required data
	if (savedUrl && savedKey && savedPeriods) {
		setupConfig.canvasUrl = savedUrl;
		setupConfig.apiKey = savedKey;

		const lastCheckupTime = await getStorage("lastCheckupTime");
		if (needsCheckup(lastCheckupTime)) {
			state = "checkup";
			addToChat("Hi! It's been 24 hours since our last check-in. Let's review your progress!", "Coeus", "left");
			await wait(750);
			addToChat("Have you completed all your assignments from yesterday?", "Coeus", "left");
			await setStorage("lastCheckupTime", new Date().getTime());
		} else {
			state = "chat";
			addToChat("Welcome back! How can I help you today?", "Coeus", "left");
		}
		return;
	}

	// Try to detect Canvas URL automatically
	const detectedUrl = await getCanvasUrlFromParent();
	if (detectedUrl) {
		setupConfig.canvasUrl = detectedUrl;
		console.log("Detected Canvas URL:", detectedUrl);
	}

	// If we're missing periods data but have URL and key, we need to re-run setup
	if (savedUrl && savedKey && !savedPeriods) {
		console.log("Missing periods data, need to complete setup");
		setupConfig.canvasUrl = savedUrl;
		setupConfig.apiKey = savedKey;
		
		// Try to rebuild canvas profile
		CanvasProfile = await chrome.runtime.sendMessage({
			action: "post",
			url: MyAPI + "/buildcanvas",
			data: {"key": setupConfig.apiKey, "url": setupConfig.canvasUrl}
		});
		
		if (CanvasProfile.error) {
			console.error("Error rebuilding canvas profile:", CanvasProfile.error);
			// Clear storage and restart setup
			await removeStorage("canvasUrl");
			await removeStorage("apiKey");
			await removeStorage("CanvasProfile");
		} else {
			// Skip to period setup
			state = "setup";
			setupStep = 2;
			addToChat("I need to finish setting up your schedule. Let me get your courses...", "Coeus", "left");
			await wait(750);
			
			const items = ["No period 0", "No period 1", "No period 7"];
			for (const course of CanvasProfile.courses) {
				items.push(course.name);
			}
			const periods = await createDragDropPopup(items);
			await setStorage("periods", JSON.stringify(periods));
			
			addToChat("Great! Setup is now complete.", "Coeus", "left");
			await setStorage("CanvasProfile", JSON.stringify(CanvasProfile));
			await setStorage("lastCheckupTime", new Date().getTime());
			state = "chat";
			addToChat("You can now ask me questions!", "Coeus", "left");
			return;
		}
	}

	// setup start text
	addToChat("Hello 👋", "Coeus", "left");
	await wait(750);
	addToChat("Before I can start helping you I need some info", "Coeus", "left");
	await wait(750);
	
	if (setupConfig.canvasUrl) {
		addToChat(`I detected you're using Canvas at: ${setupConfig.canvasUrl}`, "Coeus", "left");
		await wait(750);
		addToChat(`What is your Canvas API key? (get it <a target="_blank" href="https://${setupConfig.canvasUrl}/profile/settings">here</a>)`, "Coeus", "left");
		setupStep = 0; // Will handle API key input directly
	} else {
		addToChat("What is your canvas URL? (acalanes.instructure.com)", "Coeus", "left");
	}
}

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Replace cookie functions with Chrome storage
async function setStorage(name, value) {
	try {
		const data = {};
		data[name] = value;
		await chrome.storage.local.set(data);
		console.log(`Setting storage ${name}:`, value); // Debug log
	} catch (error) {
		console.error(`Error setting storage ${name}:`, error);
	}
}

async function getStorage(name) {
	try {
		const result = await chrome.storage.local.get([name]);
		console.log(`Getting storage ${name}:`, result[name]); // Debug log
		return result[name] || null;
	} catch (error) {
		console.error(`Error getting storage ${name}:`, error);
		return null;
	}
}

async function removeStorage(name) {
	try {
		await chrome.storage.local.remove([name]);
		console.log(`Removed storage ${name}`);
	} catch (error) {
		console.error(`Error removing storage ${name}:`, error);
	}
}

// Keep cookie functions for backward compatibility but mark as deprecated
function setCookie(name, value, days) {
	console.warn("setCookie is deprecated in extension context, use setStorage instead");
	setStorage(name, value);
}

function getCookie(name) {
	console.warn("getCookie is deprecated in extension context, use getStorage instead");
	return null; // Always return null to force use of storage
}

function eraseCookie(name) {
	console.warn("eraseCookie is deprecated in extension context, use removeStorage instead");
	removeStorage(name);
}

function createDragDropPopup(items) {
	// Get the iframe dimensions to scale the popup
	const iframe = document.documentElement;
	const maxWidth = Math.min(iframe.clientWidth * 0.9, 800); // 90% of iframe width, max 800px
	const maxHeight = Math.min(iframe.clientHeight * 0.9, 600); // 90% of iframe height, max 600px
	const minWidth = Math.max(300, iframe.clientWidth * 0.6); // At least 300px or 60% of iframe width
	const minHeight = Math.max(400, iframe.clientHeight * 0.6); // At least 400px or 60% of iframe height

	const popup = document.createElement("div");
	popup.style.cssText = `
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		padding: 20px;
		border-radius: 10px;
		box-shadow: 0 0 10px rgba(0,0,0,0.5);
		z-index: 1000;
		width: ${Math.max(minWidth, Math.min(maxWidth, 800))}px;
		height: ${Math.max(minHeight, Math.min(maxHeight, 600))}px;
		display: flex;
		justify-content: space-between;
		flex-direction: row;
		box-sizing: border-box;
	`;

	const dropZones = document.createElement("div");
	dropZones.style.cssText = `
		width: 45%;
		padding: 10px;
		border: 2px dashed #ccc;
		height: calc(100% - 60px);
		overflow-y: auto;
		border-radius: 5px;
		box-sizing: border-box;
	`;

	const dragItems = document.createElement("div"); 
	dragItems.style.cssText = `
		width: 45%;
		padding: 10px;
		border: 2px dashed #ccc;
		height: calc(100% - 60px);
		overflow-y: auto;
		border-radius: 5px;
		box-sizing: border-box;
	`;

	dragItems.addEventListener("dragover", (e) => e.preventDefault());
	dragItems.addEventListener("drop", (e) => {
		e.preventDefault();
		const draggedId = e.dataTransfer.getData("text");
		const draggedElement = document.getElementById(draggedId);
		dragItems.appendChild(draggedElement);
	});

	// Calculate item height based on available space
	const availableHeight = Math.max(minHeight, Math.min(maxHeight, 600)) - 120; // Subtract padding and button space
	const itemHeight = Math.max(40, Math.min(60, availableHeight / 10)); // Scale item height, min 40px, max 60px

	// Create 8 fixed drop zones
	for(let i = 0; i < 8; i++) {
		const dropZone = document.createElement("div");
		dropZone.style.cssText = `
			height: ${itemHeight}px;
			margin: 5px 0;
			border: 2px solid #6399e2;
			border-radius: 5px;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			font-size: ${Math.max(12, itemHeight * 0.25)}px;
			box-sizing: border-box;
		`;
		dropZone.setAttribute("data-index", i);
		dropZone.textContent = `Period ${i}`;
		dropZone.addEventListener("dragover", (e) => {
			e.preventDefault();
			dropZone.style.background = "#6399e2";
		});
		dropZone.addEventListener("dragleave", () => {
			dropZone.style.background = "white";
		});
		dropZone.addEventListener("drop", (e) => {
			e.preventDefault();
			const draggedId = e.dataTransfer.getData("text");
			const draggedElement = document.getElementById(draggedId);
			if (dropZone.children.length === 0) {
				dropZone.appendChild(draggedElement);
				dropZone.style.background = "white";
			}
		});
		dropZones.appendChild(dropZone);
	}

	// Create draggable items from input array
	items.forEach((item, index) => {
		const dragItem = document.createElement("div");
		dragItem.style.cssText = `
			height: ${itemHeight}px;
			margin: 5px 0;
			background: #6399e2;
			color: white;
			border-radius: 5px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: move;
			width: 100%;
			font-size: ${Math.max(12, itemHeight * 0.25)}px;
			text-align: center;
			padding: 5px;
			box-sizing: border-box;
			word-wrap: break-word;
			overflow: hidden;
		`;
		dragItem.setAttribute("draggable", true);
		dragItem.setAttribute("id", `item-${index}`);
		dragItem.textContent = item;
		dragItem.addEventListener("dragstart", (e) => {
			e.dataTransfer.setData("text", e.target.id);
		});
		dragItems.appendChild(dragItem);
	});

	popup.appendChild(dropZones);
	popup.appendChild(dragItems);

	const button = document.createElement("button");
	button.textContent = "Submit";
	button.style.cssText = `
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 20px;
		background: #6399e2;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: ${Math.max(14, itemHeight * 0.3)}px;
	`;

	popup.appendChild(button);
	document.body.appendChild(popup);

	return new Promise((resolve) => {
		button.onclick = () => {
			const results = {};
			Array.from(dropZones.children).forEach((zone, index) => {
				results[`period${index}`] = zone.children.length > 0 ? 
					zone.children[0].textContent :
					null;
			});
			document.body.removeChild(popup);
			resolve(results);
		};
	});
}

async function getLastCheckupTime() {
	return await getStorage("lastCheckupTime");
}

async function setLastCheckupTime() {
	await setStorage("lastCheckupTime", new Date().getTime());
}

function needsCheckup(lastCheckupTime = null) {
	if (!lastCheckupTime) return true;

	const now = new Date().getTime();
	const timeSinceLastCheckup = now - parseInt(lastCheckupTime);
	const hoursSinceLastCheckup = timeSinceLastCheckup / (1000 * 60 * 60);
	
	return hoursSinceLastCheckup >= 24;
}

async function handleCheckup(response) {
	// future, add quick buttons
	addToChat("It's time for a checkup!, do you want to continue?", "Coeus", "right");
	addToChat(response, "You", "right");
	await wait(750);

	if (response.toLowerCase().includes("no")) {
		addToChat("Ok! See you tommorrow!", "Coeus", "left");
		// Here you could add code to fetch and display pending assignments
		state = "chat";
	} else {
		addToChat("Checkup stuff here", "Coeus", "left");
		// Here you could add code to fetch upcoming assignments
		state = "chat";
	}
}

// Settings functions
async function clearChatHistory() {
	chatHistory.length = 0; // Clear the array
	const chatDiv = document.getElementById("chat");
	chatDiv.innerHTML = ""; // Clear chat display
	addToChat("Chat history cleared!", "Coeus", "left");
	document.getElementById("settings-menu").style.display = "none";
}

async function clearAllData() {
	if (confirm("Are you sure you want to clear all data? This will reset everything and you'll need to set up again.")) {
		try {
			// Clear all storage
			await chrome.storage.local.clear();
			
			// Clear chat history and display
			chatHistory.length = 0;
			const chatDiv = document.getElementById("chat");
			chatDiv.innerHTML = "";
			
			// Reset global variables
			CanvasProfile = null;
			state = "setup";
			setupStep = 0;
			setupConfig.canvasUrl = null;
			setupConfig.apiKey = null;
			
			addToChat("All data cleared! Restarting setup...", "Coeus", "left");
			await wait(1000);
			
			// Restart setup
			chatDiv.innerHTML = "";
			setup();
		} catch (error) {
			console.error("Error clearing data:", error);
			addToChat("Error clearing data. Please check the console.", "Coeus", "left");
		}
	}
	document.getElementById("settings-menu").style.display = "none";
}

async function restartSetup() {
	if (confirm("Are you sure you want to restart the setup? This will clear your current configuration.")) {
		try {
			// Clear setup-related storage but keep chat history
			await removeStorage("canvasUrl");
			await removeStorage("apiKey");
			await removeStorage("periods");
			await removeStorage("CanvasProfile");
			await removeStorage("id");
			
			// Reset global variables
			CanvasProfile = null;
			state = "setup";
			setupStep = 0;
			setupConfig.canvasUrl = null;
			setupConfig.apiKey = null;
			
			// Clear chat and restart setup
			const chatDiv = document.getElementById("chat");
			chatDiv.innerHTML = "";
			chatHistory.length = 0;
			
			addToChat("Restarting setup...", "Coeus", "left");
			await wait(1000);
			
			chatDiv.innerHTML = "";
			setup();
		} catch (error) {
			console.error("Error restarting setup:", error);
			addToChat("Error restarting setup. Please check the console.", "Coeus", "left");
		}
	}
	document.getElementById("settings-menu").style.display = "none";
}


// todo
// no period box with inf supply
// what grade you want to get (but don't do anything with it) (generate an encouraging message)
// extracarriculers/requirments to get done and when
// how much time to check in

setup();

// Function to get Canvas URL from the parent window
async function getCanvasUrlFromParent() {
	try {
		const response = await chrome.runtime.sendMessage({
			action: "getCanvasUrl"
		});
		return response?.canvasUrl || null;
	} catch (error) {
		console.error("Error getting Canvas URL:", error);
		return null;
	}
}

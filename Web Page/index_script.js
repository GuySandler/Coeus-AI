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
		<p style="margin:0;color:white;float:${side};position:relative;bottom:-15px;${side}:5px;">${fromwho}</p><br>
		<p style="float:${side};background:${color};padding: 10px;border-radius: 10px;display: inline-block;color:${textColor};margin-bottom: 10px;max-width:60%;overflow-y:auto;">
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
			setupConfig.canvasUrl = message;
			addToChat(message, "You", "right");
			await wait(750);
			addToChat(`What is your Canvas API key? (get it <a target="_blank" href="https://${setupConfig.canvasUrl}/profile/settings">here</a>)`, "Coeus", "left");
			setupStep++;
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
		case 2:
			const items = ["No period 0", "No period 1", "No period 7"];
			for (const course of CanvasProfile.courses) {
				items.push(course.name);
			}
			const periods = await createDragDropPopup(items);
			setCookie("periods", JSON.stringify(periods)); // Set cookie immediately after popup
			await wait(750);

		case 3:
			addToChat("Great! I have all the information I need.", "Coeus", "left");
			setCookie("canvasUrl", setupConfig.canvasUrl);
			setCookie("apiKey", setupConfig.apiKey);
			setCookie("id", CanvasProfile.id);
			setCookie("CanvasProfile", JSON.stringify(CanvasProfile));
			console.log(periods);
			setLastCheckupTime();

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
		const canvasProfileCookie = getCookie("CanvasProfile");
		if (canvasProfileCookie) {
			try {
				profile = JSON.parse(canvasProfileCookie);
			} catch (e) {
				console.error("Error parsing CanvasProfile from cookie:", e);
				userContext += "User's profile: (Error retrieving profile details). ";
			}
		} else {
			userContext += "User's profile: (Not available). ";
		}
	}

	// Retrieve periods
	let periods;
	const periodsCookie = getCookie("periods");
	if (periodsCookie) {
		try {
			periods = JSON.parse(periodsCookie);
		} catch (e) {
			console.error("Error parsing periods from cookie:", e);
			userContext += "User's schedule: (Error retrieving period details). ";
		}
	} else {
		userContext += "User's schedule: (Not available). ";
	}

	if (profile) {
		userContext += `User's name: ${profile.name}. `;
	}

	if (periods) {
		userContext += "Schedule: ";
		let hasSchedule = false;
		for (const periodKey in periods) {
			if (periods[periodKey]) {
				userContext += `${periodKey.replace('period', 'Period ')}: ${periods[periodKey]}, `;
				hasSchedule = true;
			}
		}
		if (hasSchedule) {
			userContext = userContext.slice(0, -2) + ". "; // Remove trailing comma and space
		} else {
			userContext += "(No courses assigned to periods). ";
		}
	} else {
		userContext += "(Unable to determine schedule). ";
	}

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
			toreplace.innerHTML = `<p style="float:left;background-color:#8b8987;padding: 10px;border-radius: 10px;display: inline-block;">Coeus: Sorry, an error occurred.</p>`;
			toreplace.removeAttribute('id');
		}
		return;
	}

	const toreplace = document.getElementById("toreplace");
	if (toreplace) {
		toreplace.innerHTML = `<p style="float:left;background-color:#8b8987;padding: 10px;border-radius: 10px;display: inline-block;">Coeus: ${response.answer}</p>`;
		toreplace.removeAttribute('id');
		chatHistory.push({ role: 'Coeus', content: response.answer });
	}
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
	const savedUrl = getCookie("canvasUrl");
	const savedKey = getCookie("apiKey");

	// skip setup
	if (savedUrl && savedKey) {
		setupConfig.canvasUrl = savedUrl;
		setupConfig.apiKey = savedKey;

		if (needsCheckup()) {
			state = "checkup";
			addToChat("Hi! It's been 24 hours since our last check-in. Let's review your progress!", "Coeus", "left");
			await wait(750);
			addToChat("Have you completed all your assignments from yesterday?", "Coeus", "left");
			setLastCheckupTime();
		} else {
			state = "chat";
			addToChat("Welcome back! How can I help you today?", "Coeus", "left");
		}
		return;
	}

	// setup start text
	addToChat("Hello 👋", "Coeus", "left");
	await wait(750);
	addToChat("Before I can start helping you I need some info", "Coeus", "left");
	await wait(750);
	addToChat("What is your canvas URL? (acalanes.instructure.com)", "Coeus", "left");
}

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function setCookie(name, value, days) {
	var expires = "";
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days*24*60*60*1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function createDragDropPopup(items) {
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
		width: 800px;
		height: 600px;
		display: flex;
		justify-content: space-between;
	`;

	const dropZones = document.createElement("div");
	dropZones.style.cssText = `
		width: 45%;
		padding: 10px;
		border: 2px dashed #ccc;
		height: 100%;
	`;

	const dragItems = document.createElement("div"); 
	dragItems.style.cssText = `
		width: 45%;
		padding: 10px;
		border: 2px dashed #ccc;
		height: 100%;
		overflow-y: auto;
	`;

	dragItems.addEventListener("dragover", (e) => e.preventDefault());
	dragItems.addEventListener("drop", (e) => {
		e.preventDefault();
		const draggedId = e.dataTransfer.getData("text");
		const draggedElement = document.getElementById(draggedId);
		dragItems.appendChild(draggedElement);
	});

	// Create 8 fixed drop zones
	for(let i = 0; i < 8; i++) {
		const dropZone = document.createElement("div");
		dropZone.style.cssText = `
			height: 60px;
			margin: 10px 0;
			border: 2px solid #6399e2;
			border-radius: 5px;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
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
			height: 60px;
			margin: 10px 0;
			background: #6399e2;
			color: white;
			border-radius: 5px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: move;
			width: 100%;
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

function getLastCheckupTime() {
	return getCookie("lastCheckupTime");
}

function setLastCheckupTime() {
	setCookie("lastCheckupTime", new Date().getTime(), 30); // Store for 30 days
}

function needsCheckup() {
	const lastCheckup = getLastCheckupTime();
	if (!lastCheckup) return true;

	const now = new Date().getTime();
	const timeSinceLastCheckup = now - parseInt(lastCheckup);
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


// todo
// no period box with inf supply
// what grade you want to get (but don't do anything with it) (generate an encouraging message)
// extracarriculers/requirments to get done and when
// how much time to check in

setup();

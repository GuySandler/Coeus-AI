// This script runs in the context of the web page
console.log("Coeus Overlay content script running!");

let coeusChatIframe = null;
let resizeHandle = null;
let isDragging = false;
let isResizing = false;
let offsetX, offsetY, startX, startY, startWidth, startHeight;

// Function to create and style the Coeus chat iframe
function createCoeusChatIframe() {
    if (document.getElementById('coeus-overlay-container')) {
        return document.getElementById('coeus-overlay');
    }

    const container = document.createElement('div');
    container.id = 'coeus-overlay-container';
    // Initial position and dimensions
    let initialTop = (window.innerHeight - 600) / 2;
    let initialLeft = (window.innerWidth - 400) / 2;
    let initialWidth = 400;
    let initialHeight = 600;

    container.style.cssText = `
        position: fixed;
        top: ${initialTop}px;
        left: ${initialLeft}px;
        width: ${initialWidth}px; 
        height: ${initialHeight}px; 
        z-index: 2147483646; /* Slightly lower for resize handle */
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-radius: 8px;
        background-color: #06174b; /* For drag handle area / title bar */
        display: none; /* Initially hidden */
        cursor: move; /* Indicate draggable */
        user-select: none; /* Prevent text selection during drag */
        overflow: hidden; /* Ensure iframe fits within rounded corners */
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'coeus-overlay';
    iframe.src = chrome.runtime.getURL('index.html');
    iframe.style.cssText = `
        width: 100%; 
        height: calc(100% - 20px); /* Adjust height for title bar */
        border: none; 
        background-color: white; 
        display: block; /* Remove any default iframe spacing */
        margin-top: 20px; /* Space for title bar */
    `;
    container.appendChild(iframe);

    // Create a title bar element for dragging
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 20px; /* Height of the draggable area */
        background-color: #06174b; /* Match container or a distinct color */
        cursor: move;
        z-index: 1; /* Above iframe content for dragging */
        color: white;
        text-align: center;
        line-height: 20px;
        font-size: 12px;
        font-family: sans-serif;
    `;
    titleBar.textContent = "Coeus AI"; // Optional: Add a title
    container.insertBefore(titleBar, iframe); // Insert title bar before iframe

    // Resize Handle
    resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 15px;
        height: 15px;
        background-color: #ccc;
        cursor: nwse-resize;
        z-index: 2147483647; /* On top of everything in the container */
        border-top-left-radius: 5px; /* Optional styling */
    `;
    container.appendChild(resizeHandle);
    document.body.appendChild(container);
    
    coeusChatIframe = iframe; // Keep reference to the iframe itself

    // Dragging logic for the container (via titleBar)
    titleBar.addEventListener('mousedown', (e) => {
        // Prevent dragging if clicking on resize handle (though it's separate now)
        if (e.target === resizeHandle) return;
        isDragging = true;
        // Calculate offset from the container's top-left corner
        const rect = container.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        coeusChatIframe.style.pointerEvents = 'none'; // Disable iframe interaction during drag
        container.style.userSelect = 'none';
        e.preventDefault(); // Prevent text selection
    });

    // Resizing logic
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
        coeusChatIframe.style.pointerEvents = 'none'; // Disable iframe interaction during resize
        container.style.userSelect = 'none';
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            container.style.left = `${e.clientX - offsetX}px`;
            container.style.top = `${e.clientY - offsetY}px`;
        } else if (isResizing) {
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            container.style.width = `${Math.max(200, newWidth)}px`; // Min width
            container.style.height = `${Math.max(150, newHeight)}px`; // Min height
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            coeusChatIframe.style.pointerEvents = 'auto'; // Re-enable iframe interaction
            container.style.userSelect = 'auto';
        }
    });

    return iframe; // Return the iframe element
}

// Function to toggle the Coeus chat iframe visibility
function toggleCoeusChat() {
    let container = document.getElementById('coeus-overlay-container');
    if (!container) {
        createCoeusChatIframe(); // This will create both container and iframe
        container = document.getElementById('coeus-overlay-container');
    }
    
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
         // Center if opened for the first time or if moved off-screen (optional)
        if (!container.dataset.hasBeenMoved) {
            let initialTop = (window.innerHeight - parseInt(container.style.height)) / 2;
            let initialLeft = (window.innerWidth - parseInt(container.style.width)) / 2;
            container.style.top = `${initialTop}px`;
            container.style.left = `${initialLeft}px`;
        }
    } else {
        container.style.display = 'none';
    }
    // Mark that it might have been moved, so don't recenter next time
    if (container.style.display === 'block') {
        container.dataset.hasBeenMoved = "true";
    }
}

let coeusLinkGlobal = null; // Store coeusLink globally for observer updates

function updateCoeusLinkText() {
    if (!coeusLinkGlobal) return;

    const svgIcon = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1" style="vertical-align: middle; margin-right: 8px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
    const hasBetterCanvas = !!document.getElementById('bettercanvas-sidebar-courses-container');
    const isNavExpanded = document.body.classList.contains('primary-nav-expanded');

    if (hasBetterCanvas || isNavExpanded) {
        coeusLinkGlobal.innerHTML = `${svgIcon} Coeus AI`;
    } else {
        coeusLinkGlobal.innerHTML = svgIcon;
    }
}

// Function to inject the Coeus button into the Canvas menu
function injectCoeusButton() {
    const menuUl = document.getElementById('menu'); // Standard Canvas navigation menu ID

    if (!menuUl) {
        console.log("Canvas menu 'ul#menu' not found. Coeus button not injected.");
        // As a fallback, or for testing, create a floating button if menu is not found
        const fallbackButton = document.createElement('button');
        fallbackButton.textContent = 'Coeus AI';
        fallbackButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483646;
            padding: 10px 15px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;
        fallbackButton.onclick = toggleCoeusChat;
        document.body.appendChild(fallbackButton);
        console.log("Injected fallback Coeus AI button.");
        return;
    }

    // Check if the button already exists
    if (document.getElementById('coeus-menu-button')) {
        console.log("Coeus AI menu button already exists.");
        // Ensure text is updated even if button exists (e.g. on page navigation that doesn't reload script)
        coeusLinkGlobal = document.getElementById('coeus-menu-button').querySelector('a');
        if (coeusLinkGlobal) {
            updateCoeusLinkText();
        }
        return;
    }

    const coeusLi = document.createElement('li');
    coeusLi.id = 'coeus-menu-button';
    coeusLi.className = 'menu-item ic-app-header__menu-list-item';
    // Default display style
    coeusLi.style.display = 'block';

    const coeusLink = document.createElement('a'); // Using <a> for semantic correctness in a menu
    coeusLinkGlobal = coeusLink; // Assign to global for observer
    coeusLink.href = '#'; // Prevent navigation
    coeusLink.className = 'ic-app-header__menu-list-link'; // Standard Canvas class for links in menu
    
    updateCoeusLinkText(); // Set initial text based on conditions
    
    coeusLink.onclick = (e) => {
        e.preventDefault();
        toggleCoeusChat();
    };

    coeusLi.appendChild(coeusLink);
    menuUl.appendChild(coeusLi);
    console.log("Coeus AI button injected into menu.");

    // BetterCanvas compatibility: Ensure the button remains visible
    // Check if BetterCanvas's specific container exists
    if (document.getElementById('bettercanvas-sidebar-courses-container')) {
        console.log("BetterCanvas detected. Ensuring Coeus AI button visibility.");
        // Force display: block !important to override BetterCanvas styles if it hides generic menu items
        coeusLi.style.setProperty('display', 'block', 'important');
        
        // Additionally, ensure other properties that BetterCanvas might alter are respected or overridden if necessary.
        // For now, focusing on display. If BetterCanvas uses opacity, visibility, or moves elements,
        // further specific overrides might be needed.
        // e.g., coeusLi.style.setProperty('opacity', '1', 'important');
        // e.g., coeusLi.style.setProperty('visibility', 'visible', 'important');
    }
}

// Inject the button when the page is fully loaded
window.addEventListener('load', () => {
    injectCoeusButton();

    // Observe body class changes for primary-nav-expanded
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                updateCoeusLinkText();
            }
        }
    });

    observer.observe(document.body, { attributes: true });
});

// Listen for messages from the background script (optional, can be kept for other functionalities)
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message === "injectOverlay") { // This message can now be re-purposed or removed if not needed
            toggleCoeusChat(); // Or injectCoeusButton() if you want to re-trigger button injection
            sendResponse({message: "Coeus chat toggled or button injected!"});
        } else if (request.action === "getCanvasUrl") {
            // Extract Canvas URL from current page
            const hostname = window.location.hostname;
            if (hostname.includes('instructure.com')) {
                sendResponse({ canvasUrl: hostname });
            } else {
                sendResponse({ canvasUrl: null });
            }
        }
    }
);
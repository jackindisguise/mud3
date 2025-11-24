const output = document.getElementById("output");
const input = document.getElementById("input");
const status = document.getElementById("status");
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Generate Matrix katakana rain
function generateMatrixRain() {
	const matrixRain = document.getElementById("matrix-rain");
	if (!matrixRain || matrixRain.classList.contains("hidden")) return;

	// Katakana characters
	const katakana =
		"アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

	// Clear existing content
	matrixRain.innerHTML = "";

	// Create columns of falling characters
	const columnCount = Math.floor(window.innerWidth / 20);
	for (let i = 0; i < columnCount; i++) {
		const column = document.createElement("div");
		column.style.position = "absolute";
		column.style.left = `${(i * 100) / columnCount}%`;
		column.style.width = `${100 / columnCount}%`;
		column.style.fontSize = "14px";
		column.style.color = "#00ff41";
		column.style.opacity = Math.random() * 0.5 + 0.1;
		column.style.animation = `matrix-rain ${
			Math.random() * 2 + 2
		}s linear infinite`;
		column.style.animationDelay = `${Math.random() * 2}s`;

		// Generate random katakana string
		let text = "";
		for (let j = 0; j < 30; j++) {
			text += katakana[Math.floor(Math.random() * katakana.length)] + "<br>";
		}
		column.innerHTML = text;

		matrixRain.appendChild(column);
	}
}

// Generate Cyberpunk lines
function generateCyberpunkLines() {
	const cyberpunkLines = document.getElementById("cyberpunk-lines");
	if (!cyberpunkLines || cyberpunkLines.classList.contains("hidden")) return;

	cyberpunkLines.innerHTML = "";

	// Create multiple animated lines
	for (let i = 0; i < 5; i++) {
		const line = document.createElement("div");
		line.style.position = "absolute";
		line.style.left = `${Math.random() * 100}%`;
		line.style.width = "2px";
		line.style.height = `${Math.random() * 100 + 50}px`;
		line.style.background = `linear-gradient(to bottom, transparent, #ff00ff, transparent)`;
		line.style.opacity = Math.random() * 0.3 + 0.2;
		line.style.boxShadow = "0 0 10px #ff00ff, 0 0 20px #ff00ff";
		line.style.animation = `cyberpunk-line ${
			Math.random() * 4 + 6
		}s linear infinite`;
		line.style.animationDelay = `${Math.random() * 4}s`;
		line.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;

		cyberpunkLines.appendChild(line);
	}
}

function connect() {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const wsUrl = protocol + "//" + window.location.host;

	ws = new WebSocket(wsUrl);

	ws.onopen = () => {
		status.textContent = "Connected";
		status.className = "connected";
		reconnectAttempts = 0;
		addLine("Connected to MUD server.", "color-lime");
	};

	ws.onmessage = (event) => {
		const html = event.data;
		// Server sends HTML wrapped in <div class='line'> or <div class='prompt'>
		// Create a temporary container to parse the HTML
		const temp = document.createElement("div");
		temp.innerHTML = html;
		const element = temp.firstElementChild;
		if (element) {
			output.appendChild(element);
			output.scrollTop = output.scrollHeight;
		}
	};

	ws.onclose = () => {
		status.textContent = "Disconnected";
		status.className = "disconnected";
		addLine("Disconnected from server.", "color-crimson");

		if (reconnectAttempts < maxReconnectAttempts) {
			reconnectAttempts++;
			setTimeout(connect, 2000);
		}
	};

	ws.onerror = (error) => {
		addLine("Connection error.", "color-crimson");
	};
}

function addLine(text, className = "") {
	const line = document.createElement("div");
	line.className = "line";
	if (className) {
		line.className += " " + className;
	}
	line.textContent = text;
	output.appendChild(line);
	output.scrollTop = output.scrollHeight;
}

function echo(text) {
	addLine(text, "echo");
}

// Hotkey mappings for numpad keys
const hotkeys = {
	Numpad8: "north",
	Numpad6: "east",
	Numpad4: "west",
	Numpad2: "south",
	Numpad7: "northwest",
	Numpad9: "northeast",
	Numpad1: "southwest",
	Numpad3: "southeast",
	Numpad5: "look",
	NumpadSubtract: "up",
	NumpadAdd: "down",
};

// Handle hotkeys - bypass input entirely
input.addEventListener("keydown", (e) => {
	const command = hotkeys[e.code];
	if (command && ws && ws.readyState === WebSocket.OPEN) {
		e.preventDefault();
		echo(command);
		ws.send(command);
	}
});

input.addEventListener("keypress", (e) => {
	if (e.key === "Enter" && ws && ws.readyState === WebSocket.OPEN) {
		const command = input.value;
		echo(command);
		ws.send(command);
		// Keep the command in the input and highlight it
		input.setSelectionRange(0, command.length);
	}
});

// Theme selection
const themesBtn = document.getElementById("themes-btn");
const themesMenu = document.getElementById("themes-menu");
const themeOptions = document.querySelectorAll(".theme-option");

themesBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	themesMenu.classList.toggle("hidden");
});

// Close theme dropdown when clicking outside
document.addEventListener("click", (e) => {
	if (!themesMenu.contains(e.target) && e.target !== themesBtn) {
		themesMenu.classList.add("hidden");
	}
});

themeOptions.forEach((option) => {
	option.addEventListener("click", () => {
		const theme = option.getAttribute("data-theme");
		document.body.setAttribute("data-theme", theme);
		themesMenu.classList.add("hidden");
		// Save preference
		localStorage.setItem("mud-theme", theme);

		// Show/hide theme effects
		const matrixRain = document.getElementById("matrix-rain");
		const cyberpunkLines = document.getElementById("cyberpunk-lines");

		if (theme === "matrix") {
			matrixRain.classList.remove("hidden");
			cyberpunkLines.classList.add("hidden");
			setTimeout(generateMatrixRain, 100);
		} else if (theme === "cyberpunk") {
			matrixRain.classList.add("hidden");
			cyberpunkLines.classList.remove("hidden");
			setTimeout(generateCyberpunkLines, 100);
		} else {
			matrixRain.classList.add("hidden");
			cyberpunkLines.classList.add("hidden");
		}
	});
});

// Load saved theme preference
const savedTheme = localStorage.getItem("mud-theme");
if (savedTheme) {
	document.body.setAttribute("data-theme", savedTheme);

	// Show/hide theme effects based on saved theme
	const matrixRain = document.getElementById("matrix-rain");
	const cyberpunkLines = document.getElementById("cyberpunk-lines");

	if (savedTheme === "matrix") {
		matrixRain.classList.remove("hidden");
		cyberpunkLines.classList.add("hidden");
		setTimeout(generateMatrixRain, 100);
	} else if (savedTheme === "cyberpunk") {
		matrixRain.classList.add("hidden");
		cyberpunkLines.classList.remove("hidden");
		setTimeout(generateCyberpunkLines, 100);
	} else {
		matrixRain.classList.add("hidden");
		cyberpunkLines.classList.add("hidden");
	}
}

// Font selection
const fontsBtn = document.getElementById("fonts-btn");
const fontsMenu = document.getElementById("fonts-menu");
const fontOptions = document.querySelectorAll(".font-option");

fontsBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	fontsMenu.classList.toggle("hidden");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
	if (!fontsMenu.contains(e.target) && e.target !== fontsBtn) {
		fontsMenu.classList.add("hidden");
	}
});

fontOptions.forEach((option) => {
	option.addEventListener("click", () => {
		const font = option.getAttribute("data-font");
		document.body.style.fontFamily = font;
		fontsMenu.classList.add("hidden");
		// Save preference
		localStorage.setItem("mud-font", font);
	});
});

// Load saved font preference
const savedFont = localStorage.getItem("mud-font");
if (savedFont) {
	document.body.style.fontFamily = savedFont;
}

// Initialize theme effects
generateMatrixRain();
generateCyberpunkLines();

// Regenerate effects on window resize
window.addEventListener("resize", () => {
	generateMatrixRain();
	generateCyberpunkLines();
});

// Auto-focus input
input.focus();

// Focus input when clicking on output window
output.addEventListener("click", () => {
	input.focus();
});

// Focus input when window regains focus (e.g., tabbing back into it)
window.addEventListener("focus", () => {
	input.focus();
});

// Connect on load
connect();

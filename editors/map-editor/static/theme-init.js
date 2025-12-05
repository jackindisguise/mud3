// Apply theme immediately from localStorage to prevent flash
// This runs synchronously in the head before page render
(function () {
	try {
		const savedTheme = localStorage.getItem("theme") || "dark";
		// Use querySelector to find the link element
		const themeStylesheet = document.querySelector("link#theme-stylesheet");
		if (themeStylesheet && savedTheme === "light") {
			themeStylesheet.href = "./static/light.css";
		}
	} catch (e) {
		// Fallback: theme will be applied by app.js
	}
})();

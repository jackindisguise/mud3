// Helpfile Editor Application
// Uses js-yaml for parsing (loaded via local script tag in index.html)

const API_BASE = ""; // Same origin

class HelpfileEditor {
	constructor() {
		this.api = window.helpfileEditorAPI || null;
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;

		this.init();
	}

	init() {
		this.setupEventListeners();
		this.loadHelpfiles();
	}

	setupEventListeners() {
		// Add button
		document.getElementById("add-helpfile-btn").addEventListener("click", () => {
			this.showNewHelpfileModal();
		});

		// Cancel/Delete buttons (save is handled by form submit)
		document.getElementById("cancel-btn").addEventListener("click", () => {
			this.cancelEdit();
		});

		document.getElementById("delete-btn").addEventListener("click", () => {
			this.deleteCurrent();
		});

		// Form changes
		document.getElementById("helpfile-form").addEventListener("input", () => {
			this.isDirty = true;
		});

		// Form submission
		document
			.getElementById("helpfile-form")
			.addEventListener("submit", (e) => {
				e.preventDefault();
				this.saveCurrent();
			});

		// Add alias/related/topic buttons
		document.getElementById("add-alias-btn").addEventListener("click", () => {
			this.addListItem("aliases");
		});

		document.getElementById("add-related-btn").addEventListener("click", () => {
			this.addListItem("related");
		});

		document.getElementById("add-topic-btn").addEventListener("click", () => {
			this.addListItem("topics");
		});

		// New helpfile modal
		document
			.getElementById("new-helpfile-create")
			.addEventListener("click", () => {
				this.createNewHelpfile();
			});

		document
			.getElementById("new-helpfile-cancel")
			.addEventListener("click", () => {
				this.closeNewHelpfileModal();
			});

		document
			.getElementById("new-helpfile-close")
			.addEventListener("click", () => {
				this.closeNewHelpfileModal();
			});

		// Theme toggle
		document
			.getElementById("theme-toggle-btn")
			.addEventListener("click", () => {
				this.toggleTheme();
			});

		// Help modal
		document.getElementById("help-btn").addEventListener("click", () => {
			document.getElementById("help-modal").classList.add("active");
		});

		document.getElementById("help-close").addEventListener("click", () => {
			document.getElementById("help-modal").classList.remove("active");
		});

		document.getElementById("help-close-btn").addEventListener("click", () => {
			document.getElementById("help-modal").classList.remove("active");
		});

		// Close modals on background click
		document.querySelectorAll(".modal").forEach((modal) => {
			modal.addEventListener("click", (e) => {
				if (e.target === modal) {
					modal.classList.remove("active");
				}
			});
		});
	}

	async loadHelpfiles() {
		try {
			let data;
			if (this.api) {
				// Use Electron API
				data = await this.api.listHelpfiles();
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/helpfiles`);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}

			// Ensure data has helpfiles array
			if (!data || !data.helpfiles) {
				console.error("Invalid response:", data);
				throw new Error(
					`Invalid response format: expected { helpfiles: [...] }`
				);
			}

			this.renderHelpfileList(data.helpfiles);
		} catch (error) {
			console.error("Error loading helpfiles:", error);
			this.showToast(`Failed to load helpfiles: ${error.message}`, "error");
		}
	}

	renderHelpfileList(helpfiles) {
		const listElement = document.getElementById("helpfile-list");
		if (!listElement) {
			console.error("List element not found: #helpfile-list");
			return;
		}

		listElement.innerHTML = "";

		if (!helpfiles || !Array.isArray(helpfiles)) {
			console.error("Invalid helpfiles array:", helpfiles);
			listElement.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--base0);">Error loading helpfiles</div>`;
			return;
		}

		if (helpfiles.length === 0) {
			listElement.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--base0);">No helpfiles found.</div>`;
			return;
		}

		helpfiles.forEach((id) => {
			const item = document.createElement("div");
			item.className = "template-item";
			item.dataset.id = id;
			item.innerHTML = `
				<div class="template-item-content">
					<h3>${id}</h3>
				</div>
			`;
			item.addEventListener("click", () => {
				this.loadHelpfile(id);
			});
			listElement.appendChild(item);
		});
	}

	async loadHelpfile(id) {
		try {
			let data;
			if (this.api) {
				// Use Electron API
				data = await this.api.getHelpfile(id);
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/helpfiles/${id}`);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}
			this.currentId = id;
			this.currentYaml = data.yaml;
			this.isDirty = false;
			this.showEditor(data.yaml);

			// Update selection in list
			document
				.querySelectorAll("#helpfile-list .template-item")
				.forEach((item) => {
					item.classList.remove("selected");
					if (item.dataset.id === id) {
						item.classList.add("selected");
					}
				});
		} catch (error) {
			this.showToast(`Failed to load helpfile ${id}: ${error.message}`, "error");
		}
	}

	showEditor(yaml) {
		try {
			const parsed = jsyaml.load(yaml);
			const helpfile = parsed;

			// Basic fields
			document.getElementById("helpfile-keyword").value = helpfile.keyword || "";
			document.getElementById("helpfile-content").value = helpfile.content || "";

			// Arrays
			this.renderList("aliases", helpfile.aliases || []);
			this.renderList("related", helpfile.related || []);
			this.renderList("topics", helpfile.topic || []);

			document.getElementById("no-selection").style.display = "none";
			document.getElementById("helpfile-editor").style.display = "block";
			this.isDirty = false;
		} catch (error) {
			console.error("Error parsing YAML:", error);
			this.showToast(`Error loading helpfile: ${error.message}`, "error");
		}
	}

	showNoSelection() {
		document.getElementById("no-selection").style.display = "block";
		document.getElementById("helpfile-editor").style.display = "none";
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
	}

	renderList(listType, items) {
		const container = document.getElementById(`${listType}-list`);
		container.innerHTML = "";

		items.forEach((item, index) => {
			const itemDiv = document.createElement("div");
			itemDiv.style.display = "flex";
			itemDiv.style.gap = "0.5rem";
			itemDiv.style.marginBottom = "0.5rem";
			itemDiv.style.alignItems = "center";

			const input = document.createElement("input");
			input.type = "text";
			input.value = item;
			input.style.flex = "1";
			input.style.padding = "0.5rem";
			input.style.background = "var(--base02)";
			input.style.border = "1px solid var(--base01)";
			input.style.borderRadius = "4px";
			input.style.color = "var(--base1)";
			input.dataset.index = index;
			input.addEventListener("input", () => {
				this.isDirty = true;
			});

			const deleteBtn = document.createElement("button");
			deleteBtn.textContent = "×";
			deleteBtn.type = "button";
			deleteBtn.style.background = "transparent";
			deleteBtn.style.border = "none";
			deleteBtn.style.color = "var(--red)";
			deleteBtn.style.cursor = "pointer";
			deleteBtn.style.fontSize = "1.5rem";
			deleteBtn.style.lineHeight = "1";
			deleteBtn.style.padding = "0";
			deleteBtn.style.width = "2rem";
			deleteBtn.style.height = "2rem";
			deleteBtn.style.display = "flex";
			deleteBtn.style.alignItems = "center";
			deleteBtn.style.justifyContent = "center";
			deleteBtn.title = "Remove item";
			deleteBtn.addEventListener("click", () => {
				this.removeListItem(listType, index);
			});

			itemDiv.appendChild(input);
			itemDiv.appendChild(deleteBtn);
			container.appendChild(itemDiv);
		});
	}

	addListItem(listType) {
		const items = this.getListItems(listType);
		items.push("");
		this.renderList(listType, items);
		this.isDirty = true;
	}

	removeListItem(listType, index) {
		const items = this.getListItems(listType);
		items.splice(index, 1);
		this.renderList(listType, items);
		this.isDirty = true;
	}

	getListItems(listType) {
		const container = document.getElementById(`${listType}-list`);
		const inputs = container.querySelectorAll("input");
		return Array.from(inputs).map((input) => input.value.trim()).filter((v) => v);
	}

	formToYaml() {
		// Ensure keyword matches the current ID (filename)
		const helpfile = {
			keyword: this.currentId,
			content: document.getElementById("helpfile-content").value,
		};

		const aliases = this.getListItems("aliases");
		if (aliases.length > 0) {
			helpfile.aliases = aliases;
		}

		const related = this.getListItems("related");
		if (related.length > 0) {
			helpfile.related = related;
		}

		const topics = this.getListItems("topics");
		if (topics.length > 0) {
			helpfile.topic = topics;
		}

		return jsyaml.dump(helpfile);
	}

	async saveCurrent() {
		if (!this.currentId) return;

		// Validate form
		if (!document.getElementById("helpfile-form").checkValidity()) {
			document.getElementById("helpfile-form").reportValidity();
			return;
		}

		try {
			const yamlContent = this.formToYaml();

			// Validate YAML can be parsed back
			jsyaml.load(yamlContent);

			const payload = { id: this.currentId, yaml: yamlContent };

			if (this.api) {
				// Use Electron API
				await this.api.updateHelpfile(payload);
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/helpfiles/${this.currentId}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to save");
				}
			}

			// Reload to update currentYaml
			const reloaded = await (this.api
				? this.api.getHelpfile(this.currentId)
				: fetch(`${API_BASE}/api/helpfiles/${this.currentId}`).then((r) =>
						r.json()
				  ));
			this.currentYaml = reloaded.yaml;
			this.isDirty = false;
			this.showToast(`Saved helpfile ${this.currentId}`, "success");
		} catch (error) {
			this.showToast(`Failed to save: ${error.message}`, "error");
		}
	}

	cancelEdit() {
		if (this.currentYaml) {
			this.showEditor(this.currentYaml);
		} else {
			this.showNoSelection();
		}
	}

	async deleteCurrent() {
		if (!this.currentId) return;

		if (
			!confirm(
				`Are you sure you want to delete helpfile "${this.currentId}"? This cannot be undone.`
			)
		) {
			return;
		}

		try {
			if (this.api) {
				// Use Electron API
				await this.api.deleteHelpfile(this.currentId);
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/helpfiles/${this.currentId}`,
					{
						method: "DELETE",
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to delete");
				}
			}

			this.showToast(`Deleted helpfile ${this.currentId}`, "success");
			this.showNoSelection();
			this.loadHelpfiles();
		} catch (error) {
			this.showToast(`Failed to delete: ${error.message}`, "error");
		}
	}

	showNewHelpfileModal() {
		document.getElementById("new-helpfile-modal").classList.add("active");
		document.getElementById("new-helpfile-keyword").value = "";
		document.getElementById("new-helpfile-keyword").focus();
	}

	closeNewHelpfileModal() {
		document.getElementById("new-helpfile-modal").classList.remove("active");
	}

	async createNewHelpfile() {
		const keyword = document.getElementById("new-helpfile-keyword").value.trim();
		if (!keyword) {
			this.showToast("Please enter a helpfile keyword", "error");
			return;
		}

		if (!/^[a-z0-9_-]+$/.test(keyword)) {
			this.showToast(
				"Keyword must contain only lowercase letters, numbers, hyphens, and underscores",
				"error"
			);
			return;
		}

		// Create default YAML structure
		const defaultYaml = `keyword: ${keyword}
content: |-
  ${keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/-/g, " ")} - Help File

  This is a help file for ${keyword}.

  Usage:
    help ${keyword}

  Description:
    Add your help content here.
`;

		try {
			const payload = { id: keyword, yaml: defaultYaml };

			if (this.api) {
				// Use Electron API
				await this.api.createHelpfile(payload);
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/helpfiles/${keyword}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to create");
				}
			}

			this.closeNewHelpfileModal();
			this.showToast(`Created helpfile ${keyword}`, "success");
			this.loadHelpfiles();
			this.loadHelpfile(keyword);
		} catch (error) {
			this.showToast(`Failed to create: ${error.message}`, "error");
		}
	}

	toggleTheme() {
		const themeStylesheet = document.getElementById("theme-stylesheet");
		const currentTheme = localStorage.getItem("theme") || "dark";
		const newTheme = currentTheme === "dark" ? "light" : "dark";

		themeStylesheet.href = `./static/${newTheme}.css`;
		localStorage.setItem("theme", newTheme);

		// Animate button
		const btn = document.getElementById("theme-toggle-btn");
		btn.classList.add("spinning");
		setTimeout(() => {
			btn.classList.remove("spinning");
			btn.textContent = newTheme === "dark" ? "🌙" : "☀️";
		}, 600);
	}

	showToast(message, type = "info") {
		const container = document.getElementById("toast-container");
		const toast = document.createElement("div");
		toast.className = "toast";

		const title =
			type === "error" ? "Error" : type === "success" ? "Success" : "Info";
		toast.innerHTML = `
			<div class="toast-content">
				<div class="toast-title">${title}</div>
				<div class="toast-details">${message}</div>
			</div>
		`;

		container.appendChild(toast);

		setTimeout(() => {
			toast.remove();
		}, 3000);
	}
}

// Initialize editor when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	new HelpfileEditor();
});


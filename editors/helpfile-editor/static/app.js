// Helpfile Editor Application
// Uses js-yaml for parsing (loaded via local script tag in index.html)

const API_BASE = ""; // Same origin

class HelpfileEditor {
	constructor() {
		this.api = window.helpfileEditorAPI || null;
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
		this.allHelpfiles = []; // Store all helpfile IDs for dropdown
		this.allHelpfileData = {}; // Store all helpfile keywords and aliases for uniqueness checking
		this.allTopics = {}; // Store all topics with their usage counts
		this.keywordToHelpfileId = {}; // Map keywords/aliases to helpfile IDs for related dropdown

		this.init();
	}

	init() {
		this.setupEventListeners();
		this.loadHelpfiles();
	}

	setupEventListeners() {
		// Add button
		document
			.getElementById("add-helpfile-btn")
			.addEventListener("click", () => {
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

		// Content preview - update as user types
		const contentTextarea = document.getElementById("helpfile-content");
		contentTextarea.addEventListener("input", () => {
			this.updatePreview();
		});

		// Form submission
		document.getElementById("helpfile-form").addEventListener("submit", (e) => {
			e.preventDefault();
			this.saveCurrent();
		});

		// Aliases tag input
		const aliasesInput = document.getElementById("aliases-input");
		aliasesInput.addEventListener("keydown", (e) => {
			if (e.key === "Tab") {
				e.preventDefault();
				const value = aliasesInput.value.trim();
				if (value) {
					this.addAliasTag(value);
					aliasesInput.value = "";
				}
			} else if (e.key === "Backspace" && aliasesInput.value === "") {
				// Remove last tag if input is empty and backspace is pressed
				const tags = document.querySelectorAll("#aliases-tag-input .alias-tag");
				if (tags.length > 0) {
					const lastTag = tags[tags.length - 1];
					const aliasId = lastTag.dataset.aliasId;
					this.removeAliasTag(aliasId);
				}
			}
		});
		aliasesInput.addEventListener("input", () => {
			this.isDirty = true;
		});

		// Related dropdown
		const relatedDropdown = document.getElementById("related-dropdown");
		relatedDropdown.addEventListener("change", (e) => {
			const helpfileId = e.target.value;
			if (helpfileId) {
				// helpfileId is already the actual ID (not an alias), so use it directly
				this.addRelatedTag(helpfileId);
				e.target.value = ""; // Reset dropdown
				this.updateRelatedDropdown(); // Update dropdown to remove selected item
			}
		});

		// Topics dropdown
		const topicsDropdown = document.getElementById("topics-dropdown");
		topicsDropdown.addEventListener("change", (e) => {
			const topic = e.target.value;
			if (topic) {
				this.addTopicTag(topic);
				e.target.value = ""; // Reset dropdown
				this.updateTopicsDropdown(); // Update dropdown to reflect current selections
			}
		});

		// Topics tag input
		const topicsInput = document.getElementById("topics-input");
		topicsInput.addEventListener("keydown", (e) => {
			if (e.key === "Tab") {
				e.preventDefault();
				const value = topicsInput.value.trim();
				if (value) {
					this.addTopicTag(value);
					topicsInput.value = "";
					this.updateTopicsDropdown(); // Update dropdown after adding new topic
				}
			} else if (e.key === "Backspace" && topicsInput.value === "") {
				// Remove last tag if input is empty and backspace is pressed
				const tags = document.querySelectorAll("#topics-tag-input .topic-tag");
				if (tags.length > 0) {
					const lastTag = tags[tags.length - 1];
					const topicId = lastTag.dataset.topicId;
					this.removeTopicTag(topicId);
					this.updateTopicsDropdown(); // Update dropdown after removing topic
				}
			}
		});
		topicsInput.addEventListener("input", () => {
			this.isDirty = true;
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

			this.allHelpfiles = data.helpfiles;
			this.renderHelpfileList(data.helpfiles);
			this.updateRelatedDropdown();
			await this.loadAllHelpfileData(); // Load all helpfile data for uniqueness checking
		} catch (error) {
			console.error("Error loading helpfiles:", error);
			this.showToast(`Failed to load helpfiles: ${error.message}`, "error");
		}
	}

	async loadAllHelpfileData() {
		// Load all helpfiles to get their keywords, aliases, and topics
		this.allHelpfileData = {};
		this.allTopics = {};
		this.keywordToHelpfileId = {};
		for (const id of this.allHelpfiles) {
			try {
				let data;
				if (this.api) {
					data = await this.api.getHelpfile(id);
				} else {
					const response = await fetch(`${API_BASE}/api/helpfiles/${id}`);
					if (!response.ok) continue;
					data = await response.json();
				}
				const parsed = jsyaml.load(data.yaml);
				const keywords = [parsed.keyword || id]; // Include the main keyword
				if (parsed.aliases && Array.isArray(parsed.aliases)) {
					keywords.push(...parsed.aliases);
				}
				this.allHelpfileData[id] = keywords;

				// Map all keywords and aliases to helpfile ID for related dropdown
				for (const keyword of keywords) {
					if (keyword && keyword.trim()) {
						this.keywordToHelpfileId[keyword.trim().toLowerCase()] = id;
					}
				}

				// Collect topics with counts
				if (parsed.topic && Array.isArray(parsed.topic)) {
					for (const topic of parsed.topic) {
						if (topic && topic.trim()) {
							const topicKey = topic.trim();
							this.allTopics[topicKey] = (this.allTopics[topicKey] || 0) + 1;
						}
					}
				}
			} catch (error) {
				console.error(
					`Error loading helpfile ${id} for uniqueness check:`,
					error
				);
			}
		}
		this.updateTopicsDropdown();
	}

	updateTopicsDropdown() {
		const dropdown = document.getElementById("topics-dropdown");
		// Clear existing options except the first placeholder
		dropdown.innerHTML =
			'<option value="">-- Select an existing topic --</option>';

		// Get currently selected topics
		const selectedTopics = this.getTopics();

		// Sort topics by usage count (descending), then alphabetically
		const sortedTopics = Object.entries(this.allTopics)
			.filter(([topic]) => !selectedTopics.includes(topic)) // Exclude already-selected topics
			.sort((a, b) => {
				// First sort by count (descending)
				if (b[1] !== a[1]) {
					return b[1] - a[1];
				}
				// Then sort alphabetically
				return a[0].localeCompare(b[0]);
			});

		// Add topics as options with count
		sortedTopics.forEach(([topic, count]) => {
			const option = document.createElement("option");
			option.value = topic;
			option.textContent = `${topic} (${count})`;
			dropdown.appendChild(option);
		});
	}

	updateRelatedDropdown() {
		const dropdown = document.getElementById("related-dropdown");
		// Clear existing options except the first placeholder
		dropdown.innerHTML = '<option value="">-- Select a helpfile --</option>';

		// Get currently selected related helpfiles (by ID)
		const selectedRelated = this.getRelated();

		// Create a map of helpfile ID to all its keywords/aliases for display
		const helpfileOptions = {};
		for (const id of this.allHelpfiles) {
			if (id === this.currentId || selectedRelated.includes(id)) {
				continue; // Skip current helpfile and already-selected ones
			}
			const keywords = this.allHelpfileData[id] || [id];
			const mainKeyword = keywords[0] || id;
			const aliases = keywords.slice(1);

			// Store options with main keyword and aliases
			if (!helpfileOptions[id]) {
				helpfileOptions[id] = {
					mainKeyword,
					aliases: [],
				};
			}
			helpfileOptions[id].aliases = aliases;
		}

		// Collect all options (aliases and keywords) for sorting
		const allOptions = [];
		Object.entries(helpfileOptions).forEach(
			([id, { mainKeyword, aliases }]) => {
				// Add all aliases as options
				aliases.forEach((alias) => {
					allOptions.push({
						id,
						displayText: alias,
						isAlias: true,
					});
				});
				// Add keyword as option
				allOptions.push({
					id,
					displayText: mainKeyword,
					isAlias: false,
				});
			}
		);

		// Sort all options alphabetically by display text
		allOptions.sort((a, b) => a.displayText.localeCompare(b.displayText));

		// Add all options to dropdown
		allOptions.forEach(({ id, displayText }) => {
			const option = document.createElement("option");
			option.value = id;
			option.textContent = displayText;
			dropdown.appendChild(option);
		});
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
			await this.loadAllHelpfileData(); // Reload all helpfile data after loading a helpfile

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
			this.showToast(
				`Failed to load helpfile ${id}: ${error.message}`,
				"error"
			);
		}
	}

	showEditor(yaml) {
		try {
			const parsed = jsyaml.load(yaml);
			const helpfile = parsed;

			// Basic fields
			document.getElementById("helpfile-keyword").value =
				helpfile.keyword || "";
			document.getElementById("helpfile-content").value =
				helpfile.content || "";

			// Arrays
			this.renderAliases(helpfile.aliases || []);
			this.renderRelated(helpfile.related || []);
			this.renderTopics(helpfile.topic || []);
			this.updateRelatedDropdown(); // Update dropdown after loading helpfile
			this.updateTopicsDropdown(); // Update topics dropdown after loading helpfile
			this.updatePreview(); // Update preview after loading helpfile

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
		return Array.from(inputs)
			.map((input) => input.value.trim())
			.filter((v) => v);
	}

	renderAliases(aliases) {
		const container = document.getElementById("aliases-tag-input");
		// Remove all existing tags (but keep the input)
		const existingTags = container.querySelectorAll(".alias-tag");
		existingTags.forEach((tag) => tag.remove());

		// Add tags before the input
		const input = document.getElementById("aliases-input");
		aliases.forEach((alias) => {
			this.addAliasTag(alias, false);
		});
	}

	addAliasTag(alias, markDirty = true) {
		if (!alias || !alias.trim()) return;

		const aliasValue = alias.trim();
		const container = document.getElementById("aliases-tag-input");
		const input = document.getElementById("aliases-input");

		// Check if alias matches the current helpfile's keyword
		if (
			this.currentId &&
			this.currentId.toLowerCase() === aliasValue.toLowerCase()
		) {
			this.showToast(
				`Alias "${aliasValue}" matches the current helpfile's keyword. Aliases must be different from the keyword.`,
				"error"
			);
			return;
		}

		// Check if alias already exists in current helpfile (case-insensitive)
		const existingTags = container.querySelectorAll(".alias-tag");
		for (const tag of existingTags) {
			if (tag.dataset.aliasId.toLowerCase() === aliasValue.toLowerCase()) {
				this.showToast(
					`Alias "${aliasValue}" already exists. Aliases must be unique.`,
					"error"
				);
				return; // Already exists in current helpfile
			}
		}

		// Check if alias conflicts with any other helpfile's keyword or alias
		// (case-insensitive, excluding current helpfile)
		for (const [helpfileId, keywords] of Object.entries(this.allHelpfileData)) {
			if (helpfileId === this.currentId) continue; // Skip current helpfile
			for (const keyword of keywords) {
				if (keyword && keyword.toLowerCase() === aliasValue.toLowerCase()) {
					this.showToast(
						`Alias "${aliasValue}" conflicts with helpfile "${helpfileId}". Keywords and aliases must be unique across all helpfiles.`,
						"error"
					);
					return; // Conflicts with another helpfile
				}
			}
		}

		// Create tag element
		const tag = document.createElement("div");
		tag.className = "alias-tag";
		tag.dataset.aliasId = aliasValue;
		tag.style.cssText = `
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0.5rem;
			background: var(--base03);
			border: 1px solid var(--base01);
			border-radius: 4px;
			color: var(--base1);
			font-size: 0.85rem;
		`;

		const tagText = document.createElement("span");
		tagText.textContent = aliasValue;
		tagText.style.cssText = `
			user-select: none;
		`;

		const deleteBtn = document.createElement("button");
		deleteBtn.textContent = "×";
		deleteBtn.type = "button";
		deleteBtn.style.cssText = `
			background: transparent;
			border: none;
			color: var(--red);
			cursor: pointer;
			font-size: 1.2rem;
			line-height: 1;
			padding: 0;
			width: 1.2rem;
			height: 1.2rem;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		deleteBtn.title = "Remove alias";
		deleteBtn.addEventListener("click", () => {
			this.removeAliasTag(aliasValue);
		});

		tag.appendChild(tagText);
		tag.appendChild(deleteBtn);

		// Insert before the input
		container.insertBefore(tag, input);

		if (markDirty) {
			this.isDirty = true;
		}
	}

	removeAliasTag(aliasId) {
		const container = document.getElementById("aliases-tag-input");
		const tag = container.querySelector(
			`.alias-tag[data-alias-id="${aliasId}"]`
		);
		if (tag) {
			tag.remove();
			this.isDirty = true;
		}
	}

	getAliases() {
		const container = document.getElementById("aliases-tag-input");
		const tags = container.querySelectorAll(".alias-tag");
		return Array.from(tags).map((tag) => tag.dataset.aliasId);
	}

	renderTopics(topics) {
		const container = document.getElementById("topics-tag-input");
		// Remove all existing tags (but keep the input)
		const existingTags = container.querySelectorAll(".topic-tag");
		existingTags.forEach((tag) => tag.remove());

		// Add tags before the input
		const input = document.getElementById("topics-input");
		topics.forEach((topic) => {
			this.addTopicTag(topic, false);
		});
	}

	addTopicTag(topic, markDirty = true) {
		if (!topic || !topic.trim()) return;

		const topicValue = topic.trim();
		const container = document.getElementById("topics-tag-input");
		const input = document.getElementById("topics-input");

		// Check if tag already exists
		const existingTags = container.querySelectorAll(".topic-tag");
		for (const tag of existingTags) {
			if (tag.dataset.topicId === topicValue) {
				return; // Already exists
			}
		}

		// Create tag element
		const tag = document.createElement("div");
		tag.className = "topic-tag";
		tag.dataset.topicId = topicValue;
		tag.style.cssText = `
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0.5rem;
			background: var(--base03);
			border: 1px solid var(--base01);
			border-radius: 4px;
			color: var(--base1);
			font-size: 0.85rem;
		`;

		const tagText = document.createElement("span");
		tagText.textContent = topicValue;
		tagText.style.cssText = `
			user-select: none;
		`;

		const deleteBtn = document.createElement("button");
		deleteBtn.textContent = "×";
		deleteBtn.type = "button";
		deleteBtn.style.cssText = `
			background: transparent;
			border: none;
			color: var(--red);
			cursor: pointer;
			font-size: 1.2rem;
			line-height: 1;
			padding: 0;
			width: 1.2rem;
			height: 1.2rem;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		deleteBtn.title = "Remove topic";
		deleteBtn.addEventListener("click", () => {
			this.removeTopicTag(topicValue);
		});

		tag.appendChild(tagText);
		tag.appendChild(deleteBtn);

		// Insert before the input
		container.insertBefore(tag, input);

		if (markDirty) {
			this.isDirty = true;
		}
	}

	removeTopicTag(topicId) {
		const container = document.getElementById("topics-tag-input");
		const tag = container.querySelector(
			`.topic-tag[data-topic-id="${topicId}"]`
		);
		if (tag) {
			tag.remove();
			this.isDirty = true;
			this.updateTopicsDropdown(); // Update dropdown to add back removed topic
		}
	}

	getTopics() {
		const container = document.getElementById("topics-tag-input");
		const tags = container.querySelectorAll(".topic-tag");
		return Array.from(tags).map((tag) => tag.dataset.topicId);
	}

	renderRelated(related) {
		const container = document.getElementById("related-tag-input");
		// Remove all existing tags
		container.innerHTML = "";

		// Add tags - related contains helpfile IDs (keywords)
		// Display aliases if available, otherwise show keyword
		related.forEach((helpfileId) => {
			this.addRelatedTag(helpfileId, false);
		});
	}

	addRelatedTag(helpfileId, markDirty = true) {
		if (!helpfileId || !helpfileId.trim()) return;

		const relatedId = helpfileId.trim();
		const container = document.getElementById("related-tag-input");

		// Check if tag already exists (by helpfile ID)
		const existingTags = container.querySelectorAll(".related-tag");
		for (const tag of existingTags) {
			if (tag.dataset.relatedId === relatedId) {
				return; // Already exists
			}
		}

		// Don't allow adding the current helpfile as related to itself
		if (relatedId === this.currentId) {
			this.showToast(
				"Cannot add the current helpfile as related to itself",
				"error"
			);
			return;
		}

		// Get display text: prefer first alias, otherwise use keyword
		const keywords = this.allHelpfileData[relatedId] || [relatedId];
		const displayText = keywords.length > 1 ? keywords[1] : keywords[0];

		// Create tag element
		const tag = document.createElement("div");
		tag.className = "related-tag";
		tag.dataset.relatedId = relatedId; // Store helpfile ID internally
		tag.style.cssText = `
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0.5rem;
			background: var(--base03);
			border: 1px solid var(--base01);
			border-radius: 4px;
			color: var(--base1);
			font-size: 0.85rem;
		`;

		const tagText = document.createElement("span");
		tagText.textContent = displayText; // Display alias or keyword
		tagText.style.cssText = `
			user-select: none;
		`;

		const deleteBtn = document.createElement("button");
		deleteBtn.textContent = "×";
		deleteBtn.type = "button";
		deleteBtn.style.cssText = `
			background: transparent;
			border: none;
			color: var(--red);
			cursor: pointer;
			font-size: 1.2rem;
			line-height: 1;
			padding: 0;
			width: 1.2rem;
			height: 1.2rem;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		deleteBtn.title = "Remove related helpfile";
		deleteBtn.addEventListener("click", () => {
			this.removeRelatedTag(relatedId);
		});

		tag.appendChild(tagText);
		tag.appendChild(deleteBtn);

		container.appendChild(tag);

		if (markDirty) {
			this.isDirty = true;
		}
	}

	removeRelatedTag(helpfileId) {
		const container = document.getElementById("related-tag-input");
		const tag = container.querySelector(
			`.related-tag[data-related-id="${helpfileId}"]`
		);
		if (tag) {
			tag.remove();
			this.isDirty = true;
			this.updateRelatedDropdown(); // Update dropdown to add back removed item
		}
	}

	getRelated() {
		const container = document.getElementById("related-tag-input");
		const tags = container.querySelectorAll(".related-tag");
		return Array.from(tags).map((tag) => tag.dataset.relatedId);
	}

	formToYaml() {
		// Ensure keyword matches the current ID (filename)
		const helpfile = {
			keyword: this.currentId,
		};

		const aliases = this.getAliases();
		if (aliases.length > 0) {
			helpfile.aliases = aliases;
		}

		const related = this.getRelated();
		if (related.length > 0) {
			helpfile.related = related;
		}

		const topics = this.getTopics();
		if (topics.length > 0) {
			helpfile.topic = topics;
		}

		// Content is always last
		helpfile.content = document.getElementById("helpfile-content").value;

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
			await this.loadAllHelpfileData(); // Reload all helpfile data after saving (includes topics)
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
			await this.loadHelpfiles();
			await this.loadAllHelpfileData(); // Reload all helpfile data after deleting
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
		const keyword = document
			.getElementById("new-helpfile-keyword")
			.value.trim();
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
  ${
		keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/-/g, " ")
	} - Help File

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
			await this.loadHelpfiles();
			await this.loadHelpfile(keyword);
			await this.loadAllHelpfileData(); // Reload all helpfile data after creating
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

	updatePreview() {
		const previewElement = document.getElementById("helpfile-preview");
		const contentTextarea = document.getElementById("helpfile-content");
		const keyword = this.currentId || "KEYWORD";

		if (!previewElement || !contentTextarea) return;

		const content = contentTextarea.value || "";
		const lines = content.split("\n");

		// Box dimensions: 80 chars total, 1 char border each side, 1 char padding each side
		// Internal width: 80 - 1 (left border) - 1 (left padding) - 1 (right padding) - 1 (right border) = 76
		const boxWidth = 80;
		const internalWidth = 76; // 80 - 2 (borders) - 2 (padding) = 76

		// Create preview similar to in-game display
		// Title (keyword in uppercase, centered in a box-like format)
		const title = keyword.toUpperCase();
		const titlePadding = Math.max(
			0,
			Math.floor((internalWidth - title.length - 2) / 2)
		);
		const titleLine =
			"─".repeat(titlePadding) +
			" " +
			title +
			" " +
			"─".repeat(internalWidth - title.length - titlePadding - 2);

		// Build preview content
		let preview = "";
		preview += "╭" + "─".repeat(boxWidth - 2) + "╮\n";
		preview += "│ " + titleLine.padEnd(internalWidth) + " │\n";
		preview += "├" + "─".repeat(boxWidth - 2) + "┤\n";

		// Add content lines
		if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
			preview += "│ " + " ".repeat(internalWidth) + " │\n";
		} else {
			lines.forEach((line) => {
				// Wrap long lines at internal width (76 chars)
				if (line.length <= internalWidth) {
					preview += "│ " + line.padEnd(internalWidth) + " │\n";
				} else {
					// Word wrap long lines
					let remaining = line;
					while (remaining.length > internalWidth) {
						let breakPoint = internalWidth;
						// Try to break at a space
						const lastSpace = remaining.lastIndexOf(" ", internalWidth);
						if (lastSpace > internalWidth * 0.7) {
							// Only break at space if it's not too early
							breakPoint = lastSpace;
						}
						preview +=
							"│ " +
							remaining.substring(0, breakPoint).padEnd(internalWidth) +
							" │\n";
						remaining = remaining.substring(breakPoint).trim();
					}
					if (remaining.length > 0) {
						preview += "│ " + remaining.padEnd(internalWidth) + " │\n";
					}
				}
			});
		}

		preview += "╰" + "─".repeat(boxWidth - 2) + "╯";

		previewElement.textContent = preview;
	}
}

// Initialize editor when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	new HelpfileEditor();
});

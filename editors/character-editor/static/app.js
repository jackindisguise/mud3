// Character Editor Application
// Uses js-yaml for parsing (loaded via local script tag in index.html)

const API_BASE = ""; // Same origin

// Available channels
const CHANNELS = [
	"OOC",
	"NEWBIE",
	"TRADE",
	"GOSSIP",
	"GOCIAL",
	"SAY",
	"WHISPER",
];

// Available message groups
const MESSAGE_GROUPS = [
	"INFO",
	"COMBAT",
	"COMMAND_RESPONSE",
	"SYSTEM",
	"CHANNELS",
	"ACTION",
	"PROMPT",
];

class CharacterEditor {
	constructor() {
		this.api = window.characterEditorAPI || null;
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
		this.races = [];
		this.jobs = [];
		this.templates = [];
		this.weaponTypes = [];

		this.init();
	}

	async init() {
		await this.loadRacesAndJobs();
		this.setupEventListeners();
		this.loadCharacters();
	}

	async loadRacesAndJobs() {
		try {
			const [racesData, jobsData, templatesData, weaponTypesData] =
				await Promise.all([
					this.fetchRacesData(),
					this.fetchJobsData(),
					this.fetchAllTemplatesData(),
					this.fetchWeaponTypesData(),
				]);
			this.races = racesData?.races || [];
			this.jobs = jobsData?.jobs || [];
			this.templates = templatesData?.templates || [];
			this.weaponTypes = weaponTypesData?.weaponTypes || [];

			// Populate dropdowns
			this.populateRaceDropdown();
			this.populateJobDropdown();
		} catch (error) {
			console.error("Failed to load races/jobs/templates/weapon types:", error);
		}
	}

	async fetchWeaponTypesData() {
		if (this.api?.getWeaponTypes) {
			return this.api.getWeaponTypes();
		}
		const response = await fetch(`${API_BASE}/api/weapon-types`);
		if (!response.ok) {
			throw new Error(`Failed to load weapon types: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchAllTemplatesData() {
		try {
			if (this.api?.getAllTemplates) {
				const result = await this.api.getAllTemplates();
				console.log("Fetched templates via API:", result);
				return result;
			}
			const response = await fetch(`${API_BASE}/api/templates`);
			if (!response.ok) {
				throw new Error(`Failed to load templates: ${response.statusText}`);
			}
			const data = await response.json();
			console.log("Fetched templates via HTTP:", data);
			return data;
		} catch (error) {
			console.error("Error fetching templates:", error);
			throw error;
		}
	}

	async fetchTemplateData(templateId) {
		try {
			if (this.api?.getTemplate) {
				const result = await this.api.getTemplate(templateId);
				// Electron API returns { template: {...} } or null
				return result;
			}
			const response = await fetch(
				`${API_BASE}/api/templates/${encodeURIComponent(templateId)}`
			);
			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ error: response.statusText }));
				throw new Error(
					error.error || `Failed to load template: ${response.statusText}`
				);
			}
			return response.json();
		} catch (error) {
			console.error("fetchTemplateData error:", error);
			throw error;
		}
	}

	async fetchRacesData() {
		if (this.api?.getRaces) {
			return this.api.getRaces();
		}
		const response = await fetch(`${API_BASE}/api/races`);
		if (!response.ok) {
			throw new Error(`Failed to load races: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchJobsData() {
		if (this.api?.getJobs) {
			return this.api.getJobs();
		}
		const response = await fetch(`${API_BASE}/api/jobs`);
		if (!response.ok) {
			throw new Error(`Failed to load jobs: ${response.statusText}`);
		}
		return response.json();
	}

	populateRaceDropdown() {
		const select = document.getElementById("character-race");
		// Clear existing options except the first one
		while (select.options.length > 1) {
			select.remove(1);
		}

		this.races.forEach((race) => {
			const option = document.createElement("option");
			option.value = race.id;
			option.textContent = race.display || race.id;
			select.appendChild(option);
		});
	}

	populateJobDropdown() {
		const select = document.getElementById("character-job");
		// Clear existing options except the first one
		while (select.options.length > 1) {
			select.remove(1);
		}

		this.jobs.forEach((job) => {
			const option = document.createElement("option");
			option.value = job.id;
			option.textContent = job.display || job.id;
			select.appendChild(option);
		});
	}

	setupEventListeners() {
		// Add button
		document
			.getElementById("add-character-btn")
			.addEventListener("click", () => {
				this.showNewCharacterModal();
			});

		// Cancel/Delete buttons (save is handled by form submit)
		document.getElementById("cancel-btn").addEventListener("click", () => {
			this.cancelEdit();
		});

		document.getElementById("delete-btn").addEventListener("click", () => {
			this.deleteCurrent();
		});

		// Form changes
		document.getElementById("character-form").addEventListener("input", () => {
			this.isDirty = true;
		});

		// Form submission
		document
			.getElementById("character-form")
			.addEventListener("submit", (e) => {
				e.preventDefault();
				this.saveCurrent();
			});

		// Dynamic list buttons
		document
			.getElementById("add-blockedUser-btn")
			.addEventListener("click", () => {
				this.addListItem("blockedUsers");
			});

		document.getElementById("add-ability-btn").addEventListener("click", () => {
			this.addAbility();
		});

		document.getElementById("add-content-btn").addEventListener("click", () => {
			this.addContent();
		});

		// Toggle buttons
		document
			.getElementById("character-isActive-btn")
			.addEventListener("click", () => {
				this.toggleSetting("isActive");
			});

		document
			.getElementById("character-isBanned-btn")
			.addEventListener("click", () => {
				this.toggleSetting("isBanned");
			});

		document
			.getElementById("character-isAdmin-btn")
			.addEventListener("click", () => {
				this.toggleSetting("isAdmin");
			});

		document
			.getElementById("character-receiveOOC-btn")
			.addEventListener("click", () => {
				this.toggleSetting("receiveOOC");
			});

		document
			.getElementById("character-verboseMode-btn")
			.addEventListener("click", () => {
				this.toggleSetting("verboseMode");
			});

		document
			.getElementById("character-colorEnabled-btn")
			.addEventListener("click", () => {
				this.toggleSetting("colorEnabled");
			});

		document
			.getElementById("character-autoLook-btn")
			.addEventListener("click", () => {
				this.toggleSetting("autoLook");
			});

		document
			.getElementById("character-briefMode-btn")
			.addEventListener("click", () => {
				this.toggleSetting("briefMode");
			});

		document
			.getElementById("character-busyModeEnabled-btn")
			.addEventListener("click", () => {
				this.toggleSetting("busyModeEnabled");
			});

		document
			.getElementById("character-combatBusyModeEnabled-btn")
			.addEventListener("click", () => {
				this.toggleSetting("combatBusyModeEnabled");
			});

		document
			.getElementById("character-autoloot-btn")
			.addEventListener("click", () => {
				this.toggleSetting("autoloot");
			});

		document
			.getElementById("character-autosacrifice-btn")
			.addEventListener("click", () => {
				this.toggleSetting("autosacrifice");
			});

		// New character modal
		document
			.getElementById("new-character-create")
			.addEventListener("click", () => {
				this.createNewCharacter();
			});

		document
			.getElementById("new-character-cancel")
			.addEventListener("click", () => {
				this.closeNewCharacterModal();
			});

		document
			.getElementById("new-character-close")
			.addEventListener("click", () => {
				this.closeNewCharacterModal();
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

	async loadCharacters() {
		try {
			let data;
			if (this.api) {
				// Use Electron API
				data = await this.api.listCharacters();
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/characters`);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}

			// Ensure data has characters array
			if (!data || !data.characters) {
				console.error("Invalid response:", data);
				throw new Error(
					`Invalid response format: expected { characters: [...] }`
				);
			}

			this.renderCharacterList(data.characters);
		} catch (error) {
			console.error("Error loading characters:", error);
			this.showToast("Error", `Failed to load characters: ${error.message}`);
		}
	}

	renderCharacterList(characters) {
		const listEl = document.getElementById("character-list");
		listEl.innerHTML = "";

		if (characters.length === 0) {
			listEl.innerHTML =
				'<div style="padding: 1rem; text-align: center; color: var(--base0);">No characters found</div>';
			return;
		}

		characters.forEach((id) => {
			const item = document.createElement("div");
			item.className = "template-item";
			item.dataset.characterId = id;

			item.innerHTML = `
				<div class="template-item-content">
					<h3>${this.escapeHtml(id)}</h3>
				</div>
			`;

			item.addEventListener("click", () => {
				this.selectCharacter(id);
			});

			listEl.appendChild(item);
		});
	}

	async selectCharacter(id) {
		// Remove previous selection
		document.querySelectorAll(".template-item").forEach((item) => {
			item.classList.remove("selected");
		});

		// Mark as selected
		const item = document.querySelector(`[data-character-id="${id}"]`);
		if (item) {
			item.classList.add("selected");
		}

		try {
			let data;
			if (this.api) {
				// Use Electron API
				data = await this.api.getCharacter(id);
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/characters/${encodeURIComponent(id)}`
				);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}

			this.currentId = id;
			this.currentYaml = data.yaml;
			this.isDirty = false;

			// Show editor
			document.getElementById("no-selection").style.display = "none";
			document.getElementById("character-editor").style.display = "block";
			document.getElementById(
				"editor-title"
			).textContent = `Edit Character: ${this.escapeHtml(id)}`;

			// Parse YAML and populate form
			this.showEditor(data.yaml);
		} catch (error) {
			console.error("Error loading character:", error);
			this.showToast("Error", `Failed to load character: ${error.message}`);
		}
	}

	showEditor(yaml) {
		try {
			const parsed = jsyaml.load(yaml);
			const char = parsed;

			// Credentials
			document.getElementById("character-username").value =
				char.credentials?.username || "";
			document.getElementById("character-characterId").value =
				char.credentials?.characterId || 0;
			document.getElementById("character-passwordHash").value =
				char.credentials?.passwordHash || "";

			// Convert ISO strings to datetime-local format
			if (char.credentials?.createdAt) {
				const createdAt = new Date(char.credentials.createdAt);
				document.getElementById("character-createdAt").value =
					this.formatDateTimeLocal(createdAt);
			}
			if (char.credentials?.lastLogin) {
				const lastLogin = new Date(char.credentials.lastLogin);
				document.getElementById("character-lastLogin").value =
					this.formatDateTimeLocal(lastLogin);
			}

			// Credentials toggles
			this.setToggle("isActive", char.credentials?.isActive || false);
			this.setToggle("isBanned", char.credentials?.isBanned || false);
			this.setToggle("isAdmin", char.credentials?.isAdmin || false);

			// Settings
			this.setToggle("receiveOOC", char.settings?.receiveOOC || false);
			this.setToggle("verboseMode", char.settings?.verboseMode || false);
			document.getElementById("character-prompt").value =
				char.settings?.prompt || "";
			this.setToggle("colorEnabled", char.settings?.colorEnabled || false);
			this.setToggle("autoLook", char.settings?.autoLook || false);
			this.setToggle("briefMode", char.settings?.briefMode || false);
			document.getElementById("character-echoMode").value =
				char.settings?.echoMode || "client";
			this.setToggle(
				"busyModeEnabled",
				char.settings?.busyModeEnabled || false
			);
			this.setToggle(
				"combatBusyModeEnabled",
				char.settings?.combatBusyModeEnabled || false
			);
			this.setToggle("autoloot", char.settings?.autoloot || false);
			this.setToggle("autosacrifice", char.settings?.autosacrifice || false);

			// Channels - render toggle buttons
			const channels = char.settings?.channels
				? Array.isArray(char.settings.channels)
					? char.settings.channels
					: Array.from(char.settings.channels || [])
				: [];
			this.renderToggleButtons("channels", CHANNELS, channels);

			// Blocked users - keep as list
			this.renderList(
				"blockedUsers",
				char.settings?.blockedUsers
					? Array.isArray(char.settings.blockedUsers)
						? char.settings.blockedUsers
						: Array.from(char.settings.blockedUsers || [])
					: []
			);

			// Busy forwarded groups - render toggle buttons
			const busyForwardedGroups = char.settings?.busyForwardedGroups
				? Array.isArray(char.settings.busyForwardedGroups)
					? char.settings.busyForwardedGroups
					: Array.from(char.settings.busyForwardedGroups || [])
				: [];
			this.renderToggleButtons(
				"busyForwardedGroups",
				MESSAGE_GROUPS,
				busyForwardedGroups
			);

			// Combat busy forwarded groups - render toggle buttons
			const combatBusyForwardedGroups = char.settings?.combatBusyForwardedGroups
				? Array.isArray(char.settings.combatBusyForwardedGroups)
					? char.settings.combatBusyForwardedGroups
					: Array.from(char.settings.combatBusyForwardedGroups || [])
				: [];
			this.renderToggleButtons(
				"combatBusyForwardedGroups",
				MESSAGE_GROUPS,
				combatBusyForwardedGroups
			);

			// Stats
			document.getElementById("character-playtime").value =
				char.stats?.playtime || 0;
			document.getElementById("character-deaths").value =
				char.stats?.deaths || 0;
			document.getElementById("character-kills").value = char.stats?.kills || 0;

			// Mob
			document.getElementById("character-oid").value = char.mob?.oid || 0;
			document.getElementById("character-keywords").value =
				char.mob?.keywords || "";
			document.getElementById("character-display").value =
				char.mob?.display || "";
			document.getElementById("character-location").value =
				char.mob?.location || "";
			document.getElementById("character-level").value = char.mob?.level || 1;
			document.getElementById("character-experience").value =
				char.mob?.experience || 0;
			document.getElementById("character-race").value = char.mob?.race || "";
			document.getElementById("character-job").value = char.mob?.job || "";
			document.getElementById("character-health").value = char.mob?.health || 0;
			document.getElementById("character-mana").value = char.mob?.mana || 0;

			// Learned abilities (object with key-value pairs)
			this.renderAbilities(char.mob?.learnedAbilities || {});

			// Contents (inventory items)
			this.renderContents(char.mob?.contents || []);

			this.isDirty = false;
		} catch (error) {
			console.error("Error parsing YAML:", error);
			this.showToast("Error", `Error loading character: ${error.message}`);
		}
	}

	formatDateTimeLocal(date) {
		if (!date) return "";
		const d = new Date(date);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const hours = String(d.getHours()).padStart(2, "0");
		const minutes = String(d.getMinutes()).padStart(2, "0");
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	parseDateTimeLocal(value) {
		if (!value) return null;
		return new Date(value).toISOString();
	}

	renderToggleButtons(containerId, allOptions, selectedOptions) {
		const container = document.getElementById(`${containerId}-container`);
		container.innerHTML = "";

		allOptions.forEach((option) => {
			const isSelected = selectedOptions.includes(option);
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = `toggle-btn ${
				isSelected ? "toggle-btn-enabled" : "toggle-btn-disabled"
			}`;
			btn.dataset.enabled = isSelected ? "true" : "false";
			btn.dataset.option = option;
			btn.textContent = option;
			btn.addEventListener("click", () => {
				this.toggleOption(containerId, option);
			});
			container.appendChild(btn);
		});
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

	toggleOption(containerId, option) {
		const container = document.getElementById(`${containerId}-container`);
		const btn = container.querySelector(`[data-option="${option}"]`);
		if (!btn) return;

		const currentValue = btn.dataset.enabled === "true";
		const newValue = !currentValue;

		btn.dataset.enabled = newValue ? "true" : "false";
		if (newValue) {
			btn.classList.add("toggle-btn-enabled");
			btn.classList.remove("toggle-btn-disabled");
		} else {
			btn.classList.add("toggle-btn-disabled");
			btn.classList.remove("toggle-btn-enabled");
		}

		this.isDirty = true;
	}

	getToggleOptions(containerId) {
		const container = document.getElementById(`${containerId}-container`);
		if (!container) return [];

		const buttons = container.querySelectorAll("button[data-option]");
		const selected = [];
		buttons.forEach((btn) => {
			if (btn.dataset.enabled === "true") {
				selected.push(btn.dataset.option);
			}
		});
		return selected;
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

	renderAbilities(abilities) {
		const container = document.getElementById("learnedAbilities-list");
		container.innerHTML = "";

		Object.entries(abilities).forEach(([abilityId, level], index) => {
			const itemDiv = document.createElement("div");
			itemDiv.style.display = "flex";
			itemDiv.style.gap = "0.5rem";
			itemDiv.style.marginBottom = "0.5rem";
			itemDiv.style.alignItems = "center";

			const abilityInput = document.createElement("input");
			abilityInput.type = "text";
			abilityInput.value = abilityId;
			abilityInput.placeholder = "Ability ID";
			abilityInput.style.flex = "1";
			abilityInput.style.padding = "0.5rem";
			abilityInput.style.background = "var(--base02)";
			abilityInput.style.border = "1px solid var(--base01)";
			abilityInput.style.borderRadius = "4px";
			abilityInput.style.color = "var(--base1)";
			abilityInput.dataset.index = index;
			abilityInput.addEventListener("input", () => {
				this.isDirty = true;
			});

			const levelInput = document.createElement("input");
			levelInput.type = "number";
			levelInput.value = level;
			levelInput.min = "0";
			levelInput.placeholder = "Level";
			levelInput.style.width = "100px";
			levelInput.style.padding = "0.5rem";
			levelInput.style.background = "var(--base02)";
			levelInput.style.border = "1px solid var(--base01)";
			levelInput.style.borderRadius = "4px";
			levelInput.style.color = "var(--base1)";
			levelInput.dataset.index = index;
			levelInput.addEventListener("input", () => {
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
			deleteBtn.title = "Remove ability";
			deleteBtn.addEventListener("click", () => {
				this.removeAbility(index);
			});

			itemDiv.appendChild(abilityInput);
			itemDiv.appendChild(levelInput);
			itemDiv.appendChild(deleteBtn);
			container.appendChild(itemDiv);
		});
	}

	addAbility() {
		const abilities = this.getAbilities();
		abilities.push({ id: "", level: 0 });
		this.renderAbilities(
			abilities.reduce((acc, ab) => {
				if (ab.id) acc[ab.id] = ab.level;
				return acc;
			}, {})
		);
		this.isDirty = true;
	}

	removeAbility(index) {
		const abilities = this.getAbilities();
		abilities.splice(index, 1);
		this.renderAbilities(
			abilities.reduce((acc, ab) => {
				if (ab.id) acc[ab.id] = ab.level;
				return acc;
			}, {})
		);
		this.isDirty = true;
	}

	getAbilities() {
		const container = document.getElementById("learnedAbilities-list");
		const rows = container.querySelectorAll("div");
		return Array.from(rows).map((row) => {
			const abilityInput = row.querySelector('input[type="text"]');
			const levelInput = row.querySelector('input[type="number"]');
			return {
				id: abilityInput?.value.trim() || "",
				level: parseInt(levelInput?.value || "0", 10) || 0,
			};
		});
	}

	async saveCurrent() {
		if (!this.currentId) return;

		try {
			const yaml = this.formToYaml();

			// Validate YAML can be parsed back
			jsyaml.load(yaml);

			if (this.api) {
				// Use Electron API
				await this.api.updateCharacter({ id: this.currentId, yaml });
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/characters/${encodeURIComponent(this.currentId)}`,
					{
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ yaml }),
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to save");
				}
			}

			// Reload to update currentYaml
			const reloaded = await (this.api
				? this.api.getCharacter(this.currentId)
				: fetch(
						`${API_BASE}/api/characters/${encodeURIComponent(this.currentId)}`
				  ).then((r) => r.json()));
			this.currentYaml = reloaded.yaml;
			this.isDirty = false;
			this.showToast("Success", "Character saved successfully");
		} catch (error) {
			console.error("Error saving character:", error);
			this.showToast("Error", `Failed to save character: ${error.message}`);
		}
	}

	formToYaml() {
		const char = {
			version: "1.0.0",
			credentials: {
				characterId:
					parseInt(document.getElementById("character-characterId").value) || 0,
				username: document.getElementById("character-username").value,
				passwordHash: document.getElementById("character-passwordHash").value,
				createdAt: this.parseDateTimeLocal(
					document.getElementById("character-createdAt").value
				),
				lastLogin: this.parseDateTimeLocal(
					document.getElementById("character-lastLogin").value
				),
				isActive: this.getToggle("isActive"),
				isBanned: this.getToggle("isBanned"),
				isAdmin: this.getToggle("isAdmin"),
			},
			settings: {
				receiveOOC: this.getToggle("receiveOOC"),
				verboseMode: this.getToggle("verboseMode"),
				prompt: document.getElementById("character-prompt").value,
				colorEnabled: this.getToggle("colorEnabled"),
				autoLook: this.getToggle("autoLook"),
				briefMode: this.getToggle("briefMode"),
				echoMode: document.getElementById("character-echoMode").value,
				busyModeEnabled: this.getToggle("busyModeEnabled"),
				combatBusyModeEnabled: this.getToggle("combatBusyModeEnabled"),
				autoloot: this.getToggle("autoloot"),
				autosacrifice: this.getToggle("autosacrifice"),
			},
			stats: {
				playtime:
					parseInt(document.getElementById("character-playtime").value) || 0,
				deaths:
					parseInt(document.getElementById("character-deaths").value) || 0,
				kills: parseInt(document.getElementById("character-kills").value) || 0,
			},
			mob: {
				oid: parseInt(document.getElementById("character-oid").value) || 0,
				keywords: document.getElementById("character-keywords").value,
				display: document.getElementById("character-display").value,
				location: document.getElementById("character-location").value,
				level: parseInt(document.getElementById("character-level").value) || 1,
				race: document.getElementById("character-race").value,
				job: document.getElementById("character-job").value,
				health:
					parseInt(document.getElementById("character-health").value) || 0,
				mana: parseInt(document.getElementById("character-mana").value) || 0,
				learnedAbilities: {},
			},
		};

		// Add arrays only if they have items
		const channels = this.getToggleOptions("channels");
		if (channels.length > 0) {
			char.settings.channels = channels;
		}

		const blockedUsers = this.getListItems("blockedUsers");
		if (blockedUsers.length > 0) {
			char.settings.blockedUsers = blockedUsers;
		}

		const busyForwardedGroups = this.getToggleOptions("busyForwardedGroups");
		if (busyForwardedGroups.length > 0) {
			char.settings.busyForwardedGroups = busyForwardedGroups;
		}

		const combatBusyForwardedGroups = this.getToggleOptions(
			"combatBusyForwardedGroups"
		);
		if (combatBusyForwardedGroups.length > 0) {
			char.settings.combatBusyForwardedGroups = combatBusyForwardedGroups;
		}

		// Add experience if set
		const experience = parseInt(
			document.getElementById("character-experience").value
		);
		if (experience > 0) {
			char.mob.experience = experience;
		}

		// Add learned abilities
		const abilities = this.getAbilities();
		abilities.forEach((ab) => {
			if (ab.id) {
				char.mob.learnedAbilities[ab.id] = ab.level;
			}
		});

		// Only include learnedAbilities if it has entries
		if (Object.keys(char.mob.learnedAbilities).length === 0) {
			char.mob.learnedAbilities = {};
		}

		// Add contents (inventory items)
		const contents = this.getContents();
		if (contents.length > 0) {
			char.mob.contents = contents;
		}

		return jsyaml.dump(char, { lineWidth: 120, noRefs: true });
	}

	renderContents(contents) {
		const container = document.getElementById("contents-list");
		container.innerHTML = "";

		contents.forEach((item, index) => {
			const itemDiv = document.createElement("div");
			itemDiv.style.padding = "1rem";
			itemDiv.style.marginBottom = "0.5rem";
			itemDiv.style.background = "var(--base02)";
			itemDiv.style.border = "1px solid var(--base01)";
			itemDiv.style.borderRadius = "4px";
			itemDiv.style.position = "relative";
			itemDiv.dataset.index = index;

			// Delete button
			const deleteBtn = document.createElement("button");
			deleteBtn.textContent = "×";
			deleteBtn.type = "button";
			deleteBtn.style.position = "absolute";
			deleteBtn.style.top = "0.5rem";
			deleteBtn.style.right = "0.5rem";
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
				this.removeContent(index);
			});

			// Helper to create form field
			const createField = (
				labelText,
				fieldName,
				fieldType = "text",
				value = "",
				options = {}
			) => {
				const group = document.createElement("div");
				group.className = "form-group";
				group.style.marginBottom = "0.5rem";
				group.dataset.fieldGroup = fieldName;

				const label = document.createElement("label");
				label.textContent = labelText + ":";
				label.style.display = "block";
				label.style.marginBottom = "0.25rem";

				let input;
				if (fieldType === "select") {
					input = document.createElement("select");
					if (options.options) {
						options.options.forEach((opt) => {
							const option = document.createElement("option");
							option.value = opt.value;
							option.textContent = opt.text;
							if (opt.value === value) option.selected = true;
							input.appendChild(option);
						});
					}
				} else if (fieldType === "textarea") {
					input = document.createElement("textarea");
					input.rows = options.rows || 2;
					input.style.resize = "vertical";
				} else if (fieldType === "number") {
					input = document.createElement("input");
					input.type = "number";
					if (options.min !== undefined) input.min = options.min;
					if (options.step !== undefined) input.step = options.step;
				} else if (fieldType === "checkbox") {
					input = document.createElement("input");
					input.type = "checkbox";
					input.checked = value === true || value === "true";
				} else {
					input = document.createElement("input");
					input.type = fieldType;
				}

				if (fieldType !== "checkbox" && fieldType !== "select") {
					input.value = value || "";
				}

				input.style.width = "100%";
				input.style.padding = "0.5rem";
				input.style.background = "var(--base03)";
				input.style.border = "1px solid var(--base01)";
				input.style.borderRadius = "4px";
				input.style.color = "var(--base1)";
				input.dataset.index = index;
				input.dataset.field = fieldName;
				input.addEventListener("input", () => {
					this.isDirty = true;
				});
				if (fieldType === "select") {
					input.addEventListener("change", () => {
						this.isDirty = true;
					});
				}

				group.appendChild(label);
				group.appendChild(input);

				return group;
			};

			// Type
			const typeGroup = createField(
				"Type",
				"type",
				"select",
				item.type || "Item",
				{
					options: [
						{ value: "DungeonObject", text: "DungeonObject" },
						{ value: "Item", text: "Item" },
						{ value: "Equipment", text: "Equipment" },
						{ value: "Armor", text: "Armor" },
						{ value: "Weapon", text: "Weapon" },
					],
				}
			);
			const typeSelect = typeGroup.querySelector('select[data-field="type"]');
			typeSelect.addEventListener("change", () => {
				this.updateContentFields(itemDiv, typeSelect.value);
				this.isDirty = true;
			});

			// Template ID as dropdown
			const templateGroup = document.createElement("div");
			templateGroup.className = "form-group";
			templateGroup.style.marginBottom = "0.5rem";
			templateGroup.dataset.fieldGroup = "templateId";

			const templateLabel = document.createElement("label");
			templateLabel.textContent = "Template:";
			templateLabel.style.display = "block";
			templateLabel.style.marginBottom = "0.25rem";

			const templateSelect = document.createElement("select");
			templateSelect.style.width = "100%";
			templateSelect.style.padding = "0.5rem";
			templateSelect.style.background = "var(--base03)";
			templateSelect.style.border = "1px solid var(--base01)";
			templateSelect.style.borderRadius = "4px";
			templateSelect.style.color = "var(--base1)";
			templateSelect.dataset.index = index;
			templateSelect.dataset.field = "templateId";

			// Add empty option
			const emptyOption = document.createElement("option");
			emptyOption.value = "";
			emptyOption.textContent = "-- No Template --";
			templateSelect.appendChild(emptyOption);

			// Populate with templates
			// Filter to only show item-related templates (Item, Equipment, Armor, Weapon)
			const itemTemplateTypes = ["Item", "Equipment", "Armor", "Weapon"];
			console.log(
				"Populating template dropdown, templates available:",
				this.templates?.length || 0
			);
			if (this.templates && this.templates.length > 0) {
				const itemTemplates = this.templates.filter((t) =>
					itemTemplateTypes.includes(t.type)
				);
				itemTemplates.forEach((template) => {
					const option = document.createElement("option");
					option.value = template.id;
					option.textContent = `${template.display} (${template.type})`;
					if (item.templateId === template.id) {
						option.selected = true;
					}
					templateSelect.appendChild(option);
				});
			} else {
				console.warn(
					"No templates available when rendering content item, attempting to reload..."
				);
				// Try to reload templates if they're not available
				this.loadRacesAndJobs()
					.then(() => {
						console.log(
							"Templates reloaded, count:",
							this.templates?.length || 0
						);
						// Re-populate dropdown
						templateSelect.innerHTML = "";
						const emptyOption = document.createElement("option");
						emptyOption.value = "";
						emptyOption.textContent = "-- No Template --";
						templateSelect.appendChild(emptyOption);

						if (this.templates && this.templates.length > 0) {
							const itemTemplates = this.templates.filter((t) =>
								itemTemplateTypes.includes(t.type)
							);
							itemTemplates.forEach((template) => {
								const option = document.createElement("option");
								option.value = template.id;
								option.textContent = `${template.display} (${template.type})`;
								if (item.templateId === template.id) {
									option.selected = true;
								}
								templateSelect.appendChild(option);
							});
						}
					})
					.catch((error) => {
						console.error("Failed to reload templates:", error);
					});
			}

			// Auto-load template when selected
			templateSelect.addEventListener("change", async () => {
				const templateId = templateSelect.value.trim();
				if (!templateId) {
					this.isDirty = true;
					return;
				}
				await this.loadTemplateIntoContent(itemDiv, templateId);
			});

			templateGroup.appendChild(templateLabel);
			templateGroup.appendChild(templateSelect);

			// Base fields (always shown)
			const keywordsGroup = createField(
				"Keywords",
				"keywords",
				"text",
				item.keywords || ""
			);
			const displayGroup = createField(
				"Display",
				"display",
				"text",
				item.display || ""
			);
			const descGroup = createField(
				"Description",
				"description",
				"textarea",
				item.description || ""
			);

			itemDiv.appendChild(deleteBtn);
			itemDiv.appendChild(typeGroup);
			itemDiv.appendChild(templateGroup);
			itemDiv.appendChild(keywordsGroup);
			itemDiv.appendChild(displayGroup);
			itemDiv.appendChild(descGroup);

			// Add subtype-specific fields based on current type
			this.updateContentFields(itemDiv, item.type || "Item");

			// Load template if one is already set (after fields are created)
			if (item.templateId) {
				// Load template after fields are created
				setTimeout(() => {
					this.loadTemplateIntoContent(itemDiv, item.templateId);
				}, 150);
			}

			container.appendChild(itemDiv);
		});
	}

	async loadTemplateIntoContent(itemDiv, templateId) {
		if (!templateId) return;

		try {
			console.log("Loading template:", templateId);
			const data = await this.fetchTemplateData(templateId);
			console.log("Template data received:", data);

			// Handle both response formats: { template: {...} } or direct template object
			const template = data?.template || data;
			if (
				template &&
				(template.keywords || template.display || template.type)
			) {
				// Populate fields from template
				const keywordsInput = itemDiv.querySelector(
					'input[data-field="keywords"]'
				);
				const displayInput = itemDiv.querySelector(
					'input[data-field="display"]'
				);
				const descInput = itemDiv.querySelector(
					'textarea[data-field="description"]'
				);
				const typeSelect = itemDiv.querySelector('select[data-field="type"]');

				if (keywordsInput && template.keywords)
					keywordsInput.value = template.keywords;
				if (displayInput && template.display)
					displayInput.value = template.display;
				if (descInput && template.description)
					descInput.value = template.description;
				if (typeSelect && template.type) {
					typeSelect.value = template.type;
					this.updateContentFields(itemDiv, template.type);
				}

				// Wait a tick for fields to be created, then load subtype-specific fields
				setTimeout(() => {
					// Equipment/Item fields
					if (template.slot) {
						const slotInput = itemDiv.querySelector(
							'select[data-field="slot"]'
						);
						if (slotInput) slotInput.value = template.slot;
					}
					if (template.defense !== undefined) {
						const defenseInput = itemDiv.querySelector(
							'input[data-field="defense"]'
						);
						if (defenseInput) defenseInput.value = template.defense;
					}
					if (template.attackPower !== undefined) {
						const attackInput = itemDiv.querySelector(
							'input[data-field="attackPower"]'
						);
						if (attackInput) attackInput.value = template.attackPower;
					}
					if (template.hitType) {
						const hitTypeInput = itemDiv.querySelector(
							'input[data-field="hitType"]'
						);
						if (hitTypeInput) hitTypeInput.value = template.hitType;
					}
					if (template.weaponType) {
						const weaponTypeInput = itemDiv.querySelector(
							'select[data-field="weaponType"]'
						);
						if (weaponTypeInput) weaponTypeInput.value = template.weaponType;
					}

					// Item fields (baseWeight, value, isContainer)
					const weightInput = itemDiv.querySelector(
						'input[data-field="baseWeight"]'
					);
					if (weightInput) {
						weightInput.value =
							template.baseWeight !== undefined ? template.baseWeight : 0;
					}

					const valueInput = itemDiv.querySelector('input[data-field="value"]');
					if (valueInput) {
						valueInput.value =
							template.value !== undefined ? template.value : 0;
					}

					const isContainerBtn = itemDiv.querySelector(
						`button[id^="content-"][id$="-isContainer-btn"]`
					);
					if (isContainerBtn) {
						const isContainer =
							template.isContainer === true || template.isContainer === "true";
						isContainerBtn.dataset.enabled = isContainer ? "true" : "false";
						if (isContainer) {
							isContainerBtn.classList.add("toggle-btn-enabled");
							isContainerBtn.classList.remove("toggle-btn-disabled");
						} else {
							isContainerBtn.classList.add("toggle-btn-disabled");
							isContainerBtn.classList.remove("toggle-btn-enabled");
						}
					}
				}, 0);

				this.isDirty = true;
				this.showToast("Template loaded", "");
			} else {
				console.error("Template data invalid:", data);
				this.showToast("Template not found or invalid", "error");
			}
		} catch (error) {
			console.error("Failed to load template:", error);
			this.showToast(
				`Failed to load template: ${error.message || error}`,
				"error"
			);
		}
	}

	updateContentFields(itemDiv, type) {
		const index = parseInt(itemDiv.dataset.index, 10);
		const existingFields = itemDiv.querySelectorAll("[data-field-group]");

		// Remove existing subtype fields
		existingFields.forEach((field) => {
			const fieldName = field.dataset.fieldGroup;
			if (
				!["type", "templateId", "keywords", "display", "description"].includes(
					fieldName
				)
			) {
				field.remove();
			}
		});

		const createField = (
			labelText,
			fieldName,
			fieldType = "text",
			value = "",
			options = {}
		) => {
			const group = document.createElement("div");
			group.className = "form-group";
			group.style.marginBottom = "0.5rem";
			group.dataset.fieldGroup = fieldName;

			const label = document.createElement("label");
			label.textContent = labelText + ":";
			label.style.display = "block";
			label.style.marginBottom = "0.25rem";

			let input;
			if (fieldType === "select") {
				input = document.createElement("select");
				if (options.options) {
					options.options.forEach((opt) => {
						const option = document.createElement("option");
						option.value = opt.value;
						option.textContent = opt.text;
						if (opt.value === value) option.selected = true;
						input.appendChild(option);
					});
				}
			} else if (fieldType === "number") {
				input = document.createElement("input");
				input.type = "number";
				if (options.min !== undefined) input.min = options.min;
				if (options.step !== undefined) input.step = options.step;
			} else if (fieldType === "checkbox") {
				input = document.createElement("input");
				input.type = "checkbox";
				input.checked = value === true || value === "true";
			} else {
				input = document.createElement("input");
				input.type = fieldType;
			}

			if (fieldType !== "checkbox" && fieldType !== "select") {
				input.value = value || "";
			}

			input.style.width = "100%";
			input.style.padding = "0.5rem";
			input.style.background = "var(--base03)";
			input.style.border = "1px solid var(--base01)";
			input.style.borderRadius = "4px";
			input.style.color = "var(--base1)";
			input.dataset.index = index;
			input.dataset.field = fieldName;
			input.addEventListener("input", () => {
				this.isDirty = true;
			});
			if (fieldType === "select") {
				input.addEventListener("change", () => {
					this.isDirty = true;
				});
			}

			group.appendChild(label);
			group.appendChild(input);

			return group;
		};

		// Get current item data
		const item = this.getContents()[index] || {};

		// Common fields for Item and subtypes
		if (
			type === "Item" ||
			type === "Equipment" ||
			type === "Armor" ||
			type === "Weapon"
		) {
			const baseWeightGroup = createField(
				"Base Weight",
				"baseWeight",
				"number",
				item.baseWeight || "",
				{ min: 0, step: 0.1 }
			);
			const valueGroup = createField(
				"Value",
				"value",
				"number",
				item.value || "",
				{ min: 0 }
			);
			// Is Container as toggle button
			const isContainerGroup = document.createElement("div");
			isContainerGroup.className = "form-group";
			isContainerGroup.style.marginBottom = "0.5rem";
			isContainerGroup.dataset.fieldGroup = "isContainer";

			const isContainerLabel = document.createElement("label");
			isContainerLabel.textContent = "Is Container:";
			isContainerLabel.style.display = "block";
			isContainerLabel.style.marginBottom = "0.25rem";

			const isContainerBtn = document.createElement("button");
			isContainerBtn.type = "button";
			isContainerBtn.id = `content-${index}-isContainer-btn`;
			isContainerBtn.className = "toggle-btn toggle-btn-disabled";
			isContainerBtn.dataset.enabled =
				item.isContainer || false ? "true" : "false";
			isContainerBtn.textContent = "Is Container";
			isContainerBtn.style.minWidth = "120px";

			// Set initial state
			if (item.isContainer) {
				isContainerBtn.classList.add("toggle-btn-enabled");
				isContainerBtn.classList.remove("toggle-btn-disabled");
			} else {
				isContainerBtn.classList.add("toggle-btn-disabled");
				isContainerBtn.classList.remove("toggle-btn-enabled");
			}

			// Add click handler
			isContainerBtn.addEventListener("click", () => {
				const currentState = isContainerBtn.dataset.enabled === "true";
				const newState = !currentState;
				isContainerBtn.dataset.enabled = newState ? "true" : "false";
				if (newState) {
					isContainerBtn.classList.add("toggle-btn-enabled");
					isContainerBtn.classList.remove("toggle-btn-disabled");
				} else {
					isContainerBtn.classList.add("toggle-btn-disabled");
					isContainerBtn.classList.remove("toggle-btn-enabled");
				}
				this.isDirty = true;
			});

			isContainerGroup.appendChild(isContainerLabel);
			isContainerGroup.appendChild(isContainerBtn);

			// Insert before description
			const descGroup = itemDiv.querySelector(
				'[data-field-group="description"]'
			);
			itemDiv.insertBefore(baseWeightGroup, descGroup);
			itemDiv.insertBefore(valueGroup, descGroup);
			itemDiv.insertBefore(isContainerGroup, descGroup);
		}

		// Equipment fields (Equipment, Armor, Weapon)
		if (type === "Equipment" || type === "Armor" || type === "Weapon") {
			const slotOptions = [
				{ value: "head", text: "Head" },
				{ value: "neck", text: "Neck" },
				{ value: "shoulders", text: "Shoulders" },
				{ value: "hands", text: "Hands" },
				{ value: "mainHand", text: "Main Hand" },
				{ value: "offHand", text: "Off Hand" },
				{ value: "finger", text: "Finger" },
				{ value: "chest", text: "Chest" },
				{ value: "waist", text: "Waist" },
				{ value: "legs", text: "Legs" },
				{ value: "feet", text: "Feet" },
			];
			const slotGroup = createField("Slot", "slot", "select", item.slot || "", {
				options: slotOptions,
			});

			// Insert after description
			const descGroup = itemDiv.querySelector(
				'[data-field-group="description"]'
			);
			itemDiv.insertBefore(slotGroup, descGroup.nextSibling);
		}

		// Armor-specific fields
		if (type === "Armor") {
			const defenseGroup = createField(
				"Defense",
				"defense",
				"number",
				item.defense || "",
				{ min: 0 }
			);
			const descGroup = itemDiv.querySelector(
				'[data-field-group="description"]'
			);
			itemDiv.insertBefore(defenseGroup, descGroup.nextSibling);
		}

		// Weapon-specific fields
		if (type === "Weapon") {
			const attackPowerGroup = createField(
				"Attack Power",
				"attackPower",
				"number",
				item.attackPower || "",
				{ min: 0 }
			);
			const hitTypeGroup = createField(
				"Hit Type",
				"hitType",
				"text",
				item.hitType || ""
			);

			// Weapon Type as dropdown
			const weaponTypeOptions = this.weaponTypes.map((wt) => ({
				value: wt,
				text: wt,
			}));
			const weaponTypeGroup = createField(
				"Weapon Type",
				"weaponType",
				"select",
				item.weaponType || "shortsword",
				{ options: weaponTypeOptions }
			);

			const descGroup = itemDiv.querySelector(
				'[data-field-group="description"]'
			);
			itemDiv.insertBefore(attackPowerGroup, descGroup.nextSibling);
			itemDiv.insertBefore(hitTypeGroup, descGroup.nextSibling);
			itemDiv.insertBefore(weaponTypeGroup, descGroup.nextSibling);
		}
	}

	addContent() {
		const contents = this.getContents();
		contents.push({
			type: "Item",
			keywords: "",
			display: "",
			description: "",
		});
		this.renderContents(contents);
		this.isDirty = true;
	}

	removeContent(index) {
		const contents = this.getContents();
		contents.splice(index, 1);
		this.renderContents(contents);
		this.isDirty = true;
	}

	getContents() {
		const container = document.getElementById("contents-list");
		const items = container.querySelectorAll("div[data-index]");
		const contents = [];

		items.forEach((itemDiv) => {
			const getFieldValue = (fieldName, fieldType = "text") => {
				const field = itemDiv.querySelector(`[data-field="${fieldName}"]`);
				if (!field) return undefined;
				if (fieldType === "checkbox") {
					return field.checked;
				}
				if (fieldType === "select") {
					const val = field.value.trim();
					return val === "" ? undefined : val;
				}
				if (fieldType === "number") {
					const val = field.value.trim();
					return val === "" ? undefined : parseFloat(val);
				}
				const val = field.value.trim();
				return val === "" ? undefined : val;
			};

			const type = getFieldValue("type", "select") || "Item";
			const content = {
				type: type,
			};

			// Base fields
			const templateId = getFieldValue("templateId", "select");
			if (templateId) content.templateId = templateId;

			const keywords = getFieldValue("keywords");
			if (keywords) content.keywords = keywords;

			const display = getFieldValue("display");
			if (display) content.display = display;

			const description = getFieldValue("description", "textarea");
			if (description) content.description = description;

			// Item fields
			if (
				type === "Item" ||
				type === "Equipment" ||
				type === "Armor" ||
				type === "Weapon"
			) {
				const baseWeight = getFieldValue("baseWeight", "number");
				if (baseWeight !== undefined) content.baseWeight = baseWeight;

				const value = getFieldValue("value", "number");
				if (value !== undefined) content.value = value;

				const isContainerBtn = itemDiv.querySelector(
					`button[id^="content-"][id$="-isContainer-btn"]`
				);
				if (isContainerBtn && isContainerBtn.dataset.enabled === "true") {
					content.isContainer = true;
				}
			}

			// Equipment fields
			if (type === "Equipment" || type === "Armor" || type === "Weapon") {
				const slot = getFieldValue("slot", "select");
				if (slot) content.slot = slot;
			}

			// Armor fields
			if (type === "Armor") {
				const defense = getFieldValue("defense", "number");
				if (defense !== undefined) content.defense = defense;
			}

			// Weapon fields
			if (type === "Weapon") {
				const attackPower = getFieldValue("attackPower", "number");
				if (attackPower !== undefined) content.attackPower = attackPower;

				const hitType = getFieldValue("hitType");
				if (hitType) content.hitType = hitType;

				const weaponType = getFieldValue("weaponType", "select");
				if (weaponType) content.weaponType = weaponType;
			}

			// Only add if it has at least keywords or display
			if (content.keywords || content.display) {
				contents.push(content);
			}
		});

		return contents;
	}

	cancelEdit() {
		if (this.isDirty) {
			if (
				!confirm("You have unsaved changes. Are you sure you want to cancel?")
			) {
				return;
			}
		}

		// Restore original data if available
		if (this.currentYaml) {
			this.showEditor(this.currentYaml);
		} else {
			// Reset editor
			this.currentId = null;
			this.currentYaml = null;
			this.isDirty = false;

			// Remove selection
			document.querySelectorAll(".template-item").forEach((item) => {
				item.classList.remove("selected");
			});

			// Hide editor
			document.getElementById("no-selection").style.display = "block";
			document.getElementById("character-editor").style.display = "none";
		}
	}

	showNoSelection() {
		document.getElementById("no-selection").style.display = "block";
		document.getElementById("character-editor").style.display = "none";
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
	}

	async deleteCurrent() {
		if (!this.currentId) return;

		if (
			!confirm(
				`Are you sure you want to delete character "${this.currentId}"? This cannot be undone.`
			)
		) {
			return;
		}

		try {
			if (this.api) {
				// Use Electron API
				await this.api.deleteCharacter(this.currentId);
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/characters/${encodeURIComponent(this.currentId)}`,
					{
						method: "DELETE",
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to delete");
				}
			}

			this.showToast("Success", "Character deleted successfully");
			this.cancelEdit();
			this.loadCharacters();
		} catch (error) {
			console.error("Error deleting character:", error);
			this.showToast("Error", `Failed to delete character: ${error.message}`);
		}
	}

	showNewCharacterModal() {
		document.getElementById("new-character-modal").classList.add("active");
		document.getElementById("new-character-username").value = "";
		document.getElementById("new-character-username").focus();
	}

	closeNewCharacterModal() {
		document.getElementById("new-character-modal").classList.remove("active");
	}

	async createNewCharacter() {
		const username = document
			.getElementById("new-character-username")
			.value.trim()
			.toLowerCase();

		if (!username) {
			this.showToast("Error", "Username is required");
			return;
		}

		if (!/^[a-z0-9_-]+$/.test(username)) {
			this.showToast(
				"Error",
				"Username must contain only lowercase letters, numbers, hyphens, and underscores"
			);
			return;
		}

		// Create default character YAML
		const defaultYaml = `version: 1.0.0
credentials:
  characterId: 0
  username: ${username}
  passwordHash: ""
  createdAt: "${new Date().toISOString()}"
  lastLogin: "${new Date().toISOString()}"
  isActive: true
  isBanned: false
  isAdmin: false
settings:
  receiveOOC: true
  verboseMode: true
  prompt: '{R%hh/%HH{rhp {C%mm/%MM{cmana {Y%ee{yexh {C%xp{cxp {B%XX{btnl{x > '
  colorEnabled: true
  autoLook: true
  briefMode: false
  echoMode: client
  busyModeEnabled: false
  combatBusyModeEnabled: true
  busyForwardedGroups:
    - CHANNELS
  combatBusyForwardedGroups:
    - CHANNELS
  autoloot: false
  autosacrifice: false
  channels:
    - OOC
    - GOSSIP
    - GOCIAL
    - SAY
    - WHISPER
  blockedUsers: []
stats:
  playtime: 0
  deaths: 0
  kills: 0
mob:
  oid: 0
  keywords: ${username}
  display: ${username}
  contents: []
  location: '@tower{0,0,0}'
  level: 1
  race: human
  job: warrior
  health: 100
  mana: 50
  learnedAbilities: {}
  effects: []
`;

		try {
			if (this.api) {
				// Use Electron API
				await this.api.createCharacter({ id: username, yaml: defaultYaml });
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/characters`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ id: username, yaml: defaultYaml }),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to create");
				}
			}

			this.closeNewCharacterModal();
			this.showToast("Success", "Character created successfully");
			await this.loadCharacters();
			await this.selectCharacter(username);
		} catch (error) {
			console.error("Error creating character:", error);
			this.showToast("Error", `Failed to create character: ${error.message}`);
		}
	}

	toggleTheme() {
		const btn = document.getElementById("theme-toggle-btn");
		btn.classList.add("spinning");

		const currentStylesheet = document.getElementById("theme-stylesheet");
		const isDark = currentStylesheet.href.includes("dark.css");

		if (isDark) {
			currentStylesheet.href = currentStylesheet.href.replace(
				"dark.css",
				"light.css"
			);
			localStorage.setItem("theme", "light");
		} else {
			currentStylesheet.href = currentStylesheet.href.replace(
				"light.css",
				"dark.css"
			);
			localStorage.setItem("theme", "dark");
		}

		setTimeout(() => {
			btn.classList.remove("spinning");
		}, 600);
	}

	showToast(title, message) {
		const container = document.getElementById("toast-container");
		const toast = document.createElement("div");
		toast.className = "toast";
		toast.innerHTML = `
			<div class="toast-content">
				<div class="toast-title">${this.escapeHtml(title)}</div>
				<div class="toast-details">${this.escapeHtml(message)}</div>
			</div>
		`;

		container.appendChild(toast);

		// Remove after animation
		setTimeout(() => {
			toast.remove();
		}, 3000);
	}

	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	setToggle(settingName, value) {
		const btn = document.getElementById(`character-${settingName}-btn`);
		if (!btn) return;

		btn.dataset.enabled = value ? "true" : "false";

		if (value) {
			btn.classList.add("toggle-btn-enabled");
			btn.classList.remove("toggle-btn-disabled");
		} else {
			btn.classList.add("toggle-btn-disabled");
			btn.classList.remove("toggle-btn-enabled");
		}
	}

	getToggle(settingName) {
		const btn = document.getElementById(`character-${settingName}-btn`);
		if (!btn) return false;
		return btn.dataset.enabled === "true";
	}

	toggleSetting(settingName) {
		const currentValue = this.getToggle(settingName);
		this.setToggle(settingName, !currentValue);
		this.isDirty = true;
	}
}

// Initialize editor when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		new CharacterEditor();
	});
} else {
	new CharacterEditor();
}

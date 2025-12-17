// Archetype Editor Application
// Uses js-yaml for parsing (loaded via local script tag in index.html)

const API_BASE = ""; // Same origin

class ArchetypeEditor {
	constructor() {
		this.api = window.archetypeEditorAPI || null;
		this.currentType = "race"; // "race" or "job"
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
		this.abilitiesMap = new Map(); // Map of ability id -> {id, name}
		this.passivesMap = new Map(); // Map of passive id -> {id, name}

		this.init();
	}

	init() {
		this.setupEventListeners();
		this.loadAbilities();
		this.loadPassives();
		this.loadArchetypes("race");
	}

	setupEventListeners() {
		// Tab switching
		document.querySelectorAll(".tab").forEach((tab) => {
			tab.addEventListener("click", (e) => {
				const tabName = e.target.dataset.tab;
				this.switchTab(tabName);
			});
		});

		// Add buttons
		document.getElementById("add-race-btn").addEventListener("click", () => {
			this.showNewArchetypeModal("race");
		});

		document.getElementById("add-job-btn").addEventListener("click", () => {
			this.showNewArchetypeModal("job");
		});

		// Cancel/Delete buttons (save is handled by form submit)
		document.getElementById("cancel-btn").addEventListener("click", () => {
			this.cancelEdit();
		});

		document.getElementById("delete-btn").addEventListener("click", () => {
			this.deleteCurrent();
		});

		// Form changes
		document.getElementById("archetype-form").addEventListener("input", () => {
			this.isDirty = true;
		});

		// Form submission
		document
			.getElementById("archetype-form")
			.addEventListener("submit", (e) => {
				e.preventDefault();
				this.saveCurrent();
			});

		// Ability dropdown
		document
			.getElementById("ability-dropdown")
			.addEventListener("change", (e) => {
				const abilityId = e.target.value;
				if (abilityId) {
					this.addAbility(abilityId);
					e.target.value = ""; // Reset dropdown
				}
			});

		// Passive dropdown
		document
			.getElementById("passive-dropdown")
			.addEventListener("change", (e) => {
				const passiveId = e.target.value;
				if (passiveId) {
					this.addPassive(passiveId);
					e.target.value = ""; // Reset dropdown
				}
			});

		// Is Starter toggle button
		document
			.getElementById("archetype-is-starter-btn")
			.addEventListener("click", () => {
				this.toggleIsStarter();
			});

		// New archetype modal
		document
			.getElementById("new-archetype-create")
			.addEventListener("click", () => {
				this.createNewArchetype();
			});

		document
			.getElementById("new-archetype-cancel")
			.addEventListener("click", () => {
				this.closeNewArchetypeModal();
			});

		document
			.getElementById("new-archetype-close")
			.addEventListener("click", () => {
				this.closeNewArchetypeModal();
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

	switchTab(tabName) {
		// Update tabs
		document.querySelectorAll(".tab").forEach((tab) => {
			tab.classList.remove("active");
		});
		document
			.querySelector(`.tab[data-tab="${tabName}"]`)
			.classList.add("active");

		// Update tab content
		document.querySelectorAll(".tab-content").forEach((content) => {
			content.classList.remove("active");
		});
		document.getElementById(`${tabName}-tab`).classList.add("active");

		// Update current type (normalize for consistency)
		this.currentType = tabName === "jobs" ? "job" : tabName;

		// Clear selection
		this.currentId = null;
		this.showNoSelection();

		// Load archetypes for the selected tab
		this.loadArchetypes(tabName);
	}

	async loadArchetypes(type) {
		try {
			// Normalize type: "jobs" -> "job", "races" -> "race"
			const normalizedType = type === "jobs" ? "job" : type;
			let data;
			if (this.api) {
				// Use Electron API
				try {
					if (normalizedType === "race") {
						data = await this.api.listRaces();
					} else {
						data = await this.api.listJobs();
					}
				} catch (apiError) {
					console.error(`Electron API error for ${type}:`, apiError);
					throw new Error(`API error: ${apiError.message || String(apiError)}`);
				}
			} else {
				// Use HTTP fetch
				const response = await fetch(`${API_BASE}/api/${normalizedType}s`);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}

			// Ensure data has archetypes array
			if (!data || !data.archetypes) {
				console.error(`Invalid response for ${type}:`, data);
				throw new Error(
					`Invalid response format: expected { archetypes: [...] }`
				);
			}

			this.renderArchetypeList(type, data.archetypes);
		} catch (error) {
			console.error(`Error loading ${type}:`, error);
			this.showToast(`Failed to load ${type}: ${error.message}`, "error");
		}
	}

	renderArchetypeList(type, archetypes) {
		// Map type to correct element ID (jobs -> job-list, races -> race-list)
		const listId = type === "jobs" ? "job-list" : `${type}-list`;
		const listElement = document.getElementById(listId);
		if (!listElement) {
			console.error(`List element not found: #${listId}`);
			return;
		}

		listElement.innerHTML = "";

		if (!archetypes || !Array.isArray(archetypes)) {
			console.error(`Invalid archetypes array for ${type}:`, archetypes);
			listElement.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--base0);">Error loading ${type}s</div>`;
			return;
		}

		if (archetypes.length === 0) {
			listElement.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--base0);">No ${type}s found.</div>`;
			return;
		}

		archetypes.forEach((id) => {
			const item = document.createElement("div");
			item.className = "template-item";
			item.dataset.id = id;
			item.innerHTML = `
				<div class="template-item-content">
					<h3>${id}</h3>
				</div>
			`;
			item.addEventListener("click", () => {
				this.loadArchetype(type, id);
			});
			listElement.appendChild(item);
		});
	}

	async loadArchetype(type, id) {
		try {
			// Normalize type: "jobs" -> "job", "races" -> "race"
			const normalizedType = type === "jobs" ? "job" : type;
			let data;
			if (this.api) {
				// Use Electron API
				if (normalizedType === "race") {
					data = await this.api.getRace(id);
				} else {
					data = await this.api.getJob(id);
				}
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/${normalizedType}s/${id}`
				);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to load");
				}
				data = await response.json();
			}
			this.currentType = normalizedType; // Store normalized type for API calls
			this.currentId = id;
			this.currentYaml = data.yaml;
			this.isDirty = false;
			this.showEditor(data.yaml);

			// Update selection in list
			const listId = type === "jobs" ? "job-list" : `${type}-list`;
			document.querySelectorAll(`#${listId} .template-item`).forEach((item) => {
				item.classList.remove("selected");
				if (item.dataset.id === id) {
					item.classList.add("selected");
				}
			});
		} catch (error) {
			this.showToast(`Failed to load ${type} ${id}: ${error.message}`, "error");
		}
	}

	showEditor(yaml) {
		try {
			const parsed = jsyaml.load(yaml);
			const arch = parsed.archetype;

			// Basic fields
			document.getElementById("archetype-id").value = arch.id || "";
			document.getElementById("archetype-name").value = arch.name || "";
			document.getElementById("archetype-description").value =
				arch.description || "";
			this.setIsStarter(arch.isStarter || false);

			// Starting attributes
			document.getElementById("start-strength").value =
				arch.startingAttributes?.strength || 0;
			document.getElementById("start-agility").value =
				arch.startingAttributes?.agility || 0;
			document.getElementById("start-intelligence").value =
				arch.startingAttributes?.intelligence || 0;

			// Attribute growth
			document.getElementById("growth-strength").value =
				arch.attributeGrowthPerLevel?.strength || 0;
			document.getElementById("growth-agility").value =
				arch.attributeGrowthPerLevel?.agility || 0;
			document.getElementById("growth-intelligence").value =
				arch.attributeGrowthPerLevel?.intelligence || 0;

			// Starting resource caps
			document.getElementById("start-max-health").value =
				arch.startingResourceCaps?.maxHealth || 0;
			document.getElementById("start-max-mana").value =
				arch.startingResourceCaps?.maxMana || 0;

			// Resource growth
			document.getElementById("growth-max-health").value =
				arch.resourceGrowthPerLevel?.maxHealth || 0;
			document.getElementById("growth-max-mana").value =
				arch.resourceGrowthPerLevel?.maxMana || 0;

			// Growth modifier
			document.getElementById("growth-base").value =
				arch.growthModifier?.base || 1.0;
			document.getElementById("growth-per-level").value =
				arch.growthModifier?.perLevel || 0.05;

			// Abilities
			this.renderAbilities(arch.abilities || []);

			// Passives
			this.renderPassives(arch.passives || []);

			document.getElementById("no-selection").style.display = "none";
			document.getElementById("archetype-editor").style.display = "block";
			this.isDirty = false;
		} catch (error) {
			console.error("Error parsing YAML:", error);
			this.showToast(`Error loading archetype: ${error.message}`, "error");
		}
	}

	showNoSelection() {
		document.getElementById("no-selection").style.display = "block";
		document.getElementById("archetype-editor").style.display = "none";
		this.currentId = null;
		this.currentYaml = null;
		this.isDirty = false;
	}

	formToYaml() {
		const arch = {
			id: document.getElementById("archetype-id").value,
			name: document.getElementById("archetype-name").value,
			description: document.getElementById("archetype-description").value,
			isStarter: this.getIsStarter(),
			startingAttributes: {
				strength:
					parseInt(document.getElementById("start-strength").value) || 0,
				agility: parseInt(document.getElementById("start-agility").value) || 0,
				intelligence:
					parseInt(document.getElementById("start-intelligence").value) || 0,
			},
			attributeGrowthPerLevel: {
				strength:
					parseInt(document.getElementById("growth-strength").value) || 0,
				agility: parseInt(document.getElementById("growth-agility").value) || 0,
				intelligence:
					parseInt(document.getElementById("growth-intelligence").value) || 0,
			},
			startingResourceCaps: {
				maxHealth:
					parseInt(document.getElementById("start-max-health").value) || 0,
				maxMana: parseInt(document.getElementById("start-max-mana").value) || 0,
			},
			resourceGrowthPerLevel: {
				maxHealth:
					parseInt(document.getElementById("growth-max-health").value) || 0,
				maxMana:
					parseInt(document.getElementById("growth-max-mana").value) || 0,
			},
			growthModifier: {
				base: parseFloat(document.getElementById("growth-base").value) || 1.0,
				perLevel:
					parseFloat(document.getElementById("growth-per-level").value) || 0.05,
			},
			abilities: this.getAbilitiesFromForm(),
			passives: this.getPassivesFromForm(),
		};

		return jsyaml.dump({ archetype: arch });
	}

	async saveCurrent() {
		if (!this.currentId) return;

		// Validate form
		if (!document.getElementById("archetype-form").checkValidity()) {
			document.getElementById("archetype-form").reportValidity();
			return;
		}

		try {
			const yamlContent = this.formToYaml();

			// Validate YAML can be parsed back
			jsyaml.load(yamlContent);

			const payload = { id: this.currentId, yaml: yamlContent };

			if (this.api) {
				// Use Electron API
				if (this.currentType === "race") {
					await this.api.updateRace(payload);
				} else {
					await this.api.updateJob(payload);
				}
			} else {
				// Use HTTP fetch (currentType is already normalized)
				const response = await fetch(
					`${API_BASE}/api/${this.currentType}s/${this.currentId}`,
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
				? this.currentType === "race"
					? this.api.getRace(this.currentId)
					: this.api.getJob(this.currentId)
				: fetch(`${API_BASE}/api/${this.currentType}s/${this.currentId}`).then(
						(r) => r.json()
				  ));
			this.currentYaml = reloaded.yaml;
			this.isDirty = false;
			this.showToast(`Saved ${this.currentType} ${this.currentId}`, "success");
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

	async loadAbilities() {
		try {
			let data;
			if (this.api) {
				data = await this.api.getAbilities();
			} else {
				const response = await fetch(`${API_BASE}/api/abilities`);
				if (!response.ok) {
					throw new Error("Failed to load abilities");
				}
				data = await response.json();
			}

			// Populate abilities map
			this.abilitiesMap.clear();
			if (data.abilities) {
				data.abilities.forEach((ability) => {
					this.abilitiesMap.set(ability.id, ability);
				});
			}

			// Populate dropdown
			const dropdown = document.getElementById("ability-dropdown");
			const options = Array.from(this.abilitiesMap.values())
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((ability) => {
					const option = document.createElement("option");
					option.value = ability.id;
					option.textContent = ability.name;
					return option;
				});
			dropdown.innerHTML = '<option value="">-- Select an ability --</option>';
			options.forEach((option) => dropdown.appendChild(option));
		} catch (error) {
			console.error("Failed to load abilities:", error);
		}
	}

	async loadPassives() {
		try {
			let data;
			if (this.api) {
				data = await this.api.getPassives();
			} else {
				const response = await fetch(`${API_BASE}/api/passives`);
				if (!response.ok) {
					throw new Error("Failed to load passives");
				}
				data = await response.json();
			}

			// Populate passives map
			this.passivesMap.clear();
			if (data.passives) {
				data.passives.forEach((passive) => {
					this.passivesMap.set(passive.id, passive);
				});
			}

			// Populate dropdown
			const dropdown = document.getElementById("passive-dropdown");
			const options = Array.from(this.passivesMap.values())
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((passive) => {
					const option = document.createElement("option");
					option.value = passive.id;
					option.textContent = passive.name;
					return option;
				});
			dropdown.innerHTML = '<option value="">-- Select a passive --</option>';
			options.forEach((option) => dropdown.appendChild(option));
		} catch (error) {
			console.error("Failed to load passives:", error);
		}
	}

	renderAbilities(abilities) {
		const container = document.getElementById("abilities-grid");
		container.innerHTML = "";

		if (abilities.length === 0) {
			return;
		}

		abilities.forEach((abilityDef) => {
			const ability = this.abilitiesMap.get(abilityDef.id);
			const abilityName = ability ? ability.name : abilityDef.id;

			const box = document.createElement("div");
			box.style.position = "relative";
			box.style.padding = "1rem";
			box.style.background = "var(--base02)";
			box.style.border = "1px solid var(--base01)";
			box.style.borderRadius = "4px";
			box.style.display = "flex";
			box.style.flexDirection = "column";
			box.style.gap = "0.5rem";
			box.dataset.abilityId = abilityDef.id;

			// Delete button (X) in top right
			const deleteBtn = document.createElement("button");
			deleteBtn.textContent = "×";
			deleteBtn.style.position = "absolute";
			deleteBtn.style.top = "0.25rem";
			deleteBtn.style.right = "0.25rem";
			deleteBtn.style.width = "24px";
			deleteBtn.style.height = "24px";
			deleteBtn.style.padding = "0";
			deleteBtn.style.background = "transparent";
			deleteBtn.style.border = "none";
			deleteBtn.style.color = "var(--red)";
			deleteBtn.style.cursor = "pointer";
			deleteBtn.style.fontSize = "1.5rem";
			deleteBtn.style.lineHeight = "1";
			deleteBtn.style.display = "flex";
			deleteBtn.style.alignItems = "center";
			deleteBtn.style.justifyContent = "center";
			deleteBtn.title = "Remove ability";
			deleteBtn.addEventListener("click", () => {
				this.removeAbility(abilityDef.id);
			});

			// Ability name
			const nameDiv = document.createElement("div");
			nameDiv.textContent = abilityName;
			nameDiv.style.fontWeight = "600";
			nameDiv.style.color = "var(--base1)";
			nameDiv.style.marginRight = "1.5rem"; // Make room for X button

			// Level input
			const levelLabel = document.createElement("label");
			levelLabel.textContent = "Level:";
			levelLabel.style.fontSize = "0.85rem";
			levelLabel.style.color = "var(--base0)";

			const levelInput = document.createElement("input");
			levelInput.type = "number";
			levelInput.min = "1";
			levelInput.value = abilityDef.level || 1;
			levelInput.style.width = "100%";
			levelInput.style.padding = "0.35rem";
			levelInput.style.background = "var(--base03)";
			levelInput.style.border = "1px solid var(--base01)";
			levelInput.style.borderRadius = "4px";
			levelInput.style.color = "var(--base1)";
			levelInput.dataset.abilityId = abilityDef.id;
			levelInput.addEventListener("input", () => {
				this.isDirty = true;
			});

			box.appendChild(deleteBtn);
			box.appendChild(nameDiv);
			box.appendChild(levelLabel);
			box.appendChild(levelInput);
			container.appendChild(box);
		});
	}

	renderPassives(passives) {
		const container = document.getElementById("passives-grid");
		container.innerHTML = "";

		if (passives.length === 0) {
			return;
		}

		passives.forEach((passiveId) => {
			const passive = this.passivesMap.get(passiveId);
			const passiveName = passive ? passive.name : passiveId;

			// Create box similar to ability boxes
			const box = document.createElement("div");
			box.dataset.passiveId = passiveId;
			box.style.position = "relative";
			box.style.padding = "1rem";
			box.style.background = "var(--base03)";
			box.style.border = "1px solid var(--base01)";
			box.style.borderRadius = "4px";
			box.style.display = "flex";
			box.style.flexDirection = "column";
			box.style.gap = "0.5rem";

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
			deleteBtn.style.width = "1.5rem";
			deleteBtn.style.height = "1.5rem";
			deleteBtn.addEventListener("click", () => {
				this.removePassive(passiveId);
			});

			// Name display
			const nameDiv = document.createElement("div");
			nameDiv.textContent = passiveName;
			nameDiv.style.fontWeight = "bold";
			nameDiv.style.color = "var(--base1)";
			nameDiv.style.marginTop = "0.5rem";

			box.appendChild(deleteBtn);
			box.appendChild(nameDiv);
			container.appendChild(box);
		});
	}

	getAbilitiesFromForm() {
		const abilities = [];
		const boxes = document.querySelectorAll("#abilities-grid > div");
		boxes.forEach((box) => {
			const abilityId = box.dataset.abilityId;
			const levelInput = box.querySelector('input[type="number"]');
			if (abilityId && levelInput) {
				const level = parseInt(levelInput.value) || 1;
				abilities.push({ id: abilityId, level });
			}
		});
		return abilities;
	}

	getPassivesFromForm() {
		const passives = [];
		const boxes = document.querySelectorAll("#passives-grid > div");
		boxes.forEach((box) => {
			const passiveId = box.dataset.passiveId;
			if (passiveId) {
				passives.push(passiveId);
			}
		});
		return passives;
	}

	addAbility(abilityId) {
		if (!abilityId) return;

		// Check if ability already exists
		const existing = Array.from(
			document.querySelectorAll("#abilities-grid > div")
		);
		const alreadyAdded = existing.some(
			(box) => box.dataset.abilityId === abilityId
		);
		if (alreadyAdded) {
			this.showToast("This ability is already added", "error");
			return;
		}

		// Add to list
		const abilities = this.getAbilitiesFromForm();
		abilities.push({ id: abilityId, level: 1 });
		this.renderAbilities(abilities);
		this.isDirty = true;
	}

	removeAbility(abilityId) {
		const abilities = this.getAbilitiesFromForm().filter(
			(ability) => ability.id !== abilityId
		);
		this.renderAbilities(abilities);
		this.isDirty = true;
	}

	addPassive(passiveId) {
		if (!passiveId) return;

		// Check if passive already exists
		const existing = Array.from(
			document.querySelectorAll("#passives-grid > div")
		);
		const alreadyAdded = existing.some(
			(box) => box.dataset.passiveId === passiveId
		);
		if (alreadyAdded) {
			this.showToast("This passive is already added", "error");
			return;
		}

		// Add to list
		const passives = this.getPassivesFromForm();
		passives.push(passiveId);
		this.renderPassives(passives);
		this.isDirty = true;
	}

	removePassive(passiveId) {
		const passives = this.getPassivesFromForm().filter(
			(passive) => passive !== passiveId
		);
		this.renderPassives(passives);
		this.isDirty = true;
	}

	toggleIsStarter() {
		const currentState = this.getIsStarter();
		this.setIsStarter(!currentState);
		this.isDirty = true;
	}

	setIsStarter(value) {
		const btn = document.getElementById("archetype-is-starter-btn");
		btn.dataset.enabled = value ? "true" : "false";
		btn.textContent = "Starter";

		if (value) {
			btn.classList.add("toggle-btn-enabled");
			btn.classList.remove("toggle-btn-disabled");
		} else {
			btn.classList.add("toggle-btn-disabled");
			btn.classList.remove("toggle-btn-enabled");
		}
	}

	getIsStarter() {
		const btn = document.getElementById("archetype-is-starter-btn");
		return btn.dataset.enabled === "true";
	}

	async deleteCurrent() {
		if (!this.currentId) return;

		if (
			!confirm(
				`Are you sure you want to delete ${this.currentType} "${this.currentId}"? This cannot be undone.`
			)
		) {
			return;
		}

		try {
			// Get the tab type (plural) for reloading the list
			const tabType = this.currentType === "race" ? "races" : "jobs";

			if (this.api) {
				// Use Electron API
				if (this.currentType === "race") {
					await this.api.deleteRace(this.currentId);
				} else {
					await this.api.deleteJob(this.currentId);
				}
			} else {
				// Use HTTP fetch (currentType is already normalized)
				const response = await fetch(
					`${API_BASE}/api/${this.currentType}s/${this.currentId}`,
					{
						method: "DELETE",
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to delete");
				}
			}

			this.showToast(
				`Deleted ${this.currentType} ${this.currentId}`,
				"success"
			);
			this.showNoSelection();
			this.loadArchetypes(tabType);
		} catch (error) {
			this.showToast(`Failed to delete: ${error.message}`, "error");
		}
	}

	showNewArchetypeModal(type) {
		this.pendingType = type;
		document.getElementById("new-archetype-modal").classList.add("active");
		document.getElementById("new-archetype-id").value = "";
		document.getElementById("new-archetype-id").focus();
	}

	closeNewArchetypeModal() {
		document.getElementById("new-archetype-modal").classList.remove("active");
		this.pendingType = null;
	}

	async createNewArchetype() {
		const id = document.getElementById("new-archetype-id").value.trim();
		if (!id) {
			this.showToast("Please enter an archetype ID", "error");
			return;
		}

		if (!/^[a-z0-9_-]+$/.test(id)) {
			this.showToast(
				"ID must contain only lowercase letters, numbers, hyphens, and underscores",
				"error"
			);
			return;
		}

		// Create default YAML structure
		const defaultYaml = `archetype:
  id: ${id}
  name: ${id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ")}
  description: A ${this.pendingType} archetype.
  isStarter: false
  startingAttributes:
    strength: 5
    agility: 5
    intelligence: 5
  attributeGrowthPerLevel:
    strength: 1
    agility: 1
    intelligence: 1
  startingResourceCaps:
    maxHealth: 50
    maxMana: 30
  resourceGrowthPerLevel:
    maxHealth: 10
    maxMana: 5
  skills: []
  passives: []
  growthModifier:
    base: 1.0
    perLevel: 0.05
`;

		try {
			// Normalize type: "jobs" -> "job", "races" -> "race"
			const normalizedType =
				this.pendingType === "jobs" ? "job" : this.pendingType;
			const payload = { id, yaml: defaultYaml };

			if (this.api) {
				// Use Electron API
				if (normalizedType === "race") {
					await this.api.createRace(payload);
				} else {
					await this.api.createJob(payload);
				}
			} else {
				// Use HTTP fetch
				const response = await fetch(
					`${API_BASE}/api/${normalizedType}s/${id}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					}
				);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to create");
				}
			}

			this.closeNewArchetypeModal();
			this.showToast(`Created ${this.pendingType} ${id}`, "success");
			this.loadArchetypes(this.pendingType); // Use original tab type for reload
			this.loadArchetype(this.pendingType, id); // Use original tab type for load
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
	new ArchetypeEditor();
});

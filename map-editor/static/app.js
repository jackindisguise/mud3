// Map Editor Application
// Uses js-yaml for parsing (loaded via local script tag in index.html)

// Color constants matching the game's COLOR enum
const COLORS = [
	{ id: 0, name: "Black", hex: "#000000", tag: "k" },
	{ id: 1, name: "Maroon", hex: "#800000", tag: "r" },
	{ id: 2, name: "Dark Green", hex: "#008000", tag: "g" },
	{ id: 3, name: "Olive", hex: "#808000", tag: "y" },
	{ id: 4, name: "Dark Blue", hex: "#000080", tag: "b" },
	{ id: 5, name: "Purple", hex: "#800080", tag: "m" },
	{ id: 6, name: "Teal", hex: "#008080", tag: "c" },
	{ id: 7, name: "Silver", hex: "#c0c0c0", tag: "w" },
	{ id: 8, name: "Grey", hex: "#808080", tag: "K" },
	{ id: 9, name: "Crimson", hex: "#ff0000", tag: "R" },
	{ id: 10, name: "Lime", hex: "#00ff00", tag: "G" },
	{ id: 11, name: "Yellow", hex: "#ffff00", tag: "Y" },
	{ id: 12, name: "Light Blue", hex: "#0000ff", tag: "B" },
	{ id: 13, name: "Pink", hex: "#ff00ff", tag: "M" },
	{ id: 14, name: "Cyan", hex: "#00ffff", tag: "C" },
	{ id: 15, name: "White", hex: "#ffffff", tag: "W" },
];

const EDITOR_ACTIONS = Object.freeze({
	CREATE_TEMPLATE: "CREATE_TEMPLATE",
	EDIT_TEMPLATE_FIELD: "EDIT_TEMPLATE_FIELD",
	CREATE_DUNGEON: "CREATE_DUNGEON",
	EDIT_DUNGEON_FIELD: "EDIT_DUNGEON_FIELD",
	CREATE_RESET: "CREATE_RESET",
	EDIT_RESET_FIELD: "EDIT_RESET_FIELD",
	PLACE_TEMPLATE: "PLACE_TEMPLATE",
	PLACE_ROOM_TEMPLATE: "PLACE_ROOM_TEMPLATE",
	DELETE_TEMPLATE: "DELETE_TEMPLATE",
	DELETE_ROOM_TEMPLATE: "DELETE_ROOM_TEMPLATE",
	DELETE_RESET: "DELETE_RESET",
	PASTE_SELECTION: "PASTE_SELECTION",
	RESIZE_DUNGEON: "RESIZE_DUNGEON",
	RESTORE_UNSAVED_WORK: "RESTORE_UNSAVED_WORK",
	EDIT_ROOM_EXIT_OVERRIDE: "EDIT_ROOM_EXIT_OVERRIDE",
});

class MapEditor {
	constructor() {
		this.api = window.mapEditorAPI || null;
		this.currentDungeon = null;
		this.currentDungeonId = null;
		this.selectedTemplate = null;
		this.selectedTemplateType = null;
		this.selectedCell = null;
		this.currentLayer = 0;
		this.yamlData = null;
		this.races = [];
		this.jobs = [];
		this.weaponTypes = [];
		this.hitTypes = null; // COMMON_HIT_TYPES data from API
		this.physicalDamageTypes = null;
		this.magicalDamageTypes = null;
		this.isDragging = false;
		this.lastPlacedCell = null;
		this.processedCells = new Set();
		this.toastIdCounter = 0;
		this.placementMode = "insert"; // "insert" or "paint"
		this.selectionMode = null; // "rectangle", "circle", "squircle", or null
		this.selectionStart = null; // {x, y, z} when selection starts
		this.selectionEnd = null; // {x, y, z} when selection ends
		this.selectedCells = new Set(); // Set of cell keys "x,y,z"
		this.isSelecting = false; // Whether we're currently dragging a selection
		this.selectionBaseCells = new Set(); // Cells to keep when additive selecting
		this.isSelectionAddMode = false;
		this.history = []; // Array of dungeon states for undo/redo
		this.historyIndex = -1; // Current position in history (-1 means no history)
		this.maxHistorySize = 50; // Maximum number of undo states to keep
		this.autoSaveTimeout = null; // Timeout for debounced auto-save
		this.hasUnsavedChanges = false; // Track if there are unsaved changes
		this.changes = []; // Linear change queue for dirty tracking
		this.changeCursor = -1; // Pointer to current change in the queue
		this.lastSavedChangeIndex = -1; // Index of last persisted change
		this.changeIdCounter = 0; // Unique identifier for change entries
		this.maxTrackedChanges = 50; // Keep change history manageable
		this.initialChangeSnapshot = null; // Baseline state for history timeline
		this.clipboard = null; // Stores copied cells data: { cells: [...], resets: [...], exitOverrides: [...] }
		this.currentMousePosition = null; // {x, y, z} of cell mouse is over
		this.projectVersion = null; // Project version from package.json
		this.dungeonList = []; // List of available dungeon IDs

		this.init();
	}

	/**
	 * Parse a room reference string (@dungeon{x,y,z}) into components
	 * @param {string} ref - Room reference string
	 * @returns {{dungeonId: string, x: number, y: number, z: number} | null}
	 */
	parseRoomRef(ref) {
		if (!ref || typeof ref !== "string") return null;
		const match = ref.match(/^@([^{]+)\{(\d+),(\d+),(\d+)\}$/);
		if (!match) return null;
		return {
			dungeonId: match[1],
			x: parseInt(match[2], 10),
			y: parseInt(match[3], 10),
			z: parseInt(match[4], 10),
		};
	}

	/**
	 * Format room reference components into string (@dungeon{x,y,z})
	 * @param {string} dungeonId - Dungeon ID
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @returns {string}
	 */
	formatRoomRef(dungeonId, x, y, z) {
		return `@${dungeonId}{${x},${y},${z}}`;
	}

	/**
	 * Get the opposite direction
	 * @param {string} direction - Direction (north, south, east, west, northeast, northwest, southeast, southwest, up, down)
	 * @returns {string} Opposite direction
	 */
	getOppositeDirection(direction) {
		const opposites = {
			north: "south",
			south: "north",
			east: "west",
			west: "east",
			northeast: "southwest",
			northwest: "southeast",
			southeast: "northwest",
			southwest: "northeast",
			up: "down",
			down: "up",
		};
		return opposites[direction] || direction;
	}

	/**
	 * Get exit override for a specific coordinate
	 * @param {Object} dungeon - Dungeon object
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @returns {Object|null} Override object or null if not found
	 */
	getExitOverride(dungeon, x, y, z) {
		if (!dungeon.exitOverrides || !Array.isArray(dungeon.exitOverrides)) {
			return null;
		}
		return (
			dungeon.exitOverrides.find(
				(override) =>
					override.coordinates &&
					override.coordinates.x === x &&
					override.coordinates.y === y &&
					override.coordinates.z === z
			) || null
		);
	}

	/**
	 * Set or update exit override for a specific coordinate
	 * @param {Object} dungeon - Dungeon object
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @param {number|Object} value - Override value (number for allowedExits only, or object with allowedExits and/or roomLinks)
	 */
	setExitOverride(dungeon, x, y, z, value) {
		if (!dungeon.exitOverrides || !Array.isArray(dungeon.exitOverrides)) {
			dungeon.exitOverrides = [];
		}

		// Find existing override
		const existingIndex = dungeon.exitOverrides.findIndex(
			(override) =>
				override.coordinates &&
				override.coordinates.x === x &&
				override.coordinates.y === y &&
				override.coordinates.z === z
		);

		const override = {
			coordinates: { x, y, z },
		};

		if (typeof value === "number") {
			override.allowedExits = value;
		} else if (typeof value === "object" && value !== null) {
			if (value.allowedExits !== undefined) {
				override.allowedExits = value.allowedExits;
			}
			if (value.roomLinks !== undefined) {
				override.roomLinks = value.roomLinks;
			}
		}

		if (existingIndex >= 0) {
			dungeon.exitOverrides[existingIndex] = override;
		} else {
			dungeon.exitOverrides.push(override);
		}
	}

	/**
	 * Delete exit override for a specific coordinate
	 * @param {Object} dungeon - Dungeon object
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @returns {boolean} True if an override was deleted, false otherwise
	 */
	deleteExitOverride(dungeon, x, y, z) {
		if (!dungeon.exitOverrides || !Array.isArray(dungeon.exitOverrides)) {
			return false;
		}

		const index = dungeon.exitOverrides.findIndex(
			(override) =>
				override.coordinates &&
				override.coordinates.x === x &&
				override.coordinates.y === y &&
				override.coordinates.z === z
		);

		if (index >= 0) {
			dungeon.exitOverrides.splice(index, 1);
			if (dungeon.exitOverrides.length === 0) {
				delete dungeon.exitOverrides;
			}
			return true;
		}

		return false;
	}

	async fetchHitTypesData() {
		if (this.api?.getHitTypes) {
			return this.api.getHitTypes();
		}
		const response = await fetch("/api/hit-types");
		if (!response.ok) {
			throw new Error(`Failed to load hit types: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchWeaponTypesData() {
		if (this.api?.getWeaponTypes) {
			return this.api.getWeaponTypes();
		}
		const response = await fetch("/api/weapon-types");
		if (!response.ok) {
			throw new Error(`Failed to load weapon types: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchRacesData() {
		if (this.api?.getRaces) {
			return this.api.getRaces();
		}
		const response = await fetch("/api/races");
		if (!response.ok) {
			throw new Error(`Failed to load races: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchJobsData() {
		if (this.api?.getJobs) {
			return this.api.getJobs();
		}
		const response = await fetch("/api/jobs");
		if (!response.ok) {
			throw new Error(`Failed to load jobs: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchDungeonListData() {
		if (this.api?.listDungeons) {
			return this.api.listDungeons();
		}
		const response = await fetch("/api/dungeons");
		if (!response.ok) {
			throw new Error(`Failed to load dungeon list: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchVersionData() {
		if (this.api?.getVersion) {
			return this.api.getVersion();
		}
		const response = await fetch("/api/version");
		if (!response.ok) {
			throw new Error(`Failed to load version: ${response.statusText}`);
		}
		return response.json();
	}

	async fetchDungeonData(id) {
		if (this.api?.getDungeon) {
			return this.api.getDungeon(id);
		}
		const response = await fetch(`/api/dungeons/${id}`);
		if (!response.ok) {
			throw new Error(`Failed to load dungeon: ${response.statusText}`);
		}
		return response.json();
	}

	async saveDungeonData(id, yaml) {
		if (this.api?.updateDungeon) {
			return this.api.updateDungeon({ id, yaml });
		}
		const response = await fetch(`/api/dungeons/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ yaml }),
		});
		if (!response.ok) {
			let error;
			try {
				error = await response.json();
			} catch {
				error = {};
			}
			throw new Error(error?.error || "Failed to save dungeon");
		}
		return response.json();
	}

	async createDungeonData(id, yaml) {
		if (this.api?.createDungeon) {
			return this.api.createDungeon({ id, yaml });
		}
		const response = await fetch(`/api/dungeons/${id}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ yaml }),
		});
		if (!response.ok) {
			let error;
			try {
				error = await response.json();
			} catch {
				error = {};
			}
			throw new Error(error?.error || "Failed to create dungeon");
		}
		return response.json();
	}

	async calculateAttributesFromSource(payload) {
		if (this.api?.calculateAttributes) {
			return this.api.calculateAttributes(payload);
		}
		const response = await fetch("/api/calculate-attributes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			throw new Error("Failed to calculate attributes");
		}
		return response.json();
	}

	async init() {
		await this.loadDungeonList();
		await this.loadRacesAndJobs();
		await this.loadHitTypes();
		await this.loadVersion();

		// Check for unsaved work in localStorage
		this.checkForUnsavedWork();
		this.setupEventListeners();
	}

	async loadVersion() {
		try {
			const data = await this.fetchVersionData();
			this.projectVersion = data.version || null;
		} catch (error) {
			console.error("Failed to load version:", error);
			this.projectVersion = null;
		}
	}

	async loadHitTypes() {
		try {
			const data = await this.fetchHitTypesData();
			this.hitTypes = data.hitTypes;
			this.physicalDamageTypes = data.physicalDamageTypes;
			this.magicalDamageTypes = data.magicalDamageTypes;
		} catch (error) {
			console.error("Failed to load hit types:", error);
			// Fallback to empty data
			this.hitTypes = {};
			this.physicalDamageTypes = {};
			this.magicalDamageTypes = {};
		}
	}

	generateHitTypeSelector(selectedHitType) {
		// Color mapping for damage types - vibrant and readable
		const damageTypeColors = {
			// Physical damage types - metallic/silver tones
			SLASH: "#e0e0e0", // Bright Silver
			STAB: "#b0b0b0", // Medium Grey
			CRUSH: "#d0d0d0", // Light Silver
			EXOTIC: "#f0f0f0", // Very Light Silver
			// Magical damage types - vibrant colors
			FIRE: "#ff6666", // Bright Red
			ICE: "#66ddff", // Bright Cyan
			ELECTRIC: "#ffdd44", // Bright Yellow
			WATER: "#6699ff", // Bright Blue
			ACID: "#66ff66", // Bright Lime Green
			RADIANT: "#ffffcc", // Bright Yellow-White
			NECROTIC: "#cc66cc", // Bright Purple
			PSYCHIC: "#ff66ff", // Bright Magenta
			FORCE: "#dddddd", // Light Silver
			THUNDER: "#ffaa66", // Bright Orange
			POISON: "#66cc66", // Bright Green
		};

		// Generate hit types organized by damage type from COMMON_HIT_TYPES
		const hitTypesByDamage = {};

		// Iterate through hitTypes and group by damage type
		if (this.hitTypes) {
			for (const [key, hitType] of Object.entries(this.hitTypes)) {
				const damageType = hitType.damageType;
				if (!hitTypesByDamage[damageType]) {
					hitTypesByDamage[damageType] = [];
				}
				hitTypesByDamage[damageType].push({
					key: key,
					verb: hitType.verb,
					color: damageTypeColors[damageType] || "#ffffff",
				});
			}
		}

		// Get the selected hit type key (could be string or object)
		let selectedKey = "";
		if (selectedHitType) {
			if (typeof selectedHitType === "string") {
				selectedKey = selectedHitType.toLowerCase();
			} else if (selectedHitType.verb) {
				// Find matching key by verb
				for (const [damageType, hitTypes] of Object.entries(hitTypesByDamage)) {
					const found = hitTypes.find((ht) => ht.verb === selectedHitType.verb);
					if (found) {
						selectedKey = found.key;
						break;
					}
				}
			}
		}

		let html =
			'<div class="form-group"><label>Hit Type</label><select id="template-hit-type">';
		html += '<option value="">(Default)</option>';

		// Helper function to format damage type name for display
		const formatDamageTypeName = (damageType) => {
			return damageType.charAt(0) + damageType.slice(1).toLowerCase();
		};

		// Add Physical damage types section
		html +=
			'<optgroup label="─── Physical ───" style="color: #e0e0e0; font-weight: 600;">';
		if (this.physicalDamageTypes) {
			for (const damageType of Object.values(this.physicalDamageTypes)) {
				if (hitTypesByDamage[damageType]) {
					html += this.generateHitTypeOptions(
						hitTypesByDamage[damageType],
						selectedKey
					);
				}
			}
		}
		html += "</optgroup>";

		// Add Magical damage types sections
		if (this.magicalDamageTypes) {
			for (const damageType of Object.values(this.magicalDamageTypes)) {
				if (
					hitTypesByDamage[damageType] &&
					hitTypesByDamage[damageType].length > 0
				) {
					const damageTypeColor = damageTypeColors[damageType] || "#ffffff";
					html += `<optgroup label="─── ${formatDamageTypeName(
						damageType
					)} ───" style="color: ${damageTypeColor}; font-weight: 600;">`;
					html += this.generateHitTypeOptions(
						hitTypesByDamage[damageType],
						selectedKey
					);
					html += "</optgroup>";
				}
			}
		}

		html += "</select></div>";
		return html;
	}

	generateHitTypeOptions(hitTypes, selectedKey) {
		if (!hitTypes || hitTypes.length === 0) return "";
		let html = "";
		hitTypes.forEach((hitType) => {
			const isSelected = hitType.key === selectedKey ? "selected" : "";
			const color = hitType.color || "#ffffff";
			html += `<option value="${hitType.key}" ${isSelected} style="color: ${color}; background: #1a1a1a;">${hitType.verb}</option>`;
		});
		return html;
	}

	generateBonusesSection(template) {
		// Primary attributes
		const primaryAttrs = ["strength", "agility", "intelligence"];
		// Secondary attributes
		const secondaryAttrs = [
			"attackPower",
			"vitality",
			"defense",
			"critRate",
			"avoidance",
			"accuracy",
			"endurance",
			"spellPower",
			"wisdom",
			"resilience",
			"spirit",
		];
		// Resource capacities
		const capacities = ["maxHealth", "maxMana"];

		// Get existing values
		const attributeBonuses = template.attributeBonuses || {};
		const secondaryAttributeBonuses = template.secondaryAttributeBonuses || {};
		const resourceBonuses = template.resourceBonuses || {};

		let html = `
			<div class="bonuses-section">
				<button type="button" class="bonuses-toggle" id="bonuses-toggle">
					<span class="bonuses-toggle-icon">▼</span>
					<span class="bonuses-toggle-text">Attribute & Capacity Bonuses</span>
				</button>
				<div class="bonuses-content" id="bonuses-content" style="display: none;">
					<div class="bonuses-group">
						<h4>Primary Attributes</h4>
		`;

		// Primary attribute fields
		primaryAttrs.forEach((attr) => {
			const value = attributeBonuses[attr] || "";
			html += `
				<div class="form-group">
					<label>${attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
					<input type="number" id="bonus-primary-${attr}" value="${value}" placeholder="0" step="0.1">
				</div>
			`;
		});

		html += `
					</div>
					<div class="bonuses-group">
						<h4>Secondary Attributes</h4>
		`;

		// Secondary attribute fields
		secondaryAttrs.forEach((attr) => {
			const value = secondaryAttributeBonuses[attr] || "";
			const label = attr
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (str) => str.toUpperCase())
				.trim();
			html += `
				<div class="form-group">
					<label>${label}</label>
					<input type="number" id="bonus-secondary-${attr}" value="${value}" placeholder="0" step="0.1">
				</div>
			`;
		});

		html += `
					</div>
					<div class="bonuses-group">
						<h4>Resource Capacities</h4>
		`;

		// Resource capacity fields
		capacities.forEach((cap) => {
			const value = resourceBonuses[cap] || "";
			const label = cap
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (str) => str.toUpperCase())
				.trim();
			html += `
				<div class="form-group">
					<label>${label}</label>
					<input type="number" id="bonus-capacity-${cap}" value="${value}" placeholder="0" step="0.1">
				</div>
			`;
		});

		html += `
					</div>
				</div>
			</div>
		`;

		return html;
	}

	generateColorSelector(id, selectedColor) {
		const options = COLORS.map(
			(color) =>
				`<option value="${color.id}" ${
					selectedColor === color.id ? "selected" : ""
				} style="background-color: ${color.hex}; color: ${
					color.id <= 7 ? "#fff" : "#000"
				};">${color.name}</option>`
		).join("");
		return `<select id="${id}" class="color-selector">
			<option value="">None (default)</option>
			${options}
		</select>`;
	}

	getMapDisplayForCell(dungeon, x, y, z) {
		const dungeonId = this.currentDungeonId;
		const roomRef = `@${dungeonId}{${x},${y},${z}}`;

		// Get resets for this room
		const resets = dungeon.resets?.filter((r) => r.roomRef === roomRef) || [];

		// Priority: mob > object > room
		let mapText = null;
		let mapColor = null;

		// Check for mobs first
		for (const reset of resets) {
			const template = dungeon.templates?.find(
				(t) => t.id === reset.templateId
			);
			if (template && template.type === "Mob") {
				mapText = template.mapText !== undefined ? template.mapText : "!";
				mapColor = template.mapColor !== undefined ? template.mapColor : 11; // Yellow
				return { mapText, mapColor };
			}
		}

		// Check for objects
		for (const reset of resets) {
			const template = dungeon.templates?.find(
				(t) => t.id === reset.templateId
			);
			if (template && template.type !== "Mob") {
				if (template.mapText !== undefined) mapText = template.mapText;
				if (template.mapColor !== undefined) mapColor = template.mapColor;
				if (mapText !== null || mapColor !== null) {
					return { mapText, mapColor };
				}
			}
		}

		// Use room defaults
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];
		const row = layer[y] || [];
		const roomIndex = row[x] || 0;

		if (roomIndex > 0) {
			const room = dungeon.rooms[roomIndex - 1];
			if (room) {
				mapText = room.mapText !== undefined ? room.mapText : ".";
				mapColor = room.mapColor !== undefined ? room.mapColor : null;
			}
		}

		return { mapText: mapText || ".", mapColor };
	}

	async loadRacesAndJobs() {
		try {
			const [racesData, jobsData, weaponTypesData] = await Promise.all([
				this.fetchRacesData(),
				this.fetchJobsData(),
				this.fetchWeaponTypesData(),
			]);
			this.races = racesData?.races || [];
			this.jobs = jobsData?.jobs || [];
			this.weaponTypes = weaponTypesData?.weaponTypes || [];
		} catch (error) {
			console.error("Failed to load races/jobs/weapon types:", error);
		}
	}

	async loadDungeonList() {
		try {
			const data = await this.fetchDungeonListData();
			this.dungeonList = data.dungeons || [];
		} catch (error) {
			console.error("Failed to load dungeon list:", error);
			this.dungeonList = [];
		}
	}

	async loadDungeonList() {
		try {
			const data = await this.fetchDungeonListData();
			this.dungeonList = data.dungeons || [];
			const select = document.getElementById("dungeon-select");
			if (select) {
				select.innerHTML = '<option value="">Select a dungeon...</option>';

				// Add "New..." option
				const newOption = document.createElement("option");
				newOption.value = "__NEW__";
				newOption.textContent = "New...";
				select.appendChild(newOption);

				this.dungeonList.forEach((id) => {
					const option = document.createElement("option");
					option.value = id;
					option.textContent = id;
					select.appendChild(option);
				});

				this.updateCurrentDungeonDisplay();
			}
			this.updateDungeonSettingsForm(this.yamlData?.dungeon || null);
		} catch (error) {
			console.error("Failed to load dungeon list:", error);
		}
	}

	updateCurrentDungeonDisplay(dungeonMeta) {
		const nameEl = document.getElementById("current-dungeon-name");
		const editBtn = document.getElementById("edit-dungeon-settings-btn");
		if (!nameEl || !editBtn) return;

		const meta = dungeonMeta || this.yamlData?.dungeon || null;
		const id = meta?.id || this.currentDungeonId;

		if (!id) {
			const placeholder = "No dungeon selected";
			nameEl.textContent = placeholder;
			nameEl.title = placeholder;
			editBtn.disabled = true;
			editBtn.title = "Select a dungeon to edit settings";
			return;
		}

		const trimmedName = meta?.name?.trim();
		const description = meta?.description?.trim();
		const displayName = trimmedName ? `${trimmedName} (${id})` : id;

		nameEl.textContent = displayName;
		nameEl.title = description ? `${displayName}\n${description}` : displayName;
		editBtn.disabled = false;
		editBtn.title = `Edit settings for ${displayName}`;
	}

	ensureDungeonMetadata(dungeon, fallbackId = this.currentDungeonId) {
		if (!dungeon) return;
		const fallbackName =
			(dungeon.name && dungeon.name.trim()) ||
			dungeon.id ||
			fallbackId ||
			this.currentDungeon?.name ||
			"Untitled Dungeon";
		dungeon.name = fallbackName.trim();

		if (typeof dungeon.description === "string") {
			const trimmedDescription = dungeon.description.trim();
			dungeon.description = trimmedDescription || undefined;
		}
	}

	updateDungeonSettingsForm(dungeon) {
		const dimensions = dungeon?.dimensions;
		const widthInput = document.getElementById("width-input");
		const heightInput = document.getElementById("height-input");
		const layersInput = document.getElementById("layers-input");
		const resetMessageInput = document.getElementById("reset-message-input");
		const nameInput = document.getElementById("dungeon-name-input");
		const descriptionInput = document.getElementById(
			"dungeon-description-input"
		);

		if (widthInput) {
			widthInput.value =
				dimensions && typeof dimensions.width === "number"
					? dimensions.width
					: "";
		}
		if (heightInput) {
			heightInput.value =
				dimensions && typeof dimensions.height === "number"
					? dimensions.height
					: "";
		}
		if (layersInput) {
			layersInput.value =
				dimensions && typeof dimensions.layers === "number"
					? dimensions.layers
					: "";
		}
		if (resetMessageInput) {
			resetMessageInput.value = dungeon?.resetMessage || "";
		}
		if (nameInput) {
			nameInput.value =
				(dungeon && (dungeon.name || dungeon.id)) ||
				this.currentDungeon?.name ||
				this.currentDungeonId ||
				"";
		}
		if (descriptionInput) {
			descriptionInput.value = dungeon?.description || "";
		}
	}

	commitDungeonSettingsForm() {
		if (!this.yamlData || !this.yamlData.dungeon) return false;

		const dungeon = this.yamlData.dungeon;
		const resetMessageInput = document.getElementById("reset-message-input");
		const nameInput = document.getElementById("dungeon-name-input");
		const descriptionInput = document.getElementById(
			"dungeon-description-input"
		);

		const newResetMessage = resetMessageInput?.value || "";
		const trimmedName = nameInput?.value?.trim() || "";
		if (!trimmedName) {
			this.showToast("Dungeon name is required", "");
			if (nameInput) {
				nameInput.focus();
			}
			return false;
		}
		const newDescription = descriptionInput?.value?.trim() || "";

		let changed = false;
		const pendingUpdates = {};
		const newParameters = {};
		const oldParameters = {};

		const normalizedResetMessage = newResetMessage || undefined;
		if (dungeon.resetMessage !== normalizedResetMessage) {
			pendingUpdates.resetMessage = normalizedResetMessage;
			oldParameters.resetMessage = dungeon.resetMessage || "";
			newParameters.resetMessage = normalizedResetMessage || "";
			changed = true;
		}

		const normalizedName = trimmedName;
		if (dungeon.name !== normalizedName) {
			pendingUpdates.name = normalizedName;
			oldParameters.name = dungeon.name || "";
			newParameters.name = normalizedName || "";
			changed = true;
		}

		const normalizedDescription = newDescription || undefined;
		if (dungeon.description !== normalizedDescription) {
			pendingUpdates.description = normalizedDescription;
			oldParameters.description = dungeon.description || "";
			newParameters.description = normalizedDescription || "";
			changed = true;
		}

		if (changed) {
			this.saveStateToHistory();

			if (
				Object.prototype.hasOwnProperty.call(pendingUpdates, "resetMessage")
			) {
				dungeon.resetMessage = pendingUpdates.resetMessage;
				if (this.currentDungeon) {
					this.currentDungeon.resetMessage = pendingUpdates.resetMessage || "";
				}
			}

			if (Object.prototype.hasOwnProperty.call(pendingUpdates, "name")) {
				dungeon.name = pendingUpdates.name;
				if (this.currentDungeon) {
					this.currentDungeon.name = pendingUpdates.name || "";
				}
			}

			if (Object.prototype.hasOwnProperty.call(pendingUpdates, "description")) {
				dungeon.description = pendingUpdates.description;
				if (this.currentDungeon) {
					this.currentDungeon.description = pendingUpdates.description || "";
				}
			}

			this.updateCurrentDungeonDisplay(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.EDIT_DUNGEON_FIELD,
				actionTarget: this.currentDungeonId,
				newParameters,
				oldParameters,
			});
		}

		return true;
	}

	async loadDungeon(id) {
		try {
			// Check if there's unsaved work for this dungeon
			const unsavedData = this.getLocalStorageKey(id);
			const savedData = localStorage.getItem(unsavedData);

			if (savedData) {
				// Ask user if they want to restore unsaved work
				const restore = await this.showRestoreModal();
				if (restore) {
					// Load from localStorage
					const parsed = JSON.parse(savedData);
					this.currentDungeonId = id;
					this.yamlData = parsed.yamlData;
					const dungeon = this.yamlData.dungeon;
					this.ensureDungeonMetadata(dungeon, id);
					this.currentDungeon = {
						dimensions: dungeon.dimensions,
						resetMessage: dungeon.resetMessage || "",
						name: dungeon.name || "",
						description: dungeon.description || "",
					};

					this.updateCurrentDungeonDisplay(dungeon);
					this.updateDungeonSettingsForm(dungeon);

					// Initialize history with restored state
					this.history = [this.cloneDungeonState(dungeon)];
					this.historyIndex = 0;
					this.resetChangeTracking({
						markUnsaved: true,
						action: EDITOR_ACTIONS.RESTORE_UNSAVED_WORK,
					});

					this.showToast(
						"Restored unsaved work",
						`Last saved: ${new Date(parsed.timestamp).toLocaleString()}`
					);
					// Load templates
					this.loadTemplates(dungeon);

					// Load resets
					this.loadResets(dungeon);

					// Render map
					this.renderMap(dungeon);

					// Setup layer selector
					this.setupLayerSelector(dungeon.dimensions.layers);
				} else {
					// Load from server and clear localStorage
					localStorage.removeItem(unsavedData);
					await this.loadDungeonFromSource(id);
				}
			} else {
				// No unsaved work, load from server
				await this.loadDungeonFromSource(id);
			}
		} catch (error) {
			console.error("Failed to load dungeon:", error);
			this.showToast("Failed to load dungeon", error.message);
		}
	}

	async loadDungeonFromSource(id) {
		const data = await this.fetchDungeonData(id);
		this.currentDungeonId = id;
		this.currentDungeon = {
			dimensions: data.dimensions,
			resetMessage: data.resetMessage || "",
			name: data.name || id || "",
			description: data.description || "",
		};

		// Clear selection and indicator
		this.clearSelectionTool();
		this.clearSelectedTemplate();

		// Parse YAML
		this.yamlData = jsyaml.load(data.yaml);
		const dungeon = this.yamlData.dungeon;
		this.ensureDungeonMetadata(dungeon, id);
		this.currentDungeon.name = dungeon.name || this.currentDungeon.name || "";
		this.currentDungeon.description =
			dungeon.description || this.currentDungeon.description || "";

		this.updateCurrentDungeonDisplay(dungeon);

		// Initialize history with current state
		this.history = [this.cloneDungeonState(dungeon)];
		this.historyIndex = 0;

		// Update UI
		this.updateDungeonSettingsForm(dungeon);

		// Load templates
		this.loadTemplates(dungeon);

		// Load resets
		this.loadResets(dungeon);

		// Render map
		this.renderMap(dungeon);

		// Setup layer selector
		this.setupLayerSelector(dungeon.dimensions.layers);

		// Reset change tracking for clean load
		this.resetChangeTracking();
	}

	loadTemplates(dungeon) {
		// Load room templates
		const roomList = document.getElementById("room-templates");
		roomList.innerHTML = "";

		// Add delete room template first
		const deleteItem = this.createTemplateItem(
			"room",
			"__DELETE__",
			"🗑️ Delete Room",
			"Click on rooms to remove them"
		);
		roomList.appendChild(deleteItem);

		if (dungeon.rooms) {
			dungeon.rooms.forEach((room, index) => {
				const item = this.createTemplateItem(
					"room",
					index,
					room.display || `Room ${index + 1}`,
					room.description || ""
				);
				roomList.appendChild(item);
			});
		}

		// Load mob templates
		const mobList = document.getElementById("mob-templates");
		mobList.innerHTML = "";
		if (dungeon.templates) {
			dungeon.templates
				.filter((t) => t.type === "Mob")
				.forEach((template, index) => {
					const item = this.createTemplateItem(
						"mob",
						template.id,
						template.display || template.id,
						template.description || ""
					);
					mobList.appendChild(item);
				});
		}

		// Load object templates
		const objectList = document.getElementById("object-templates");
		objectList.innerHTML = "";
		if (dungeon.templates) {
			dungeon.templates
				.filter((t) => t.type !== "Mob")
				.forEach((template, index) => {
					const item = this.createTemplateItem(
						"object",
						template.id,
						template.display || template.id,
						template.description || ""
					);
					objectList.appendChild(item);
				});
		}
	}

	createTemplateItem(type, id, display, description) {
		const item = document.createElement("div");
		item.className = "template-item";
		item.dataset.type = type;
		item.dataset.id = id;
		const isDeleteTemplate = id === "__DELETE__";
		item.innerHTML = `
			<div class="template-item-content">
				<h3>${display}</h3>
				<p>${description}</p>
				${
					!isDeleteTemplate
						? `
				<div class="template-item-actions">
					<button class="template-edit-btn" title="Edit template">✏️</button>
					<button class="template-delete-btn" title="Delete template">🗑️</button>
				</div>
				`
						: ""
				}
			</div>
		`;
		item.addEventListener("click", () => {
			// If there's an active selection, place template in all selected cells
			if (this.selectedCells.size > 0) {
				this.placeTemplateInSelection(type, id);
				// Clear selection after placement but keep the tool active
				this.clearSelectedCells();
				return;
			}

			document
				.querySelectorAll(".template-item")
				.forEach((i) => i.classList.remove("selected"));
			item.classList.add("selected");
			this.selectedTemplate = id;
			this.selectedTemplateType = type;
			this.updatePlacementIndicator(type, id, display);
			this.updateStatusBar();
		});
		item.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			if (!isDeleteTemplate) {
				this.editTemplate(type, id);
			}
		});

		// Add edit and delete button handlers
		if (!isDeleteTemplate) {
			const editBtn = item.querySelector(".template-edit-btn");
			const deleteBtn = item.querySelector(".template-delete-btn");

			if (editBtn) {
				editBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.editTemplate(type, id);
				});
			}

			if (deleteBtn) {
				deleteBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deleteTemplate(type, id);
				});
			}
		}

		return item;
	}

	placeTemplateInSelection(type, id) {
		if (!this.yamlData || this.selectedCells.size === 0) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId || dungeon.id || "dungeon";
		let placedCount = 0;
		let skippedEmptyRooms = 0;
		let skippedDenseRooms = 0;
		let changeOccurred = false;
		const selectionSize = this.selectedCells.size;
		const selectionBounds = this.getSelectionBounds();
		const selectionShape = this.selectionMode;
		const isDeleteRoomTemplate = type === "room" && id === "__DELETE__";
		const roomTemplateIndex =
			type === "room" && !isDeleteRoomTemplate ? parseInt(id, 10) : Number.NaN;
		const selectedRoomTemplate =
			type === "room" && !Number.isNaN(roomTemplateIndex)
				? dungeon.rooms[roomTemplateIndex]
				: null;

		// Process each selected cell
		this.selectedCells.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);

			if (type === "room") {
				// Place room template
				const layerIndex = dungeon.dimensions.layers - 1 - z;
				const layer = dungeon.grid[layerIndex] || [];

				// Ensure row exists
				if (!layer[y]) {
					layer[y] = new Array(dungeon.dimensions.width).fill(0);
				}

				if (isDeleteRoomTemplate) {
					if (layer[y][x] > 0) {
						layer[y][x] = 0;
						this.removeResetsAt(x, y, z);
						placedCount++;
						changeOccurred = true;
					}
					return;
				}

				const templateIndex = parseInt(id, 10) + 1;
				layer[y][x] = templateIndex;
				if (selectedRoomTemplate?.dense) {
					this.removeResetsAt(x, y, z);
				}
				placedCount++;
				changeOccurred = true;
			} else if (type === "mob" || type === "object") {
				const room = this.getRoomAt(dungeon, x, y, z);
				if (!room) {
					skippedEmptyRooms++;
					return;
				}
				if (room.dense) {
					skippedDenseRooms++;
					return;
				}

				const roomRef = `@${dungeonId}{${x},${y},${z}}`;

				// Check if reset already exists
				const existingReset = dungeon.resets?.find(
					(r) => r.roomRef === roomRef && r.templateId === id
				);

				if (existingReset) {
					// Increment maxCount if it exists
					existingReset.maxCount = (existingReset.maxCount || 1) + 1;
					changeOccurred = true;
				} else {
					// Add new reset
					if (!dungeon.resets) {
						dungeon.resets = [];
					}
					dungeon.resets.push({
						templateId: id,
						roomRef: roomRef,
						minCount: 1,
						maxCount: 1,
					});
					changeOccurred = true;
				}
				placedCount++;
			}
		});

		// Get template name for toast
		const template =
			type === "room" && !isDeleteRoomTemplate
				? dungeon.rooms[parseInt(id, 10)]
				: dungeon.templates?.find((t) => t.id === id);
		const templateName = isDeleteRoomTemplate
			? "Room Delete"
			: template?.display ||
			  (type === "room" ? `Room ${parseInt(id, 10) + 1}` : id);

		if (isDeleteRoomTemplate) {
			if (placedCount === 0) {
				this.showToast("No rooms deleted", "Selection did not contain rooms");
			} else {
				this.showToast(
					"Deleted rooms",
					`Cleared ${placedCount} cell${placedCount === 1 ? "" : "s"}`
				);
				this.makeChange({
					action: EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE,
					actionTarget: id,
					metadata: {
						templateType: type,
						selectionSize,
						placedCount,
						selectionShape,
						selectionFrom: selectionBounds
							? `${selectionBounds.from.x},${selectionBounds.from.y},${selectionBounds.from.z}`
							: null,
						selectionTo: selectionBounds
							? `${selectionBounds.to.x},${selectionBounds.to.y},${selectionBounds.to.z}`
							: null,
						roomTemplateName: templateName,
					},
				});
			}
			this.loadResets(dungeon);
			this.renderMap(dungeon);
			return;
		}

		if ((type === "mob" || type === "object") && placedCount === 0) {
			const reasons = [];
			if (skippedEmptyRooms) {
				reasons.push(
					skippedEmptyRooms === 1
						? "Selected cell has no room"
						: "Some selected cells do not contain rooms"
				);
			}
			if (skippedDenseRooms) {
				reasons.push(
					skippedDenseRooms === 1
						? "Selected room is dense"
						: "Dense rooms cannot contain mobs or objects"
				);
			}
			this.showToast(
				`No ${type === "mob" ? "mobs" : "objects"} placed`,
				reasons.join(". ") || "Select a valid room first"
			);
			return;
		}

		// Show toast notification when placements succeeded
		this.showToast(
			`Placed ${templateName} in selection`,
			`${placedCount} cell${placedCount !== 1 ? "s" : ""}`
		);

		if (
			(type === "mob" || type === "object") &&
			(skippedEmptyRooms > 0 || skippedDenseRooms > 0)
		) {
			const skippedReasons = [];
			if (skippedEmptyRooms) {
				skippedReasons.push(
					`${skippedEmptyRooms} cell${
						skippedEmptyRooms === 1 ? "" : "s"
					} without rooms`
				);
			}
			if (skippedDenseRooms) {
				skippedReasons.push(
					`${skippedDenseRooms} dense room${skippedDenseRooms === 1 ? "" : "s"}`
				);
			}
			this.showToast("Skipped cells", skippedReasons.join(", "));
		}

		// Reload resets and re-render map
		this.loadResets(dungeon);
		this.renderMap(dungeon);

		if (changeOccurred) {
			const actionType = isDeleteRoomTemplate
				? EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE
				: type === "room"
				? EDITOR_ACTIONS.PLACE_ROOM_TEMPLATE
				: EDITOR_ACTIONS.PLACE_TEMPLATE;

			this.makeChange({
				action: actionType,
				actionTarget: id,
				metadata: {
					templateType: type,
					selectionSize,
					placedCount,
					skippedEmptyRooms,
					skippedDenseRooms,
					selectionShape,
					selectionFrom: selectionBounds
						? `${selectionBounds.from.x},${selectionBounds.from.y},${selectionBounds.from.z}`
						: null,
					selectionTo: selectionBounds
						? `${selectionBounds.to.x},${selectionBounds.to.y},${selectionBounds.to.z}`
						: null,
					roomTemplateName:
						type === "room" && !isDeleteRoomTemplate ? templateName : null,
				},
			});
		}
	}

	loadResets(dungeon) {
		const resetList = document.getElementById("reset-list");
		resetList.innerHTML = "";

		if (!dungeon.resets) return;

		// Filter resets to only show those on the current layer
		const filteredResets = dungeon.resets.filter((reset) => {
			// Parse roomRef format: @dungeonId{x,y,z}
			const match = reset.roomRef.match(/\{(\d+),(\d+),(\d+)\}/);
			if (match) {
				const z = parseInt(match[3]);
				return z === this.currentLayer;
			}
			return false;
		});

		// Create a map of original indices to filtered indices for edit/delete operations
		const originalIndices = new Map();
		filteredResets.forEach((reset, filteredIndex) => {
			const originalIndex = dungeon.resets.indexOf(reset);
			originalIndices.set(filteredIndex, originalIndex);
		});

		filteredResets.forEach((reset, filteredIndex) => {
			const template = dungeon.templates?.find(
				(t) => t.id === reset.templateId
			);
			const templateName = template
				? template.display || reset.templateId
				: reset.templateId;

			// Check if mob reset
			const isMobReset = template?.type === "Mob";

			let details = `
				<div class="reset-details">
					Room: ${reset.roomRef}<br>
					Count: ${reset.minCount || 1} - ${reset.maxCount || 1}
			`;

			// Show equipped/inventory if present and this is a mob reset
			if (isMobReset) {
				if (reset.equipped && reset.equipped.length > 0) {
					details += `<br>Equipped: ${reset.equipped.join(", ")}`;
				}
				if (reset.inventory && reset.inventory.length > 0) {
					details += `<br>Inventory: ${reset.inventory.join(", ")}`;
				}
			}

			details += `</div>`;

			const item = document.createElement("div");
			item.className = "reset-item";
			item.innerHTML = `
				<h4>${templateName}</h4>
				${details}
				<div class="reset-actions">
					<button class="edit-reset-btn" data-index="${filteredIndex}" title="Edit reset">✏️</button>
					<button class="delete-reset-btn" data-index="${filteredIndex}" title="Delete reset">🗑️</button>
				</div>
			`;

			// Attach event listeners
			const editBtn = item.querySelector(".edit-reset-btn");
			const deleteBtn = item.querySelector(".delete-reset-btn");

			editBtn.addEventListener("click", () => {
				// Use original index for the actual reset operation
				const originalIndex = originalIndices.get(filteredIndex);
				this.editReset(originalIndex);
			});

			deleteBtn.addEventListener("click", () => {
				// Use original index for the actual reset operation
				const originalIndex = originalIndices.get(filteredIndex);
				this.deleteReset(originalIndex);
			});

			resetList.appendChild(item);
		});
	}

	// Helper function to get room at coordinates
	getRoomAt(dungeon, x, y, z) {
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];
		const row = layer[y] || [];
		const roomIndex = row[x] || 0;
		if (roomIndex > 0) {
			const room = dungeon.rooms[roomIndex - 1];
			if (!room) return null;

			// Apply exit override if present (create a copy to avoid mutating template)
			const override = this.getExitOverride(dungeon, x, y, z);
			if (override) {
				// Handle both number (allowedExits only) and object (allowedExits and/or roomLinks) formats
				let allowedExitsOverride = room.allowedExits;
				let roomLinksOverride = room.roomLinks || {};
				if (override.allowedExits !== undefined) {
					allowedExitsOverride = override.allowedExits ?? room.allowedExits;
				}
				if (override.roomLinks !== undefined) {
					// Merge roomLinks from override with base room's roomLinks
					roomLinksOverride = {
						...(room.roomLinks || {}),
						...(override.roomLinks || {}),
					};
				}
				// Return a copy with the override applied
				return {
					...room,
					allowedExits: allowedExitsOverride,
					roomLinks: roomLinksOverride,
				};
			}

			return room;
		}
		return null;
	}

	removeResetsAt(x, y, z) {
		if (!this.yamlData?.dungeon?.resets) {
			return 0;
		}
		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId || dungeon.id || "dungeon";
		const roomRef = `@${dungeonId}{${x},${y},${z}}`;
		const initialCount = dungeon.resets.length;
		dungeon.resets = dungeon.resets.filter(
			(reset) => reset.roomRef !== roomRef
		);
		return initialCount - dungeon.resets.length;
	}

	removeResetsForRoomTemplate(roomIndex) {
		if (
			!this.yamlData?.dungeon?.resets ||
			roomIndex === undefined ||
			roomIndex === null
		) {
			return 0;
		}

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId || dungeon.id || "dungeon";
		const targetValue = roomIndex + 1;
		const refsToRemove = new Set();

		for (
			let layerIndex = 0;
			layerIndex < (dungeon.grid?.length || 0);
			layerIndex++
		) {
			const layer = dungeon.grid[layerIndex] || [];
			for (let y = 0; y < layer.length; y++) {
				const row = layer[y] || [];
				for (let x = 0; x < row.length; x++) {
					if (row[x] === targetValue) {
						const z = dungeon.dimensions.layers - 1 - layerIndex;
						refsToRemove.add(`@${dungeonId}{${x},${y},${z}}`);
					}
				}
			}
		}

		if (refsToRemove.size === 0) return 0;

		const initialCount = dungeon.resets.length;
		dungeon.resets = dungeon.resets.filter(
			(reset) => !refsToRemove.has(reset.roomRef)
		);
		return initialCount - dungeon.resets.length;
	}

	// Helper function to check if a room has an exit in a direction
	hasExit(room, direction) {
		if (!room || !room.allowedExits) return false;
		const DIRECTION = {
			NORTH: 1 << 0,
			SOUTH: 1 << 1,
			EAST: 1 << 2,
			WEST: 1 << 3,
		};
		// Room's allowedExits already includes any exit overrides applied at load time
		return (room.allowedExits & DIRECTION[direction]) !== 0;
	}

	// Helper function to get exit indicators for a cell
	getExitIndicators(dungeon, x, y, z) {
		const DIRECTION = {
			NORTH: "NORTH",
			SOUTH: "SOUTH",
			EAST: "EAST",
			WEST: "WEST",
		};
		const indicators = {
			north: null, // null = no special line, 'exit' = two-way exit (slightly darker), 'one-way-exit' = hashed (can exit but neighbor can't), 'one-way-blocked' = solid (neighbor can exit to us but we can't back), 'blocked' = no exit (grey), 'link' = room link line
			south: null,
			east: null,
			west: null,
		};

		const currentRoom = this.getRoomAt(dungeon, x, y, z);

		// If cell is empty, check neighbors - show blocked on sides with room neighbors
		if (!currentRoom) {
			const directions = [
				{ name: "north", checkX: x, checkY: y - 1 },
				{ name: "south", checkX: x, checkY: y + 1 },
				{ name: "east", checkX: x + 1, checkY: y },
				{ name: "west", checkX: x - 1, checkY: y },
			];

			for (const dir of directions) {
				const neighborRoom = this.getRoomAt(dungeon, dir.checkX, dir.checkY, z);
				// If neighbor has a room, show blocked border on that side
				if (neighborRoom) {
					indicators[dir.name] = "blocked";
				}
			}
			return indicators;
		}

		// Dense rooms cannot be entered or exited - all sides are blocked
		if (currentRoom.dense) {
			indicators.north = "blocked";
			indicators.south = "blocked";
			indicators.east = "blocked";
			indicators.west = "blocked";
			return indicators;
		}

		// Check each direction
		const directions = [
			{ name: "north", checkX: x, checkY: y - 1, opposite: "SOUTH" },
			{ name: "south", checkX: x, checkY: y + 1, opposite: "NORTH" },
			{ name: "east", checkX: x + 1, checkY: y, opposite: "WEST" },
			{ name: "west", checkX: x - 1, checkY: y, opposite: "EAST" },
		];

		for (const dir of directions) {
			const neighborRoom = this.getRoomAt(dungeon, dir.checkX, dir.checkY, z);

			// Check if neighbor is empty - if so, this side is blocked (cannot exit to empty cells)
			if (!neighborRoom) {
				indicators[dir.name] = "blocked";
				continue;
			}

			// Check if neighbor is dense - if so, this side is blocked (cannot enter dense rooms)
			if (neighborRoom.dense) {
				indicators[dir.name] = "blocked";
				continue;
			}

			// Check if current room has room link in this direction (highest priority)
			if (currentRoom.roomLinks && currentRoom.roomLinks[dir.name]) {
				indicators[dir.name] = "link";
			}
			// Check if current room allows exit in this direction
			else if (this.hasExit(currentRoom, dir.name.toUpperCase())) {
				// If neighbor exists and can exit back: two-way connection (slightly darker)
				if (this.hasExit(neighborRoom, dir.opposite)) {
					indicators[dir.name] = "exit";
				}
				// If neighbor exists but cannot exit back: one-way exit (hashed border)
				else {
					indicators[dir.name] = "one-way-exit";
				}
			}
			// Current room cannot exit in this direction
			else {
				// If neighbor can exit toward us but we can't exit back: one-way blocked (solid border)
				if (this.hasExit(neighborRoom, dir.opposite)) {
					indicators[dir.name] = "one-way-blocked";
				}
				// No exit allowed in this direction - show grey border
				else {
					indicators[dir.name] = "blocked";
				}
			}
		}

		return indicators;
	}

	renderMap(dungeon) {
		const gridContainer = document.getElementById("map-grid");
		gridContainer.innerHTML = "";

		// Create wrapper for grid with rulers
		const wrapper = document.createElement("div");
		wrapper.className = "grid-wrapper";

		// Create top ruler (column numbers)
		const topRuler = document.createElement("div");
		topRuler.className = "grid-ruler-top";
		// Add corner cell (empty)
		const cornerCell = document.createElement("div");
		cornerCell.className = "grid-ruler-corner";
		topRuler.appendChild(cornerCell);
		// Add column numbers
		for (let x = 0; x < dungeon.dimensions.width; x++) {
			const rulerCell = document.createElement("div");
			rulerCell.className = "grid-ruler-cell";
			rulerCell.textContent = x;
			topRuler.appendChild(rulerCell);
		}
		wrapper.appendChild(topRuler);

		// Create main content area
		const contentArea = document.createElement("div");
		contentArea.className = "grid-content-area";

		// Store current selection before clearing
		const previousSelection = new Set(this.selectedCells);

		// Get current layer (reverse because YAML stores top layer first)
		const layerIndex = dungeon.dimensions.layers - 1 - this.currentLayer;
		const layer = dungeon.grid[layerIndex] || [];

		// Render cells (YAML stores rows top-first, but we need to reverse for display)
		for (let y = 0; y < dungeon.dimensions.height; y++) {
			const row = layer[y] || [];
			const rowWrapper = document.createElement("div");
			rowWrapper.className = "grid-row-wrapper";

			// Add row ruler cell before each row
			const rowRulerCell = document.createElement("div");
			rowRulerCell.className = "grid-ruler-cell grid-ruler-left";
			rowRulerCell.textContent = y;
			rowWrapper.appendChild(rowRulerCell);

			for (let x = 0; x < dungeon.dimensions.width; x++) {
				const cell = document.createElement("div");
				cell.className = "grid-cell";
				cell.dataset.x = x;
				cell.dataset.y = y;
				cell.dataset.z = this.currentLayer;

				const roomIndex = row[x] || 0;
				if (roomIndex > 0) {
					cell.classList.add("has-room");
					const room = dungeon.rooms[roomIndex - 1];
					if (room) {
						cell.title = room.display || `Room ${roomIndex}`;
						// Add dense class if room is dense (cannot be entered or exited)
						if (room.dense) {
							cell.classList.add("dense-room");
						}
					}

					// Check if this cell has an exit override
					if (this.getExitOverride(dungeon, x, y, this.currentLayer)) {
						cell.classList.add("has-exit-override");
						cell.title = (cell.title || "") + " (Exit Override)";
					}
				}

				// Get map display (text and color) with priority: mob > object > room
				const { mapText, mapColor } = this.getMapDisplayForCell(
					dungeon,
					x,
					y,
					this.currentLayer
				);

				// Set text content
				cell.textContent = mapText || ".";

				// Set color if specified
				if (mapColor !== null && mapColor !== undefined) {
					const color = COLORS.find((c) => c.id === mapColor);
					if (color) {
						cell.style.color = color.hex;
					}
				}

				// Add exit indicators for all cells (rooms and empty cells)
				const exitIndicators = this.getExitIndicators(
					dungeon,
					x,
					y,
					this.currentLayer
				);
				// Add classes for exit visualization
				for (const [direction, indicatorType] of Object.entries(
					exitIndicators
				)) {
					if (indicatorType === "exit") {
						cell.classList.add(`exit-${direction}`);
					} else if (indicatorType === "one-way-exit") {
						cell.classList.add(`one-way-exit-${direction}`);
					} else if (indicatorType === "one-way-blocked") {
						cell.classList.add(`one-way-blocked-${direction}`);
					} else if (indicatorType === "blocked") {
						cell.classList.add(`blocked-${direction}`);
					} else if (indicatorType === "link") {
						cell.classList.add(`exit-${direction}`);
						cell.classList.add(`link-${direction}`);
					}
				}

				// Check for UP and DOWN exits and add arrow indicators
				// Use getRoomAt to get the room with exit overrides applied
				const roomAtCell = this.getRoomAt(dungeon, x, y, this.currentLayer);
				if (roomAtCell) {
					const UP = 1 << 8;
					const DOWN = 1 << 9;
					// Check both allowedExits flags and roomLinks for UP/DOWN
					const hasUpExit =
						roomAtCell.allowedExits && roomAtCell.allowedExits & UP;
					const hasUpLink = roomAtCell.roomLinks && roomAtCell.roomLinks.up;
					const hasDownExit =
						roomAtCell.allowedExits && roomAtCell.allowedExits & DOWN;
					const hasDownLink = roomAtCell.roomLinks && roomAtCell.roomLinks.down;

					if (hasUpExit || hasUpLink) {
						const upArrow = document.createElement("span");
						upArrow.className = "exit-arrow exit-arrow-up";
						upArrow.textContent = "▲";
						cell.appendChild(upArrow);
					}
					if (hasDownExit || hasDownLink) {
						const downArrow = document.createElement("span");
						downArrow.className = "exit-arrow exit-arrow-down";
						downArrow.textContent = "▼";
						cell.appendChild(downArrow);
					}
				}

				// Prevent text selection on cells
				cell.style.userSelect = "none";
				cell.style.webkitUserSelect = "none";

				cell.addEventListener("mousedown", (e) => {
					e.preventDefault();
					if (this.selectionMode !== null) {
						// Selection mode: start selection
						this.isSelectionAddMode = e.ctrlKey || e.metaKey;
						if (this.isSelectionAddMode) {
							this.selectionBaseCells = new Set(this.selectedCells);
						} else {
							// Clear previous selection when starting a new one (unless in add mode)
							this.clearSelectedCells();
						}
						this.isSelecting = true;
						this.selectionStart = { x, y, z: this.currentLayer };
						this.selectionEnd = { x, y, z: this.currentLayer };
						this.updateSelection();
					} else if (this.selectedTemplate !== null) {
						// Only enable drag in insert mode
						if (this.placementMode === "insert") {
							this.isDragging = true;
							this.processedCells.clear();
							const cellKey = `${x},${y},${this.currentLayer}`;
							if (!this.processedCells.has(cellKey)) {
								this.processedCells.add(cellKey);
								this.handleCellClick(x, y, this.currentLayer, roomIndex, true);
							}
						} else {
							// Paint mode: just handle the click
							this.handleCellClick(x, y, this.currentLayer, roomIndex, true);
						}
					}
				});

				cell.addEventListener("mouseenter", (e) => {
					// Update mouse position for status bar
					this.currentMousePosition = { x, y, z: this.currentLayer };
					this.updateStatusBar();

					if (this.isSelecting && this.selectionMode !== null) {
						// Update selection end point
						this.selectionEnd = { x, y, z: this.currentLayer };
						this.updateSelection();
					} else if (
						this.isDragging &&
						this.selectedTemplate !== null &&
						this.placementMode === "insert"
					) {
						e.preventDefault();
						// Only place if this cell hasn't been processed yet
						const cellKey = `${x},${y},${this.currentLayer}`;
						if (!this.processedCells.has(cellKey)) {
							this.processedCells.add(cellKey);
							this.handleCellClick(x, y, this.currentLayer, roomIndex, true);
						}
					}
				});

				cell.addEventListener("mouseleave", () => {
					// Clear mouse position when leaving cell
					this.currentMousePosition = null;
					this.updateStatusBar();
				});

				cell.addEventListener("click", (e) => {
					if (!this.isDragging) {
						this.handleCellClick(x, y, this.currentLayer, roomIndex);
					} else {
						e.preventDefault();
					}
				});

				rowWrapper.appendChild(cell);
			}
			contentArea.appendChild(rowWrapper);
		}

		wrapper.appendChild(contentArea);
		gridContainer.appendChild(wrapper);

		// Restore selection visuals after rendering
		this.selectedCells = previousSelection;
		this.updateSelectionVisuals();

		// Restore single cell selection visual if selectedCell is set and on current layer
		if (this.selectedCell && this.selectedCell.z === this.currentLayer) {
			const { x, y, z } = this.selectedCell;
			const cell = document.querySelector(
				`[data-x="${x}"][data-y="${y}"][data-z="${z}"]`
			);
			if (cell) {
				cell.classList.add("selected");
			}
		} else if (this.selectedCell && this.selectedCell.z !== this.currentLayer) {
			// Clear selectedCell if it's on a different layer
			this.selectedCell = null;
		}

		// Update status bar after rendering
		this.updateStatusBar();
	}

	updateStatusBar() {
		// Template - shows the selected template, not active placement
		const templateEl = document.getElementById("status-template");
		if (templateEl) {
			if (
				this.selectedTemplate !== null &&
				this.selectedTemplate !== undefined &&
				this.selectedTemplateType
			) {
				const dungeon = this.yamlData?.dungeon;
				if (dungeon) {
					let templateName = "Unknown";
					if (this.selectedTemplateType === "room") {
						const template = dungeon.rooms[this.selectedTemplate];
						templateName = template?.display || `Room ${this.selectedTemplate}`;
					} else if (this.selectedTemplateType === "mob") {
						const template = dungeon.templates?.find(
							(t) => t.id === this.selectedTemplate
						);
						templateName = template?.display || `Mob ${this.selectedTemplate}`;
					} else if (this.selectedTemplateType === "object") {
						const template = dungeon.templates?.find(
							(t) => t.id === this.selectedTemplate
						);
						templateName =
							template?.display || `Object ${this.selectedTemplate}`;
					}
					templateEl.textContent = templateName;
				} else {
					templateEl.textContent = "None";
				}
			} else {
				templateEl.textContent = "None";
			}
		}

		// Tool - shows the selected tool, not active usage
		const toolEl = document.getElementById("status-tool");
		if (toolEl) {
			if (this.selectionMode) {
				const toolNames = {
					rectangle: "Rectangle",
					circle: "Circle",
					squircle: "Squircle",
					line: "Line",
					"edge-line": "Edge Line",
					"edge-rectangle": "Edge Rectangle",
					"edge-circle": "Edge Circle",
					"edge-squircle": "Edge Squircle",
				};
				toolEl.textContent =
					toolNames[this.selectionMode] || this.selectionMode;
			} else {
				toolEl.textContent = "None";
			}
		}

		// Mode
		const modeEl = document.getElementById("status-mode");
		if (modeEl) {
			modeEl.textContent = this.placementMode === "paint" ? "Paint" : "Insert";
		}

		// Position
		const positionEl = document.getElementById("status-position");
		if (positionEl) {
			if (this.currentMousePosition) {
				const { x, y, z } = this.currentMousePosition;
				positionEl.textContent = `(${x}, ${y}, ${z})`;
			} else {
				positionEl.textContent = "—";
			}
		}

		// History
		const historyEl = document.getElementById("status-history");
		if (historyEl) {
			historyEl.textContent = this.changes.length.toString();
		}

		// Changes
		const changesEl = document.getElementById("status-changes");
		if (changesEl) {
			if (this.hasUnsavedChanges) {
				changesEl.textContent = "Unsaved";
				changesEl.className = "status-value unsaved";
			} else {
				changesEl.textContent = "Saved";
				changesEl.className = "status-value saved";
			}
		}
	}

	handleCellClick(x, y, z, currentRoomIndex, skipInfo = false) {
		// Only update single cell selection if no selection tool is active
		if (this.selectionMode === null) {
			// Update selected cell
			document
				.querySelectorAll(".grid-cell")
				.forEach((c) => c.classList.remove("selected"));
			const cell = document.querySelector(
				`[data-x="${x}"][data-y="${y}"][data-z="${z}"]`
			);
			if (cell) {
				cell.classList.add("selected");
				this.selectedCell = { x, y, z };
				this.updateActionButtonStates();
			}
		}

		// If a template is selected, place it
		if (
			this.selectedTemplate !== null &&
			this.selectedTemplateType === "room"
		) {
			this.placeRoomTemplate(x, y, z);
		} else if (
			this.selectedTemplate !== null &&
			(this.selectedTemplateType === "mob" ||
				this.selectedTemplateType === "object")
		) {
			this.addReset(x, y, z);
		}

		// Show room info (skip during drag to avoid flickering)
		// Always show when no template is selected, or after placement
		if (!skipInfo && !this.isDragging) {
			// If no template is selected, switch to info tab
			if (this.selectedTemplate === null) {
				const rightSidebar = document.querySelector(".sidebar.right");
				if (rightSidebar) {
					// Switch to info tab
					rightSidebar
						.querySelectorAll(".tab")
						.forEach((t) => t.classList.remove("active"));
					rightSidebar
						.querySelectorAll(".tab-content")
						.forEach((c) => c.classList.remove("active"));

					const infoTab = rightSidebar.querySelector('[data-tab="info"]');
					const infoTabContent = rightSidebar.querySelector("#info-tab");

					if (infoTab) {
						infoTab.classList.add("active");
					}
					if (infoTabContent) {
						infoTabContent.classList.add("active");
					}
				}
			}
			this.showRoomInfo(x, y, z);
		}
	}

	placeRoomTemplate(x, y, z) {
		if (
			!this.yamlData ||
			this.selectedTemplate === null ||
			this.selectedTemplate === undefined
		)
			return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];
		let changeOccurred = false;
		const changeMetadata = {
			mode: this.placementMode,
			coordinates: { x, y, z },
		};

		// Ensure row exists
		if (!layer[y]) {
			layer[y] = new Array(dungeon.dimensions.width).fill(0);
		}

		// Check if this is a delete operation
		if (this.selectedTemplate === "__DELETE__") {
			if (this.placementMode === "paint") {
				// Paint delete: flood fill delete connected matching rooms
				const targetValue = layer[y][x]; // The value we're matching
				if (targetValue > 0) {
					const targetRoomIndex = targetValue - 1;
					const targetRoom = dungeon.rooms[targetRoomIndex];
					const roomName = targetRoom?.display || `Room ${targetRoomIndex + 1}`;
					let deletedCount = 0;

					// Flood fill algorithm: delete connected matching cells
					const visited = new Set();
					const queue = [{ x, y, z }];

					while (queue.length > 0) {
						const cell = queue.shift();
						const cellKey = `${cell.x},${cell.y},${cell.z}`;

						// Skip if already visited
						if (visited.has(cellKey)) continue;
						visited.add(cellKey);

						// Get the layer for this cell
						const cellLayerIndex = dungeon.dimensions.layers - 1 - cell.z;
						const cellLayer = dungeon.grid[cellLayerIndex] || [];

						// Ensure row exists
						if (!cellLayer[cell.y]) {
							cellLayer[cell.y] = new Array(dungeon.dimensions.width).fill(0);
						}
						const cellRow = cellLayer[cell.y];

						// Check if this cell matches the target value
						if (cellRow[cell.x] === targetValue) {
							// Delete this cell
							cellRow[cell.x] = 0;
							deletedCount++;

							// Remove resets for this room
							this.removeResetsAt(cell.x, cell.y, cell.z);

							// Remove exit overrides for this room
							this.deleteExitOverride(dungeon, cell.x, cell.y, cell.z);

							// Check adjacent cells (up, down, left, right)
							const directions = [
								{ x: 0, y: -1, z: 0 }, // up
								{ x: 0, y: 1, z: 0 }, // down
								{ x: -1, y: 0, z: 0 }, // left
								{ x: 1, y: 0, z: 0 }, // right
							];

							for (const dir of directions) {
								const nextX = cell.x + dir.x;
								const nextY = cell.y + dir.y;
								const nextZ = cell.z + dir.z;

								// Check bounds
								if (
									nextX >= 0 &&
									nextX < dungeon.dimensions.width &&
									nextY >= 0 &&
									nextY < dungeon.dimensions.height &&
									nextZ >= 0 &&
									nextZ < dungeon.dimensions.layers
								) {
									const nextKey = `${nextX},${nextY},${nextZ}`;
									if (!visited.has(nextKey)) {
										queue.push({ x: nextX, y: nextY, z: nextZ });
									}
								}
							}
						}
					}

					// Clean up empty exitOverrides array after paint delete
					if (
						dungeon.exitOverrides &&
						Array.isArray(dungeon.exitOverrides) &&
						dungeon.exitOverrides.length === 0
					) {
						delete dungeon.exitOverrides;
					}

					this.showToast(
						`Painted delete: ${roomName}`,
						`Deleted ${deletedCount} room${deletedCount !== 1 ? "s" : ""}`
					);
					this.loadResets(dungeon);
					if (deletedCount > 0) {
						changeOccurred = true;
						changeMetadata.deletedCount = deletedCount;
						changeMetadata.deleteMode = "paint";
					}
				} else {
					this.showToast(
						"No room to delete",
						`At coordinates (${x}, ${y}, ${z})`
					);
				}
			} else {
				// Insert delete: delete single room
				const hadRoom = layer[y][x] > 0;
				if (hadRoom) {
					// Get room info before deleting
					const roomIndex = layer[y][x] - 1;
					const room = dungeon.rooms[roomIndex];
					const roomName = room?.display || `Room ${roomIndex + 1}`;

					// Delete the room (set to 0)
					layer[y][x] = 0;

					// Also remove any resets for this room
					this.removeResetsAt(x, y, z);

					// Remove exit overrides for this room
					this.deleteExitOverride(dungeon, x, y, z);

					this.showToast(
						`Deleted ${roomName}`,
						`At coordinates (${x}, ${y}, ${z})`
					);
					this.loadResets(dungeon);
					changeOccurred = true;
					changeMetadata.deletedCount = 1;
					changeMetadata.deleteMode = "single";
					changeMetadata.deletedRoom = roomName;
				} else {
					this.showToast(
						"No room to delete",
						`At coordinates (${x}, ${y}, ${z})`
					);
				}
			}

			// Re-render map
			this.renderMap(dungeon);
			if (changeOccurred) {
				this.makeChange({
					action: EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE,
					actionTarget: `${x},${y},${z}`,
					newParameters: {
						mode: this.placementMode,
					},
					metadata: changeMetadata,
				});
			}
			return;
		}

		// Regular room placement
		let densePlacementRemovedResets = false;
		const newRoomTemplate =
			this.selectedTemplate !== "__DELETE__"
				? dungeon.rooms[this.selectedTemplate]
				: null;
		if (this.placementMode === "paint") {
			// Paint mode: flood fill connected matching cells
			const targetRoomIndex = layer[y][x] > 0 ? layer[y][x] - 1 : -1;
			const targetValue = layer[y][x]; // The value we're matching (0 for empty, or room index + 1)
			const templateIndex = parseInt(this.selectedTemplate) + 1;
			const newRoomName = newRoomTemplate?.display || `Room ${templateIndex}`;
			let filledCount = 0;

			// Flood fill algorithm: fill connected matching cells
			const visited = new Set();
			const queue = [{ x, y, z }];

			while (queue.length > 0) {
				const cell = queue.shift();
				const cellKey = `${cell.x},${cell.y},${cell.z}`;

				// Skip if already visited
				if (visited.has(cellKey)) continue;
				visited.add(cellKey);

				// Get the layer for this cell
				const cellLayerIndex = dungeon.dimensions.layers - 1 - cell.z;
				const cellLayer = dungeon.grid[cellLayerIndex] || [];

				// Ensure row exists
				if (!cellLayer[cell.y]) {
					cellLayer[cell.y] = new Array(dungeon.dimensions.width).fill(0);
				}
				const cellRow = cellLayer[cell.y];

				// Check if this cell matches the target value
				if (cellRow[cell.x] === targetValue) {
					// Fill this cell
					cellRow[cell.x] = templateIndex;
					filledCount++;
					if (
						newRoomTemplate?.dense &&
						this.removeResetsAt(cell.x, cell.y, cell.z) > 0
					) {
						densePlacementRemovedResets = true;
					}

					// Check adjacent cells (up, down, left, right)
					const directions = [
						{ x: 0, y: -1, z: 0 }, // up
						{ x: 0, y: 1, z: 0 }, // down
						{ x: -1, y: 0, z: 0 }, // left
						{ x: 1, y: 0, z: 0 }, // right
					];

					for (const dir of directions) {
						const nextX = cell.x + dir.x;
						const nextY = cell.y + dir.y;
						const nextZ = cell.z + dir.z;

						// Check bounds
						if (
							nextX >= 0 &&
							nextX < dungeon.dimensions.width &&
							nextY >= 0 &&
							nextY < dungeon.dimensions.height &&
							nextZ >= 0 &&
							nextZ < dungeon.dimensions.layers
						) {
							const nextKey = `${nextX},${nextY},${nextZ}`;
							if (!visited.has(nextKey)) {
								queue.push({ x: nextX, y: nextY, z: nextZ });
							}
						}
					}
				}
			}

			this.showToast(
				`Painted: ${newRoomName}`,
				`Filled ${filledCount} cell${filledCount !== 1 ? "s" : ""}`
			);
			if (filledCount > 0) {
				changeOccurred = true;
				changeMetadata.filledCount = filledCount;
				changeMetadata.fillMode = "paint";
				changeMetadata.targetRoomIndex = targetRoomIndex;
			}
		} else {
			// Insert mode: place single room
			const templateIndex = parseInt(this.selectedTemplate) + 1;
			const hadRoom = layer[y][x] > 0;
			layer[y][x] = templateIndex;
			if (newRoomTemplate?.dense && this.removeResetsAt(x, y, z) > 0) {
				densePlacementRemovedResets = true;
			}

			// Get room template name for toast
			const roomName = newRoomTemplate?.display || `Room ${templateIndex}`;

			// Show toast notification
			if (hadRoom) {
				this.showToast(
					`Replaced with ${roomName}`,
					`At coordinates (${x}, ${y}, ${z})`
				);
			} else {
				this.showToast(
					`Placed ${roomName}`,
					`At coordinates (${x}, ${y}, ${z})`
				);
			}
			changeOccurred = true;
			changeMetadata.fillMode = "single";
			changeMetadata.replacedRoom = hadRoom;
			changeMetadata.templateIndex = templateIndex;
		}

		if (densePlacementRemovedResets) {
			this.loadResets(dungeon);
			changeMetadata.removedResets = true;
		}

		// Re-render map
		this.renderMap(dungeon);

		if (changeOccurred) {
			const action =
				this.selectedTemplate === "__DELETE__"
					? EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE
					: EDITOR_ACTIONS.PLACE_ROOM_TEMPLATE;

			this.makeChange({
				action,
				actionTarget:
					this.selectedTemplate === "__DELETE__" ? null : this.selectedTemplate,
				newParameters: {
					mode: this.placementMode,
					template: this.selectedTemplate,
				},
				metadata: changeMetadata,
			});
		}
	}

	addReset(x, y, z) {
		if (
			!this.yamlData ||
			this.selectedTemplate === null ||
			this.selectedTemplate === undefined
		)
			return;

		const dungeon = this.yamlData.dungeon;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];

		// Ensure row exists
		if (!layer[y]) {
			layer[y] = new Array(dungeon.dimensions.width).fill(0);
		}

		// Get the room template ID at the clicked cell
		const targetRoomIndex = layer[y][x] > 0 ? layer[y][x] - 1 : -1;

		if (targetRoomIndex < 0) {
			this.showToast(
				"Cannot add reset",
				"Select a room before placing mobs or objects"
			);
			return;
		}

		const targetRoom = dungeon.rooms[targetRoomIndex];
		if (targetRoom?.dense) {
			this.showToast(
				"Cannot add reset",
				"Dense rooms cannot contain mobs or objects"
			);
			return;
		}

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeonId = this.currentDungeonId || dungeon.id || "dungeon";
		const targetValue = layer[y][x]; // The room template index + 1 we're matching

		if (!dungeon.resets) {
			dungeon.resets = [];
		}

		// Get template name for toast
		const template = dungeon.templates?.find(
			(t) => t.id === this.selectedTemplate
		);
		const templateName = template?.display || this.selectedTemplate;
		const templateType = this.selectedTemplateType === "mob" ? "Mob" : "Object";

		if (this.placementMode === "paint") {
			// Paint mode: flood fill all cells with the same room template ID
			const visited = new Set();
			const queue = [{ x, y, z }];
			let filledCount = 0;

			while (queue.length > 0) {
				const cell = queue.shift();
				const cellKey = `${cell.x},${cell.y},${cell.z}`;

				// Skip if already visited
				if (visited.has(cellKey)) continue;
				visited.add(cellKey);

				// Get the layer for this cell
				const cellLayerIndex = dungeon.dimensions.layers - 1 - cell.z;
				const cellLayer = dungeon.grid[cellLayerIndex] || [];

				// Ensure row exists
				if (!cellLayer[cell.y]) {
					cellLayer[cell.y] = new Array(dungeon.dimensions.width).fill(0);
				}
				const cellRow = cellLayer[cell.y];

				// Check if this cell matches the target room template ID
				if (cellRow[cell.x] === targetValue) {
					const cellRoom = this.getRoomAt(dungeon, cell.x, cell.y, cell.z);
					if (cellRoom && !cellRoom.dense) {
						const cellRoomRef = `@${dungeonId}{${cell.x},${cell.y},${cell.z}}`;

						// Check if reset already exists
						const existing = dungeon.resets.find(
							(r) =>
								r.roomRef === cellRoomRef &&
								r.templateId === this.selectedTemplate
						);

						if (!existing) {
							// Add new reset
							dungeon.resets.push({
								templateId: this.selectedTemplate,
								roomRef: cellRoomRef,
								minCount: 1,
								maxCount: 1,
							});
							filledCount++;
						}
					}

					// Check adjacent cells (up, down, left, right)
					const directions = [
						{ x: 0, y: -1, z: 0 }, // up
						{ x: 0, y: 1, z: 0 }, // down
						{ x: -1, y: 0, z: 0 }, // left
						{ x: 1, y: 0, z: 0 }, // right
					];

					for (const dir of directions) {
						const nextX = cell.x + dir.x;
						const nextY = cell.y + dir.y;
						const nextZ = cell.z + dir.z;

						// Check bounds
						if (
							nextX >= 0 &&
							nextX < dungeon.dimensions.width &&
							nextY >= 0 &&
							nextY < dungeon.dimensions.height &&
							nextZ >= 0 &&
							nextZ < dungeon.dimensions.layers
						) {
							const nextKey = `${nextX},${nextY},${nextZ}`;
							if (!visited.has(nextKey)) {
								queue.push({ x: nextX, y: nextY, z: nextZ });
							}
						}
					}
				}
			}

			if (filledCount > 0) {
				this.showToast(
					`Painted ${templateType} Reset: ${templateName}`,
					`Added to ${filledCount} cell${filledCount !== 1 ? "s" : ""}`
				);

				// Reload resets display
				this.loadResets(dungeon);

				// Re-render map to reflect the new resets (mob/object will show on grid)
				this.renderMap(dungeon);

				this.makeChange({
					action: EDITOR_ACTIONS.CREATE_RESET,
					actionTarget: this.selectedTemplate,
					newParameters: {
						mode: this.placementMode,
						template: this.selectedTemplate,
					},
					metadata: {
						templateId: this.selectedTemplate,
						templateType,
						filledCount,
						mode: this.placementMode,
					},
				});
			} else {
				this.showToast(
					`No cells painted`,
					`All matching cells already have this ${templateType.toLowerCase()} reset`
				);
			}
			return;
		} else {
			// Insert mode: add reset to single cell
			const roomRef = `@${dungeonId}{${x},${y},${z}}`;

			// Check if reset already exists - if so, increment count instead of alerting
			const existing = dungeon.resets.find(
				(r) => r.roomRef === roomRef && r.templateId === this.selectedTemplate
			);

			let changeAction = EDITOR_ACTIONS.CREATE_RESET;
			let newParameters = null;
			let oldParameters = null;

			if (existing) {
				// Increment maxCount
				const previousMax = existing.maxCount || 1;
				existing.maxCount = previousMax + 1;
				changeAction = EDITOR_ACTIONS.EDIT_RESET_FIELD;
				oldParameters = { maxCount: previousMax };
				newParameters = { maxCount: existing.maxCount };
				// Show toast notification
				this.showToast(
					`Updated ${templateType} Reset: ${templateName}`,
					`Count: ${existing.minCount || 1}-${
						existing.maxCount
					} at (${x}, ${y}, ${z})`
				);
			} else {
				// Add new reset
				dungeon.resets.push({
					templateId: this.selectedTemplate,
					roomRef: roomRef,
					minCount: 1,
					maxCount: 1,
				});
				newParameters = { minCount: 1, maxCount: 1 };
				// Show toast notification
				this.showToast(
					`Added ${templateType} Reset: ${templateName}`,
					`At coordinates (${x}, ${y}, ${z})`
				);
			}

			// Reload resets display
			this.loadResets(dungeon);

			// Re-render map to reflect the new reset (mob/object will show on grid)
			this.renderMap(dungeon);

			this.makeChange({
				action: changeAction,
				actionTarget: roomRef,
				newParameters,
				oldParameters,
				metadata: {
					templateId: this.selectedTemplate,
					templateType,
					roomRef,
				},
			});
		}
	}

	showRoomInfo(x, y, z) {
		if (!this.yamlData) return;

		const dungeon = this.yamlData.dungeon;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];
		const row = layer[y] || [];
		const roomIndex = row[x] || 0;

		const infoPanel = document.getElementById("info-panel");
		const dungeonId = this.currentDungeonId;
		const roomRef = `@${dungeonId}{${x},${y},${z}}`;

		if (roomIndex > 0) {
			const room = dungeon.rooms[roomIndex - 1];
			const resets = dungeon.resets?.filter((r) => r.roomRef === roomRef) || [];
			const roomAtCell = this.getRoomAt(dungeon, x, y, z);

			// Check if this cell has an exit override
			const hasOverride = !!this.getExitOverride(dungeon, x, y, z);
			const templateAllowedExits = room.allowedExits || 0;
			const currentAllowedExits = roomAtCell
				? roomAtCell.allowedExits
				: templateAllowedExits;

			infoPanel.innerHTML = `
				<h3>Room: ${room?.display || "Unknown"}</h3>
				<p><strong>Coordinates:</strong> ${x}, ${y}, ${z}</p>
				<p><strong>Reference:</strong> ${roomRef}</p>
				${
					room?.description
						? `<p><strong>Description:</strong> ${room.description}</p>`
						: ""
				}
				<h4>Exit Overrides</h4>
				<p style="font-size: 0.85rem; color: #aaa; margin-bottom: 0.5rem;">
					${
						hasOverride
							? "This room has custom exit overrides"
							: "Using template's default exits"
					}
				</p>
				<button id="edit-exit-override-btn" class="edit-exit-override-btn" style="margin-bottom: 1rem;">
					${hasOverride ? "Edit Exit Override" : "Add Exit Override"}
				</button>
				<h4>Resets (${resets.length})</h4>
				${
					resets.length > 0
						? resets
								.map((reset, i) => {
									const template = dungeon.templates?.find(
										(t) => t.id === reset.templateId
									);
									return `<p>• ${template?.display || reset.templateId} (${
										reset.minCount || 1
									}-${reset.maxCount || 1})</p>`;
								})
								.join("")
						: "<p>No resets</p>"
				}
			`;

			// Set up exit override editor button
			const editBtn = document.getElementById("edit-exit-override-btn");
			if (editBtn) {
				editBtn.addEventListener("click", () => {
					this.editExitOverride(x, y, z);
				});
			}
		} else {
			infoPanel.innerHTML = `
				<h3>Empty Cell</h3>
				<p><strong>Coordinates:</strong> ${x}, ${y}, ${z}</p>
				<p><strong>Reference:</strong> ${roomRef}</p>
				<p>Click a room template and then click here to place a room.</p>
			`;
		}
	}

	editTemplate(type, id) {
		const dungeon = this.yamlData.dungeon;
		let template;

		if (type === "room") {
			template = dungeon.rooms[parseInt(id)];
		} else {
			template = dungeon.templates?.find((t) => t.id === id);
		}

		if (!template) {
			// Create new template
			if (type === "room") {
				template = { display: "", description: "" };
			} else if (type === "mob") {
				template = { id: "", type: "Mob", display: "", description: "" };
			} else {
				template = { id: "", type: "Weapon", display: "", description: "" };
			}
		}

		this.showTemplateModal(type, id, template);
	}

	editExitOverride(x, y, z) {
		if (!this.yamlData) return;

		const dungeon = this.yamlData.dungeon;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];
		const row = layer[y] || [];
		const roomIndex = row[x] || 0;

		if (roomIndex === 0) {
			this.showToast("No room to edit", "Select a room cell first");
			return;
		}

		const room = dungeon.rooms[roomIndex - 1];
		const roomAtCell = this.getRoomAt(dungeon, x, y, z);

		// Get current override value
		const currentOverride = this.getExitOverride(dungeon, x, y, z);

		// Get current allowedExits (from override if exists, otherwise template default)
		const templateAllowedExits = room.allowedExits || 0;
		let currentAllowedExitsValue = templateAllowedExits;
		if (currentOverride) {
			if (currentOverride.allowedExits !== undefined) {
				currentAllowedExitsValue =
					currentOverride.allowedExits ?? templateAllowedExits;
			}
		} else {
			const currentAllowedExits = roomAtCell
				? roomAtCell.allowedExits
				: templateAllowedExits;
			currentAllowedExitsValue = currentAllowedExits;
		}

		// Get current roomLinks (from override if exists)
		let currentRoomLinks = {};
		if (currentOverride && currentOverride.roomLinks) {
			currentRoomLinks = currentOverride.roomLinks || {};
		}

		// Initialize exitOverrides if it doesn't exist
		if (!dungeon.exitOverrides) {
			dungeon.exitOverrides = [];
		}

		const DIRECTION = {
			NORTH: 1 << 0,
			SOUTH: 1 << 1,
			EAST: 1 << 2,
			WEST: 1 << 3,
			NORTHEAST: 1 << 4,
			NORTHWEST: 1 << 5,
			SOUTHEAST: 1 << 6,
			SOUTHWEST: 1 << 7,
			UP: 1 << 8,
			DOWN: 1 << 9,
		};

		const TEXT2DIR = {
			north: DIRECTION.NORTH,
			south: DIRECTION.SOUTH,
			east: DIRECTION.EAST,
			west: DIRECTION.WEST,
			northeast: DIRECTION.NORTHEAST,
			northwest: DIRECTION.NORTHWEST,
			southeast: DIRECTION.SOUTHEAST,
			southwest: DIRECTION.SOUTHWEST,
			up: DIRECTION.UP,
			down: DIRECTION.DOWN,
		};

		const modal = document.getElementById("template-modal");
		const title = document.getElementById("modal-title");
		const body = document.getElementById("modal-body");

		title.textContent = `Edit Exit Override - ${
			room?.display || "Room"
		} at (${x}, ${y}, ${z})`;

		const exitButtonsHtml = `
			<div class="exit-controls" style="margin: 1rem 0;">
				<h4 style="margin-bottom: 0.5rem;">Allowed Exits</h4>
				<p style="font-size: 0.85rem; color: #aaa; margin-bottom: 0.75rem;">
					Template default: ${this.formatAllowedExits(templateAllowedExits)}
				</p>
				<div class="exit-buttons">
					<div class="exit-buttons-row">
						<button class="exit-row-toggle-btn" data-row="0" title="Toggle all cardinals">⦿</button>
						<button class="exit-btn" data-direction="north" style="padding: 0.5rem;">NORTH</button>
						<button class="exit-btn" data-direction="south" style="padding: 0.5rem;">SOUTH</button>
						<button class="exit-btn" data-direction="east" style="padding: 0.5rem;">EAST</button>
						<button class="exit-btn" data-direction="west" style="padding: 0.5rem;">WEST</button>
					</div>
					<div class="exit-buttons-row">
						<button class="exit-row-toggle-btn" data-row="1" title="Toggle all diagonals">⦿</button>
						<button class="exit-btn" data-direction="northeast" style="padding: 0.5rem;">NORTHEAST</button>
						<button class="exit-btn" data-direction="northwest" style="padding: 0.5rem;">NORTHWEST</button>
						<button class="exit-btn" data-direction="southeast" style="padding: 0.5rem;">SOUTHEAST</button>
						<button class="exit-btn" data-direction="southwest" style="padding: 0.5rem;">SOUTHWEST</button>
					</div>
					<div class="exit-buttons-row">
						<button class="exit-row-toggle-btn" data-row="2" title="Toggle up/down">⦿</button>
						<button class="exit-btn" data-direction="up" style="padding: 0.5rem;">UP</button>
						<button class="exit-btn" data-direction="down" style="padding: 0.5rem;">DOWN</button>
					</div>
				</div>
			</div>
		`;

		// Build roomLinks HTML
		const allDirections = [
			"north",
			"south",
			"east",
			"west",
			"northeast",
			"northwest",
			"southeast",
			"southwest",
			"up",
			"down",
		];
		const usedDirections = Object.keys(currentRoomLinks);

		const roomLinksHtml = Object.entries(currentRoomLinks)
			.map(([dir, ref], index) => {
				// Get available directions (all except the ones used by other links)
				const availableDirs = allDirections.filter(
					(d) => d === dir || !usedDirections.includes(d)
				);

				return `<div class="room-link-item" data-index="${index}">${this.generateRoomLinkHTML(
					availableDirs,
					dir,
					ref,
					index
				)}</div>`;
			})
			.join("");

		const canAddMore = usedDirections.length < allDirections.length;

		const roomLinksSectionHtml = `
			<div class="form-group" style="margin-top: 1.5rem;">
				<label>Room Links (optional)</label>
				<p style="font-size: 0.85rem; color: #aaa; margin-bottom: 0.75rem;">
					Override exit links to other rooms. If provided, allowedExits should also be set.
				</p>
				<div id="exit-override-room-links-container" style="margin-bottom: 0.5rem;">
					${roomLinksHtml}
				</div>
				<button type="button" class="add-link-btn" id="exit-override-add-room-link-btn" ${
					!canAddMore ? "disabled" : ""
				} style="padding: 0.5rem;">+ Add Room Link</button>
				${
					!canAddMore
						? '<p style="color: #aaa; font-size: 0.85rem; margin-top: 0.5rem;">All directions are in use</p>'
						: ""
				}
			</div>
		`;

		body.innerHTML = `
			<div class="form-group">
				<label>Override exits for this specific room cell</label>
				${exitButtonsHtml}
			</div>
			${roomLinksSectionHtml}
		`;

		// Hide the default modal actions and use our custom ones
		const defaultModalActions = modal.querySelector(".modal-actions");
		if (defaultModalActions) {
			defaultModalActions.style.display = "none";
		}

		// Create custom modal actions for exit override
		let customModalActions = modal.querySelector(".exit-override-actions");
		if (!customModalActions) {
			customModalActions = document.createElement("div");
			customModalActions.className = "modal-actions exit-override-actions";
			modal.querySelector(".modal-content").appendChild(customModalActions);
		}
		customModalActions.style.display = "flex";
		customModalActions.innerHTML = `
			<button id="exit-override-save-btn" class="save-btn">Save</button>
			<button id="exit-override-clear-btn" class="cancel-btn clear-override-btn" style="margin-left: 0.5rem;">Clear Override</button>
			<button id="exit-override-cancel-btn" class="cancel-btn">Cancel</button>
		`;

		// Set up close button handler
		const closeBtn = modal.querySelector(".close");
		if (closeBtn) {
			closeBtn.onclick = () => {
				modal.classList.remove("active");
				// Restore default modal actions
				if (defaultModalActions) {
					defaultModalActions.style.display = "flex";
				}
				if (customModalActions) {
					customModalActions.style.display = "none";
				}
			};
		}

		// Store current room coordinates in modal for make-2way functionality
		modal.dataset.exitOverrideX = x;
		modal.dataset.exitOverrideY = y;
		modal.dataset.exitOverrideZ = z;

		modal.classList.add("active");

		// Refresh exit button states
		const refreshExitButtons = () => {
			document.querySelectorAll(".exit-btn").forEach((btn) => {
				const direction = btn.dataset.direction;
				const dirFlag = TEXT2DIR[direction];
				if (!dirFlag) return;

				const isEnabled = (currentAllowedExitsValue & dirFlag) !== 0;

				if (isEnabled) {
					btn.classList.remove("disabled");
					btn.classList.add("enabled");
				} else {
					btn.classList.remove("enabled");
					btn.classList.add("disabled");
				}
			});
		};

		// Set up exit button handlers
		document.querySelectorAll(".exit-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				const direction = btn.dataset.direction;
				const dirFlag = TEXT2DIR[direction];
				if (!dirFlag) return;

				// Toggle the direction bit
				currentAllowedExitsValue ^= dirFlag;
				refreshExitButtons();
			});
		});

		// Set up row toggle button handlers
		document.querySelectorAll(".exit-row-toggle-btn").forEach((toggleBtn) => {
			toggleBtn.addEventListener("click", () => {
				const rowIndex = parseInt(toggleBtn.dataset.row);
				const row = toggleBtn.closest(".exit-buttons-row");
				if (!row) return;

				// Get all exit buttons in this row (excluding the toggle button itself)
				const rowExitButtons = Array.from(row.querySelectorAll(".exit-btn"));
				if (rowExitButtons.length === 0) return;

				// Check if all buttons in the row are enabled
				const allEnabled = rowExitButtons.every((btn) => {
					const direction = btn.dataset.direction;
					const dirFlag = TEXT2DIR[direction];
					if (!dirFlag) return false;
					return (currentAllowedExitsValue & dirFlag) !== 0;
				});

				// Toggle all buttons in the row
				rowExitButtons.forEach((btn) => {
					const direction = btn.dataset.direction;
					const dirFlag = TEXT2DIR[direction];
					if (!dirFlag) return;

					if (allEnabled) {
						// Turn all off
						currentAllowedExitsValue &= ~dirFlag;
					} else {
						// Turn all on
						currentAllowedExitsValue |= dirFlag;
					}
				});

				refreshExitButtons();
			});
		});

		refreshExitButtons();

		// Set up roomLinks handlers (similar to template modal)
		const updateExitOverrideRoomLinkDirections = () => {
			const container = document.getElementById(
				"exit-override-room-links-container"
			);
			if (!container) return;

			// Update each dropdown to only show available directions
			container.querySelectorAll(".room-link-direction").forEach((select) => {
				const currentValue = select.value;
				// Get all directions used by OTHER selects (not this one)
				const usedByOthers = Array.from(
					container.querySelectorAll(".room-link-direction")
				)
					.filter((s) => s !== select)
					.map((s) => s.value);

				// Available directions: current value + all unused directions
				const availableDirs = allDirections.filter(
					(d) => d === currentValue || !usedByOthers.includes(d)
				);

				// Update options
				select.innerHTML = availableDirs
					.map(
						(d) =>
							`<option value="${d}" ${d === currentValue ? "selected" : ""}>${
								d.charAt(0).toUpperCase() + d.slice(1)
							}</option>`
					)
					.join("");
			});
		};

		const getAvailableDirectionsForExitOverride = () => {
			const container = document.getElementById(
				"exit-override-room-links-container"
			);
			if (!container) return [];
			const used = Array.from(
				container.querySelectorAll(".room-link-direction")
			).map((s) => s.value);
			return allDirections.filter((d) => !used.includes(d));
		};

		const addExitOverrideRoomLink = () => {
			const container = document.getElementById(
				"exit-override-room-links-container"
			);
			if (!container) return;

			const availableDirs = getAvailableDirectionsForExitOverride();
			if (availableDirs.length === 0) return; // Can't add more

			const index = container.children.length;
			const linkItem = document.createElement("div");
			linkItem.className = "room-link-item";
			linkItem.dataset.index = index;
			linkItem.innerHTML = this.generateRoomLinkHTML(
				availableDirs,
				"",
				"",
				index
			);

			container.appendChild(linkItem);

			// Set up handlers for the new item
			const deleteBtn = linkItem.querySelector(".delete-link-btn");
			if (deleteBtn) {
				deleteBtn.onclick = (e) => {
					const idx = parseInt(e.target.dataset.index);
					deleteExitOverrideRoomLink(idx);
				};
			}

			const make2WayBtn = linkItem.querySelector(".make-2way-btn");
			if (make2WayBtn) {
				make2WayBtn.onclick = async (e) => {
					const idx = parseInt(e.target.dataset.index);
					await this.makeExit2WayForOverride(idx, x, y, z);
				};
			}

			const directionSelect = linkItem.querySelector(".room-link-direction");
			if (directionSelect) {
				directionSelect.onchange = () => {
					updateExitOverrideRoomLinkDirections();
				};
			}

			updateExitOverrideRoomLinkDirections();
		};

		const deleteExitOverrideRoomLink = (index) => {
			const container = document.getElementById(
				"exit-override-room-links-container"
			);
			if (!container) return;

			const items = Array.from(container.querySelectorAll(".room-link-item"));
			if (index >= 0 && index < items.length) {
				items[index].remove();
				// Re-index remaining items
				container.querySelectorAll(".room-link-item").forEach((item, i) => {
					item.dataset.index = i;
					const deleteBtn = item.querySelector(".delete-link-btn");
					if (deleteBtn) {
						deleteBtn.dataset.index = i;
						deleteBtn.onclick = (e) => {
							const idx = parseInt(e.target.dataset.index);
							deleteExitOverrideRoomLink(idx);
						};
					}
					const make2WayBtn = item.querySelector(".make-2way-btn");
					if (make2WayBtn) {
						make2WayBtn.dataset.index = i;
						make2WayBtn.onclick = async (e) => {
							const idx = parseInt(e.target.dataset.index);
							await this.makeExit2WayForOverride(idx, x, y, z);
						};
					}
				});
				updateExitOverrideRoomLinkDirections();
			}
		};

		// Add room link button
		const addLinkBtn = document.getElementById(
			"exit-override-add-room-link-btn"
		);
		if (addLinkBtn) {
			addLinkBtn.onclick = () => {
				addExitOverrideRoomLink();
			};
		}

		// Delete link buttons
		document
			.querySelectorAll("#exit-override-room-links-container .delete-link-btn")
			.forEach((btn) => {
				btn.onclick = (e) => {
					const index = parseInt(e.target.dataset.index);
					deleteExitOverrideRoomLink(index);
				};
			});

		// Make 2-way buttons
		document
			.querySelectorAll("#exit-override-room-links-container .make-2way-btn")
			.forEach((btn) => {
				btn.onclick = async (e) => {
					const index = parseInt(e.target.dataset.index);
					await this.makeExit2WayForOverride(index, x, y, z);
				};
			});

		// Direction change handlers
		document
			.querySelectorAll(
				"#exit-override-room-links-container .room-link-direction"
			)
			.forEach((select) => {
				select.onchange = () => {
					updateExitOverrideRoomLinkDirections();
				};
			});

		// Save button
		document
			.getElementById("exit-override-save-btn")
			.addEventListener("click", () => {
				this.saveStateToHistory();

				// Store the old value before updating
				const oldOverride = this.getExitOverride(dungeon, x, y, z);
				const oldValue = oldOverride
					? {
							allowedExits: oldOverride.allowedExits,
							roomLinks: oldOverride.roomLinks,
					  }
					: null;

				// Collect roomLinks
				const roomLinks = {};
				const linkItems = document.querySelectorAll(
					"#exit-override-room-links-container .room-link-item"
				);
				linkItems.forEach((item) => {
					const direction = item.querySelector(".room-link-direction").value;
					const dungeonSelect = item.querySelector(".room-link-dungeon");
					const xInput = item.querySelector(".room-link-x");
					const yInput = item.querySelector(".room-link-y");
					const zInput = item.querySelector(".room-link-z");

					// Try new format first (dropdown + number inputs)
					if (dungeonSelect && xInput && yInput && zInput) {
						const dungeonId = dungeonSelect.value;
						const x = parseInt(xInput.value, 10);
						const y = parseInt(yInput.value, 10);
						const z = parseInt(zInput.value, 10);
						if (dungeonId && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
							roomLinks[direction] = this.formatRoomRef(dungeonId, x, y, z);
						}
					} else {
						// Fallback to old text input format
						const refInput = item.querySelector(".room-link-ref");
						if (refInput) {
							const ref = refInput.value.trim();
							if (ref) {
								roomLinks[direction] = ref;
							}
						}
					}
				});

				// Store the override - use object if roomLinks exist, otherwise use number
				const overrideValue =
					Object.keys(roomLinks).length > 0
						? {
								allowedExits: currentAllowedExitsValue,
								roomLinks: roomLinks,
						  }
						: currentAllowedExitsValue;

				this.setExitOverride(dungeon, x, y, z, overrideValue);

				// Re-render map to show updated exits
				this.renderMap(dungeon);

				this.makeChange({
					action: EDITOR_ACTIONS.EDIT_ROOM_EXIT_OVERRIDE,
					actionTarget: `${x},${y},${z}`,
					newParameters: {
						allowedExits: currentAllowedExitsValue,
						...(Object.keys(roomLinks).length > 0 ? { roomLinks } : {}),
					},
					oldParameters: oldValue,
					metadata: {
						coordinates: { x, y, z },
						roomDisplay: room?.display || "Unknown",
						templateAllowedExits,
					},
				});

				modal.classList.remove("active");
				// Restore default modal actions
				if (defaultModalActions) {
					defaultModalActions.style.display = "flex";
				}
				if (customModalActions) {
					customModalActions.style.display = "none";
				}
				this.showToast(
					"Exit override saved",
					`Updated exits for ${room?.display || "room"}`
				);
				this.showRoomInfo(x, y, z); // Refresh room info
			});

		// Clear override button
		document
			.getElementById("exit-override-clear-btn")
			.addEventListener("click", () => {
				const oldOverride = this.getExitOverride(dungeon, x, y, z);
				if (!oldOverride) {
					this.showToast("No override to clear", "");
					return;
				}

				this.saveStateToHistory();

				const oldValue = {
					allowedExits: oldOverride.allowedExits,
					roomLinks: oldOverride.roomLinks,
				};
				this.deleteExitOverride(dungeon, x, y, z);

				// Re-render map
				this.renderMap(dungeon);

				this.makeChange({
					action: EDITOR_ACTIONS.EDIT_ROOM_EXIT_OVERRIDE,
					actionTarget: `${x},${y},${z}`,
					newParameters: null,
					oldParameters: {
						allowedExits: oldValue,
					},
					metadata: {
						coordinates: { x, y, z },
						roomDisplay: room?.display || "Unknown",
						templateAllowedExits,
					},
				});

				modal.classList.remove("active");
				// Restore default modal actions
				if (defaultModalActions) {
					defaultModalActions.style.display = "flex";
				}
				if (customModalActions) {
					customModalActions.style.display = "none";
				}
				this.showToast("Exit override cleared", "Using template defaults");
				this.showRoomInfo(x, y, z); // Refresh room info
			});

		// Cancel button
		document
			.getElementById("exit-override-cancel-btn")
			.addEventListener("click", () => {
				modal.classList.remove("active");
				// Restore default modal actions
				if (defaultModalActions) {
					defaultModalActions.style.display = "flex";
				}
				if (customModalActions) {
					customModalActions.style.display = "none";
				}
			});
	}

	formatAllowedExits(allowedExits) {
		const directions = [];
		if (allowedExits & (1 << 0)) directions.push("N");
		if (allowedExits & (1 << 1)) directions.push("S");
		if (allowedExits & (1 << 2)) directions.push("E");
		if (allowedExits & (1 << 3)) directions.push("W");
		if (allowedExits & (1 << 4)) directions.push("NE");
		if (allowedExits & (1 << 5)) directions.push("NW");
		if (allowedExits & (1 << 6)) directions.push("SE");
		if (allowedExits & (1 << 7)) directions.push("SW");
		if (allowedExits & (1 << 8)) directions.push("UP");
		if (allowedExits & (1 << 9)) directions.push("DOWN");
		return directions.length > 0 ? directions.join(", ") : "None";
	}

	generateRoomCopyOptions(currentRoomId) {
		const dungeon = this.yamlData?.dungeon;
		if (!dungeon || !dungeon.rooms) {
			return "";
		}

		const currentIndex =
			currentRoomId !== null && currentRoomId !== undefined
				? parseInt(currentRoomId)
				: -1;
		const options = dungeon.rooms
			.map((room, index) => {
				if (index === currentIndex) {
					return null; // Exclude current room
				}
				const displayName = room.display || `Room ${index + 1}`;
				return `<option value="${index}">${displayName} #${index}</option>`;
			})
			.filter((opt) => opt !== null)
			.join("");

		return options;
	}

	copyRoomSettings(sourceRoomIndex, targetRoomId) {
		const dungeon = this.yamlData?.dungeon;
		if (
			!dungeon ||
			!dungeon.rooms ||
			sourceRoomIndex < 0 ||
			sourceRoomIndex >= dungeon.rooms.length
		) {
			return;
		}

		const sourceRoom = dungeon.rooms[sourceRoomIndex];
		if (!sourceRoom) {
			return;
		}

		// Copy display name
		const displayInput = document.getElementById("template-display");
		if (displayInput) {
			displayInput.value = sourceRoom.display || "";
		}

		// Copy description
		const descriptionInput = document.getElementById("template-description");
		if (descriptionInput) {
			descriptionInput.value = sourceRoom.description || "";
		}

		// Copy map text
		const mapTextInput = document.getElementById("template-map-text");
		if (mapTextInput) {
			mapTextInput.value = sourceRoom.mapText || "";
		}

		// Copy map color
		const mapColorSelect = document.getElementById("template-map-color");
		if (mapColorSelect && sourceRoom.mapColor !== undefined) {
			mapColorSelect.value = sourceRoom.mapColor.toString();
		}

		// Copy dense
		const denseBtn = document.getElementById("template-dense-btn");
		if (denseBtn) {
			if (sourceRoom.dense) {
				denseBtn.classList.remove("disabled");
				denseBtn.classList.add("enabled");
				denseBtn.dataset.dense = "true";
			} else {
				denseBtn.classList.remove("enabled");
				denseBtn.classList.add("disabled");
				denseBtn.dataset.dense = "false";
			}
		}

		// Copy allowedExits
		const DIRECTION = {
			NORTH: 1 << 0,
			SOUTH: 1 << 1,
			EAST: 1 << 2,
			WEST: 1 << 3,
			NORTHEAST: 1 << 4,
			NORTHWEST: 1 << 5,
			SOUTHEAST: 1 << 6,
			SOUTHWEST: 1 << 7,
			UP: 1 << 8,
			DOWN: 1 << 9,
		};
		const DEFAULT_ALLOWED_EXITS =
			DIRECTION.NORTH |
			DIRECTION.SOUTH |
			DIRECTION.EAST |
			DIRECTION.WEST |
			DIRECTION.NORTHEAST |
			DIRECTION.NORTHWEST |
			DIRECTION.SOUTHEAST |
			DIRECTION.SOUTHWEST;
		const allowedExits =
			sourceRoom.allowedExits !== undefined && sourceRoom.allowedExits !== null
				? sourceRoom.allowedExits
				: DEFAULT_ALLOWED_EXITS;

		const modal = document.getElementById("template-modal");
		if (modal) {
			modal.dataset.allowedExits = allowedExits;
		}

		// Update exit buttons
		const TEXT2DIR = {
			north: DIRECTION.NORTH,
			south: DIRECTION.SOUTH,
			east: DIRECTION.EAST,
			west: DIRECTION.WEST,
			northeast: DIRECTION.NORTHEAST,
			northwest: DIRECTION.NORTHWEST,
			southeast: DIRECTION.SOUTHEAST,
			southwest: DIRECTION.SOUTHWEST,
			up: DIRECTION.UP,
			down: DIRECTION.DOWN,
		};

		document.querySelectorAll(".exit-btn").forEach((btn) => {
			const direction = btn.dataset.direction;
			const dirFlag = TEXT2DIR[direction];
			if (!dirFlag) return;

			const isEnabled = (allowedExits & dirFlag) !== 0;
			if (isEnabled) {
				btn.classList.remove("disabled");
				btn.classList.add("enabled");
			} else {
				btn.classList.remove("enabled");
				btn.classList.add("disabled");
			}
		});

		// Copy room links
		const roomLinksContainer = document.getElementById("room-links-container");
		if (roomLinksContainer) {
			roomLinksContainer.innerHTML = "";
			const roomLinks = sourceRoom.roomLinks || {};
			const allDirections = [
				"north",
				"south",
				"east",
				"west",
				"northeast",
				"northwest",
				"southeast",
				"southwest",
				"up",
				"down",
			];
			const usedDirections = Object.keys(roomLinks);

			const roomLinksHtml = Object.entries(roomLinks)
				.map(([dir, ref], index) => {
					const availableDirs = allDirections.filter(
						(d) => d === dir || !usedDirections.includes(d)
					);
					return `<div class="room-link-item" data-index="${index}">${this.generateRoomLinkHTML(
						availableDirs,
						dir,
						ref,
						index
					)}</div>`;
				})
				.join("");

			roomLinksContainer.innerHTML = roomLinksHtml;

			// Re-attach event handlers for room links
			document.querySelectorAll(".delete-link-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const index = parseInt(e.target.dataset.index);
					this.deleteRoomLink(index);
				};
			});

			document.querySelectorAll(".make-2way-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const index = parseInt(e.target.dataset.index);
					this.makeExit2WayForTemplate(index);
				};
			});

			document.querySelectorAll(".room-link-direction").forEach((select) => {
				select.onchange = () => {
					this.updateRoomLinkDirections();
				};
			});

			// Update add button state
			const addBtn = document.getElementById("add-room-link-btn");
			if (addBtn) {
				const canAddMore = usedDirections.length < allDirections.length;
				addBtn.disabled = !canAddMore;
			}
		}

		this.showToast(
			"Room settings copied",
			`Copied settings from "${
				sourceRoom.display || `Room ${sourceRoomIndex + 1}`
			}"`
		);
	}

	showTemplateModal(type, id, template) {
		const modal = document.getElementById("template-modal");
		const title = document.getElementById("modal-title");
		const body = document.getElementById("modal-body");

		title.textContent =
			type === "room"
				? "Edit Room Template"
				: type === "mob"
				? "Edit Mob Template"
				: "Edit Object Template";

		let html = "";
		const isMob = type !== "room" && template.type === "Mob";

		if (type === "room") {
			// DIRECTION bitmap values
			const DIRECTION = {
				NORTH: 1 << 0, // 1
				SOUTH: 1 << 1, // 2
				EAST: 1 << 2, // 4
				WEST: 1 << 3, // 8
				NORTHEAST: 1 << 4, // 16
				NORTHWEST: 1 << 5, // 32
				SOUTHEAST: 1 << 6, // 64
				SOUTHWEST: 1 << 7, // 128
				UP: 1 << 8, // 256
				DOWN: 1 << 9, // 512
			};

			// Default allowedExits: NSEW + diagonals (not UP/DOWN)
			const DEFAULT_ALLOWED_EXITS =
				DIRECTION.NORTH |
				DIRECTION.SOUTH |
				DIRECTION.EAST |
				DIRECTION.WEST |
				DIRECTION.NORTHEAST |
				DIRECTION.NORTHWEST |
				DIRECTION.SOUTHEAST |
				DIRECTION.SOUTHWEST;

			// Text to DIRECTION mapping
			const TEXT2DIR = {
				north: DIRECTION.NORTH,
				south: DIRECTION.SOUTH,
				east: DIRECTION.EAST,
				west: DIRECTION.WEST,
				northeast: DIRECTION.NORTHEAST,
				northwest: DIRECTION.NORTHWEST,
				southeast: DIRECTION.SOUTHEAST,
				southwest: DIRECTION.SOUTHWEST,
				up: DIRECTION.UP,
				down: DIRECTION.DOWN,
			};

			// Get allowedExits bitmap (mandatory field, default to NSEW)
			const allowedExits =
				template.allowedExits !== undefined
					? template.allowedExits
					: DEFAULT_ALLOWED_EXITS;

			// Helper function to check if a direction is allowed
			const isAllowed = (dirText) => {
				const dir = TEXT2DIR[dirText];
				return dir && (allowedExits & dir) !== 0;
			};

			// Build room links HTML
			const roomLinks = template.roomLinks || {};
			const allDirections = [
				"north",
				"south",
				"east",
				"west",
				"northeast",
				"northwest",
				"southeast",
				"southwest",
				"up",
				"down",
			];
			const usedDirections = Object.keys(roomLinks);

			const roomLinksHtml = Object.entries(roomLinks)
				.map(([dir, ref], index) => {
					// Get available directions (all except the ones used by other links)
					const availableDirs = allDirections.filter(
						(d) => d === dir || !usedDirections.includes(d)
					);

					return `<div class="room-link-item" data-index="${index}">${this.generateRoomLinkHTML(
						availableDirs,
						dir,
						ref,
						index
					)}</div>`;
				})
				.join("");

			const canAddMore = usedDirections.length < allDirections.length;

			// Build exits HTML
			const exitDirections = [
				"north",
				"south",
				"east",
				"west",
				"northeast",
				"northwest",
				"southeast",
				"southwest",
				"up",
				"down",
			];

			const exitsHtml = exitDirections
				.map((dir) => {
					const isAllowedDir = isAllowed(dir);
					const label = dir.toUpperCase();
					return `<button type="button" class="exit-btn ${
						isAllowedDir ? "enabled" : "disabled"
					}" data-direction="${dir}">${label}</button>`;
				})
				.join("");

			html = `
				<div class="form-group">
					<label>Display Name</label>
					<input type="text" id="template-display" value="${template.display || ""}">
				</div>
				<div class="form-group">
					<label>Description</label>
					<textarea id="template-description">${template.description || ""}</textarea>
				</div>
				<div class="form-group">
					<label>Map Text (1 letter)</label>
					<input type="text" id="template-map-text" value="${
						template.mapText || ""
					}" placeholder="." maxlength="1" style="width: 80px;">
				</div>
				<div class="form-group">
					<label>Map Color</label>
					${this.generateColorSelector("template-map-color", template.mapColor)}
				</div>
				<div class="form-group">
					<label>Dense</label>
					<div class="exits-container">
						<div class="exits-buttons">
							<button type="button" class="exit-btn ${
								template.dense ? "enabled" : "disabled"
							}" id="template-dense-btn" data-dense="${
				template.dense ? "true" : "false"
			}">DENSE</button>
						</div>
					</div>
				</div>
				<div class="form-group">
					<label>Allowed Exits</label>
					<div class="exits-container">
						<div class="exits-buttons">
							${exitsHtml}
						</div>
					</div>
				</div>
				<div class="form-group">
					<label>Room Links</label>
					<div id="room-links-container">
						${roomLinksHtml}
					</div>
					<button type="button" class="add-link-btn" id="add-room-link-btn" ${
						!canAddMore ? "disabled" : ""
					}>+ Add Room Link</button>
					${
						!canAddMore
							? '<p style="color: #aaa; font-size: 0.85rem; margin-top: 0.5rem;">All directions are in use</p>'
							: ""
					}
				</div>
				<div class="form-group">
					<label>Copy Room</label>
					<div class="copy-room-container">
						<select id="copy-room-select" class="copy-room-select">
							<option value="">Select a room to copy...</option>
							${this.generateRoomCopyOptions(id)}
						</select>
						<button type="button" class="copy-room-btn" id="copy-room-btn" disabled>Copy</button>
					</div>
				</div>
			`;
		} else {
			const raceOptions = this.races
				.map(
					(r) =>
						`<option value="${r.id}" ${
							template.race === r.id ? "selected" : ""
						}>${r.display}</option>`
				)
				.join("");
			const jobOptions = this.jobs
				.map(
					(j) =>
						`<option value="${j.id}" ${
							template.job === j.id ? "selected" : ""
						}>${j.display}</option>`
				)
				.join("");

			const isWeapon = template.type === "Weapon";
			const isArmor = template.type === "Armor";
			const isEquipment = template.type === "Equipment";
			const isEquipmentType = isWeapon || isArmor || isEquipment;
			const hitTypeSelector = isWeapon
				? this.generateHitTypeSelector(template.hitType)
				: "";
			const bonusesSection = isEquipmentType
				? this.generateBonusesSection(template)
				: "";

			html = `
				<div class="form-group">
					<label>ID</label>
					<input type="text" id="template-id" value="${template.id || ""}" ${
				id ? "readonly" : ""
			}>
				</div>
				<div class="form-group">
					<label>Type</label>
					<select id="template-type">
						<option value="Mob" ${template.type === "Mob" ? "selected" : ""}>Mob</option>
						<option value="Equipment" ${
							template.type === "Equipment" ? "selected" : ""
						}>Equipment</option>
						<option value="Weapon" ${
							template.type === "Weapon" ? "selected" : ""
						}>Weapon</option>
						<option value="Armor" ${
							template.type === "Armor" ? "selected" : ""
						}>Armor</option>
						<option value="Prop" ${template.type === "Prop" ? "selected" : ""}>Prop</option>
					</select>
				</div>
				<div class="form-group">
					<label>Display Name</label>
					<input type="text" id="template-display" value="${template.display || ""}">
				</div>
				<div class="form-group">
					<label>Description</label>
					<textarea id="template-description">${template.description || ""}</textarea>
				</div>
				${
					type !== "room"
						? `
				<div class="form-group">
					<label>Room Description</label>
					<input type="text" id="template-room-description" value="${
						template.roomDescription || ""
					}" placeholder="Shows in room contents (1 line)">
				</div>
				`
						: ""
				}
				<div class="form-group">
					<label>Keywords</label>
					<input type="text" id="template-keywords" value="${template.keywords || ""}">
				</div>
				<div id="mob-fields" style="display: ${isMob ? "block" : "none"};">
				<div class="form-group">
					<label>Race</label>
					<select id="template-race">
						<option value="">Select a race...</option>
						${raceOptions}
					</select>
				</div>
				<div class="form-group">
					<label>Job</label>
					<select id="template-job">
						<option value="">Select a job...</option>
						${jobOptions}
					</select>
				</div>
				<div class="form-group">
					<label>Level</label>
					<input type="number" id="template-level" value="${
						template.level || 1
					}" min="1" max="100">
				</div>
				<div class="form-group">
					<label>Calculated Attributes</label>
					<div id="calculated-attributes" class="calculated-attributes">
						<p style="color: #aaa; font-style: italic;">Select race, job, and level to see calculated attributes</p>
					</div>
				</div>
				<div class="form-group">
					<label>Behaviors</label>
					<div class="exits-container">
						<div class="exits-buttons">
							<button type="button" class="exit-btn behavior-btn ${
								template.behaviors?.aggressive ? "enabled" : "disabled"
							}" data-behavior="aggressive" title="Mob will attack character mobs">AGGRESSIVE</button>
							<button type="button" class="exit-btn behavior-btn ${
								template.behaviors?.wimpy ? "enabled" : "disabled"
							}" data-behavior="wimpy" title="Mob will flee when health reaches 25%">WIMPY</button>
							<button type="button" class="exit-btn behavior-btn ${
								template.behaviors?.wander ? "enabled" : "disabled"
							}" data-behavior="wander" title="Mob will randomly move around every 30 seconds">WANDER</button>
						</div>
					</div>
				</div>
				</div>
				<div id="weapon-fields" style="display: ${isWeapon ? "block" : "none"};">
					<div class="form-group">
						<label>Weapon Type</label>
						<select id="template-weapon-type">
							${this.weaponTypes
								.map((wt) => {
									const selectedWeaponType =
										template.weaponType || "shortsword";
									const isSelected =
										wt === selectedWeaponType ? "selected" : "";
									return `<option value="${wt}" ${isSelected} style="color: #ffffff; background: #1a1a1a;">${wt}</option>`;
								})
								.join("")}
						</select>
					</div>
					${hitTypeSelector}
					<div class="form-group">
						<label>Attack Power</label>
						<input type="number" id="template-attack-power" value="${
							template.attackPower || ""
						}" placeholder="0" step="0.1">
					</div>
					${bonusesSection}
				</div>
				<div id="armor-fields" style="display: ${isArmor ? "block" : "none"};">
					<div class="form-group">
						<label>Defense</label>
						<input type="number" id="template-defense" value="${
							template.defense || ""
						}" placeholder="0" step="0.1">
					</div>
					${bonusesSection}
				</div>
				<div id="equipment-fields" style="display: ${isEquipment ? "block" : "none"};">
					${bonusesSection}
				</div>
				<div class="form-group">
					<label>Map Text (1 letter)</label>
					<input type="text" id="template-map-text" value="${
						template.mapText || ""
					}" placeholder="." maxlength="1" style="width: 80px;">
				</div>
				<div class="form-group">
					<label>Map Color</label>
					${this.generateColorSelector("template-map-color", template.mapColor)}
				</div>
			`;
		}

		body.innerHTML = html;
		modal.classList.add("active");

		// Initialize allowedExits data attribute for room templates
		if (type === "room") {
			const DIRECTION = {
				NORTH: 1 << 0,
				SOUTH: 1 << 1,
				EAST: 1 << 2,
				WEST: 1 << 3,
				NORTHEAST: 1 << 4,
				NORTHWEST: 1 << 5,
				SOUTHEAST: 1 << 6,
				SOUTHWEST: 1 << 7,
				UP: 1 << 8,
				DOWN: 1 << 9,
			};
			const DEFAULT_ALLOWED_EXITS =
				DIRECTION.NORTH |
				DIRECTION.SOUTH |
				DIRECTION.EAST |
				DIRECTION.WEST |
				DIRECTION.NORTHEAST |
				DIRECTION.NORTHWEST |
				DIRECTION.SOUTHEAST |
				DIRECTION.SOUTHWEST;
			// allowedExits is mandatory - default to NSEW + diagonals if not set
			const allowedExits =
				template.allowedExits !== undefined && template.allowedExits !== null
					? template.allowedExits
					: DEFAULT_ALLOWED_EXITS;
			modal.dataset.allowedExits = allowedExits;
		}

		// Set up room link handlers if this is a room template
		if (type === "room") {
			// DIRECTION bitmap values (same as above, needed in this scope)
			const DIRECTION = {
				NORTH: 1 << 0,
				SOUTH: 1 << 1,
				EAST: 1 << 2,
				WEST: 1 << 3,
				NORTHEAST: 1 << 4,
				NORTHWEST: 1 << 5,
				SOUTHEAST: 1 << 6,
				SOUTHWEST: 1 << 7,
				UP: 1 << 8,
				DOWN: 1 << 9,
			};

			const TEXT2DIR = {
				north: DIRECTION.NORTH,
				south: DIRECTION.SOUTH,
				east: DIRECTION.EAST,
				west: DIRECTION.WEST,
				northeast: DIRECTION.NORTHEAST,
				northwest: DIRECTION.NORTHWEST,
				southeast: DIRECTION.SOUTHEAST,
				southwest: DIRECTION.SOUTHWEST,
				up: DIRECTION.UP,
				down: DIRECTION.DOWN,
			};

			// Exit button handlers - store current allowedExits bitmap (mandatory field)
			let currentAllowedExits =
				template.allowedExits !== undefined && template.allowedExits !== null
					? template.allowedExits
					: DIRECTION.NORTH |
					  DIRECTION.SOUTH |
					  DIRECTION.EAST |
					  DIRECTION.WEST |
					  DIRECTION.NORTHEAST |
					  DIRECTION.NORTHWEST |
					  DIRECTION.SOUTHEAST |
					  DIRECTION.SOUTHWEST;

			// Refresh all button states based on the current bitmap
			const refreshExitButtons = () => {
				document.querySelectorAll(".exit-btn").forEach((btn) => {
					const direction = btn.dataset.direction;
					const dirFlag = TEXT2DIR[direction];
					if (!dirFlag) return;

					const isEnabled = (currentAllowedExits & dirFlag) !== 0;

					if (isEnabled) {
						btn.classList.remove("disabled");
						btn.classList.add("enabled");
					} else {
						btn.classList.remove("enabled");
						btn.classList.add("disabled");
					}
				});
			};

			document.querySelectorAll(".exit-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const direction = e.target.dataset.direction;
					const dirFlag = TEXT2DIR[direction];
					if (!dirFlag) return;

					const isEnabled = e.target.classList.contains("enabled");
					if (isEnabled) {
						// Disable: remove flag from bitmap
						currentAllowedExits = currentAllowedExits & ~dirFlag;
					} else {
						// Enable: add flag to bitmap
						currentAllowedExits = currentAllowedExits | dirFlag;
					}

					// Refresh all button states
					refreshExitButtons();

					// Store in data attribute for later retrieval
					document.getElementById("template-modal").dataset.allowedExits =
						currentAllowedExits;
				};
			});

			// Add room link button
			const addBtn = document.getElementById("add-room-link-btn");
			if (addBtn) {
				addBtn.onclick = () => {
					this.addRoomLink();
				};
			}

			// Delete link buttons
			document.querySelectorAll(".delete-link-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const index = parseInt(e.target.dataset.index);
					this.deleteRoomLink(index);
				};
			});

			// Make 2-way buttons
			document.querySelectorAll(".make-2way-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const index = parseInt(e.target.dataset.index);
					this.makeExit2WayForTemplate(index);
				};
			});

			// Dense button handler
			const denseBtn = document.getElementById("template-dense-btn");
			if (denseBtn) {
				denseBtn.onclick = () => {
					const isEnabled = denseBtn.classList.contains("enabled");
					if (isEnabled) {
						denseBtn.classList.remove("enabled");
						denseBtn.classList.add("disabled");
						denseBtn.dataset.dense = "false";
					} else {
						denseBtn.classList.remove("disabled");
						denseBtn.classList.add("enabled");
						denseBtn.dataset.dense = "true";
					}
				};
			}

			// Direction change handlers - update other dropdowns when a direction changes
			document.querySelectorAll(".room-link-direction").forEach((select) => {
				select.onchange = () => {
					this.updateRoomLinkDirections();
				};
			});

			// Copy room functionality
			const copyRoomSelect = document.getElementById("copy-room-select");
			const copyRoomBtn = document.getElementById("copy-room-btn");
			if (copyRoomSelect && copyRoomBtn) {
				copyRoomSelect.onchange = () => {
					copyRoomBtn.disabled = !copyRoomSelect.value;
				};
				copyRoomBtn.onclick = () => {
					const sourceRoomIndex = parseInt(copyRoomSelect.value, 10);
					if (!isNaN(sourceRoomIndex)) {
						this.copyRoomSettings(sourceRoomIndex, id);
					}
				};
			}
		}

		// Set up type selector handler to show/hide mob, weapon, armor, and equipment fields
		const typeSelect = document.getElementById("template-type");
		if (typeSelect) {
			const mobFields = document.getElementById("mob-fields");
			const weaponFields = document.getElementById("weapon-fields");
			const armorFields = document.getElementById("armor-fields");
			const equipmentFields = document.getElementById("equipment-fields");
			typeSelect.onchange = () => {
				const newType = typeSelect.value;
				if (mobFields) {
					mobFields.style.display = newType === "Mob" ? "block" : "none";
				}
				if (weaponFields) {
					weaponFields.style.display = newType === "Weapon" ? "block" : "none";
				}
				if (armorFields) {
					armorFields.style.display = newType === "Armor" ? "block" : "none";
				}
				if (equipmentFields) {
					equipmentFields.style.display =
						newType === "Equipment" ? "block" : "none";
				}
				// Recalculate if switching to Mob
				if (newType === "Mob") {
					setTimeout(() => this.calculateMobAttributes(), 100);
				}
			};
		}

		// Set up bonuses section toggle
		const bonusesToggle = document.getElementById("bonuses-toggle");
		const bonusesContent = document.getElementById("bonuses-content");
		if (bonusesToggle && bonusesContent) {
			bonusesToggle.onclick = () => {
				const isExpanded = bonusesContent.style.display !== "none";
				bonusesContent.style.display = isExpanded ? "none" : "block";
				const icon = bonusesToggle.querySelector(".bonuses-toggle-icon");
				if (icon) {
					icon.textContent = isExpanded ? "▼" : "▲";
				}
			};
		}

		// Set up behavior button handlers
		if (isMob) {
			document.querySelectorAll(".behavior-btn").forEach((btn) => {
				btn.onclick = (e) => {
					const behavior = e.target.dataset.behavior;
					const isEnabled = e.target.classList.contains("enabled");
					if (isEnabled) {
						e.target.classList.remove("enabled");
						e.target.classList.add("disabled");
					} else {
						e.target.classList.remove("disabled");
						e.target.classList.add("enabled");
					}
				};
			});
		}

		// Set up mob attribute calculation handlers
		const raceSelect = document.getElementById("template-race");
		const jobSelect = document.getElementById("template-job");
		const levelInput = document.getElementById("template-level");

		if (raceSelect && jobSelect && levelInput) {
			const calculateAttributes = () => {
				if (typeSelect?.value === "Mob") {
					this.calculateMobAttributes();
				}
			};

			raceSelect.onchange = calculateAttributes;
			jobSelect.onchange = calculateAttributes;
			levelInput.oninput = calculateAttributes;

			// Calculate initial attributes if race/job/level are set
			if (template.race && template.job && template.level && isMob) {
				setTimeout(calculateAttributes, 100);
			}
		}

		// Save handler
		const saveBtn = document.getElementById("modal-save");
		if (saveBtn) {
			saveBtn.onclick = () => {
				this.saveTemplate(type, id, template);
			};
		}

		// Cancel handler
		const cancelBtn = document.getElementById("modal-cancel");
		if (cancelBtn) {
			cancelBtn.onclick = () => {
				modal.classList.remove("active");
			};
		}

		const closeBtn = modal.querySelector(".close");
		if (closeBtn) {
			closeBtn.onclick = () => {
				modal.classList.remove("active");
			};
		}
	}

	saveTemplate(type, id, oldTemplate) {
		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		let changeAction = oldTemplate
			? EDITOR_ACTIONS.EDIT_TEMPLATE_FIELD
			: EDITOR_ACTIONS.CREATE_TEMPLATE;
		let changeTarget = id ?? null;
		const newParametersSummary = { type };
		const oldParametersSummary = oldTemplate
			? {
					display: oldTemplate.display || "",
					description: oldTemplate.description || "",
			  }
			: null;

		let removedDenseResets = 0;

		if (type === "room") {
			const index = id !== null && id !== undefined ? parseInt(id) : -1;
			const display = document.getElementById("template-display").value;
			const description = document.getElementById("template-description").value;
			const mapText = document.getElementById("template-map-text").value;
			const mapColorSelect = document.getElementById("template-map-color");
			const mapColor = mapColorSelect.value
				? parseInt(mapColorSelect.value)
				: undefined;
			newParametersSummary.display = display;
			newParametersSummary.description = description;

			// Get dense button value (only for rooms)
			const denseBtn = document.getElementById("template-dense-btn");
			const dense = denseBtn ? denseBtn.classList.contains("enabled") : false;

			// Get allowedExits bitmap from modal data attribute
			const modal = document.getElementById("template-modal");
			let allowedExits = modal.dataset.allowedExits;
			if (allowedExits === undefined) {
				// If not set, calculate from button states
				const DIRECTION = {
					NORTH: 1 << 0,
					SOUTH: 1 << 1,
					EAST: 1 << 2,
					WEST: 1 << 3,
					NORTHEAST: 1 << 4,
					NORTHWEST: 1 << 5,
					SOUTHEAST: 1 << 6,
					SOUTHWEST: 1 << 7,
					UP: 1 << 8,
					DOWN: 1 << 9,
				};
				const TEXT2DIR = {
					north: DIRECTION.NORTH,
					south: DIRECTION.SOUTH,
					east: DIRECTION.EAST,
					west: DIRECTION.WEST,
					northeast: DIRECTION.NORTHEAST,
					northwest: DIRECTION.NORTHWEST,
					southeast: DIRECTION.SOUTHEAST,
					southwest: DIRECTION.SOUTHWEST,
					up: DIRECTION.UP,
					down: DIRECTION.DOWN,
				};
				const DEFAULT_ALLOWED_EXITS =
					DIRECTION.NORTH |
					DIRECTION.SOUTH |
					DIRECTION.EAST |
					DIRECTION.WEST |
					DIRECTION.NORTHEAST |
					DIRECTION.NORTHWEST |
					DIRECTION.SOUTHEAST |
					DIRECTION.SOUTHWEST;

				allowedExits = DEFAULT_ALLOWED_EXITS;
				document.querySelectorAll(".exit-btn").forEach((btn) => {
					const direction = btn.dataset.direction;
					const dirFlag = TEXT2DIR[direction];
					if (dirFlag && btn.classList.contains("enabled")) {
						allowedExits = allowedExits | dirFlag;
					} else if (dirFlag && btn.classList.contains("disabled")) {
						allowedExits = allowedExits & ~dirFlag;
					}
				});
			} else {
				allowedExits = parseInt(allowedExits);
			}

			// Collect room links
			const roomLinks = {};
			const linkItems = document.querySelectorAll(".room-link-item");
			linkItems.forEach((item) => {
				const direction = item.querySelector(".room-link-direction").value;
				const dungeonSelect = item.querySelector(".room-link-dungeon");
				const xInput = item.querySelector(".room-link-x");
				const yInput = item.querySelector(".room-link-y");
				const zInput = item.querySelector(".room-link-z");

				// Try new format first (dropdown + number inputs)
				if (dungeonSelect && xInput && yInput && zInput) {
					const dungeonId = dungeonSelect.value;
					const x = parseInt(xInput.value, 10);
					const y = parseInt(yInput.value, 10);
					const z = parseInt(zInput.value, 10);
					if (dungeonId && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
						roomLinks[direction] = this.formatRoomRef(dungeonId, x, y, z);
					}
				} else {
					// Fallback to old text input format
					const refInput = item.querySelector(".room-link-ref");
					if (refInput) {
						const ref = refInput.value.trim();
						if (ref) {
							roomLinks[direction] = ref;
						}
					}
				}
			});

			if (index >= 0 && index < dungeon.rooms.length) {
				// Update existing - preserve roomDescription and keywords if they exist
				const oldRoom = dungeon.rooms[index];
				const updated = {
					...oldRoom,
					display,
					description,
					...(mapText && { mapText }),
					...(mapColor !== undefined && { mapColor }),
				};
				// Remove version if it exists - templates don't have version, dungeon does
				if (updated.version !== undefined) {
					delete updated.version;
				}
				// Set allowedExits bitmap (mandatory field)
				updated.allowedExits = allowedExits;
				// Set dense property (only include if true)
				if (dense) {
					updated.dense = true;
				} else if (updated.dense !== undefined) {
					delete updated.dense;
				}
				if (Object.keys(roomLinks).length > 0) {
					updated.roomLinks = roomLinks;
				} else if (updated.roomLinks) {
					delete updated.roomLinks;
				}
				// Remove map fields if they're empty
				if (!mapText) delete updated.mapText;
				if (mapColor === undefined) delete updated.mapColor;
				dungeon.rooms[index] = updated;
				changeTarget = index;
				newParametersSummary.roomIndex = index;
				changeAction = EDITOR_ACTIONS.EDIT_TEMPLATE_FIELD;

				const wasDense = !!oldTemplate?.dense;
				if (dense && !wasDense) {
					removedDenseResets = this.removeResetsForRoomTemplate(index);
				}
			} else {
				// Add new
				const newRoom = {
					display,
					description,
				};
				if (mapText) newRoom.mapText = mapText;
				if (mapColor !== undefined) newRoom.mapColor = mapColor;
				// Set allowedExits bitmap (mandatory field, defaults to NSEW)
				newRoom.allowedExits = allowedExits;
				// Set dense property (only include if true)
				if (dense) {
					newRoom.dense = true;
				}
				if (Object.keys(roomLinks).length > 0) {
					newRoom.roomLinks = roomLinks;
				}
				dungeon.rooms.push(newRoom);
				changeTarget = dungeon.rooms.length - 1;
				newParametersSummary.roomIndex = changeTarget;
				changeAction = EDITOR_ACTIONS.CREATE_TEMPLATE;
				this.showToast(
					"Room template created",
					`Created "${display || "New Room"}"`
				);
			}
		} else {
			const templateId = document.getElementById("template-id").value;
			const templateType = document.getElementById("template-type").value;
			const display = document.getElementById("template-display").value;
			const description = document.getElementById("template-description").value;
			const roomDescriptionInput = document.getElementById(
				"template-room-description"
			);
			const roomDescription = roomDescriptionInput
				? roomDescriptionInput.value.trim()
				: "";
			const keywords = document.getElementById("template-keywords").value;
			const mapText = document.getElementById("template-map-text").value;
			const mapColorSelect = document.getElementById("template-map-color");
			const mapColor = mapColorSelect.value
				? parseInt(mapColorSelect.value)
				: undefined;
			newParametersSummary.display = display;
			newParametersSummary.description = description;

			if (!dungeon.templates) {
				dungeon.templates = [];
			}

			const existing = dungeon.templates.findIndex((t) => t.id === templateId);
			changeAction =
				existing >= 0
					? EDITOR_ACTIONS.EDIT_TEMPLATE_FIELD
					: EDITOR_ACTIONS.CREATE_TEMPLATE;
			changeTarget = templateId;
			newParametersSummary.templateId = templateId;
			const newTemplate = {
				id: templateId,
				type: templateType,
				display,
				description,
			};
			if (roomDescription) newTemplate.roomDescription = roomDescription;
			if (keywords) newTemplate.keywords = keywords;
			if (mapText) newTemplate.mapText = mapText;
			if (mapColor !== undefined) newTemplate.mapColor = mapColor;

			// Add mob-specific fields
			if (templateType === "Mob") {
				const race = document.getElementById("template-race")?.value;
				const job = document.getElementById("template-job")?.value;
				const level = document.getElementById("template-level")?.value;
				if (race) newTemplate.race = race;
				if (job) newTemplate.job = job;
				if (level) newTemplate.level = parseInt(level) || 1;

				// Collect behaviors
				const behaviors = {};
				document.querySelectorAll(".behavior-btn").forEach((btn) => {
					const behavior = btn.dataset.behavior;
					if (btn.classList.contains("enabled")) {
						behaviors[behavior] = true;
					}
				});
				if (Object.keys(behaviors).length > 0) {
					newTemplate.behaviors = behaviors;
				}
			}

			// Add weapon-specific fields
			if (templateType === "Weapon") {
				const weaponType = document.getElementById(
					"template-weapon-type"
				)?.value;
				const hitType = document.getElementById("template-hit-type")?.value;
				const attackPower = document.getElementById(
					"template-attack-power"
				)?.value;
				if (weaponType) {
					newTemplate.weaponType = weaponType;
				}
				if (hitType) {
					newTemplate.hitType = hitType;
				}
				if (attackPower) {
					const apValue = parseFloat(attackPower);
					if (!isNaN(apValue)) {
						newTemplate.attackPower = apValue;
					}
				}
			}

			// Add armor-specific fields
			if (templateType === "Armor") {
				const defense = document.getElementById("template-defense")?.value;
				if (defense) {
					const defValue = parseFloat(defense);
					if (!isNaN(defValue)) {
						newTemplate.defense = defValue;
					}
				}
			}

			// Add bonuses for weapon, armor, and equipment
			if (
				templateType === "Weapon" ||
				templateType === "Armor" ||
				templateType === "Equipment"
			) {
				// Primary attribute bonuses
				const primaryAttrs = ["strength", "agility", "intelligence"];
				const attributeBonuses = {};
				let hasPrimaryBonuses = false;
				primaryAttrs.forEach((attr) => {
					const input = document.getElementById(`bonus-primary-${attr}`);
					if (input && input.value) {
						const value = parseFloat(input.value);
						if (!isNaN(value)) {
							attributeBonuses[attr] = value;
							hasPrimaryBonuses = true;
						}
					}
				});
				if (hasPrimaryBonuses) {
					newTemplate.attributeBonuses = attributeBonuses;
				}

				// Secondary attribute bonuses
				const secondaryAttrs = [
					"attackPower",
					"vitality",
					"defense",
					"critRate",
					"avoidance",
					"accuracy",
					"endurance",
					"spellPower",
					"wisdom",
					"resilience",
					"spirit",
				];
				const secondaryAttributeBonuses = {};
				let hasSecondaryBonuses = false;
				secondaryAttrs.forEach((attr) => {
					const input = document.getElementById(`bonus-secondary-${attr}`);
					if (input && input.value) {
						const value = parseFloat(input.value);
						if (!isNaN(value)) {
							secondaryAttributeBonuses[attr] = value;
							hasSecondaryBonuses = true;
						}
					}
				});
				if (hasSecondaryBonuses) {
					newTemplate.secondaryAttributeBonuses = secondaryAttributeBonuses;
				}

				// Resource capacity bonuses
				const capacities = ["maxHealth", "maxMana"];
				const resourceBonuses = {};
				let hasResourceBonuses = false;
				capacities.forEach((cap) => {
					const input = document.getElementById(`bonus-capacity-${cap}`);
					if (input && input.value) {
						const value = parseFloat(input.value);
						if (!isNaN(value)) {
							resourceBonuses[cap] = value;
							hasResourceBonuses = true;
						}
					}
				});
				if (hasResourceBonuses) {
					newTemplate.resourceBonuses = resourceBonuses;
				}
			}
			// Note: If type is not Mob/Weapon/Armor, we don't add those fields
			// The YAML serializer will omit undefined fields

			if (existing >= 0) {
				// Update existing - merge with old template to preserve other fields
				const oldTemplate = dungeon.templates[existing];
				const updated = {
					...oldTemplate,
					...newTemplate,
				};
				// Remove version if it exists - templates don't have version, dungeon does
				if (updated.version !== undefined) {
					delete updated.version;
				}
				// Remove mob fields if type changed away from Mob
				if (templateType !== "Mob" && oldTemplate.type === "Mob") {
					delete updated.race;
					delete updated.job;
					delete updated.level;
					delete updated.behaviors;
				}
				// Equipment types: Equipment, Weapon, Armor
				const isOldEquipmentType =
					oldTemplate.type === "Equipment" ||
					oldTemplate.type === "Weapon" ||
					oldTemplate.type === "Armor";
				const isNewEquipmentType =
					templateType === "Equipment" ||
					templateType === "Weapon" ||
					templateType === "Armor";

				// Remove weapon-specific fields if type changed away from Weapon
				if (templateType !== "Weapon" && oldTemplate.type === "Weapon") {
					delete updated.hitType;
					delete updated.attackPower;
					delete updated.weaponType;
				}
				// Remove armor-specific fields if type changed away from Armor
				if (templateType !== "Armor" && oldTemplate.type === "Armor") {
					delete updated.defense;
				}
				// Preserve bonus fields when switching between equipment types
				// Only remove bonuses if switching away from all equipment types
				if (isOldEquipmentType && !isNewEquipmentType) {
					delete updated.attributeBonuses;
					delete updated.secondaryAttributeBonuses;
					delete updated.resourceBonuses;
				}
				// Remove hitType if empty
				if (templateType === "Weapon" && !updated.hitType) {
					delete updated.hitType;
				}
				// Remove attackPower if empty
				if (templateType === "Weapon" && updated.attackPower === undefined) {
					delete updated.attackPower;
				}
				// Remove weaponType if empty
				if (templateType === "Weapon" && updated.weaponType === undefined) {
					delete updated.weaponType;
				}
				// Remove defense if empty
				if (templateType === "Armor" && updated.defense === undefined) {
					delete updated.defense;
				}
				// Remove empty bonus objects
				if (
					updated.attributeBonuses &&
					Object.keys(updated.attributeBonuses).length === 0
				) {
					delete updated.attributeBonuses;
				}
				if (
					updated.secondaryAttributeBonuses &&
					Object.keys(updated.secondaryAttributeBonuses).length === 0
				) {
					delete updated.secondaryAttributeBonuses;
				}
				if (
					updated.resourceBonuses &&
					Object.keys(updated.resourceBonuses).length === 0
				) {
					delete updated.resourceBonuses;
				}
				// Remove behaviors if empty
				if (updated.behaviors && Object.keys(updated.behaviors).length === 0) {
					delete updated.behaviors;
				}
				// Remove roomDescription if empty
				if (!roomDescription) delete updated.roomDescription;
				// Remove map fields if they're empty
				if (!mapText) delete updated.mapText;
				if (mapColor === undefined) delete updated.mapColor;
				dungeon.templates[existing] = updated;
			} else {
				dungeon.templates.push(newTemplate);
			}
		}

		document.getElementById("template-modal").classList.remove("active");
		this.loadTemplates(dungeon);
		if (removedDenseResets > 0) {
			this.loadResets(dungeon);
			this.showToast(
				"Dense room updated",
				`Removed ${removedDenseResets} reset${
					removedDenseResets === 1 ? "" : "s"
				} from this template`
			);
		}
		// Re-render map to reflect any changes to mapText/mapColor
		this.renderMap(dungeon);

		this.makeChange({
			action: changeAction,
			actionTarget: changeTarget,
			newParameters: newParametersSummary,
			oldParameters: oldParametersSummary,
			metadata: {
				templateType: type,
			},
		});
	}

	deleteTemplate(type, id) {
		if (!this.yamlData) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		let oldParameters = null;
		const metadata = { type };

		if (type === "room") {
			const roomIndex = parseInt(id);
			if (roomIndex < 0 || roomIndex >= dungeon.rooms.length) return;

			const room = dungeon.rooms[roomIndex];
			const roomName = room?.display || `Room ${roomIndex + 1}`;
			let deletedCount = 0;

			// Find and clear all grid cells using this room template
			for (let layerIndex = 0; layerIndex < dungeon.grid.length; layerIndex++) {
				const layer = dungeon.grid[layerIndex] || [];
				for (let y = 0; y < layer.length; y++) {
					const row = layer[y] || [];
					for (let x = 0; x < row.length; x++) {
						// Room index in grid is 1-based, template index is 0-based
						if (row[x] === roomIndex + 1) {
							row[x] = 0;
							deletedCount++;

							// Calculate z coordinate (reverse layer index)
							const z = dungeon.dimensions.layers - 1 - layerIndex;

							// Remove resets for this room
							const roomRef = `@${dungeonId}{${x},${y},${z}}`;
							if (dungeon.resets) {
								dungeon.resets = dungeon.resets.filter(
									(r) => r.roomRef !== roomRef
								);
							}

							// Remove exit overrides for this room
							this.deleteExitOverride(dungeon, x, y, z);
						}
					}
				}
			}

			// Clean up empty exitOverrides array after template deletion
			if (
				dungeon.exitOverrides &&
				Array.isArray(dungeon.exitOverrides) &&
				dungeon.exitOverrides.length === 0
			) {
				delete dungeon.exitOverrides;
			}

			// Remove the room template
			dungeon.rooms.splice(roomIndex, 1);

			// Adjust all grid references (decrement room indices > deleted index)
			for (let layerIndex = 0; layerIndex < dungeon.grid.length; layerIndex++) {
				const layer = dungeon.grid[layerIndex] || [];
				for (let y = 0; y < layer.length; y++) {
					const row = layer[y] || [];
					for (let x = 0; x < row.length; x++) {
						if (row[x] > roomIndex + 1) {
							row[x]--;
						}
					}
				}
			}

			this.showToast(
				`Deleted ${roomName}`,
				`Removed ${deletedCount} room${deletedCount !== 1 ? "s" : ""} from grid`
			);
			oldParameters = { display: roomName, deletedRooms: deletedCount };
			metadata.roomIndex = roomIndex;
		} else {
			// Mob or Object template
			const template = dungeon.templates?.find((t) => t.id === id);
			if (!template) return;

			const templateName = template.display || id;
			let deletedResetCount = 0;

			// Remove all resets using this template
			if (dungeon.resets) {
				const initialCount = dungeon.resets.length;
				dungeon.resets = dungeon.resets.filter((r) => r.templateId !== id);
				deletedResetCount = initialCount - dungeon.resets.length;
			}

			// Remove the template
			const templateIndex = dungeon.templates.findIndex((t) => t.id === id);
			if (templateIndex >= 0) {
				dungeon.templates.splice(templateIndex, 1);
			}

			this.showToast(
				`Deleted ${templateName}`,
				`Removed ${deletedResetCount} reset${
					deletedResetCount !== 1 ? "s" : ""
				}`
			);
			oldParameters = {
				display: templateName,
				resetsRemoved: deletedResetCount,
			};
		}

		// Reload templates and resets, re-render map
		this.loadTemplates(dungeon);
		this.loadResets(dungeon);
		this.renderMap(dungeon);

		this.makeChange({
			action: EDITOR_ACTIONS.DELETE_TEMPLATE,
			actionTarget: id,
			oldParameters,
			metadata,
		});
	}

	async populateTemplateTables(dungeon) {
		// Load templates from all dungeons
		const allTemplates = await this.loadAllDungeonTemplates();
		const currentDungeonId = this.currentDungeonId;

		// Get all equipment templates (Equipment, Armor, Weapon) from all dungeons
		const equipmentTemplates = allTemplates.filter(
			(t) => t.type === "Equipment" || t.type === "Armor" || t.type === "Weapon"
		);

		// Get all item templates (Item, Equipment, Armor, Weapon - all are items) from all dungeons
		const itemTemplates = allTemplates.filter(
			(t) =>
				t.type === "Item" ||
				t.type === "Equipment" ||
				t.type === "Armor" ||
				t.type === "Weapon"
		);

		// Populate equipment table
		const equippedTable = document.getElementById("equipped-templates-table");
		if (equippedTable) {
			equippedTable.innerHTML = "";
			if (equipmentTemplates.length === 0) {
				equippedTable.innerHTML =
					'<div class="template-list-empty">No equipment templates available</div>';
			} else {
				equipmentTemplates.forEach((template) => {
					const item = document.createElement("div");
					item.className = "template-table-item";
					const isCurrentDungeon = template.dungeonId === currentDungeonId;
					const displayId = isCurrentDungeon
						? template.localId
						: template.globalId;
					const dungeonLabel = isCurrentDungeon
						? ""
						: ` <span style="color: #888; font-size: 0.75rem;">(${template.dungeonId})</span>`;
					item.innerHTML = `
						<div class="template-table-item-name">${
							template.display || template.localId
						}${dungeonLabel}</div>
						<div class="template-table-item-id">${displayId}</div>
					`;
					item.addEventListener("click", async () => {
						await this.addTemplateToList(template.globalId, "equipped");
					});
					equippedTable.appendChild(item);
				});
			}
		}

		// Populate inventory table
		const inventoryTable = document.getElementById("inventory-templates-table");
		if (inventoryTable) {
			inventoryTable.innerHTML = "";
			if (itemTemplates.length === 0) {
				inventoryTable.innerHTML =
					'<div class="template-list-empty">No item templates available</div>';
			} else {
				itemTemplates.forEach((template) => {
					const item = document.createElement("div");
					item.className = "template-table-item";
					const isCurrentDungeon = template.dungeonId === currentDungeonId;
					const displayId = isCurrentDungeon
						? template.localId
						: template.globalId;
					const dungeonLabel = isCurrentDungeon
						? ""
						: ` <span style="color: #888; font-size: 0.75rem;">(${template.dungeonId})</span>`;
					item.innerHTML = `
						<div class="template-table-item-name">${
							template.display || template.localId
						}${dungeonLabel}</div>
						<div class="template-table-item-id">${displayId}</div>
					`;
					item.addEventListener("click", async () => {
						await this.addTemplateToList(template.globalId, "inventory");
					});
					inventoryTable.appendChild(item);
				});
			}
		}
	}

	async loadAllDungeonTemplates() {
		const allTemplates = [];
		const currentDungeonId = this.currentDungeonId;

		// Get current dungeon templates
		const currentDungeon = this.yamlData?.dungeon;
		if (currentDungeon && currentDungeon.templates) {
			currentDungeon.templates.forEach((template) => {
				allTemplates.push({
					...template,
					dungeonId: currentDungeonId,
					localId: template.id,
					globalId: template.id.includes("@")
						? template.id
						: `@${currentDungeonId}:${template.id}`,
				});
			});
		}

		// Load templates from all other dungeons
		try {
			const data = await this.fetchDungeonListData();
			const dungeonIds = data.dungeons || [];

			// Load each dungeon's templates
			for (const dungeonId of dungeonIds) {
				if (dungeonId === currentDungeonId) continue; // Skip current dungeon (already loaded)

				try {
					const dungeonData = await this.fetchDungeonData(dungeonId);
					const dungeonYaml = jsyaml.load(dungeonData.yaml);
					const templates = dungeonYaml.dungeon?.templates || [];

					templates.forEach((template) => {
						allTemplates.push({
							...template,
							dungeonId: dungeonId,
							localId: template.id,
							globalId: template.id.includes("@")
								? template.id
								: `@${dungeonId}:${template.id}`,
						});
					});
				} catch (error) {
					console.warn(
						`Failed to load templates from dungeon ${dungeonId}:`,
						error
					);
				}
			}
		} catch (error) {
			console.warn("Failed to load dungeon list for templates:", error);
		}

		return allTemplates;
	}

	async populateTemplateLists(reset) {
		// Load all templates to resolve cross-dungeon references
		const allTemplates = await this.loadAllDungeonTemplates();
		const templateMap = new Map();
		allTemplates.forEach((t) => {
			templateMap.set(t.globalId, t);
			templateMap.set(t.localId, t); // Also map local ID for current dungeon
		});

		// Helper to get global ID from a template ID (might be local or global)
		const getGlobalId = (templateId) => {
			if (templateId.includes("@")) {
				return templateId; // Already global
			}
			// Check if it's from current dungeon
			const template = templateMap.get(templateId);
			if (template) {
				return template.globalId;
			}
			// Default: assume current dungeon
			return `@${this.currentDungeonId}:${templateId}`;
		};

		// Populate equipped list
		const equippedList = document.getElementById("equipped-list");
		if (equippedList) {
			equippedList.innerHTML = "";
			const equipped = reset.equipped || [];
			if (equipped.length === 0) {
				equippedList.innerHTML =
					'<div class="template-list-empty">No equipment selected</div>';
			} else {
				equipped.forEach((templateId) => {
					const globalId = getGlobalId(templateId);
					this.addTemplateToList(globalId, "equipped", false);
				});
			}
			this.updateTemplateInput("equipped");
		}

		// Populate inventory list
		const inventoryList = document.getElementById("inventory-list");
		if (inventoryList) {
			inventoryList.innerHTML = "";
			const inventory = reset.inventory || [];
			if (inventory.length === 0) {
				inventoryList.innerHTML =
					'<div class="template-list-empty">No items selected</div>';
			} else {
				inventory.forEach((templateId) => {
					const globalId = getGlobalId(templateId);
					this.addTemplateToList(globalId, "inventory", false);
				});
			}
			this.updateTemplateInput("inventory");
		}
	}

	async addTemplateToList(templateId, listType, updateInput = true) {
		// templateId should be a global ID (@dungeon:templateId) when adding from selector
		// Load all templates to find the matching one
		const allTemplates = await this.loadAllDungeonTemplates();
		const templateMap = new Map();
		allTemplates.forEach((t) => {
			templateMap.set(t.globalId, t);
			// Also map local ID for current dungeon templates
			if (t.dungeonId === this.currentDungeonId) {
				templateMap.set(t.localId, t);
			}
		});

		// Find template by global ID or local ID
		let template = templateMap.get(templateId);

		// If not found, create a minimal template object for display
		if (!template) {
			// Parse the template ID to get display info
			let displayName = templateId;
			let dungeonId = this.currentDungeonId;
			if (templateId.includes("@")) {
				const parts = templateId.split(":");
				if (parts.length > 1) {
					dungeonId = parts[0].substring(1); // Remove @
					displayName = parts[1];
				}
			}
			template = {
				id: templateId,
				type: "Item", // Default type
				display: displayName,
				dungeonId: dungeonId,
				localId: displayName,
				globalId: templateId,
			};
		}

		const listId = listType === "equipped" ? "equipped-list" : "inventory-list";
		const list = document.getElementById(listId);
		if (!list) return;

		// Remove empty message if present
		const emptyMsg = list.querySelector(".template-list-empty");
		if (emptyMsg) {
			emptyMsg.remove();
		}

		// Create list item (allow duplicates, so no duplicate check)
		const listItem = document.createElement("div");
		listItem.className = "template-list-item";
		listItem.dataset.templateId = templateId;

		// Parse template ID to show dungeon info if it's from another dungeon
		let displayName = template.display || templateId;
		let displayId = templateId;
		let dungeonLabel = "";
		if (templateId.includes("@")) {
			const parts = templateId.split(":");
			if (parts.length > 1) {
				const dungeonId = parts[0].substring(1); // Remove @
				const localId = parts[1];
				if (dungeonId !== this.currentDungeonId) {
					dungeonLabel = ` <span style="color: #888; font-size: 0.75rem;">(${dungeonId})</span>`;
					displayName = template.display || localId;
				} else {
					displayId = localId; // Show local ID for current dungeon
				}
			}
		}

		listItem.innerHTML = `
			<div class="template-list-item-content">
				<div class="template-list-item-name">${displayName}${dungeonLabel}</div>
				<div class="template-list-item-id">${displayId}</div>
			</div>
			<button type="button" class="template-list-item-remove" title="Remove">×</button>
		`;

		// Add remove handler
		const removeBtn = listItem.querySelector(".template-list-item-remove");
		removeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			listItem.remove();
			if (list.children.length === 0) {
				list.innerHTML =
					'<div class="template-list-empty">No ' +
					(listType === "equipped" ? "equipment" : "items") +
					" selected</div>";
			}
			if (updateInput) {
				this.updateTemplateInput(listType);
			}
		});

		list.appendChild(listItem);

		if (updateInput) {
			this.updateTemplateInput(listType);
		}
	}

	updateTemplateInput(listType) {
		const listId = listType === "equipped" ? "equipped-list" : "inventory-list";
		const inputId =
			listType === "equipped" ? "reset-equipped" : "reset-inventory";
		const list = document.getElementById(listId);
		const input = document.getElementById(inputId);

		if (!list || !input) return;

		const items = list.querySelectorAll(".template-list-item");
		const templateIds = Array.from(items).map(
			(item) => item.dataset.templateId
		);
		// Store as comma-separated string in hidden input for compatibility
		input.value = templateIds.join(", ");
	}

	getTemplateListValues(listType) {
		const listId = listType === "equipped" ? "equipped-list" : "inventory-list";
		const list = document.getElementById(listId);
		if (!list) return [];

		const items = list.querySelectorAll(".template-list-item");
		return Array.from(items).map((item) => item.dataset.templateId);
	}

	editReset(index) {
		const dungeon = this.yamlData.dungeon;
		const reset = dungeon.resets[index];

		// Get template info for display
		const template = dungeon.templates?.find((t) => t.id === reset.templateId);
		const templateName = template
			? template.display || reset.templateId
			: reset.templateId;

		// Populate template and location info
		document.getElementById("reset-template-name").textContent = templateName;
		document.getElementById("reset-location").textContent =
			reset.roomRef || "N/A";

		// Populate modal with current values
		document.getElementById("reset-min-count").value = reset.minCount || 1;
		document.getElementById("reset-max-count").value = reset.maxCount || 1;

		// Check if this is a mob reset
		const isMobReset = template?.type === "Mob";

		// Show/hide mob-specific fields
		const mobFieldsSection = document.getElementById("reset-mob-fields");
		if (mobFieldsSection) {
			mobFieldsSection.style.display = isMobReset ? "block" : "none";
		}

		// Populate equipped and inventory fields if this is a mob reset
		if (isMobReset) {
			// populateTemplateTables is async, so we need to await it
			this.populateTemplateTables(dungeon).then(() => {
				this.populateTemplateLists(reset);
			});
		}

		// Show modal
		const modal = document.getElementById("reset-edit-modal");
		modal.classList.add("active");

		// Store the index for the save handler
		this.editingResetIndex = index;

		// Set up one-time event listeners
		const saveBtn = document.getElementById("reset-edit-save");
		const cancelBtn = document.getElementById("reset-edit-cancel");
		const closeBtn = document.getElementById("reset-edit-close");

		// Remove any existing listeners by cloning and replacing
		const newSaveBtn = saveBtn.cloneNode(true);
		const newCancelBtn = cancelBtn.cloneNode(true);
		const newCloseBtn = closeBtn.cloneNode(true);

		saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
		cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
		closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

		const closeModal = () => {
			modal.classList.remove("active");
			this.editingResetIndex = null;
		};

		newSaveBtn.addEventListener("click", () => {
			this.saveStateToHistory();
			const previousValues = {
				minCount: reset.minCount || 1,
				maxCount: reset.maxCount || 1,
				equipped: reset.equipped ? [...reset.equipped] : undefined,
				inventory: reset.inventory ? [...reset.inventory] : undefined,
			};
			const minCount =
				parseInt(document.getElementById("reset-min-count").value) || 1;
			const maxCount =
				parseInt(document.getElementById("reset-max-count").value) || 1;

			if (minCount > maxCount) {
				this.showToast(
					"Invalid count range",
					"Minimum count cannot be greater than maximum count"
				);
				return;
			}

			reset.minCount = minCount;
			reset.maxCount = maxCount;

			// Update equipped and inventory if this is a mob reset
			const template = dungeon.templates?.find(
				(t) => t.id === reset.templateId
			);
			if (template?.type === "Mob") {
				// Get values from the lists
				const equipped = this.getTemplateListValues("equipped");
				const inventory = this.getTemplateListValues("inventory");

				reset.equipped = equipped.length > 0 ? equipped : undefined;
				reset.inventory = inventory.length > 0 ? inventory : undefined;

				// Remove field if empty
				if (!reset.equipped || reset.equipped.length === 0) {
					delete reset.equipped;
				}
				if (!reset.inventory || reset.inventory.length === 0) {
					delete reset.inventory;
				}
			} else {
				// Remove equipped/inventory from non-mob resets (cleanup)
				delete reset.equipped;
				delete reset.inventory;
			}

			this.loadResets(dungeon);
			// Re-render map (count changes don't affect display, but ensure consistency)
			this.renderMap(dungeon);

			this.showToast("Reset updated", `Count: ${minCount}-${maxCount}`);
			this.makeChange({
				action: EDITOR_ACTIONS.EDIT_RESET_FIELD,
				actionTarget: reset.roomRef,
				newParameters: {
					minCount,
					maxCount,
					equipped: reset.equipped,
					inventory: reset.inventory,
				},
				oldParameters: previousValues,
				metadata: {
					templateId: reset.templateId,
					index,
				},
			});
			closeModal();
		});

		newCancelBtn.addEventListener("click", closeModal);
		newCloseBtn.addEventListener("click", closeModal);
	}

	deleteReset(index) {
		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const reset = dungeon.resets[index];

		const template = dungeon.templates?.find((t) => t.id === reset.templateId);
		const templateName = template
			? template.display || reset.templateId
			: reset.templateId;

		dungeon.resets.splice(index, 1);
		this.loadResets(dungeon);
		// Re-render map to reflect removed reset (grid display will update)
		this.renderMap(dungeon);

		this.showToast("Reset deleted", templateName);

		this.makeChange({
			action: EDITOR_ACTIONS.DELETE_RESET,
			actionTarget: reset.roomRef,
			oldParameters: {
				minCount: reset.minCount || 1,
				maxCount: reset.maxCount || 1,
				templateId: reset.templateId,
			},
			metadata: {
				index,
			},
		});
	}

	setupLayerSelector(layers) {
		const select = document.getElementById("layer-select");
		select.innerHTML = "";
		for (let i = 0; i < layers; i++) {
			const option = document.createElement("option");
			option.value = i;
			option.textContent = `Layer ${i}`;
			select.appendChild(option);
		}
		select.value = this.currentLayer;
	}

	async resizeDungeon() {
		if (!this.yamlData) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const width = parseInt(document.getElementById("width-input").value);
		const height = parseInt(document.getElementById("height-input").value);
		const layers = parseInt(document.getElementById("layers-input").value);

		if (!width || !height || !layers) {
			this.showToast(
				"Invalid dimensions",
				"Please enter valid width, height, and layers"
			);
			return;
		}

		const dungeon = this.yamlData.dungeon;
		const oldDims = dungeon.dimensions;

		// Check if dimensions are being reduced
		if (
			width < oldDims.width ||
			height < oldDims.height ||
			layers < oldDims.layers
		) {
			const confirmed = await this.showConfirmModal();
			if (!confirmed) return;
		}

		// Update dimensions
		dungeon.dimensions = { width, height, layers };

		// Resize grid
		// Reverse grid to work with internal representation
		const reversedGrid = [...dungeon.grid].reverse();

		// Resize each layer
		for (let z = 0; z < layers; z++) {
			if (!reversedGrid[z]) {
				reversedGrid[z] = [];
			}

			// Resize rows
			for (let y = 0; y < height; y++) {
				if (!reversedGrid[z][y]) {
					reversedGrid[z][y] = [];
				}

				// Resize columns
				const row = reversedGrid[z][y];
				while (row.length < width) {
					row.push(0);
				}
				row.splice(width);
			}

			// Remove extra rows
			reversedGrid[z].splice(height);

			// Ensure all rows have correct width
			for (let y = 0; y < height; y++) {
				if (!reversedGrid[z][y]) {
					reversedGrid[z][y] = new Array(width).fill(0);
				}
			}
		}

		// Remove extra layers
		reversedGrid.splice(layers);

		// Reverse back for YAML storage
		dungeon.grid = [...reversedGrid].reverse();

		// Remove resets outside new boundaries
		if (dungeon.resets) {
			dungeon.resets = dungeon.resets.filter((reset) => {
				const match = reset.roomRef.match(/@[^{]+\{(\d+),(\d+),(\d+)\}/);
				if (!match) return false;
				const x = parseInt(match[1]);
				const y = parseInt(match[2]);
				const z = parseInt(match[3]);
				return x < width && y < height && z < layers;
			});
		}

		// Remove exit overrides outside new boundaries
		if (dungeon.exitOverrides && Array.isArray(dungeon.exitOverrides)) {
			dungeon.exitOverrides = dungeon.exitOverrides.filter((override) => {
				const { x, y, z } = override.coordinates || {};
				return x < width && y < height && z < layers;
			});
			// Clean up empty exitOverrides array
			if (dungeon.exitOverrides.length === 0) {
				delete dungeon.exitOverrides;
			}
		} else if (dungeon.exitOverrides && Array.isArray(dungeon.exitOverrides)) {
			dungeon.exitOverrides = dungeon.exitOverrides.filter((override) => {
				const { x, y, z } = override.coordinates || {};
				return x < width && y < height && z < layers;
			});
			if (dungeon.exitOverrides.length === 0) {
				delete dungeon.exitOverrides;
			}
		}

		// Update UI
		this.setupLayerSelector(layers);
		this.renderMap(dungeon);
		this.loadResets(dungeon);

		this.makeChange({
			action: EDITOR_ACTIONS.RESIZE_DUNGEON,
			actionTarget: this.currentDungeonId,
			newParameters: { width, height, layers },
			oldParameters: {
				width: oldDims.width,
				height: oldDims.height,
				layers: oldDims.layers,
			},
		});
	}

	applyMobiusPerimeter() {
		if (!this.yamlData || !this.currentDungeonId) {
			this.showToast("No dungeon loaded", "Please select a dungeon first");
			return;
		}

		// Save state to history before making changes (for undo)
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		const { width, height, layers } = dungeon.dimensions;

		// Store the previous state for the change entry
		const previousState = this.cloneDungeonState(dungeon);

		// Direction bitmask constants
		const DIRECTION = {
			NORTH: 1 << 0,
			SOUTH: 1 << 1,
			EAST: 1 << 2,
			WEST: 1 << 3,
			NORTHEAST: 1 << 4,
			NORTHWEST: 1 << 5,
			SOUTHEAST: 1 << 6,
			SOUTHWEST: 1 << 7,
			UP: 1 << 8,
			DOWN: 1 << 9,
		};

		let linksCreated = 0;

		// Process each layer
		for (let z = 0; z < layers; z++) {
			// Process north edge (y = 0) - rooms here link NORTH to south edge (y = height - 1) at same X
			for (let x = 0; x < width; x++) {
				const room = this.getRoomAt(dungeon, x, 0, z);
				if (!room) continue;

				const override = this.getExitOverride(dungeon, x, 0, z);
				const currentRoomLinks = override?.roomLinks || room.roomLinks || {};
				const newRoomLinks = { ...currentRoomLinks };
				let currentAllowedExits = override?.allowedExits ?? room.allowedExits;
				let updated = false;

				// Add NORTH exit link if room has it
				if (this.hasExit(room, "NORTH")) {
					const targetX = x;
					const targetY = height - 1;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.north = targetRef;
					updated = true;
					linksCreated++;
				}

				// Add diagonal exits on north edge - enable them and add links
				if (x === 0) {
					// Northwest corner - add northwest exit
					const targetX = width - 1;
					const targetY = height - 1;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.northwest = targetRef;
					currentAllowedExits = currentAllowedExits | DIRECTION.NORTHWEST;
					updated = true;
					linksCreated++;
				}
				if (x === width - 1) {
					// Northeast corner - add northeast exit
					const targetX = 0;
					const targetY = height - 1;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.northeast = targetRef;
					currentAllowedExits = currentAllowedExits | DIRECTION.NORTHEAST;
					updated = true;
					linksCreated++;
				}

				if (updated) {
					this.setExitOverride(dungeon, x, 0, z, {
						allowedExits: currentAllowedExits,
						roomLinks: newRoomLinks,
					});
				}
			}

			// Process south edge (y = height - 1) - rooms here link SOUTH to north edge (y = 0) at same X
			for (let x = 0; x < width; x++) {
				const room = this.getRoomAt(dungeon, x, height - 1, z);
				if (!room) continue;

				const override = this.getExitOverride(dungeon, x, height - 1, z);
				const currentRoomLinks = override?.roomLinks || room.roomLinks || {};
				const newRoomLinks = { ...currentRoomLinks };
				let currentAllowedExits = override?.allowedExits ?? room.allowedExits;
				let updated = false;

				// Add SOUTH exit link if room has it
				if (this.hasExit(room, "SOUTH")) {
					const targetX = x;
					const targetY = 0;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.south = targetRef;
					updated = true;
					linksCreated++;
				}

				// Add diagonal exits on south edge - enable them and add links
				if (x === 0) {
					// Southwest corner - add southwest exit
					const targetX = width - 1;
					const targetY = 0;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.southwest = targetRef;
					currentAllowedExits = currentAllowedExits | DIRECTION.SOUTHWEST;
					updated = true;
					linksCreated++;
				}
				if (x === width - 1) {
					// Southeast corner - add southeast exit
					const targetX = 0;
					const targetY = 0;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.southeast = targetRef;
					currentAllowedExits = currentAllowedExits | DIRECTION.SOUTHEAST;
					updated = true;
					linksCreated++;
				}

				if (updated) {
					this.setExitOverride(dungeon, x, height - 1, z, {
						allowedExits: currentAllowedExits,
						roomLinks: newRoomLinks,
					});
				}
			}

			// Process west edge (x = 0) - rooms here link WEST to east edge (x = width - 1) at same Y
			for (let y = 0; y < height; y++) {
				const room = this.getRoomAt(dungeon, 0, y, z);
				if (!room) continue;

				const override = this.getExitOverride(dungeon, 0, y, z);
				const currentRoomLinks = override?.roomLinks || room.roomLinks || {};
				const newRoomLinks = { ...currentRoomLinks };
				let currentAllowedExits = override?.allowedExits ?? room.allowedExits;
				let updated = false;

				// Add WEST exit link if room has it
				if (this.hasExit(room, "WEST")) {
					const targetX = width - 1;
					const targetY = y;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.west = targetRef;
					updated = true;
					linksCreated++;
				}

				// Add diagonal exits on west edge - enable them and add links (skip corners, already handled)
				if (y === 0) {
					// Northwest corner - already handled in north edge, skip
				} else if (y === height - 1) {
					// Southwest corner - already handled in south edge, skip
				} else {
					// West edge (not corners) - add northwest and southwest exits
					// Northwest exit wraps to southeast edge
					const targetXNW = width - 1;
					const targetYNW = height - 1;
					const targetRefNW = this.formatRoomRef(
						dungeonId,
						targetXNW,
						targetYNW,
						z
					);
					newRoomLinks.northwest = targetRefNW;
					currentAllowedExits = currentAllowedExits | DIRECTION.NORTHWEST;

					// Southwest exit wraps to northeast edge
					const targetXSW = width - 1;
					const targetYSW = 0;
					const targetRefSW = this.formatRoomRef(
						dungeonId,
						targetXSW,
						targetYSW,
						z
					);
					newRoomLinks.southwest = targetRefSW;
					currentAllowedExits = currentAllowedExits | DIRECTION.SOUTHWEST;

					updated = true;
					linksCreated += 2;
				}

				if (updated) {
					this.setExitOverride(dungeon, 0, y, z, {
						allowedExits: currentAllowedExits,
						roomLinks: newRoomLinks,
					});
				}
			}

			// Process east edge (x = width - 1) - rooms here link EAST to west edge (x = 0) at same Y
			for (let y = 0; y < height; y++) {
				const room = this.getRoomAt(dungeon, width - 1, y, z);
				if (!room) continue;

				const override = this.getExitOverride(dungeon, width - 1, y, z);
				const currentRoomLinks = override?.roomLinks || room.roomLinks || {};
				const newRoomLinks = { ...currentRoomLinks };
				let currentAllowedExits = override?.allowedExits ?? room.allowedExits;
				let updated = false;

				// Add EAST exit link if room has it
				if (this.hasExit(room, "EAST")) {
					const targetX = 0;
					const targetY = y;
					const targetRef = this.formatRoomRef(dungeonId, targetX, targetY, z);
					newRoomLinks.east = targetRef;
					updated = true;
					linksCreated++;
				}

				// Add diagonal exits on east edge - enable them and add links (skip corners, already handled)
				if (y === 0) {
					// Northeast corner - already handled in north edge, skip
				} else if (y === height - 1) {
					// Southeast corner - already handled in south edge, skip
				} else {
					// East edge (not corners) - add northeast and southeast exits
					// Northeast exit wraps to southwest edge
					const targetXNE = 0;
					const targetYNE = height - 1;
					const targetRefNE = this.formatRoomRef(
						dungeonId,
						targetXNE,
						targetYNE,
						z
					);
					newRoomLinks.northeast = targetRefNE;
					currentAllowedExits = currentAllowedExits | DIRECTION.NORTHEAST;

					// Southeast exit wraps to northwest edge
					const targetXSE = 0;
					const targetYSE = 0;
					const targetRefSE = this.formatRoomRef(
						dungeonId,
						targetXSE,
						targetYSE,
						z
					);
					newRoomLinks.southeast = targetRefSE;
					currentAllowedExits = currentAllowedExits | DIRECTION.SOUTHEAST;

					updated = true;
					linksCreated += 2;
				}

				if (updated) {
					this.setExitOverride(dungeon, width - 1, y, z, {
						allowedExits: currentAllowedExits,
						roomLinks: newRoomLinks,
					});
				}
			}
		}

		// Re-render map to show new links
		this.renderMap(dungeon);

		// Create change entry for undo/redo
		this.makeChange(
			{
				action: EDITOR_ACTIONS.EDIT_ROOM_EXIT_OVERRIDE,
				actionTarget: "perimeter",
				newParameters: {
					mobiusPerimeter: true,
					linksCreated,
				},
				metadata: {
					dungeonId,
					width,
					height,
					layers,
				},
			},
			{
				previousStateOverride: previousState,
			}
		);

		this.showToast(
			"Mobius perimeter applied",
			`Created ${linksCreated} edge link${linksCreated !== 1 ? "s" : ""}`
		);
	}

	showConfirmModal() {
		return new Promise((resolve) => {
			const modal = document.getElementById("confirm-modal");
			modal.classList.add("active");

			document.getElementById("confirm-yes").onclick = () => {
				modal.classList.remove("active");
				resolve(true);
			};

			document.getElementById("confirm-no").onclick = () => {
				modal.classList.remove("active");
				resolve(false);
			};
		});
	}

	async saveDungeon() {
		if (!this.yamlData || !this.currentDungeonId) {
			this.showToast("No dungeon loaded", "Please select a dungeon first");
			return;
		}

		if (!this.commitDungeonSettingsForm()) {
			return;
		}

		// Update reset message
		const resetMessage = document.getElementById("reset-message-input").value;
		this.yamlData.dungeon.resetMessage = resetMessage || undefined;
		const dungeonName = document
			.getElementById("dungeon-name-input")
			.value.trim();
		const dungeonDescription = document
			.getElementById("dungeon-description-input")
			.value.trim();
		const normalizedName = dungeonName || undefined;
		const normalizedDescription = dungeonDescription || undefined;
		this.yamlData.dungeon.name = normalizedName;
		this.yamlData.dungeon.description = normalizedDescription;
		if (this.currentDungeon) {
			this.currentDungeon.resetMessage = resetMessage || "";
			this.currentDungeon.name = normalizedName || "";
			this.currentDungeon.description = normalizedDescription || "";
		}
		this.updateCurrentDungeonDisplay(this.yamlData.dungeon);

		// Clear any pending auto-save timeout before saving
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
			this.autoSaveTimeout = null;
		}

		// Rebuild the dungeon object to control YAML key order
		const preferredOrder = [
			"id",
			"name",
			"description",
			"dimensions",
			"resetMessage",
			"grid",
			"rooms",
			"templates",
			"resets",
		];
		const dungeonData = this.yamlData.dungeon || {};
		const orderedDungeon = {};

		for (const key of preferredOrder) {
			if (
				Object.prototype.hasOwnProperty.call(dungeonData, key) &&
				dungeonData[key] !== undefined
			) {
				orderedDungeon[key] = dungeonData[key];
			}
		}

		for (const key of Object.keys(dungeonData)) {
			if (!preferredOrder.includes(key) && dungeonData[key] !== undefined) {
				orderedDungeon[key] = dungeonData[key];
			}
		}

		this.yamlData.dungeon = orderedDungeon;

		// Rebuild root object with version first
		const orderedRoot = {};
		if (this.projectVersion) {
			orderedRoot.version = this.projectVersion;
		}
		orderedRoot.dungeon = orderedDungeon;

		// Convert back to YAML
		const yaml = jsyaml.dump(orderedRoot, {
			lineWidth: 120,
			noRefs: true,
			flowLevel: 4,
		});

		// Save via IPC/API
		try {
			await this.saveDungeonData(this.currentDungeonId, yaml);
			this.showToast("Dungeon saved successfully!", "");
			// Clear localStorage since we've saved
			const storageKey = this.getLocalStorageKey(this.currentDungeonId);
			localStorage.removeItem(storageKey);
			this.markChangesSaved();
			// Reload to get fresh data
			await this.loadDungeonFromSource(this.currentDungeonId);
		} catch (error) {
			this.showToast("Failed to save", error.message);
		}
	}

	getAvailableDirections() {
		const container = document.getElementById("room-links-container");
		if (!container)
			return [
				"north",
				"south",
				"east",
				"west",
				"northeast",
				"northwest",
				"southeast",
				"southwest",
				"up",
				"down",
			];

		const allDirections = [
			"north",
			"south",
			"east",
			"west",
			"northeast",
			"northwest",
			"southeast",
			"southwest",
			"up",
			"down",
		];
		const usedDirections = Array.from(
			container.querySelectorAll(".room-link-direction")
		).map((select) => select.value);

		return allDirections.filter((d) => !usedDirections.includes(d));
	}

	updateRoomLinkDirections() {
		const container = document.getElementById("room-links-container");
		if (!container) return;

		const allDirections = [
			"north",
			"south",
			"east",
			"west",
			"northeast",
			"northwest",
			"southeast",
			"southwest",
			"up",
			"down",
		];

		// Update each dropdown to only show available directions
		container.querySelectorAll(".room-link-direction").forEach((select) => {
			const currentValue = select.value;
			// Get all directions used by OTHER selects (not this one)
			const usedByOthers = Array.from(
				container.querySelectorAll(".room-link-direction")
			)
				.filter((s) => s !== select)
				.map((s) => s.value);

			// Available directions: current value + all unused directions
			const availableDirs = allDirections.filter(
				(d) => d === currentValue || !usedByOthers.includes(d)
			);

			// Save current value and rebuild options
			select.innerHTML = availableDirs
				.map(
					(d) =>
						`<option value="${d}" ${d === currentValue ? "selected" : ""}>${
							d.charAt(0).toUpperCase() + d.slice(1)
						}</option>`
				)
				.join("");
		});

		// Recalculate used directions after updates
		const usedDirections = Array.from(
			container.querySelectorAll(".room-link-direction")
		).map((select) => select.value);

		// Update add button state
		const addBtn = document.getElementById("add-room-link-btn");
		if (addBtn) {
			const canAddMore = usedDirections.length < allDirections.length;
			addBtn.disabled = !canAddMore;

			// Update or remove the "all directions used" message
			let msg = addBtn.nextElementSibling;
			if (
				!canAddMore &&
				(!msg || !msg.textContent.includes("All directions"))
			) {
				const p = document.createElement("p");
				p.style.cssText =
					"color: #aaa; font-size: 0.85rem; margin-top: 0.5rem;";
				p.textContent = "All directions are in use";
				addBtn.parentNode.insertBefore(p, addBtn.nextSibling);
			} else if (
				canAddMore &&
				msg &&
				msg.textContent.includes("All directions")
			) {
				msg.remove();
			}
		}
	}

	/**
	 * Generate HTML for a room link item with dropdown and number inputs
	 * @param {string[]} availableDirs - Available directions
	 * @param {string} selectedDir - Selected direction (optional)
	 * @param {string} ref - Room reference string to parse (optional)
	 * @param {number} index - Item index
	 * @returns {string} HTML string
	 */
	generateRoomLinkHTML(availableDirs, selectedDir = "", ref = "", index = 0) {
		const parsed = ref ? this.parseRoomRef(ref) : null;
		const dungeonId = parsed?.dungeonId || this.currentDungeonId || "";
		const x = parsed?.x ?? 0;
		const y = parsed?.y ?? 0;
		const z = parsed?.z ?? 0;

		const dungeonOptions = this.dungeonList
			.map(
				(id) =>
					`<option value="${id}" ${
						id === dungeonId ? "selected" : ""
					}>${id}</option>`
			)
			.join("");

		return `
			<select class="room-link-direction">
				${availableDirs
					.map(
						(d) =>
							`<option value="${d}" ${d === selectedDir ? "selected" : ""}>${
								d.charAt(0).toUpperCase() + d.slice(1)
							}</option>`
					)
					.join("")}
			</select>
			<select class="room-link-dungeon">
				${dungeonOptions}
			</select>
			<input type="number" class="room-link-x" value="${x}" min="0" step="1" placeholder="X">
			<input type="number" class="room-link-y" value="${y}" min="0" step="1" placeholder="Y">
			<input type="number" class="room-link-z" value="${z}" min="0" step="1" placeholder="Z">
			<button type="button" class="make-2way-btn" data-index="${index}" title="Make 2-way link">⇄</button>
			<button type="button" class="delete-link-btn" data-index="${index}">Delete</button>
		`;
	}

	addRoomLink() {
		const container = document.getElementById("room-links-container");
		if (!container) return;

		const availableDirs = this.getAvailableDirections();
		if (availableDirs.length === 0) return; // Can't add more

		const index = container.children.length;
		const linkItem = document.createElement("div");
		linkItem.className = "room-link-item";
		linkItem.dataset.index = index;
		linkItem.innerHTML = this.generateRoomLinkHTML(
			availableDirs,
			"",
			"",
			index
		);
		container.appendChild(linkItem);

		// Attach delete handler to the new button
		const deleteBtn = linkItem.querySelector(".delete-link-btn");
		if (deleteBtn) {
			deleteBtn.onclick = (e) => {
				const idx = parseInt(e.target.dataset.index);
				this.deleteRoomLink(idx);
			};
		}

		// Attach make-2way handler to the new button
		const make2WayBtn = linkItem.querySelector(".make-2way-btn");
		if (make2WayBtn) {
			make2WayBtn.onclick = (e) => {
				const idx = parseInt(e.target.dataset.index);
				this.makeExit2WayForTemplate(idx);
			};
		}

		// Attach direction change handler
		const directionSelect = linkItem.querySelector(".room-link-direction");
		if (directionSelect) {
			directionSelect.onchange = () => {
				this.updateRoomLinkDirections();
			};
		}

		// Update all direction dropdowns
		this.updateRoomLinkDirections();
	}

	deleteRoomLink(index) {
		const container = document.getElementById("room-links-container");
		if (!container) return;

		const items = Array.from(container.querySelectorAll(".room-link-item"));
		if (index >= 0 && index < items.length) {
			items[index].remove();
			// Re-index remaining items
			container.querySelectorAll(".room-link-item").forEach((item, i) => {
				item.dataset.index = i;
				const deleteBtn = item.querySelector(".delete-link-btn");
				if (deleteBtn) {
					deleteBtn.dataset.index = i;
					deleteBtn.onclick = (e) => {
						const idx = parseInt(e.target.dataset.index);
						this.deleteRoomLink(idx);
					};
				}
				const make2WayBtn = item.querySelector(".make-2way-btn");
				if (make2WayBtn) {
					make2WayBtn.dataset.index = i;
					make2WayBtn.onclick = (e) => {
						const idx = parseInt(e.target.dataset.index);
						this.makeExit2WayForTemplate(idx);
					};
				}
			});

			// Update direction dropdowns after deletion
			this.updateRoomLinkDirections();
		}
	}

	async makeExit2WayForOverride(linkIndex, currentX, currentY, currentZ) {
		if (!this.yamlData) return;

		const container = document.getElementById(
			"exit-override-room-links-container"
		);
		if (!container) return;

		const items = Array.from(container.querySelectorAll(".room-link-item"));
		if (linkIndex < 0 || linkIndex >= items.length) return;

		const linkItem = items[linkIndex];
		const directionSelect = linkItem.querySelector(".room-link-direction");
		const dungeonSelect = linkItem.querySelector(".room-link-dungeon");
		const xInput = linkItem.querySelector(".room-link-x");
		const yInput = linkItem.querySelector(".room-link-y");
		const zInput = linkItem.querySelector(".room-link-z");

		if (!directionSelect || !dungeonSelect || !xInput || !yInput || !zInput)
			return;

		const direction = directionSelect.value;
		const targetDungeonId = dungeonSelect.value;
		const targetX = parseInt(xInput.value, 10);
		const targetY = parseInt(yInput.value, 10);
		const targetZ = parseInt(zInput.value, 10);

		if (
			!targetDungeonId ||
			isNaN(targetX) ||
			isNaN(targetY) ||
			isNaN(targetZ)
		) {
			this.showToast("Invalid target", "Please fill in all room link fields");
			return;
		}

		// Get opposite direction
		const oppositeDir = this.getOppositeDirection(direction);

		// Format the reciprocal link
		const reciprocalLink = this.formatRoomRef(
			this.currentDungeonId,
			currentX,
			currentY,
			currentZ
		);

		// Check if target is in the same dungeon
		if (targetDungeonId === this.currentDungeonId) {
			// Same dungeon - modify directly
			const dungeon = this.yamlData.dungeon;

			let targetOverride = this.getExitOverride(
				dungeon,
				targetX,
				targetY,
				targetZ
			);
			if (!targetOverride) {
				// Create new object override
				const targetRoom = this.getRoomAt(dungeon, targetX, targetY, targetZ);
				const baseAllowedExits = targetRoom?.allowedExits || 0;
				targetOverride = {
					allowedExits: baseAllowedExits,
					roomLinks: {},
				};
			} else if (!targetOverride.roomLinks) {
				targetOverride.roomLinks = {};
			}

			// Add reciprocal link
			targetOverride.roomLinks[oppositeDir] = reciprocalLink;
			this.setExitOverride(dungeon, targetX, targetY, targetZ, targetOverride);

			this.showToast(
				"2-way link created",
				`Added ${oppositeDir} link from target room back to (${currentX}, ${currentY}, ${currentZ})`
			);

			// Re-render map
			this.renderMap(dungeon);
		} else {
			// Different dungeon - need to load, modify, and save it
			try {
				// Save current state
				const currentDungeonId = this.currentDungeonId;
				const currentYamlData = JSON.parse(JSON.stringify(this.yamlData));

				// Load target dungeon
				const targetData = await this.fetchDungeonData(targetDungeonId);
				const targetYamlData = jsyaml.load(targetData.yaml);
				const targetDungeon = targetYamlData.dungeon;

				// Get or create exit override for target room
				let targetOverride = this.getExitOverride(
					targetDungeon,
					targetX,
					targetY,
					targetZ
				);
				if (!targetOverride) {
					// Temporarily set yamlData to access getRoomAt
					const tempYamlData = this.yamlData;
					this.yamlData = { dungeon: targetDungeon };
					const targetRoom = this.getRoomAt(
						targetDungeon,
						targetX,
						targetY,
						targetZ
					);
					this.yamlData = tempYamlData;

					const baseAllowedExits = targetRoom?.allowedExits || 0;
					targetOverride = {
						allowedExits: baseAllowedExits,
						roomLinks: {},
					};
				} else if (!targetOverride.roomLinks) {
					targetOverride.roomLinks = {};
				}

				// Add reciprocal link
				targetOverride.roomLinks[oppositeDir] = reciprocalLink;
				this.setExitOverride(
					targetDungeon,
					targetX,
					targetY,
					targetZ,
					targetOverride
				);

				// Save target dungeon
				const orderedRoot = {};
				if (targetYamlData.version) {
					orderedRoot.version = targetYamlData.version;
				}
				orderedRoot.dungeon = targetDungeon;

				const targetYaml = jsyaml.dump(orderedRoot, {
					lineWidth: 120,
					noRefs: true,
					flowLevel: 4,
				});

				await this.saveDungeonData(targetDungeonId, targetYaml);

				// Restore current dungeon
				this.currentDungeonId = currentDungeonId;
				this.yamlData = currentYamlData;

				this.showToast(
					"2-way link created",
					`Added ${oppositeDir} link in ${targetDungeonId} from target room back to (${currentX}, ${currentY}, ${currentZ})`
				);
			} catch (error) {
				console.error("Failed to create 2-way link in target dungeon:", error);
				this.showToast(
					"Failed to create 2-way link",
					`Error: ${error.message}`
				);
			}
		}
	}

	makeExit2WayForTemplate(linkIndex) {
		if (!this.yamlData) return;

		const container = document.getElementById("room-links-container");
		if (!container) return;

		const items = Array.from(container.querySelectorAll(".room-link-item"));
		if (linkIndex < 0 || linkIndex >= items.length) return;

		const linkItem = items[linkIndex];
		const directionSelect = linkItem.querySelector(".room-link-direction");
		const dungeonSelect = linkItem.querySelector(".room-link-dungeon");
		const xInput = linkItem.querySelector(".room-link-x");
		const yInput = linkItem.querySelector(".room-link-y");
		const zInput = linkItem.querySelector(".room-link-z");

		if (!directionSelect || !dungeonSelect || !xInput || !yInput || !zInput)
			return;

		const direction = directionSelect.value;
		const targetDungeonId = dungeonSelect.value;
		const targetX = parseInt(xInput.value, 10);
		const targetY = parseInt(yInput.value, 10);
		const targetZ = parseInt(zInput.value, 10);

		if (
			!targetDungeonId ||
			isNaN(targetX) ||
			isNaN(targetY) ||
			isNaN(targetZ)
		) {
			this.showToast("Invalid target", "Please fill in all room link fields");
			return;
		}

		// Get the current template index from modal
		const modal = document.getElementById("template-modal");
		const templateId = document.getElementById("template-id")?.value;
		const templateType = document.getElementById("template-type")?.value;

		if (templateType !== "room") {
			this.showToast(
				"Not available",
				"2-way links only work for room templates"
			);
			return;
		}

		// For templates, we need to find all rooms using this template and create exit overrides
		// This is complex, so for now we'll just show a message
		// TODO: Implement finding all rooms using this template and creating exit overrides
		this.showToast(
			"Not yet implemented",
			"2-way links for room templates require finding all rooms using the template. Please use exit overrides for specific rooms."
		);
	}

	async calculateMobAttributes() {
		const raceSelect = document.getElementById("template-race");
		const jobSelect = document.getElementById("template-job");
		const levelInput = document.getElementById("template-level");
		const displayDiv = document.getElementById("calculated-attributes");

		if (!raceSelect || !jobSelect || !levelInput || !displayDiv) return;

		const raceId = raceSelect.value;
		const jobId = jobSelect.value;
		const level = parseInt(levelInput.value) || 1;

		if (!raceId || !jobId) {
			displayDiv.innerHTML =
				'<p style="color: #aaa; font-style: italic;">Select race and job to see calculated attributes</p>';
			return;
		}

		try {
			const data = await this.calculateAttributesFromSource({
				raceId,
				jobId,
				level,
			});
			const { primary, secondary, resourceCaps } = data;

			displayDiv.innerHTML = `
				<div class="attributes-section">
					<h4>Primary Attributes</h4>
					<div class="attribute-grid">
						<div class="attribute-item"><span class="attr-label">Strength:</span> <span class="attr-value">${primary.strength.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Agility:</span> <span class="attr-value">${primary.agility.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Intelligence:</span> <span class="attr-value">${primary.intelligence.toFixed(
							2
						)}</span></div>
					</div>
				</div>
				<div class="attributes-section">
					<h4>Secondary Attributes</h4>
					<div class="attribute-grid">
						<div class="attribute-item"><span class="attr-label">Attack Power:</span> <span class="attr-value">${secondary.attackPower.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Defense:</span> <span class="attr-value">${secondary.defense.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Vitality:</span> <span class="attr-value">${secondary.vitality.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Crit Rate:</span> <span class="attr-value">${secondary.critRate.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Avoidance:</span> <span class="attr-value">${secondary.avoidance.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Accuracy:</span> <span class="attr-value">${secondary.accuracy.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Endurance:</span> <span class="attr-value">${secondary.endurance.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Spell Power:</span> <span class="attr-value">${secondary.spellPower.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Wisdom:</span> <span class="attr-value">${secondary.wisdom.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Resilience:</span> <span class="attr-value">${secondary.resilience.toFixed(
							2
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Spirit:</span> <span class="attr-value">${secondary.spirit.toFixed(
							2
						)}</span></div>
					</div>
				</div>
				<div class="attributes-section">
					<h4>Resource Capacities</h4>
					<div class="attribute-grid">
						<div class="attribute-item"><span class="attr-label">Max Health:</span> <span class="attr-value">${Math.round(
							resourceCaps.maxHealth
						)}</span></div>
						<div class="attribute-item"><span class="attr-label">Max Mana:</span> <span class="attr-value">${Math.round(
							resourceCaps.maxMana
						)}</span></div>
					</div>
				</div>
			`;
		} catch (error) {
			displayDiv.innerHTML = `<p style="color: #f44;">Error calculating attributes: ${error.message}</p>`;
		}
	}

	updatePlacementIndicator(type, id, display) {
		const indicator = document.getElementById("placement-indicator");
		const toastContainer = document.getElementById("toast-container");
		if (!indicator) {
			toastContainer?.classList.remove("has-indicator");
			return;
		}

		if (!type || id === null || id === undefined) {
			indicator.style.display = "none";
			toastContainer?.classList.remove("has-indicator");
			return;
		}

		// Check if this is the delete template
		const isDelete = id === "__DELETE__";

		const actionText = isDelete
			? this.placementMode === "paint"
				? "Paint Delete"
				: "Delete Room"
			: type === "room"
			? this.placementMode === "paint"
				? "Paint Room"
				: "Place Room"
			: type === "mob"
			? "Add Mob Reset"
			: "Add Object Reset";

		indicator.setAttribute("data-type", isDelete ? "delete" : type);
		indicator.querySelector(".placement-action").textContent = actionText;
		indicator.querySelector(".placement-template").textContent = display || id;
		indicator.style.display = "block";
		toastContainer?.classList.add("has-indicator");

		// Set up mode buttons if not already set up
		const insertBtn = document.getElementById("placement-mode-insert");
		const paintBtn = document.getElementById("placement-mode-paint");

		if (insertBtn && !insertBtn.dataset.listenerAdded) {
			insertBtn.dataset.listenerAdded = "true";
			insertBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.setPlacementMode("insert");
			});
		}

		if (paintBtn && !paintBtn.dataset.listenerAdded) {
			paintBtn.dataset.listenerAdded = "true";
			paintBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.setPlacementMode("paint");
			});
		}

		// Update mode button highlights
		if (insertBtn) {
			insertBtn.classList.toggle("active", this.placementMode === "insert");
		}
		if (paintBtn) {
			paintBtn.classList.toggle("active", this.placementMode === "paint");
		}

		// Set up cancel button if not already set up
		const cancelBtn = document.getElementById("placement-cancel-btn");
		if (cancelBtn && !cancelBtn.dataset.listenerAdded) {
			cancelBtn.dataset.listenerAdded = "true";
			cancelBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.cancelPlacement();
			});
		}
	}

	setPlacementMode(mode) {
		this.placementMode = mode;

		// Flood-fill paint mode conflicts with selection tools because they
		// hijack mouse events. Clear any active selection tool when switching
		// to paint so clicks trigger flood fill as expected.
		if (mode === "paint" && this.selectionMode !== null) {
			this.clearSelectionTool();
		}

		// Update indicator to reflect new mode
		if (this.selectedTemplate !== null && this.selectedTemplateType) {
			const template = this.getTemplateDisplay(
				this.selectedTemplateType,
				this.selectedTemplate
			);
			this.updatePlacementIndicator(
				this.selectedTemplateType,
				this.selectedTemplate,
				template
			);
		}

		this.updateStatusBar();
	}

	getTemplateDisplay(type, id) {
		if (!this.yamlData) return id;
		const dungeon = this.yamlData.dungeon;

		if (type === "room") {
			if (id === "__DELETE__") return "🗑️ Delete Room";
			const room = dungeon.rooms[id];
			return room?.display || `Room ${parseInt(id) + 1}`;
		} else {
			const template = dungeon.templates?.find((t) => t.id === id);
			return template?.display || id;
		}
	}

	cancelPlacement() {
		// Clear selection
		this.selectedTemplate = null;
		this.selectedTemplateType = null;

		// Remove selected class from template items
		document
			.querySelectorAll(".template-item")
			.forEach((i) => i.classList.remove("selected"));

		// Hide placement indicator
		const indicator = document.getElementById("placement-indicator");
		if (indicator) {
			indicator.style.display = "none";
		}

		const toastContainer = document.getElementById("toast-container");
		toastContainer?.classList.remove("has-indicator");
	}

	showToast(message, details) {
		const container = document.getElementById("toast-container");
		if (!container) return;

		const toastId = `toast-${this.toastIdCounter++}`;
		const toast = document.createElement("div");
		toast.className = "toast";
		toast.id = toastId;
		toast.innerHTML = `
			<div class="toast-content">
				<div class="toast-title">${message}</div>
				${details ? `<div class="toast-details">${details}</div>` : ""}
			</div>
		`;

		// Add to container (will appear at bottom)
		container.appendChild(toast);

		// Remove after animation completes
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 3000);
	}

	setupEventListeners() {
		// Prevent text selection during drag
		document.addEventListener("mouseup", (e) => {
			if (this.isSelecting) {
				// End selection
				this.isSelecting = false;
				this.selectionBaseCells.clear();
				this.isSelectionAddMode = false;

				// If template is selected, place it in all selected cells
				if (this.selectedTemplate !== null && this.selectedCells.size > 0) {
					// Use placeTemplateInSelection which handles history properly
					this.placeTemplateInSelection(
						this.selectedTemplateType,
						this.selectedTemplate
					);
					// Clear selection after placement (but keep selection tool active)
					this.clearSelectedCells();
				}
			} else if (this.isDragging) {
				// Cancel drag on mouseup anywhere
				if (this.selectedCell) {
					// Show room info for the last selected cell when drag ends
					const { x, y, z } = this.selectedCell;
					if (this.yamlData) {
						const dungeon = this.yamlData.dungeon;
						const layerIndex = dungeon.dimensions.layers - 1 - z;
						const layer = dungeon.grid[layerIndex] || [];
						const row = layer[y] || [];
						const roomIndex = row[x] || 0;
						this.showRoomInfo(x, y, z);
					}
				}
				this.isDragging = false;
				this.processedCells.clear();
			}
		});

		document.addEventListener("mouseleave", (e) => {
			// Cancel drag if mouse leaves the window
			if (this.isDragging) {
				this.isDragging = false;
				this.processedCells.clear();
			}
		});

		document.addEventListener("selectstart", (e) => {
			if (this.isDragging) {
				e.preventDefault();
			}
		});

		// Dungeon selector
		document
			.getElementById("dungeon-select")
			.addEventListener("change", (e) => {
				if (e.target.value === "__NEW__") {
					this.showNewDungeonModal();
					// Reset dropdown to empty
					e.target.value = "";
				} else if (e.target.value) {
					this.loadDungeon(e.target.value);
				}
			});

		// Save button
		document.getElementById("save-btn").addEventListener("click", () => {
			this.saveDungeon();
		});

		// Help button
		const helpModal = document.getElementById("help-modal");
		const helpBtn = document.getElementById("help-btn");
		const helpCloseBtn = document.getElementById("help-close-btn");
		const helpClose = document.getElementById("help-close");

		if (helpBtn) {
			helpBtn.addEventListener("click", () => {
				helpModal.classList.add("active");
			});
		}

		const closeHelpModal = () => {
			helpModal.classList.remove("active");
		};

		if (helpCloseBtn) {
			helpCloseBtn.addEventListener("click", closeHelpModal);
		}

		if (helpClose) {
			helpClose.addEventListener("click", closeHelpModal);
		}

		// Theme toggle button
		const themeToggleBtn = document.getElementById("theme-toggle-btn");
		const themeStylesheet = document.getElementById("theme-stylesheet");

		// Get current theme from stylesheet (already set by inline script in head)
		const getCurrentTheme = () => {
			return themeStylesheet.href.includes("light.css") ? "light" : "dark";
		};

		// Update button icon based on current theme
		const updateThemeButton = () => {
			if (themeToggleBtn) {
				themeToggleBtn.textContent =
					getCurrentTheme() === "light" ? "☀️" : "🌙";
			}
		};

		// Initialize button icon
		updateThemeButton();

		// Theme toggle handler
		if (themeToggleBtn && themeStylesheet) {
			themeToggleBtn.addEventListener("click", () => {
				const currentTheme = getCurrentTheme();
				const newTheme = currentTheme === "dark" ? "light" : "dark";

				// Add spinning animation
				themeToggleBtn.classList.add("spinning");

				// Change icon halfway through animation (at 180 degrees)
				setTimeout(() => {
					if (newTheme === "light") {
						themeStylesheet.href = "./static/light.css";
						localStorage.setItem("theme", "light");
						themeToggleBtn.textContent = "☀️";
					} else {
						themeStylesheet.href = "./static/dark.css";
						localStorage.setItem("theme", "dark");
						themeToggleBtn.textContent = "🌙";
					}
				}, 300); // Halfway through 600ms animation

				// Remove spinning class after animation completes
				setTimeout(() => {
					themeToggleBtn.classList.remove("spinning");
				}, 600);
			});
		}

		// Close help modal when clicking outside
		helpModal.addEventListener("click", (e) => {
			if (e.target === helpModal) {
				closeHelpModal();
			}
		});

		// New dungeon modal
		const newDungeonModal = document.getElementById("new-dungeon-modal");
		const newDungeonCloseBtn = document.getElementById("new-dungeon-close");
		const newDungeonCancelBtn = document.getElementById("new-dungeon-cancel");
		const newDungeonCreateBtn = document.getElementById("new-dungeon-create");

		const closeNewDungeonModal = () => {
			newDungeonModal.classList.remove("active");
		};

		if (newDungeonCloseBtn) {
			newDungeonCloseBtn.addEventListener("click", closeNewDungeonModal);
		}

		if (newDungeonCancelBtn) {
			newDungeonCancelBtn.addEventListener("click", closeNewDungeonModal);
		}

		if (newDungeonCreateBtn) {
			newDungeonCreateBtn.addEventListener("click", () => {
				this.createNewDungeon();
			});
		}

		// Close new dungeon modal when clicking outside
		newDungeonModal.addEventListener("click", (e) => {
			if (e.target === newDungeonModal) {
				closeNewDungeonModal();
			}
		});

		// Allow Enter key to submit new dungeon form
		const newDungeonNameInput = document.getElementById("new-dungeon-name");
		if (newDungeonNameInput) {
			newDungeonNameInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && newDungeonModal.classList.contains("active")) {
					e.preventDefault();
					this.createNewDungeon();
				}
			});
		}

		// Tabs - scope to each sidebar independently
		document.querySelectorAll(".sidebar").forEach((sidebar) => {
			const tabs = sidebar.querySelectorAll(".tab");
			tabs.forEach((tab) => {
				tab.addEventListener("click", (e) => {
					const tabName = e.target.dataset.tab;
					// Only affect tabs and content within this sidebar
					sidebar
						.querySelectorAll(".tab")
						.forEach((t) => t.classList.remove("active"));
					sidebar
						.querySelectorAll(".tab-content")
						.forEach((c) => c.classList.remove("active"));
					e.target.classList.add("active");
					sidebar.querySelector(`#${tabName}-tab`).classList.add("active");
				});
			});
		});

		const historyList = document.getElementById("history-list");
		if (historyList) {
			historyList.addEventListener("click", (e) => {
				const item = e.target.closest(".history-item");
				if (!item) return;
				const index = item.dataset.index;
				this.jumpToChange(Number(index));
			});
		}

		// Add template buttons
		document.getElementById("add-room-btn").addEventListener("click", () => {
			this.editTemplate("room", -1);
		});

		document.getElementById("add-mob-btn").addEventListener("click", () => {
			this.editTemplate("mob", "");
		});

		document.getElementById("add-object-btn").addEventListener("click", () => {
			this.editTemplate("object", "");
		});

		// Layer selector
		document.getElementById("layer-select").addEventListener("change", (e) => {
			this.currentLayer = parseInt(e.target.value);
			if (this.yamlData) {
				// Reload resets to show only current layer
				this.loadResets(this.yamlData.dungeon);
				this.renderMap(this.yamlData.dungeon);
			}
		});

		// Keyboard shortcuts for layer navigation
		document.addEventListener("keydown", (e) => {
			// Only handle if not typing in an input field
			if (
				e.target.tagName === "INPUT" ||
				e.target.tagName === "TEXTAREA" ||
				e.target.isContentEditable
			) {
				return;
			}

			if (
				e.key === "PageUp" ||
				e.key === "PageDown" ||
				e.key === "Home" ||
				e.key === "End"
			) {
				e.preventDefault();
				if (!this.yamlData) return;

				const dungeon = this.yamlData.dungeon;
				const maxLayers = dungeon.dimensions.layers;

				if (e.key === "PageUp") {
					// Go to next layer (higher, since layer 0 is bottom)
					this.currentLayer = Math.min(maxLayers - 1, this.currentLayer + 1);
				} else if (e.key === "PageDown") {
					// Go to previous layer (lower, since layer 0 is bottom)
					this.currentLayer = Math.max(0, this.currentLayer - 1);
				} else if (e.key === "Home") {
					// Jump to first layer (layer 0)
					this.currentLayer = 0;
				} else if (e.key === "End") {
					// Jump to last layer
					this.currentLayer = maxLayers - 1;
				}

				// Update layer selector
				const layerSelect = document.getElementById("layer-select");
				if (layerSelect) {
					layerSelect.value = this.currentLayer;
				}

				// Re-render map
				this.renderMap(dungeon);
				// Reload resets to show only current layer
				this.loadResets(dungeon);
			} else if (e.key === "Delete") {
				// Delete selected rooms
				if (this.selectedCells.size > 0) {
					e.preventDefault();
					this.deleteSelectedRooms();
				} else if (this.selectedCell) {
					// Single cell selection - delete the room at that cell
					e.preventDefault();
					this.deleteRoomAtCell(
						this.selectedCell.x,
						this.selectedCell.y,
						this.selectedCell.z
					);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				// First, close any open modals
				const templateModal = document.getElementById("template-modal");
				const resetEditModal = document.getElementById("reset-edit-modal");
				const confirmModal = document.getElementById("confirm-modal");
				const helpModal = document.getElementById("help-modal");

				if (templateModal && templateModal.classList.contains("active")) {
					templateModal.classList.remove("active");
					return;
				}
				if (resetEditModal && resetEditModal.classList.contains("active")) {
					resetEditModal.classList.remove("active");
					return;
				}
				if (confirmModal && confirmModal.classList.contains("active")) {
					confirmModal.classList.remove("active");
					return;
				}
				if (helpModal && helpModal.classList.contains("active")) {
					helpModal.classList.remove("active");
					return;
				}

				const newDungeonModal = document.getElementById("new-dungeon-modal");
				if (newDungeonModal && newDungeonModal.classList.contains("active")) {
					newDungeonModal.classList.remove("active");
					return;
				}

				const dungeonSettingsModal = document.getElementById(
					"dungeon-settings-modal"
				);
				if (
					dungeonSettingsModal &&
					dungeonSettingsModal.classList.contains("active")
				) {
					if (!this.commitDungeonSettingsForm()) {
						return;
					}
					dungeonSettingsModal.classList.remove("active");
					return;
				}

				// If no modals are open, handle selection/deselection
				if (this.isSelecting) {
					this.cancelSelection();
					return;
				}

				const hasCellSelection =
					this.selectedCells.size > 0 || this.selectedCell !== null;

				if (hasCellSelection) {
					this.clearSelectedCells();
					return;
				}

				// No cell selection - clear selection tool and template selection
				this.clearSelectionTool();

				if (
					this.selectedTemplate !== null ||
					this.selectedTemplateType !== null
				) {
					this.clearSelectedTemplate();
				}
			} else if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
				// Undo (Ctrl+Z)
				e.preventDefault();
				this.undo();
			} else if (
				e.ctrlKey &&
				(e.key === "y" || (e.key === "z" && e.shiftKey))
			) {
				// Redo (Ctrl+Y or Ctrl+Shift+Z)
				e.preventDefault();
				this.redo();
			} else if (e.ctrlKey && e.key === "c" && !e.shiftKey) {
				// Copy (Ctrl+C)
				if (this.selectedCells.size > 0) {
					e.preventDefault();
					this.copySelection();
				}
			} else if (e.ctrlKey && e.key === "x" && !e.shiftKey) {
				// Cut (Ctrl+X)
				if (this.selectedCells.size > 0) {
					e.preventDefault();
					this.cutSelection();
				}
			} else if (e.ctrlKey && e.key === "v" && !e.shiftKey) {
				// Paste (Ctrl+V)
				if (this.clipboard) {
					e.preventDefault();
					this.pasteSelection();
				}
			} else if (e.ctrlKey && e.key === "a" && !e.shiftKey) {
				// Select all (Ctrl+A)
				e.preventDefault();
				this.selectAllCurrentLayer();
			} else if (e.ctrlKey && e.key === "s" && !e.shiftKey) {
				// Save dungeon (Ctrl+S)
				e.preventDefault();
				this.saveDungeon();
			}
		});

		// Dungeon settings modal
		const dungeonSettingsModal = document.getElementById(
			"dungeon-settings-modal"
		);
		const editSettingsBtn = document.getElementById(
			"edit-dungeon-settings-btn"
		);
		const dungeonSettingsClose = document.getElementById(
			"dungeon-settings-close"
		);
		const dungeonSettingsDone = document.getElementById(
			"dungeon-settings-done"
		);
		const applyDungeonSettingsBtn = document.getElementById(
			"apply-dungeon-settings-btn"
		);

		const closeDungeonSettingsModal = () => {
			if (!this.commitDungeonSettingsForm()) {
				return;
			}
			if (dungeonSettingsModal) {
				dungeonSettingsModal.classList.remove("active");
			}
		};

		if (editSettingsBtn && dungeonSettingsModal) {
			editSettingsBtn.addEventListener("click", () => {
				if (!this.currentDungeonId) return;
				this.updateDungeonSettingsForm(this.yamlData?.dungeon || null);
				dungeonSettingsModal.classList.add("active");
			});
		}

		if (dungeonSettingsClose) {
			dungeonSettingsClose.addEventListener("click", closeDungeonSettingsModal);
		}

		if (dungeonSettingsDone) {
			dungeonSettingsDone.addEventListener("click", closeDungeonSettingsModal);
		}

		if (applyDungeonSettingsBtn) {
			applyDungeonSettingsBtn.addEventListener("click", () => {
				if (!this.commitDungeonSettingsForm()) {
					return;
				}
				this.resizeDungeon();
			});
		}

		const mobiusPerimeterBtn = document.getElementById("mobius-perimeter-btn");
		if (mobiusPerimeterBtn) {
			mobiusPerimeterBtn.addEventListener("click", () => {
				this.applyMobiusPerimeter();
			});
		}

		// Toolbox buttons
		document.querySelectorAll(".tool-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const tool = e.currentTarget.dataset.tool;
				this.setSelectionMode(tool, e.currentTarget);
			});
		});

		// Clear action buttons
		const clearResetsBtn = document.getElementById("clear-resets-btn");
		if (clearResetsBtn) {
			clearResetsBtn.addEventListener("click", () => {
				this.clearResetsInSelection();
			});
		}

		const clearExitOverridesBtn = document.getElementById(
			"clear-exit-overrides-btn"
		);
		if (clearExitOverridesBtn) {
			clearExitOverridesBtn.addEventListener("click", () => {
				this.clearExitOverridesInSelection();
			});
		}

		// Initialize button states
		this.updateActionButtonStates();
	}

	clearSelectedTemplate() {
		this.selectedTemplate = null;
		this.selectedTemplateType = null;
		document.querySelectorAll(".template-item").forEach((item) => {
			item.classList.remove("selected");
		});
		this.updatePlacementIndicator(null, null, null);
	}

	clearSelectedCells() {
		this.selectedCells.clear();
		this.selectedCell = null;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.selectionBaseCells.clear();
		this.isSelectionAddMode = false;
		this.updateSelectionVisuals();
		document.querySelectorAll(".grid-cell").forEach((cell) => {
			cell.classList.remove("selected");
			cell.classList.remove("selected-cell");
		});
	}

	clearSelectionTool() {
		this.clearSelectedCells();

		if (this.selectionMode === null) {
			this.isSelecting = false;
			return;
		}

		this.selectionMode = null;
		this.isSelecting = false;
		document.querySelectorAll(".tool-btn").forEach((btn) => {
			btn.classList.remove("active");
		});

		this.updateStatusBar();
	}

	cancelSelection() {
		if (!this.isSelecting) {
			return;
		}

		this.isSelecting = false;
		this.clearSelectedCells();
	}

	setSelectionMode(mode, button = null) {
		// Toggle mode: clicking the same tool (or null) deselects it
		if (mode === null || this.selectionMode === mode) {
			this.clearSelectionTool();
			return;
		}

		this.selectionMode = mode;
		this.isSelecting = false;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.selectionBaseCells.clear();
		this.isSelectionAddMode = false;

		// Update button highlights
		document.querySelectorAll(".tool-btn").forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.tool === this.selectionMode);
		});

		if (typeof button?.focus === "function") {
			button.focus();
		}

		this.updateStatusBar();
	}

	updateSelection() {
		if (!this.selectionStart || !this.selectionEnd || !this.selectionMode) {
			this.selectedCells.clear();
			this.updateSelectionVisuals();
			return;
		}

		const cells = new Set();
		const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
		const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
		const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
		const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);
		const z = this.selectionStart.z;

		if (this.selectionMode === "line") {
			// Line: use Bresenham's algorithm between start and end on the same layer
			const startX = this.selectionStart.x;
			const startY = this.selectionStart.y;
			const endX = this.selectionEnd.x;
			const endY = this.selectionEnd.y;

			let x0 = startX;
			let y0 = startY;
			const x1 = endX;
			const y1 = endY;

			const dx = Math.abs(x1 - x0);
			const dy = Math.abs(y1 - y0);
			const sx = x0 < x1 ? 1 : -1;
			const sy = y0 < y1 ? 1 : -1;
			let err = dx - dy;

			while (true) {
				// Clamp coordinates to dungeon bounds
				if (
					x0 >= 0 &&
					x0 < this.yamlData.dungeon.dimensions.width &&
					y0 >= 0 &&
					y0 < this.yamlData.dungeon.dimensions.height
				) {
					cells.add(`${x0},${y0},${z}`);
				}

				if (x0 === x1 && y0 === y1) break;
				const e2 = 2 * err;
				if (e2 > -dy) {
					err -= dy;
					x0 += sx;
				}
				if (e2 < dx) {
					err += dx;
					y0 += sy;
				}
			}
		} else if (this.selectionMode === "rectangle") {
			// Rectangle: all cells in the bounding box
			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					cells.add(`${x},${y},${z}`);
				}
			}
		} else if (this.selectionMode === "edge-line") {
			const startX = this.selectionStart.x;
			const startY = this.selectionStart.y;
			const endX = this.selectionEnd.x;
			const endY = this.selectionEnd.y;

			// Track line cells to avoid selecting them
			const lineCells = new Set();

			// First pass: draw the line and track all line cells
			let x0 = startX;
			let y0 = startY;
			const x1 = endX;
			const y1 = endY;

			const dx = Math.abs(x1 - x0);
			const dy = Math.abs(y1 - y0);
			const sx = x0 < x1 ? 1 : -1;
			const sy = y0 < y1 ? 1 : -1;
			let err = dx - dy;

			while (true) {
				if (
					x0 >= 0 &&
					x0 < this.yamlData.dungeon.dimensions.width &&
					y0 >= 0 &&
					y0 < this.yamlData.dungeon.dimensions.height
				) {
					lineCells.add(`${x0},${y0},${z}`);
				}

				if (x0 === x1 && y0 === y1) break;
				const e2 = 2 * err;
				if (e2 > -dy) {
					err -= dy;
					x0 += sx;
				}
				if (e2 < dx) {
					err += dx;
					y0 += sy;
				}
			}

			// Calculate line direction for perpendicular
			const dirX = endX - startX;
			const dirY = endY - startY;

			// Determine perpendicular direction (normalized to cardinal)
			let perpX = 0;
			let perpY = 0;

			if (dirX === 0 && dirY === 0) {
				// Degenerate case
				return;
			} else if (dirX === 0) {
				// Vertical line: perpendicular is horizontal
				perpX = dirY > 0 ? -1 : 1; // Left for downward, right for upward
				perpY = 0;
			} else if (dirY === 0) {
				// Horizontal line: perpendicular is vertical
				perpX = 0;
				perpY = dirX > 0 ? -1 : 1; // Above for rightward, below for leftward
			} else {
				// Diagonal: use perpendicular vector and round to nearest cardinal
				// Perpendicular to (dx, dy) is (-dy, dx)
				const perpDirX = -dirY;
				const perpDirY = dirX;
				// Round to nearest cardinal direction
				if (Math.abs(perpDirX) >= Math.abs(perpDirY)) {
					perpX = perpDirX > 0 ? 1 : -1;
					perpY = 0;
				} else {
					perpX = 0;
					perpY = perpDirY > 0 ? 1 : -1;
				}
			}

			// Always include the start and end cells of the original line
			const startKey = `${startX},${startY},${z}`;
			const endKey = `${endX},${endY},${z}`;
			if (
				startX >= 0 &&
				startX < this.yamlData.dungeon.dimensions.width &&
				startY >= 0 &&
				startY < this.yamlData.dungeon.dimensions.height
			) {
				cells.add(startKey);
			}
			if (
				endX >= 0 &&
				endX < this.yamlData.dungeon.dimensions.width &&
				endY >= 0 &&
				endY < this.yamlData.dungeon.dimensions.height
			) {
				cells.add(endKey);
			}

			// Also ensure start and end cells of offset parallel lines are selected
			// Start cells (offset versions)
			const start1X = startX + perpX;
			const start1Y = startY + perpY;
			const start2X = startX - perpX;
			const start2Y = startY - perpY;

			if (
				start1X >= 0 &&
				start1X < this.yamlData.dungeon.dimensions.width &&
				start1Y >= 0 &&
				start1Y < this.yamlData.dungeon.dimensions.height
			) {
				const start1Key = `${start1X},${start1Y},${z}`;
				if (!lineCells.has(start1Key)) {
					cells.add(start1Key);
				}
			}

			if (
				start2X >= 0 &&
				start2X < this.yamlData.dungeon.dimensions.width &&
				start2Y >= 0 &&
				start2Y < this.yamlData.dungeon.dimensions.height
			) {
				const start2Key = `${start2X},${start2Y},${z}`;
				if (!lineCells.has(start2Key)) {
					cells.add(start2Key);
				}
			}

			// End cells (offset versions)
			const end1X = endX + perpX;
			const end1Y = endY + perpY;
			const end2X = endX - perpX;
			const end2Y = endY - perpY;

			if (
				end1X >= 0 &&
				end1X < this.yamlData.dungeon.dimensions.width &&
				end1Y >= 0 &&
				end1Y < this.yamlData.dungeon.dimensions.height
			) {
				const end1Key = `${end1X},${end1Y},${z}`;
				if (!lineCells.has(end1Key)) {
					cells.add(end1Key);
				}
			}

			if (
				end2X >= 0 &&
				end2X < this.yamlData.dungeon.dimensions.width &&
				end2Y >= 0 &&
				end2Y < this.yamlData.dungeon.dimensions.height
			) {
				const end2Key = `${end2X},${end2Y},${z}`;
				if (!lineCells.has(end2Key)) {
					cells.add(end2Key);
				}
			}

			// Select two parallel lines (one on each side of the original line)
			// Side 1: offset by +perp
			x0 = startX;
			y0 = startY;
			err = dx - dy;

			while (true) {
				if (
					x0 >= 0 &&
					x0 < this.yamlData.dungeon.dimensions.width &&
					y0 >= 0 &&
					y0 < this.yamlData.dungeon.dimensions.height
				) {
					const edgeX = x0 + perpX;
					const edgeY = y0 + perpY;
					const edgeKey = `${edgeX},${edgeY},${z}`;

					if (
						!lineCells.has(edgeKey) &&
						edgeX >= 0 &&
						edgeX < this.yamlData.dungeon.dimensions.width &&
						edgeY >= 0 &&
						edgeY < this.yamlData.dungeon.dimensions.height
					) {
						cells.add(edgeKey);
					}
				}

				if (x0 === x1 && y0 === y1) break;
				const e2 = 2 * err;
				if (e2 > -dy) {
					err -= dy;
					x0 += sx;
				}
				if (e2 < dx) {
					err += dx;
					y0 += sy;
				}
			}

			// Side 2: offset by -perp
			x0 = startX;
			y0 = startY;
			err = dx - dy;

			while (true) {
				if (
					x0 >= 0 &&
					x0 < this.yamlData.dungeon.dimensions.width &&
					y0 >= 0 &&
					y0 < this.yamlData.dungeon.dimensions.height
				) {
					const edgeX = x0 - perpX;
					const edgeY = y0 - perpY;
					const edgeKey = `${edgeX},${edgeY},${z}`;

					if (
						!lineCells.has(edgeKey) &&
						edgeX >= 0 &&
						edgeX < this.yamlData.dungeon.dimensions.width &&
						edgeY >= 0 &&
						edgeY < this.yamlData.dungeon.dimensions.height
					) {
						cells.add(edgeKey);
					}
				}

				if (x0 === x1 && y0 === y1) break;
				const e2 = 2 * err;
				if (e2 > -dy) {
					err -= dy;
					x0 += sx;
				}
				if (e2 < dx) {
					err += dx;
					y0 += sy;
				}
			}

			// Connect the start points of the two parallel lines
			// The connecting line goes along the perpendicular direction
			// (start1X, start1Y, start2X, start2Y already defined above)

			// Draw connecting line from start1 to start2 (along perp direction)
			// This is a line in the perpendicular direction, so it's simple
			let connX = start1X;
			let connY = start1Y;
			const connStepX = start2X > start1X ? 1 : start2X < start1X ? -1 : 0;
			const connStepY = start2Y > start1Y ? 1 : start2Y < start1Y ? -1 : 0;

			while (true) {
				if (
					connX >= 0 &&
					connX < this.yamlData.dungeon.dimensions.width &&
					connY >= 0 &&
					connY < this.yamlData.dungeon.dimensions.height
				) {
					const connKey = `${connX},${connY},${z}`;
					if (!lineCells.has(connKey)) {
						cells.add(connKey);
					}
				}

				if (connX === start2X && connY === start2Y) break;

				// Move towards target (this handles both horizontal and vertical connections)
				if (connX !== start2X) connX += connStepX;
				if (connY !== start2Y) connY += connStepY;
			}

			// Connect the end points of the two parallel lines
			// (end1X, end1Y, end2X, end2Y already defined above)

			// Draw connecting line from end1 to end2
			connX = end1X;
			connY = end1Y;
			const connStepX2 = end2X > end1X ? 1 : end2X < end1X ? -1 : 0;
			const connStepY2 = end2Y > end1Y ? 1 : end2Y < end1Y ? -1 : 0;

			while (true) {
				if (
					connX >= 0 &&
					connX < this.yamlData.dungeon.dimensions.width &&
					connY >= 0 &&
					connY < this.yamlData.dungeon.dimensions.height
				) {
					const connKey = `${connX},${connY},${z}`;
					if (!lineCells.has(connKey)) {
						cells.add(connKey);
					}
				}

				if (connX === end2X && connY === end2Y) break;

				// Move towards target
				if (connX !== end2X) connX += connStepX2;
				if (connY !== end2Y) connY += connStepY2;
			}
		} else if (this.selectionMode === "edge-rectangle") {
			// Rectangle edge: only border cells
			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					// Include cells on the border
					if (x === minX || x === maxX || y === minY || y === maxY) {
						cells.add(`${x},${y},${z}`);
					}
				}
			}
		} else if (this.selectionMode === "circle") {
			// Circle: cells within the circle
			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;
			const radiusX = (maxX - minX) / 2;
			const radiusY = (maxY - minY) / 2;
			const maxRadius = Math.max(radiusX, radiusY);

			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					const dx = (x - centerX) / radiusX;
					const dy = (y - centerY) / radiusY;
					const distance = Math.sqrt(dx * dx + dy * dy);
					if (distance <= 1.0) {
						cells.add(`${x},${y},${z}`);
					}
				}
			}
		} else if (this.selectionMode === "edge-circle") {
			// Circle edge: only cells on the circumference (exactly one pixel width)
			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;
			const radiusX = (maxX - minX) / 2;
			const radiusY = (maxY - minY) / 2;

			// Handle very small selections (fallback to rectangle edge)
			if (radiusX === 0 || radiusY === 0) {
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						if (x === minX || x === maxX || y === minY || y === maxY) {
							cells.add(`${x},${y},${z}`);
						}
					}
				}
			} else {
				// First, determine which cells are inside the circle
				const insideCells = new Set();
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						const dx = (x - centerX) / radiusX;
						const dy = (y - centerY) / radiusY;
						const distance = Math.sqrt(dx * dx + dy * dy);
						if (distance <= 1.0) {
							insideCells.add(`${x},${y},${z}`);
						}
					}
				}

				// Then, find edge cells: cells that are inside but have at least one neighbor outside
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						const cellKey = `${x},${y},${z}`;
						if (insideCells.has(cellKey)) {
							// Check if any neighbor is outside the circle
							const neighbors = [
								`${x - 1},${y},${z}`,
								`${x + 1},${y},${z}`,
								`${x},${y - 1},${z}`,
								`${x},${y + 1},${z}`,
								`${x - 1},${y - 1},${z}`,
								`${x + 1},${y - 1},${z}`,
								`${x - 1},${y + 1},${z}`,
								`${x + 1},${y + 1},${z}`,
							];

							// If at least one neighbor is outside, this is an edge cell
							const isEdge = neighbors.some((neighbor) => {
								const [nx, ny] = neighbor.split(",").map(Number);
								// If neighbor is outside bounding box, it's outside the shape
								if (nx < minX || nx > maxX || ny < minY || ny > maxY) {
									return true;
								}
								// Otherwise check if it's inside the shape
								return !insideCells.has(neighbor);
							});

							if (isEdge) {
								cells.add(cellKey);
							}
						}
					}
				}
			}
		} else if (this.selectionMode === "squircle") {
			// Squircle: rounded rectangle (superellipse)
			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;
			const radiusX = (maxX - minX) / 2;
			const radiusY = (maxY - minY) / 2;
			const n = 3; // Superellipse power (3 gives a nice rounded square)

			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					const dx = Math.abs((x - centerX) / radiusX);
					const dy = Math.abs((y - centerY) / radiusY);
					const value = Math.pow(dx, n) + Math.pow(dy, n);
					if (value <= 1.0) {
						cells.add(`${x},${y},${z}`);
					}
				}
			}
		} else if (this.selectionMode === "edge-squircle") {
			// Squircle edge: only cells on the boundary (exactly one pixel width, contiguous)
			const centerX = (minX + maxX) / 2;
			const centerY = (minY + maxY) / 2;
			const radiusX = (maxX - minX) / 2;
			const radiusY = (maxY - minY) / 2;
			const n = 3; // Superellipse power (3 gives a nice rounded square)

			// Handle very small selections (fallback to rectangle edge)
			if (radiusX === 0 || radiusY === 0) {
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						if (x === minX || x === maxX || y === minY || y === maxY) {
							cells.add(`${x},${y},${z}`);
						}
					}
				}
			} else {
				// First, determine which cells are inside the squircle
				const insideCells = new Set();
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						const dx = Math.abs((x - centerX) / radiusX);
						const dy = Math.abs((y - centerY) / radiusY);
						const value = Math.pow(dx, n) + Math.pow(dy, n);
						if (value <= 1.0) {
							insideCells.add(`${x},${y},${z}`);
						}
					}
				}

				// Then, find edge cells: cells that are inside but have at least one neighbor outside
				for (let y = minY; y <= maxY; y++) {
					for (let x = minX; x <= maxX; x++) {
						const cellKey = `${x},${y},${z}`;
						if (insideCells.has(cellKey)) {
							// Check if any neighbor is outside the squircle
							const neighbors = [
								`${x - 1},${y},${z}`,
								`${x + 1},${y},${z}`,
								`${x},${y - 1},${z}`,
								`${x},${y + 1},${z}`,
								`${x - 1},${y - 1},${z}`,
								`${x + 1},${y - 1},${z}`,
								`${x - 1},${y + 1},${z}`,
								`${x + 1},${y + 1},${z}`,
							];

							// If at least one neighbor is outside, this is an edge cell
							const isEdge = neighbors.some((neighbor) => {
								const [nx, ny] = neighbor.split(",").map(Number);
								// If neighbor is outside bounding box, it's outside the shape
								if (nx < minX || nx > maxX || ny < minY || ny > maxY) {
									return true;
								}
								// Otherwise check if it's inside the shape
								return !insideCells.has(neighbor);
							});

							if (isEdge) {
								cells.add(cellKey);
							}
						}
					}
				}
			}
		}

		if (this.isSelectionAddMode && this.selectionBaseCells.size > 0) {
			this.selectionBaseCells.forEach((cellKey) => cells.add(cellKey));
		}

		this.selectedCells = cells;
		this.updateSelectionVisuals();
	}

	updateSelectionVisuals() {
		// Update visual feedback for selected cells
		document.querySelectorAll(".grid-cell").forEach((cell) => {
			const x = parseInt(cell.dataset.x);
			const y = parseInt(cell.dataset.y);
			const z = parseInt(cell.dataset.z);
			const cellKey = `${x},${y},${z}`;
			cell.classList.toggle("selected-cell", this.selectedCells.has(cellKey));
		});

		// Update action button states based on selection
		this.updateActionButtonStates();
	}

	getSelectionBounds() {
		if (!this.selectedCells || this.selectedCells.size === 0) {
			return null;
		}

		let minX = Infinity;
		let minY = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let maxZ = -Infinity;

		this.selectedCells.forEach((cellKey) => {
			const [xStr, yStr, zStr] = cellKey.split(",");
			const x = parseInt(xStr, 10);
			const y = parseInt(yStr, 10);
			const z = parseInt(zStr, 10);

			if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
				return;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			minZ = Math.min(minZ, z);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
			maxZ = Math.max(maxZ, z);
		});

		if (
			!Number.isFinite(minX) ||
			!Number.isFinite(minY) ||
			!Number.isFinite(minZ)
		) {
			return null;
		}

		return {
			from: { x: minX, y: minY, z: minZ },
			to: { x: maxX, y: maxY, z: maxZ },
		};
	}

	deleteRoomAtCell(x, y, z) {
		if (!this.yamlData) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];

		if (!layer[y]) {
			layer[y] = new Array(dungeon.dimensions.width).fill(0);
		}

		if (layer[y][x] > 0) {
			// Get room info before deleting
			const roomIndex = layer[y][x] - 1;
			const room = dungeon.rooms[roomIndex];
			const roomName = room?.display || `Room ${roomIndex + 1}`;

			// Delete the room (set to 0)
			layer[y][x] = 0;

			// Remove resets for this room
			const roomRef = `@${dungeonId}{${x},${y},${z}}`;
			if (dungeon.resets) {
				dungeon.resets = dungeon.resets.filter((r) => r.roomRef !== roomRef);
			}

			// Remove exit overrides for this room
			this.deleteExitOverride(dungeon, x, y, z);

			this.showToast(
				`Deleted ${roomName}`,
				`At coordinates (${x}, ${y}, ${z})`
			);
			this.loadResets(dungeon);
			this.renderMap(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE,
				actionTarget: `${x},${y},${z}`,
				oldParameters: {
					roomName,
				},
				metadata: {
					coordinates: { x, y, z },
				},
			});
		} else {
			this.showToast("No room to delete", `At coordinates (${x}, ${y}, ${z})`);
		}
	}

	deselectAll() {
		this.clearSelectedCells();
		this.clearSelectedTemplate();

		// Don't clear selection mode - keep tool active
		// this.selectionMode = null;

		// Don't clear tool button highlights - keep selection tool active
		// document.querySelectorAll(".tool-btn").forEach((btn) => {
		// 	btn.classList.remove("active");
		// });
	}

	selectAllCurrentLayer() {
		if (!this.yamlData) return;

		const dungeon = this.yamlData.dungeon;

		// Clear current selection
		this.selectedCells.clear();

		// Select all cells on the current layer
		for (let y = 0; y < dungeon.dimensions.height; y++) {
			for (let x = 0; x < dungeon.dimensions.width; x++) {
				const cellKey = `${x},${y},${this.currentLayer}`;
				this.selectedCells.add(cellKey);
			}
		}

		// Update visuals
		this.updateSelectionVisuals();

		// Show toast notification
		const totalCells = dungeon.dimensions.width * dungeon.dimensions.height;
		this.showToast(
			"Selected all",
			`${totalCells} cells on layer ${this.currentLayer}`
		);
	}

	deleteSelectedRooms() {
		if (!this.yamlData || this.selectedCells.size === 0) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		let deletedCount = 0;

		this.selectedCells.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			const layerIndex = dungeon.dimensions.layers - 1 - z;
			const layer = dungeon.grid[layerIndex] || [];

			if (!layer[y]) {
				layer[y] = new Array(dungeon.dimensions.width).fill(0);
			}

			if (layer[y][x] > 0) {
				layer[y][x] = 0;
				deletedCount++;

				// Remove resets for this room
				const roomRef = `@${dungeonId}{${x},${y},${z}}`;
				if (dungeon.resets) {
					dungeon.resets = dungeon.resets.filter((r) => r.roomRef !== roomRef);
				}

				// Remove exit overrides for this room
				this.deleteExitOverride(dungeon, x, y, z);
			}
		});

		// Clean up empty exitOverrides array after processing all deletions
		if (
			dungeon.exitOverrides &&
			Array.isArray(dungeon.exitOverrides) &&
			dungeon.exitOverrides.length === 0
		) {
			delete dungeon.exitOverrides;
		}

		if (deletedCount > 0) {
			this.showToast(
				`Deleted ${deletedCount} room${deletedCount !== 1 ? "s" : ""}`,
				"From selected area"
			);
			this.loadResets(dungeon);
			this.renderMap(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE,
				actionTarget: "selection",
				oldParameters: {
					deletedCount,
				},
				metadata: {
					selectionSize: this.selectedCells.size,
				},
			});
		}

		// Clear selection after deletion
		this.clearSelectedCells();
	}

	clearResetsInSelection() {
		if (!this.yamlData) return;

		// Get selected cells - either from selectedCells set or selectedCell
		const cellsToProcess = new Set();
		if (this.selectedCells.size > 0) {
			this.selectedCells.forEach((cellKey) => cellsToProcess.add(cellKey));
		} else if (this.selectedCell) {
			const { x, y, z } = this.selectedCell;
			cellsToProcess.add(`${x},${y},${z}`);
		}

		if (cellsToProcess.size === 0) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		let deletedCount = 0;

		cellsToProcess.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			const roomRef = `@${dungeonId}{${x},${y},${z}}`;

			if (dungeon.resets) {
				const beforeCount = dungeon.resets.length;
				dungeon.resets = dungeon.resets.filter((r) => r.roomRef !== roomRef);
				if (dungeon.resets.length < beforeCount) {
					deletedCount++;
				}
			}
		});

		if (deletedCount > 0) {
			this.showToast(
				`Cleared ${deletedCount} reset${deletedCount !== 1 ? "s" : ""}`,
				"From selected area"
			);
			this.loadResets(dungeon);
			this.renderMap(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.DELETE_RESET,
				actionTarget: "selection",
				oldParameters: {
					deletedCount,
				},
				metadata: {
					selectionSize: cellsToProcess.size,
				},
			});
		}
	}

	clearExitOverridesInSelection() {
		if (!this.yamlData) return;

		// Get selected cells - either from selectedCells set or selectedCell
		const cellsToProcess = new Set();
		if (this.selectedCells.size > 0) {
			this.selectedCells.forEach((cellKey) => cellsToProcess.add(cellKey));
		} else if (this.selectedCell) {
			const { x, y, z } = this.selectedCell;
			cellsToProcess.add(`${x},${y},${z}`);
		}

		if (cellsToProcess.size === 0) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		let deletedCount = 0;

		cellsToProcess.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			if (this.deleteExitOverride(dungeon, x, y, z)) {
				deletedCount++;
			}
		});

		// Clean up empty exitOverrides array
		if (
			dungeon.exitOverrides &&
			Array.isArray(dungeon.exitOverrides) &&
			dungeon.exitOverrides.length === 0
		) {
			delete dungeon.exitOverrides;
		}

		if (deletedCount > 0) {
			this.showToast(
				`Cleared ${deletedCount} exit override${deletedCount !== 1 ? "s" : ""}`,
				"From selected area"
			);
			this.renderMap(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.EDIT_ROOM_EXIT_OVERRIDE,
				actionTarget: "selection",
				oldParameters: {
					deletedCount,
				},
				metadata: {
					selectionSize: cellsToProcess.size,
				},
			});
		}
	}

	updateActionButtonStates() {
		const hasSelection =
			this.selectedCells.size > 0 ||
			(this.selectedCell !== null && this.selectedCell !== undefined);

		const clearResetsBtn = document.getElementById("clear-resets-btn");
		const clearExitOverridesBtn = document.getElementById(
			"clear-exit-overrides-btn"
		);

		if (clearResetsBtn) {
			clearResetsBtn.disabled = !hasSelection;
		}
		if (clearExitOverridesBtn) {
			clearExitOverridesBtn.disabled = !hasSelection;
		}
	}

	cloneDungeonState(dungeon) {
		// Deep clone the dungeon state for history
		return {
			dimensions: JSON.parse(JSON.stringify(dungeon.dimensions)),
			grid: JSON.parse(JSON.stringify(dungeon.grid)),
			rooms: JSON.parse(JSON.stringify(dungeon.rooms || [])),
			templates: JSON.parse(JSON.stringify(dungeon.templates || [])),
			resets: JSON.parse(JSON.stringify(dungeon.resets || [])),
			exitOverrides: JSON.parse(JSON.stringify(dungeon.exitOverrides || [])),
			resetMessage: dungeon.resetMessage,
			name: dungeon.name,
			description: dungeon.description,
		};
	}

	saveStateToHistory() {
		if (!this.yamlData) return;

		const dungeon = this.yamlData.dungeon;
		const newState = this.cloneDungeonState(dungeon);

		// Remove any states after current index (when undoing and then making new changes)
		if (this.historyIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.historyIndex + 1);
		}

		// Add new state
		this.history.push(newState);
		this.historyIndex = this.history.length - 1;

		// Limit history size
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
			this.historyIndex--;
		}
	}

	resetChangeTracking(options = {}) {
		this.changes = [];
		this.changeCursor = -1;
		this.lastSavedChangeIndex = -1;
		this.changeIdCounter = 0;
		if (options.initialStateOverride) {
			this.initialChangeSnapshot = options.initialStateOverride
				? this.cloneDungeonState(options.initialStateOverride)
				: null;
		} else if (this.yamlData?.dungeon) {
			this.initialChangeSnapshot = this.cloneDungeonState(
				this.yamlData.dungeon
			);
		} else {
			this.initialChangeSnapshot = null;
		}

		if (options.markUnsaved) {
			this.makeChange(
				{
					action: options.action || EDITOR_ACTIONS.RESTORE_UNSAVED_WORK,
					actionTarget: options.actionTarget || this.currentDungeonId,
					newParameters: options.newParameters || null,
					oldParameters: options.oldParameters || null,
					metadata: options.metadata || null,
				},
				{
					skipAutosave: true,
					previousStateOverride: Object.prototype.hasOwnProperty.call(
						options,
						"previousStateOverride"
					)
						? options.previousStateOverride
						: null,
					newStateOverride: Object.prototype.hasOwnProperty.call(
						options,
						"newStateOverride"
					)
						? options.newStateOverride
						: this.yamlData?.dungeon
						? this.cloneDungeonState(this.yamlData.dungeon)
						: null,
				}
			);
			this.changeCursor = this.changes.length - 1;
			this.lastSavedChangeIndex = -1;
			this.renderChangeHistory();
			return;
		}

		this.updateUnsavedState();
		this.renderChangeHistory();
	}

	updateUnsavedState() {
		this.hasUnsavedChanges = this.changeCursor !== this.lastSavedChangeIndex;
		this.updateSaveButton();
		this.updateStatusBar();
	}

	markChangesSaved() {
		this.lastSavedChangeIndex = this.changeCursor;
		this.updateUnsavedState();
		this.renderChangeHistory();
		this.updateStatusBar();
	}

	makeChange(changeDetails = {}, options = {}) {
		if (!changeDetails || !changeDetails.action) {
			console.warn("map-editor: attempted to record change without action");
			return;
		}

		const now = Date.now();
		const hasPrevOverride = Object.prototype.hasOwnProperty.call(
			options,
			"previousStateOverride"
		);
		const hasNewOverride = Object.prototype.hasOwnProperty.call(
			options,
			"newStateOverride"
		);

		const previousState = hasPrevOverride
			? options.previousStateOverride
			: this.history[this.historyIndex]
			? JSON.parse(JSON.stringify(this.history[this.historyIndex]))
			: this.yamlData?.dungeon
			? this.cloneDungeonState(this.yamlData.dungeon)
			: null;

		const newState = hasNewOverride
			? options.newStateOverride
			: this.yamlData?.dungeon
			? this.cloneDungeonState(this.yamlData.dungeon)
			: null;

		if (this.changeCursor < this.changes.length - 1) {
			this.changes = this.changes.slice(0, this.changeCursor + 1);
			if (this.lastSavedChangeIndex > this.changeCursor) {
				this.lastSavedChangeIndex = this.changeCursor;
			}
		}

		const changeEntry = {
			id: ++this.changeIdCounter,
			timestamp: now,
			action: changeDetails.action,
			actionTarget: changeDetails.actionTarget || null,
			newParameters: changeDetails.newParameters || null,
			oldParameters: changeDetails.oldParameters || null,
			metadata: changeDetails.metadata || null,
			previousState,
			newState,
		};

		this.changes.push(changeEntry);
		this.changeCursor = this.changes.length - 1;

		if (this.changes.length > this.maxTrackedChanges) {
			this.changes.shift();
			this.changeCursor = this.changes.length - 1;
			this.lastSavedChangeIndex =
				this.lastSavedChangeIndex <= -1
					? -1
					: Math.max(-1, this.lastSavedChangeIndex - 1);
		}

		this.updateUnsavedState();
		this.renderChangeHistory();

		if (!options.skipAutosave) {
			this.saveToLocalStorage();
		}
	}

	renderChangeHistory() {
		const list = document.getElementById("history-list");
		const emptyState = document.getElementById("history-empty");

		if (!list) {
			return;
		}

		if (!this.yamlData) {
			list.innerHTML = "";
			if (emptyState) {
				emptyState.style.display = "block";
				emptyState.textContent = "Load a dungeon to start editing.";
			}
			return;
		}

		list.innerHTML = "";

		const entries = [];

		const initialMeta =
			this.changes.length === 0 ? "No recorded changes yet" : "Original state";
		entries.push({
			index: -1,
			label: "Initial state",
			meta: initialMeta,
			time: "",
		});

		this.changes.forEach((change, index) => {
			entries.push({
				index,
				label: this.getChangeActionLabel(change),
				meta: this.getChangeMeta(change),
				time: this.getChangeTimestamp(change),
			});
		});

		const hasHistory = this.changes.length > 0;
		if (emptyState) {
			emptyState.style.display = hasHistory ? "none" : "block";
			emptyState.textContent = "Make a change to start building history.";
		}

		// Show newest changes at the top while keeping initial state at the bottom
		const [initialEntry] = entries.splice(0, 1);
		const orderedEntries = [...entries].reverse();
		if (initialEntry) {
			orderedEntries.push(initialEntry);
		}

		orderedEntries.forEach((entry) => {
			const changeForEntry =
				entry.index >= 0 ? this.changes[entry.index] : null;
			const item = document.createElement("button");
			item.type = "button";
			item.className = "history-item";
			if (entry.index === this.changeCursor) {
				item.classList.add("active");
			}
			if (entry.index === this.lastSavedChangeIndex) {
				item.classList.add("saved");
			}
			item.dataset.index = entry.index;

			const title = document.createElement("div");
			title.className = "history-item-title";
			title.textContent = entry.label;
			item.appendChild(title);

			if (entry.meta || entry.time) {
				const metaRow = document.createElement("div");
				metaRow.className = "history-item-meta";

				const metaText = document.createElement("span");
				metaText.textContent = entry.meta || "";
				metaRow.appendChild(metaText);

				const timeText = document.createElement("span");
				timeText.textContent = entry.time || "";
				metaRow.appendChild(timeText);

				item.appendChild(metaRow);
			}

			if (entry.index === this.lastSavedChangeIndex) {
				const status = document.createElement("span");
				status.className = "history-item-status";
				status.textContent = "saved";
				item.appendChild(status);
			}

			if (entry.index === this.changeCursor && changeForEntry) {
				const detailEntries = this.getChangeDetails(changeForEntry);
				if (detailEntries.length > 0) {
					const detailsContainer = document.createElement("div");
					detailsContainer.className = "history-item-details";
					detailEntries.forEach(({ label, value }) => {
						const detailRow = document.createElement("div");
						detailRow.className = "history-item-detail";

						const detailLabel = document.createElement("span");
						detailLabel.className = "history-item-detail-label";
						detailLabel.textContent = `${label}:`;

						const detailValue = document.createElement("span");
						detailValue.className = "history-item-detail-value";
						detailValue.textContent = value;

						detailRow.appendChild(detailLabel);
						detailRow.appendChild(detailValue);
						detailsContainer.appendChild(detailRow);
					});
					item.appendChild(detailsContainer);
				}
			}

			list.appendChild(item);
		});
	}

	getChangeActionLabel(change) {
		const actionLabels = {
			[EDITOR_ACTIONS.CREATE_TEMPLATE]: "Created template",
			[EDITOR_ACTIONS.EDIT_TEMPLATE_FIELD]: "Updated template",
			[EDITOR_ACTIONS.DELETE_TEMPLATE]: "Deleted template",
			[EDITOR_ACTIONS.CREATE_RESET]: "Added reset",
			[EDITOR_ACTIONS.EDIT_RESET_FIELD]: "Updated reset",
			[EDITOR_ACTIONS.DELETE_RESET]: "Deleted reset",
			[EDITOR_ACTIONS.PLACE_TEMPLATE]: "Placed template",
			[EDITOR_ACTIONS.PLACE_ROOM_TEMPLATE]: "Edited room placement",
			[EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE]: "Removed rooms",
			[EDITOR_ACTIONS.PASTE_SELECTION]: "Pasted selection",
			[EDITOR_ACTIONS.RESIZE_DUNGEON]: "Resized dungeon",
			[EDITOR_ACTIONS.EDIT_DUNGEON_FIELD]: "Edited dungeon info",
			[EDITOR_ACTIONS.RESTORE_UNSAVED_WORK]: "Restored unsaved work",
			[EDITOR_ACTIONS.EDIT_ROOM_EXIT_OVERRIDE]: "Edited exit override",
		};
		return actionLabels[change.action] || change.action || "Change";
	}

	getChangeMeta(change) {
		const details = [];
		if (change.metadata?.templateType) {
			details.push(change.metadata.templateType);
		}
		if (change.metadata?.placedCount) {
			details.push(`${change.metadata.placedCount} cell(s) affected`);
		} else if (change.metadata?.deletedCount) {
			details.push(`${change.metadata.deletedCount} cell(s) removed`);
		} else if (change.metadata?.filledCount) {
			details.push(`${change.metadata.filledCount} cell(s) filled`);
		}
		if (
			typeof change.metadata?.selectionSize === "number" &&
			change.metadata.selectionSize > 0
		) {
			details.push(`Selection: ${change.metadata.selectionSize}`);
		} else if (change.metadata?.selectionFrom && change.metadata?.selectionTo) {
			const shapeLabel = change.metadata?.selectionShape
				? `${change.metadata.selectionShape} `
				: "";
			details.push(
				`Selection: ${shapeLabel}${change.metadata.selectionFrom} \u2192 ${change.metadata.selectionTo}`
			);
		}
		if (change.metadata?.roomTemplateName) {
			details.push(change.metadata.roomTemplateName);
		}
		if (change.metadata?.templateId) {
			details.push(`#${change.metadata.templateId}`);
		}
		if (change.actionTarget && change.actionTarget !== "selection") {
			details.push(change.actionTarget);
		}
		return details.join(" • ");
	}

	getChangeDetails(change) {
		if (!change) return [];
		const details = [];
		const addDetail = (label, value) => {
			if (
				label &&
				value !== undefined &&
				value !== null &&
				value !== "" &&
				(!(typeof value === "string") || value.trim().length > 0)
			) {
				details.push({ label, value: String(value) });
			}
		};

		if (change.actionTarget && change.actionTarget !== "selection") {
			addDetail("Target", change.actionTarget);
		}

		if (
			change.metadata &&
			typeof change.metadata === "object" &&
			Object.keys(change.metadata).length > 0
		) {
			Object.entries(change.metadata).forEach(([key, value]) => {
				addDetail(
					this.formatChangeDetailLabel(key),
					this.formatChangeDetailValue(value)
				);
			});
		}

		if (
			change.newParameters &&
			typeof change.newParameters === "object" &&
			Object.keys(change.newParameters).length > 0
		) {
			addDetail(
				"New Values",
				this.formatParameterSummary(change.newParameters)
			);
		}

		if (
			change.oldParameters &&
			typeof change.oldParameters === "object" &&
			Object.keys(change.oldParameters).length > 0
		) {
			addDetail(
				"Previous Values",
				this.formatParameterSummary(change.oldParameters)
			);
		}

		return details;
	}

	formatChangeDetailLabel(label) {
		if (!label) return "";
		return label
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.replace(/[_-]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	formatChangeDetailValue(value) {
		if (value === null || value === undefined) return "";
		if (typeof value === "boolean") {
			return value ? "Yes" : "No";
		}
		if (typeof value === "number") {
			return value.toString();
		}
		if (typeof value === "string") {
			return value;
		}
		if (Array.isArray(value)) {
			return value
				.map((entry) => this.formatChangeDetailValue(entry))
				.join(", ");
		}
		if (typeof value === "object") {
			return Object.entries(value)
				.map(
					([key, val]) =>
						`${this.formatChangeDetailLabel(
							key
						)}: ${this.formatChangeDetailValue(val)}`
				)
				.join(", ");
		}
		return String(value);
	}

	formatParameterSummary(params) {
		if (params === null || params === undefined) {
			return "";
		}
		if (typeof params !== "object") {
			return this.formatChangeDetailValue(params);
		}
		const entries = Object.entries(params);
		if (entries.length === 0) return "";
		return entries
			.map(
				([key, value]) =>
					`${this.formatChangeDetailLabel(key)}: ${this.formatChangeDetailValue(
						value
					)}`
			)
			.join(", ");
	}

	getChangeTimestamp(change) {
		if (!change.timestamp) return "";
		try {
			const date = new Date(change.timestamp);
			return date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "";
		}
	}

	jumpToChange(targetIndex) {
		if (!this.yamlData) return;
		const numericIndex = Number(targetIndex);
		if (Number.isNaN(numericIndex)) return;
		if (numericIndex === this.changeCursor) return;
		if (numericIndex < -1 || numericIndex > this.changes.length - 1) return;

		let snapshot = null;
		if (numericIndex === -1) {
			if (this.initialChangeSnapshot) {
				snapshot = this.cloneDungeonState(this.initialChangeSnapshot);
			} else if (this.changes[0]?.previousState) {
				snapshot = this.cloneDungeonState(this.changes[0].previousState);
			} else if (this.yamlData?.dungeon) {
				snapshot = this.cloneDungeonState(this.yamlData.dungeon);
			}
		} else {
			const targetChange = this.changes[numericIndex];
			if (targetChange?.newState) {
				snapshot = this.cloneDungeonState(targetChange.newState);
			}
		}

		if (!snapshot) {
			return;
		}

		this.restoreStateFromHistory(snapshot);
		this.history = [this.cloneDungeonState(this.yamlData.dungeon)];
		this.historyIndex = 0;
		this.changeCursor = numericIndex;
		this.updateUnsavedState();
		this.renderChangeHistory();
	}

	restoreStateFromHistory(state) {
		if (!this.yamlData) return;

		const dungeon = this.yamlData.dungeon;
		dungeon.dimensions = state.dimensions;
		dungeon.grid = state.grid;
		dungeon.rooms = state.rooms;
		dungeon.templates = state.templates;
		dungeon.resets = state.resets;
		// Restore exitOverrides (handle undefined for old history entries)
		if (state.exitOverrides !== undefined) {
			dungeon.exitOverrides = state.exitOverrides;
			// Clean up empty exitOverrides array if it exists but is empty
			if (
				dungeon.exitOverrides &&
				Array.isArray(dungeon.exitOverrides) &&
				dungeon.exitOverrides.length === 0
			) {
				delete dungeon.exitOverrides;
			}
		} else {
			// Old history entry - delete exitOverrides to match old state
			delete dungeon.exitOverrides;
		}
		dungeon.resetMessage = state.resetMessage;
		dungeon.name = state.name;
		dungeon.description = state.description;

		// Update UI
		this.updateDungeonSettingsForm(dungeon);
		this.updateCurrentDungeonDisplay(dungeon);

		// Reload templates and resets
		this.loadTemplates(dungeon);
		this.loadResets(dungeon);

		// Re-render map
		this.renderMap(dungeon);
	}

	undo() {
		if (this.changeCursor < 0) {
			// Already at the beginning of history
			this.showToast("Nothing to undo", "");
			return;
		}

		this.jumpToChange(this.changeCursor - 1);
		this.showToast("Undone", "");
	}

	redo() {
		if (this.changeCursor >= this.changes.length - 1) {
			// Already at the end of history
			this.showToast("Nothing to redo", "");
			return;
		}

		this.jumpToChange(this.changeCursor + 1);
		this.showToast("Redone", "");
	}

	getLocalStorageKey(dungeonId) {
		return `mud-map-editor-unsaved-${dungeonId}`;
	}

	saveToLocalStorage() {
		if (!this.yamlData || !this.currentDungeonId) return;

		// Clear existing timeout
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
		}

		// Debounce auto-save (save 500ms after last change)
		const timeoutId = setTimeout(() => {
			// Only proceed if this timeout hasn't been cleared
			if (this.autoSaveTimeout !== timeoutId) {
				return;
			}

			try {
				const storageKey = this.getLocalStorageKey(this.currentDungeonId);
				// Check if localStorage was cleared (meaning we saved to server)
				const existingData = localStorage.getItem(storageKey);
				if (existingData === null && !this.hasUnsavedChanges) {
					// We saved to server, don't mark as unsaved
					return;
				}

				const dataToSave = {
					yamlData: this.yamlData,
					timestamp: Date.now(),
					dungeonId: this.currentDungeonId,
				};
				localStorage.setItem(storageKey, JSON.stringify(dataToSave));
			} catch (error) {
				console.error("Failed to save to localStorage:", error);
				// localStorage might be full or disabled
			}
		}, 500);
		this.autoSaveTimeout = timeoutId;
	}

	checkForUnsavedWork() {
		// Check all localStorage keys for unsaved work
		const keys = Object.keys(localStorage);
		const unsavedKeys = keys.filter((key) =>
			key.startsWith("mud-map-editor-unsaved-")
		);

		if (unsavedKeys.length > 0) {
			// Show a notification that there's unsaved work
			// This will be handled when they try to load a dungeon
		}
	}

	async showRestoreModal() {
		return new Promise((resolve) => {
			const modal = document.getElementById("confirm-modal");
			const modalContent = modal.querySelector(".modal-content");
			const title = modalContent.querySelector("h2");
			const message = modalContent.querySelector("p");

			if (title) {
				title.textContent = "Restore Unsaved Work?";
			}
			if (message) {
				message.textContent =
					"You have unsaved changes from a previous session. Would you like to restore them?";
			}

			modal.classList.add("active");

			const yesBtn = document.getElementById("confirm-yes");
			const noBtn = document.getElementById("confirm-no");

			const cleanup = () => {
				modal.classList.remove("active");
				yesBtn.onclick = null;
				noBtn.onclick = null;
			};

			yesBtn.onclick = () => {
				cleanup();
				resolve(true);
			};

			noBtn.onclick = () => {
				cleanup();
				resolve(false);
			};
		});
	}

	showNewDungeonModal() {
		const modal = document.getElementById("new-dungeon-modal");
		if (!modal) return;

		// Reset form values
		document.getElementById("new-dungeon-name").value = "";
		document.getElementById("new-dungeon-width").value = "10";
		document.getElementById("new-dungeon-height").value = "10";
		document.getElementById("new-dungeon-layers").value = "1";

		modal.classList.add("active");

		// Focus on name input
		setTimeout(() => {
			document.getElementById("new-dungeon-name").focus();
		}, 100);
	}

	async createNewDungeon() {
		const nameInput = document.getElementById("new-dungeon-name");
		const widthInput = document.getElementById("new-dungeon-width");
		const heightInput = document.getElementById("new-dungeon-height");
		const layersInput = document.getElementById("new-dungeon-layers");

		const rawName = nameInput.value.trim();
		const name = rawName.toLowerCase();
		const width = parseInt(widthInput.value, 10);
		const height = parseInt(heightInput.value, 10);
		const layers = parseInt(layersInput.value, 10);

		// Validate inputs
		if (!name) {
			this.showToast(
				"Invalid dungeon name",
				"Please enter a name for the dungeon"
			);
			return;
		}

		// Sanitize name (only allow lowercase letters, numbers, hyphens, underscores)
		const sanitizedName = name.replace(/[^a-z0-9_-]/g, "_");
		if (sanitizedName !== name) {
			this.showToast(
				"Invalid characters in name",
				"Name can only contain lowercase letters, numbers, hyphens, and underscores"
			);
			return;
		}
		const displayName = rawName || sanitizedName;

		if (width < 1 || width > 100) {
			this.showToast("Invalid width", "Width must be between 1 and 100");
			return;
		}

		if (height < 1 || height > 100) {
			this.showToast("Invalid height", "Height must be between 1 and 100");
			return;
		}

		if (layers < 1 || layers > 100) {
			this.showToast("Invalid layers", "Layers must be between 1 and 100");
			return;
		}

		try {
			// Create empty dungeon structure
			const grid = [];
			for (let z = 0; z < layers; z++) {
				const layer = [];
				for (let y = 0; y < height; y++) {
					const row = new Array(width).fill(0);
					layer.push(row);
				}
				grid.push(layer);
			}

			const dungeonData = {
				dungeon: {
					id: sanitizedName,
					name: displayName,
					dimensions: {
						width,
						height,
						layers,
					},
					grid,
					rooms: [],
					templates: [],
					resets: [],
				},
			};

			// Create dungeon via IPC/API
			await this.createDungeonData(
				sanitizedName,
				jsyaml.dump(dungeonData, { lineWidth: -1, noRefs: true })
			);

			// Close modal
			document.getElementById("new-dungeon-modal").classList.remove("active");

			// Reload dungeon list
			await this.loadDungeonList();

			// Load the new dungeon
			await this.loadDungeon(sanitizedName);

			this.showToast("Dungeon created", `Created "${displayName}"`);
		} catch (error) {
			console.error("Failed to create dungeon:", error);
			this.showToast("Failed to create dungeon", error.message);
		}
	}

	updateSaveButton() {
		const saveBtn = document.getElementById("save-btn");
		if (saveBtn) {
			if (this.hasUnsavedChanges) {
				saveBtn.classList.add("unsaved");
				saveBtn.title = "You have unsaved changes";
			} else {
				saveBtn.classList.remove("unsaved");
				saveBtn.title = "Save dungeon";
			}
		}
	}

	copySelection() {
		if (!this.yamlData || this.selectedCells.size === 0) return;

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		const cells = [];
		const resets = [];
		const exitOverrides = [];

		// Find the minimum x, y, z to calculate relative positions
		let minX = Infinity,
			minY = Infinity,
			minZ = Infinity;
		this.selectedCells.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			minZ = Math.min(minZ, z);
		});

		// Copy cells with relative positions (including empty cells)
		this.selectedCells.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			const layerIndex = dungeon.dimensions.layers - 1 - z;
			const layer = dungeon.grid[layerIndex] || [];
			const row = layer[y] || [];
			const roomIndex = row[x] || 0;

			// Copy all cells, including empty ones (roomIndex === 0)
			cells.push({
				relX: x - minX,
				relY: y - minY,
				relZ: z - minZ,
				roomIndex: roomIndex > 0 ? roomIndex - 1 : -1, // -1 indicates empty cell
			});

			// Copy resets for this room (only if there's a room)
			if (roomIndex > 0) {
				const roomRef = `@${dungeonId}{${x},${y},${z}}`;
				const cellResets =
					dungeon.resets?.filter((r) => r.roomRef === roomRef) || [];
				cellResets.forEach((reset) => {
					resets.push({
						relX: x - minX,
						relY: y - minY,
						relZ: z - minZ,
						reset: JSON.parse(JSON.stringify(reset)), // Deep copy
					});
				});
			}

			// Copy exit overrides for this cell (if any)
			const exitOverride = this.getExitOverride(dungeon, x, y, z);
			if (exitOverride) {
				exitOverrides.push({
					relX: x - minX,
					relY: y - minY,
					relZ: z - minZ,
					override: JSON.parse(JSON.stringify(exitOverride)), // Deep copy
				});
			}
		});

		this.clipboard = {
			cells: cells,
			resets: resets,
			exitOverrides: exitOverrides,
			minX: minX,
			minY: minY,
			minZ: minZ,
		};

		// Do not clear selection tool - keep it active for pasting

		this.showToast(
			"Copied selection",
			`${cells.length} cell${cells.length !== 1 ? "s" : ""}`
		);
	}

	cutSelection() {
		if (!this.yamlData || this.selectedCells.size === 0) return;

		// Save state to history before making changes
		this.saveStateToHistory();

		// Store cells to delete before copying (copySelection clears selection)
		const cellsToDelete = Array.from(this.selectedCells);

		// Copy the selection first (this will clear the selection)
		this.copySelection();

		// Then delete the cells from the grid
		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		let deletedCount = 0;

		cellsToDelete.forEach((cellKey) => {
			const [x, y, z] = cellKey.split(",").map(Number);
			const layerIndex = dungeon.dimensions.layers - 1 - z;
			const layer = dungeon.grid[layerIndex] || [];

			if (!layer[y]) {
				layer[y] = new Array(dungeon.dimensions.width).fill(0);
			}

			if (layer[y][x] > 0) {
				layer[y][x] = 0;
				deletedCount++;

				// Remove resets for this room
				const roomRef = `@${dungeonId}{${x},${y},${z}}`;
				if (dungeon.resets) {
					dungeon.resets = dungeon.resets.filter((r) => r.roomRef !== roomRef);
				}

				// Remove exit overrides for this room
				this.deleteExitOverride(dungeon, x, y, z);
			}
		});

		// Clean up empty exitOverrides array after cut
		if (
			dungeon.exitOverrides &&
			Array.isArray(dungeon.exitOverrides) &&
			dungeon.exitOverrides.length === 0
		) {
			delete dungeon.exitOverrides;
		}

		if (deletedCount > 0) {
			const clipboardCellsCount = this.clipboard
				? this.clipboard.cells.length
				: 0;
			this.showToast(
				"Cut selection",
				`Cut ${deletedCount} room${
					deletedCount !== 1 ? "s" : ""
				} (${clipboardCellsCount} cell${
					clipboardCellsCount !== 1 ? "s" : ""
				} copied)`
			);
			this.loadResets(dungeon);
			this.renderMap(dungeon);
			this.makeChange({
				action: EDITOR_ACTIONS.DELETE_ROOM_TEMPLATE,
				actionTarget: "cut",
				oldParameters: {
					deletedCount,
				},
				metadata: {
					selectionSize: cellsToDelete.length,
				},
			});
		}
	}

	pasteSelection() {
		if (!this.yamlData || !this.clipboard || this.clipboard.cells.length === 0)
			return;

		// Save state to history before making changes
		this.saveStateToHistory();

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;

		// Check if we're in PASTE INTO mode (selection exists)
		const isPasteInto = this.selectedCells.size > 0;
		let pasteX = 0,
			pasteY = 0,
			pasteZ = this.currentLayer;
		let selectedCellsSet = null;

		if (isPasteInto) {
			// PASTE INTO mode: only paste into selected cells
			// Find minimum x, y, z of selected cells to use as origin
			let minX = Infinity,
				minY = Infinity,
				minZ = Infinity;
			selectedCellsSet = new Set(this.selectedCells);
			this.selectedCells.forEach((cellKey) => {
				const [x, y, z] = cellKey.split(",").map(Number);
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				minZ = Math.min(minZ, z);
			});
			pasteX = minX;
			pasteY = minY;
			pasteZ = minZ;
		} else {
			// Normal paste mode: determine paste position
			if (this.selectedCell) {
				// Paste at selected cell position (but use current layer for Z)
				pasteX = this.selectedCell.x;
				pasteY = this.selectedCell.y;
				pasteZ = this.currentLayer;
			} else if (this.currentMousePosition) {
				// Paste at current mouse position on grid
				pasteX = this.currentMousePosition.x;
				pasteY = this.currentMousePosition.y;
				pasteZ = this.currentMousePosition.z;
			} else {
				// Default: paste at (0, 0, currentLayer)
				pasteX = 0;
				pasteY = 0;
				pasteZ = this.currentLayer;
			}
		}

		let pastedCount = 0;
		let skippedCount = 0;
		let changeOccurred = false;

		// Paste cells
		this.clipboard.cells.forEach((cell) => {
			const targetX = pasteX + cell.relX;
			const targetY = pasteY + cell.relY;
			const targetZ = pasteZ + cell.relZ;
			const targetKey = `${targetX},${targetY},${targetZ}`;

			// In PASTE INTO mode, only paste if target is in selected cells
			if (isPasteInto && !selectedCellsSet.has(targetKey)) {
				skippedCount++;
				return;
			}

			// Check bounds
			if (
				targetX >= 0 &&
				targetX < dungeon.dimensions.width &&
				targetY >= 0 &&
				targetY < dungeon.dimensions.height &&
				targetZ >= 0 &&
				targetZ < dungeon.dimensions.layers
			) {
				const layerIndex = dungeon.dimensions.layers - 1 - targetZ;
				const layer = dungeon.grid[layerIndex] || [];

				// Ensure row exists
				if (!layer[targetY]) {
					layer[targetY] = new Array(dungeon.dimensions.width).fill(0);
				}

				if (cell.roomIndex === -1) {
					// Empty cell: delete room if present
					if (layer[targetY][targetX] > 0) {
						layer[targetY][targetX] = 0;

						// Remove resets for this room
						const roomRef = `@${dungeonId}{${targetX},${targetY},${targetZ}}`;
						if (dungeon.resets) {
							dungeon.resets = dungeon.resets.filter(
								(r) => r.roomRef !== roomRef
							);
						}

						// Remove exit overrides for this room
						this.deleteExitOverride(dungeon, targetX, targetY, targetZ);
						changeOccurred = true;
					}
				} else {
					// Place room (convert back to 1-based index)
					layer[targetY][targetX] = cell.roomIndex + 1;
					changeOccurred = true;
				}
				pastedCount++;
			} else {
				skippedCount++;
			}
		});

		// Paste resets
		if (!dungeon.resets) {
			dungeon.resets = [];
		}

		this.clipboard.resets.forEach((resetData) => {
			const targetX = pasteX + resetData.relX;
			const targetY = pasteY + resetData.relY;
			const targetZ = pasteZ + resetData.relZ;
			const targetKey = `${targetX},${targetY},${targetZ}`;

			// In PASTE INTO mode, only paste resets if target is in selected cells
			if (isPasteInto && !selectedCellsSet.has(targetKey)) {
				return;
			}

			// Check bounds
			if (
				targetX >= 0 &&
				targetX < dungeon.dimensions.width &&
				targetY >= 0 &&
				targetY < dungeon.dimensions.height &&
				targetZ >= 0 &&
				targetZ < dungeon.dimensions.layers
			) {
				const newRoomRef = `@${dungeonId}{${targetX},${targetY},${targetZ}}`;
				const newReset = JSON.parse(JSON.stringify(resetData.reset));
				newReset.roomRef = newRoomRef;
				dungeon.resets.push(newReset);
				changeOccurred = true;
			}
		});

		// Paste exit overrides
		if (
			this.clipboard.exitOverrides &&
			Array.isArray(this.clipboard.exitOverrides)
		) {
			this.clipboard.exitOverrides.forEach((overrideData) => {
				const targetX = pasteX + overrideData.relX;
				const targetY = pasteY + overrideData.relY;
				const targetZ = pasteZ + overrideData.relZ;
				const targetKey = `${targetX},${targetY},${targetZ}`;

				// In PASTE INTO mode, only paste exit overrides if target is in selected cells
				if (isPasteInto && !selectedCellsSet.has(targetKey)) {
					return;
				}

				// Check bounds
				if (
					targetX >= 0 &&
					targetX < dungeon.dimensions.width &&
					targetY >= 0 &&
					targetY < dungeon.dimensions.height &&
					targetZ >= 0 &&
					targetZ < dungeon.dimensions.layers
				) {
					// Extract the override value (skip coordinates, only take allowedExits/roomLinks)
					const override = overrideData.override;
					const overrideValue = {};
					if (override.allowedExits !== undefined) {
						overrideValue.allowedExits = override.allowedExits;
					}
					if (override.roomLinks !== undefined) {
						overrideValue.roomLinks = override.roomLinks;
					}

					// Only set if there's something to set
					if (Object.keys(overrideValue).length > 0) {
						this.setExitOverride(
							dungeon,
							targetX,
							targetY,
							targetZ,
							overrideValue
						);
						changeOccurred = true;
					}
				}
			});
		}

		// Show toast notification
		let message = `Pasted ${pastedCount} cell${pastedCount !== 1 ? "s" : ""}`;
		if (isPasteInto) {
			message += ` into selection`;
		}
		if (skippedCount > 0) {
			message += ` (${skippedCount} skipped)`;
		}
		this.showToast(
			isPasteInto ? "Pasted into selection" : "Pasted selection",
			message
		);

		// Clean up empty exitOverrides array after paste
		if (
			dungeon.exitOverrides &&
			Array.isArray(dungeon.exitOverrides) &&
			dungeon.exitOverrides.length === 0
		) {
			delete dungeon.exitOverrides;
		}

		// Reload resets and re-render map
		this.loadResets(dungeon);
		this.renderMap(dungeon);

		if (changeOccurred) {
			this.makeChange({
				action: EDITOR_ACTIONS.PASTE_SELECTION,
				actionTarget: `${pasteX},${pasteY},${pasteZ}`,
				newParameters: {
					pastedCount,
				},
				metadata: {
					skippedCount,
				},
			});
		}
	}
}

// Initialize editor when page loads
let editor;
window.addEventListener("DOMContentLoaded", () => {
	// js-yaml should already be loaded via script tag in HTML
	// Wait a moment to ensure it's available
	setTimeout(() => {
		if (typeof jsyaml === "undefined") {
			console.error(
				"js-yaml library not loaded. Please check the script tag in index.html"
			);
			return;
		}
		editor = new MapEditor();
	}, 100);
});

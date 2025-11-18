// Map Editor Application
// Uses js-yaml for parsing (loaded via CDN in HTML)

class MapEditor {
	constructor() {
		this.currentDungeon = null;
		this.currentDungeonId = null;
		this.selectedTemplate = null;
		this.selectedTemplateType = null;
		this.selectedCell = null;
		this.currentLayer = 0;
		this.yamlData = null;
		this.races = [];
		this.jobs = [];

		this.init();
	}

	async init() {
		await this.loadDungeonList();
		await this.loadRacesAndJobs();
		this.setupEventListeners();
	}

	async loadRacesAndJobs() {
		try {
			const [racesRes, jobsRes] = await Promise.all([
				fetch("/api/races"),
				fetch("/api/jobs"),
			]);
			const racesData = await racesRes.json();
			const jobsData = await jobsRes.json();
			this.races = racesData.races || [];
			this.jobs = jobsData.jobs || [];
		} catch (error) {
			console.error("Failed to load races/jobs:", error);
		}
	}

	async loadDungeonList() {
		try {
			const response = await fetch("/api/dungeons");
			const data = await response.json();
			const select = document.getElementById("dungeon-select");
			select.innerHTML = '<option value="">Select a dungeon...</option>';
			data.dungeons.forEach((id) => {
				const option = document.createElement("option");
				option.value = id;
				option.textContent = id;
				select.appendChild(option);
			});
		} catch (error) {
			console.error("Failed to load dungeon list:", error);
		}
	}

	async loadDungeon(id) {
		try {
			const response = await fetch(`/api/dungeons/${id}`);
			const data = await response.json();
			this.currentDungeonId = id;
			this.currentDungeon = {
				dimensions: data.dimensions,
				resetMessage: data.resetMessage || "",
			};

			// Parse YAML
			this.yamlData = jsyaml.load(data.yaml);
			const dungeon = this.yamlData.dungeon;

			// Update UI
			document.getElementById("width-input").value = dungeon.dimensions.width;
			document.getElementById("height-input").value = dungeon.dimensions.height;
			document.getElementById("layers-input").value = dungeon.dimensions.layers;
			document.getElementById("reset-message-input").value =
				dungeon.resetMessage || "";

			// Load templates
			this.loadTemplates(dungeon);

			// Load resets
			this.loadResets(dungeon);

			// Render map
			this.renderMap(dungeon);

			// Setup layer selector
			this.setupLayerSelector(dungeon.dimensions.layers);
		} catch (error) {
			console.error("Failed to load dungeon:", error);
			alert("Failed to load dungeon: " + error.message);
		}
	}

	loadTemplates(dungeon) {
		// Load room templates
		const roomList = document.getElementById("room-templates");
		roomList.innerHTML = "";
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
		item.innerHTML = `
			<h3>${display}</h3>
			<p>${description}</p>
		`;
		item.addEventListener("click", () => {
			document
				.querySelectorAll(".template-item")
				.forEach((i) => i.classList.remove("selected"));
			item.classList.add("selected");
			this.selectedTemplate = id;
			this.selectedTemplateType = type;
		});
		item.addEventListener("dblclick", () => {
			this.editTemplate(type, id);
		});
		return item;
	}

	loadResets(dungeon) {
		const resetList = document.getElementById("reset-list");
		resetList.innerHTML = "";

		if (!dungeon.resets) return;

		dungeon.resets.forEach((reset, index) => {
			const template = dungeon.templates?.find(
				(t) => t.id === reset.templateId
			);
			const templateName = template
				? template.display || reset.templateId
				: reset.templateId;

			const item = document.createElement("div");
			item.className = "reset-item";
			item.innerHTML = `
				<h4>${templateName}</h4>
				<div class="reset-details">
					Room: ${reset.roomRef}<br>
					Count: ${reset.minCount || 1} - ${reset.maxCount || 1}
				</div>
				<div class="reset-actions">
					<button onclick="editor.editReset(${index})">Edit</button>
					<button onclick="editor.deleteReset(${index})">Delete</button>
				</div>
			`;
			resetList.appendChild(item);
		});
	}

	renderMap(dungeon) {
		const gridContainer = document.getElementById("map-grid");
		gridContainer.innerHTML = "";

		const container = document.createElement("div");
		container.className = "grid-container";
		container.style.gridTemplateColumns = `repeat(${dungeon.dimensions.width}, 30px)`;

		// Get current layer (reverse because YAML stores top layer first)
		const layerIndex = dungeon.dimensions.layers - 1 - this.currentLayer;
		const layer = dungeon.grid[layerIndex] || [];

		// Render cells (YAML stores rows top-first, but we need to reverse for display)
		for (let y = 0; y < dungeon.dimensions.height; y++) {
			const row = layer[y] || [];
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
					}
				}

				cell.addEventListener("click", () => {
					this.handleCellClick(x, y, this.currentLayer, roomIndex);
				});

				container.appendChild(cell);
			}
		}

		gridContainer.appendChild(container);
	}

	handleCellClick(x, y, z, currentRoomIndex) {
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

		// Show room info
		this.showRoomInfo(x, y, z);
	}

	placeRoomTemplate(x, y, z) {
		if (!this.yamlData || !this.selectedTemplate) return;

		const dungeon = this.yamlData.dungeon;
		const layerIndex = dungeon.dimensions.layers - 1 - z;
		const layer = dungeon.grid[layerIndex] || [];

		// Ensure row exists
		if (!layer[y]) {
			layer[y] = new Array(dungeon.dimensions.width).fill(0);
		}

		// Place template (1-based index)
		const templateIndex = parseInt(this.selectedTemplate) + 1;
		layer[y][x] = templateIndex;

		// Re-render map
		this.renderMap(dungeon);
	}

	addReset(x, y, z) {
		if (!this.yamlData || !this.selectedTemplate) return;

		const dungeon = this.yamlData.dungeon;
		const dungeonId = this.currentDungeonId;
		const roomRef = `@${dungeonId}{${x},${y},${z}}`;

		if (!dungeon.resets) {
			dungeon.resets = [];
		}

		// Check if reset already exists
		const existing = dungeon.resets.find(
			(r) => r.roomRef === roomRef && r.templateId === this.selectedTemplate
		);
		if (existing) {
			alert("A reset for this template already exists in this room.");
			return;
		}

		// Add reset
		dungeon.resets.push({
			templateId: this.selectedTemplate,
			roomRef: roomRef,
			minCount: 1,
			maxCount: 1,
		});

		// Reload resets display
		this.loadResets(dungeon);
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

			infoPanel.innerHTML = `
				<h3>Room: ${room?.display || "Unknown"}</h3>
				<p><strong>Coordinates:</strong> ${x}, ${y}, ${z}</p>
				<p><strong>Reference:</strong> ${roomRef}</p>
				${
					room?.description
						? `<p><strong>Description:</strong> ${room.description}</p>`
						: ""
				}
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
		if (type === "room") {
			// Build room links HTML
			const roomLinks = template.roomLinks || {};
			const allDirections = ["north", "south", "east", "west", "up", "down"];
			const usedDirections = Object.keys(roomLinks);

			const roomLinksHtml = Object.entries(roomLinks)
				.map(([dir, ref], index) => {
					// Get available directions (all except the ones used by other links)
					const availableDirs = allDirections.filter(
						(d) => d === dir || !usedDirections.includes(d)
					);

					return `
				<div class="room-link-item" data-index="${index}">
					<select class="room-link-direction" data-original-dir="${dir}">
						${availableDirs
							.map(
								(d) =>
									`<option value="${d}" ${d === dir ? "selected" : ""}>${
										d.charAt(0).toUpperCase() + d.slice(1)
									}</option>`
							)
							.join("")}
					</select>
					<input type="text" class="room-link-ref" value="${ref}" placeholder="@dungeon{x,y,z}">
					<button type="button" class="delete-link-btn" data-index="${index}">Delete</button>
				</div>
			`;
				})
				.join("");

			const canAddMore = usedDirections.length < allDirections.length;

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
					<label>Keywords (comma-separated)</label>
					<input type="text" id="template-keywords" value="${template.keywords || ""}">
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
			`;
		} else {
			const isMob = template.type === "Mob";
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
						<option value="Weapon" ${
							template.type === "Weapon" ? "selected" : ""
						}>Weapon</option>
						<option value="Armor" ${
							template.type === "Armor" ? "selected" : ""
						}>Armor</option>
						<option value="Prop" ${template.type === "Prop" ? "selected" : ""}>Prop</option>
					</select>
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
				</div>
				<div class="form-group">
					<label>Display Name</label>
					<input type="text" id="template-display" value="${template.display || ""}">
				</div>
				<div class="form-group">
					<label>Description</label>
					<textarea id="template-description">${template.description || ""}</textarea>
				</div>
				<div class="form-group">
					<label>Keywords (comma-separated)</label>
					<input type="text" id="template-keywords" value="${template.keywords || ""}">
				</div>
			`;
		}

		body.innerHTML = html;
		modal.classList.add("active");

		// Set up room link handlers if this is a room template
		if (type === "room") {
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

			// Direction change handlers - update other dropdowns when a direction changes
			document.querySelectorAll(".room-link-direction").forEach((select) => {
				select.onchange = () => {
					this.updateRoomLinkDirections();
				};
			});
		}

		// Set up type selector handler to show/hide mob fields
		const typeSelect = document.getElementById("template-type");
		if (typeSelect) {
			const mobFields = document.getElementById("mob-fields");
			typeSelect.onchange = () => {
				const newType = typeSelect.value;
				if (mobFields) {
					mobFields.style.display = newType === "Mob" ? "block" : "none";
				}
				// Recalculate if switching to Mob
				if (newType === "Mob") {
					setTimeout(() => this.calculateMobAttributes(), 100);
				}
			};
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
		document.getElementById("modal-save").onclick = () => {
			this.saveTemplate(type, id, template);
		};

		// Cancel handler
		document.getElementById("modal-cancel").onclick = () => {
			modal.classList.remove("active");
		};

		document.querySelector(".close").onclick = () => {
			modal.classList.remove("active");
		};
	}

	saveTemplate(type, id, oldTemplate) {
		const dungeon = this.yamlData.dungeon;

		if (type === "room") {
			const index = parseInt(id);
			const display = document.getElementById("template-display").value;
			const description = document.getElementById("template-description").value;
			const keywords = document.getElementById("template-keywords").value;

			// Collect room links
			const roomLinks = {};
			const linkItems = document.querySelectorAll(".room-link-item");
			linkItems.forEach((item) => {
				const direction = item.querySelector(".room-link-direction").value;
				const ref = item.querySelector(".room-link-ref").value.trim();
				if (ref) {
					roomLinks[direction] = ref;
				}
			});

			if (index >= 0 && index < dungeon.rooms.length) {
				// Update existing
				const updated = {
					...dungeon.rooms[index],
					display,
					description,
					...(keywords && { keywords }),
				};
				if (Object.keys(roomLinks).length > 0) {
					updated.roomLinks = roomLinks;
				} else if (updated.roomLinks) {
					delete updated.roomLinks;
				}
				dungeon.rooms[index] = updated;
			} else {
				// Add new
				const newRoom = { display, description };
				if (keywords) newRoom.keywords = keywords;
				if (Object.keys(roomLinks).length > 0) {
					newRoom.roomLinks = roomLinks;
				}
				dungeon.rooms.push(newRoom);
			}
		} else {
			const templateId = document.getElementById("template-id").value;
			const templateType = document.getElementById("template-type").value;
			const display = document.getElementById("template-display").value;
			const description = document.getElementById("template-description").value;
			const keywords = document.getElementById("template-keywords").value;

			if (!dungeon.templates) {
				dungeon.templates = [];
			}

			const existing = dungeon.templates.findIndex((t) => t.id === templateId);
			const newTemplate = {
				id: templateId,
				type: templateType,
				display,
				description,
			};
			if (keywords) newTemplate.keywords = keywords;

			// Add mob-specific fields
			if (templateType === "Mob") {
				const race = document.getElementById("template-race")?.value;
				const job = document.getElementById("template-job")?.value;
				const level = document.getElementById("template-level")?.value;
				if (race) newTemplate.race = race;
				if (job) newTemplate.job = job;
				if (level) newTemplate.level = parseInt(level) || 1;
			}
			// Note: If type is not Mob, we don't add race/job/level fields
			// The YAML serializer will omit undefined fields

			if (existing >= 0) {
				// Update existing - merge with old template to preserve other fields
				const oldTemplate = dungeon.templates[existing];
				const updated = {
					...oldTemplate,
					...newTemplate,
				};
				// Remove mob fields if type changed away from Mob
				if (templateType !== "Mob" && oldTemplate.type === "Mob") {
					delete updated.race;
					delete updated.job;
					delete updated.level;
				}
				dungeon.templates[existing] = updated;
			} else {
				dungeon.templates.push(newTemplate);
			}
		}

		document.getElementById("template-modal").classList.remove("active");
		this.loadTemplates(dungeon);
	}

	editReset(index) {
		const dungeon = this.yamlData.dungeon;
		const reset = dungeon.resets[index];

		const minCount = prompt("Minimum count:", reset.minCount || 1);
		if (minCount === null) return;

		const maxCount = prompt("Maximum count:", reset.maxCount || 1);
		if (maxCount === null) return;

		reset.minCount = parseInt(minCount) || 1;
		reset.maxCount = parseInt(maxCount) || 1;

		this.loadResets(dungeon);
	}

	deleteReset(index) {
		if (!confirm("Delete this reset?")) return;

		const dungeon = this.yamlData.dungeon;
		dungeon.resets.splice(index, 1);
		this.loadResets(dungeon);
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

		const width = parseInt(document.getElementById("width-input").value);
		const height = parseInt(document.getElementById("height-input").value);
		const layers = parseInt(document.getElementById("layers-input").value);

		if (!width || !height || !layers) {
			alert("Please enter valid dimensions");
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

		// Update UI
		this.setupLayerSelector(layers);
		this.renderMap(dungeon);
		this.loadResets(dungeon);
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
			alert("No dungeon loaded");
			return;
		}

		// Update reset message
		const resetMessage = document.getElementById("reset-message-input").value;
		this.yamlData.dungeon.resetMessage = resetMessage || undefined;

		// Convert back to YAML
		const yaml = jsyaml.dump(this.yamlData, { lineWidth: 120, noRefs: true });

		// Save via API
		try {
			const response = await fetch(`/api/dungeons/${this.currentDungeonId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					dimensions: this.yamlData.dungeon.dimensions,
					resetMessage: this.yamlData.dungeon.resetMessage,
					yaml: yaml,
				}),
			});

			if (response.ok) {
				alert("Dungeon saved successfully!");
				// Reload to get fresh data
				await this.loadDungeon(this.currentDungeonId);
			} else {
				const error = await response.json();
				alert("Failed to save: " + (error.error || "Unknown error"));
			}
		} catch (error) {
			alert("Failed to save: " + error.message);
		}
	}

	getAvailableDirections() {
		const container = document.getElementById("room-links-container");
		if (!container) return ["north", "south", "east", "west", "up", "down"];

		const allDirections = ["north", "south", "east", "west", "up", "down"];
		const usedDirections = Array.from(
			container.querySelectorAll(".room-link-direction")
		).map((select) => select.value);

		return allDirections.filter((d) => !usedDirections.includes(d));
	}

	updateRoomLinkDirections() {
		const container = document.getElementById("room-links-container");
		if (!container) return;

		const allDirections = ["north", "south", "east", "west", "up", "down"];

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

	addRoomLink() {
		const container = document.getElementById("room-links-container");
		if (!container) return;

		const availableDirs = this.getAvailableDirections();
		if (availableDirs.length === 0) return; // Can't add more

		const index = container.children.length;
		const linkItem = document.createElement("div");
		linkItem.className = "room-link-item";
		linkItem.dataset.index = index;
		linkItem.innerHTML = `
			<select class="room-link-direction">
				${availableDirs
					.map(
						(d) =>
							`<option value="${d}">${
								d.charAt(0).toUpperCase() + d.slice(1)
							}</option>`
					)
					.join("")}
			</select>
			<input type="text" class="room-link-ref" placeholder="@dungeon{x,y,z}">
			<button type="button" class="delete-link-btn" data-index="${index}">Delete</button>
		`;
		container.appendChild(linkItem);

		// Attach delete handler to the new button
		const deleteBtn = linkItem.querySelector(".delete-link-btn");
		if (deleteBtn) {
			deleteBtn.onclick = (e) => {
				const idx = parseInt(e.target.dataset.index);
				this.deleteRoomLink(idx);
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
				const btn = item.querySelector(".delete-link-btn");
				if (btn) {
					btn.dataset.index = i;
					btn.onclick = (e) => {
						const idx = parseInt(e.target.dataset.index);
						this.deleteRoomLink(idx);
					};
				}
			});

			// Update direction dropdowns after deletion
			this.updateRoomLinkDirections();
		}
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
			const response = await fetch("/api/calculate-attributes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ raceId, jobId, level }),
			});

			if (!response.ok) {
				throw new Error("Failed to calculate attributes");
			}

			const data = await response.json();
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

	setupEventListeners() {
		// Dungeon selector
		document
			.getElementById("dungeon-select")
			.addEventListener("change", (e) => {
				if (e.target.value) {
					this.loadDungeon(e.target.value);
				}
			});

		// Save button
		document.getElementById("save-btn").addEventListener("click", () => {
			this.saveDungeon();
		});

		// Tabs
		document.querySelectorAll(".tab").forEach((tab) => {
			tab.addEventListener("click", (e) => {
				const tabName = e.target.dataset.tab;
				document
					.querySelectorAll(".tab")
					.forEach((t) => t.classList.remove("active"));
				document
					.querySelectorAll(".tab-content")
					.forEach((c) => c.classList.remove("active"));
				e.target.classList.add("active");
				document.getElementById(`${tabName}-tab`).classList.add("active");
			});
		});

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
				this.renderMap(this.yamlData.dungeon);
			}
		});

		// Resize button
		document.getElementById("resize-btn").addEventListener("click", () => {
			this.resizeDungeon();
		});
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

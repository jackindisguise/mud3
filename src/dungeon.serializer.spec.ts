import assert from "node:assert";
import { suite, test } from "node:test";
import { DungeonObject, Equipment, EQUIPMENT_SLOT } from "./dungeon.js";
import { serializedToOptions } from "./dungeon.js";

suite("compressed serialization", () => {
	test("base serialization includes keys with undefined for a vanilla DungeonObject", () => {
		const obj = new DungeonObject();
		const serialized = obj.serialize();

		assert.deepEqual(serialized, {
			type: "DungeonObject",
			keywords: "dungeon object",
			display: "Dungeon Object",
			description: undefined,
			roomDescription: undefined,
			mapText: undefined,
			mapColor: undefined,
		});
	});

	test("compressed serialization of vanilla DungeonObject is minimal", () => {
		const obj = new DungeonObject();
		const compressed = obj.serialize({ compress: true });
		assert.deepEqual(compressed, { type: "DungeonObject" });
	});

	test("compressed serialization includes changed fields", () => {
		const obj = new DungeonObject();
		obj.display = "changed";
		const compressed = obj.serialize({ compress: true });
		assert.deepEqual(compressed, {
			type: "DungeonObject",
			display: "changed",
		});
	});

	test("compressed serialization propagates to nested contents", () => {
		const parent = new DungeonObject();
		const child1 = new DungeonObject();
		const child2 = new DungeonObject();
		parent.add(child1, child2);

		const compressed = parent.serialize({ compress: true });

		assert.deepEqual(compressed, {
			type: "DungeonObject",
			contents: [{ type: "DungeonObject" }, { type: "DungeonObject" }],
		});
	});

	test("compressed serialization works for subtypes (Equipment)", () => {
		const eq = new Equipment({ slot: EQUIPMENT_SLOT.FINGER });
		const compressed = eq.serialize({ compress: true });

		// Base for Equipment defaults to slot HEAD; FINGER differs, so it should be included
		assert.deepEqual(compressed, {
			type: "Equipment",
			slot: EQUIPMENT_SLOT.FINGER,
		});
	});
});

suite("deserialize normalization", () => {
	test("compressed and uncompressed DungeonObject deserialize identically", () => {
		const parent = new DungeonObject();
		parent.display = "Parent";
		const child = new DungeonObject();
		child.display = "Child";
		parent.add(child);

		const uncompressed = parent.serialize();
		const compressed = parent.serialize({ compress: true });

		const fromUncompressed = DungeonObject.deserialize(uncompressed);
		const fromCompressed = DungeonObject.deserialize(compressed);

		// Compare by re-serializing into uncompressed form
		assert.deepEqual(fromCompressed.serialize(), fromUncompressed.serialize());
	});

	test("compressed and uncompressed Equipment deserialize identically", () => {
		const eq = new Equipment({
			slot: EQUIPMENT_SLOT.FINGER,
			attributeBonuses: { strength: 3 },
		});

		const uncompressed = eq.serialize();
		const compressed = eq.serialize({ compress: true });
		console.log(uncompressed);
		console.log(compressed);

		const fromUncompressed = DungeonObject.deserialize(uncompressed);
		const fromCompressed = DungeonObject.deserialize(compressed);

		assert.deepEqual(fromCompressed.serialize(), fromUncompressed.serialize());
	});

	test("nested contents: both forms deserialize to equivalent hierarchies", () => {
		const parent = new DungeonObject();
		parent.display = "Container";

		const c1 = new DungeonObject();
		c1.display = "c1";
		const c2 = new DungeonObject();
		parent.add(c1, c2);

		const uncompressed = parent.serialize();
		const compressed = parent.serialize({ compress: true });

		const fromUncompressed = DungeonObject.deserialize(uncompressed);
		const fromCompressed = DungeonObject.deserialize(compressed);

		assert.deepEqual(fromCompressed.serialize(), fromUncompressed.serialize());
	});
});

suite("serializedToOptions", () => {
	test("DungeonObject -> DungeonObjectOptions", () => {
		const obj = new DungeonObject();
		obj.display = "X";
		obj.description = "Y";
		const ser = obj.serialize({ compress: true });

		const opts = serializedToOptions(ser);
		assert.deepEqual(opts, {
			keywords: "dungeon object",
			display: "X",
			description: "Y",
		});
	});

	test("Equipment -> EquipmentOptions", () => {
		const eq = new Equipment({
			slot: EQUIPMENT_SLOT.NECK,
			attributeBonuses: { strength: 1 },
			resourceBonuses: { maxHealth: 5 },
		});
		const ser = eq.serialize({ compress: true });
		const opts = serializedToOptions(ser);
		assert.deepEqual(opts, {
			keywords: "dungeon object",
			display: "Dungeon Object",
			slot: EQUIPMENT_SLOT.NECK,
			attributeBonuses: { strength: 1 },
			resourceBonuses: { maxHealth: 5 },
		});
	});
});

import assert from "node:assert";
import { suite, test } from "node:test";

import {
	AnySerializedDungeonObject,
	DungeonObject,
	Item,
	Room,
	SerializedItem,
	createFromTemplate,
	type DungeonObjectTemplate,
	type RoomTemplate,
	type SerializedDungeonObject,
} from "./dungeon.js";

function xoid(object: any) {
	const { oid, ...rest } = object as any;
	return rest;
}

suite("Template-aware serialization", () => {
	test("serialize() includes templateId when created from template", () => {
		const tmpl: DungeonObjectTemplate = {
			id: "potion",
			type: "Item",
			keywords: "potion",
			display: "Potion",
			description: "A basic potion.",
			baseWeight: 1.5,
		};
		const obj = createFromTemplate(tmpl);
		const ser = xoid(obj.serialize());
		assert.deepStrictEqual(ser, {
			type: "Item",
			keywords: "potion",
			display: "Potion",
			templateId: "potion",
			description: "A basic potion.",
			roomDescription: undefined,
			mapText: undefined,
			mapColor: undefined,
			baseWeight: 1.5,
		});
	});

	test("compress uses template base: unchanged object diffs down to type+templateId", () => {
		const tmpl: DungeonObjectTemplate = {
			id: "potion",
			type: "Item",
			keywords: "potion",
			display: "Potion",
			description: "A basic potion.",
			baseWeight: 1.5,
		};
		const obj = createFromTemplate(tmpl);
		const compressed = xoid(
			obj.serialize({
				compress: true,
			})
		);
		assert.deepStrictEqual(
			compressed,
			{ type: "Item", templateId: "potion" },
			"compressed should only contain type and templateId when equal to template"
		);
	});

	test("compress with modifications keeps only diffs vs template plus type+templateId", () => {
		const tmpl: DungeonObjectTemplate = {
			id: "potion",
			type: "Item",
			keywords: "potion",
			display: "Potion",
			description: "A basic potion.",
			baseWeight: 1.5,
		};
		const obj = createFromTemplate(tmpl);
		// change non-template field
		obj.roomDescription = "A potion rests here.";
		// change a template field
		obj.display = "Greater Potion";

		const compressed = xoid(
			obj.serialize({
				compress: true,
			})
		);
		assert.deepStrictEqual(compressed, {
			type: "Item",
			templateId: "potion",
			display: "Greater Potion",
			roomDescription: "A potion rests here.",
		});
	});

	test("normalize/deserialization with templateId reproduces full object equal to uncompressed", () => {
		const tmpl: DungeonObjectTemplate = {
			id: "ring-power",
			type: "Item",
			keywords: "ring power",
			display: "Ring of Power",
			description: "It hums with energy.",
			baseWeight: 0.1,
		};
		const obj = createFromTemplate(tmpl);
		obj.roomDescription = "A glowing ring lies here.";
		const uncompressed = xoid(obj.serialize());
		const compressed = xoid(obj.serialize({ compress: true }));
		assert.deepStrictEqual(compressed, {
			type: "Item",
			templateId: "ring-power",
			roomDescription: "A glowing ring lies here.",
		});
		const fromUncompressed = DungeonObject.deserialize(uncompressed);
		const fromCompressed = DungeonObject.deserialize(
			compressed as AnySerializedDungeonObject
		);
		assert.deepStrictEqual(
			fromCompressed.serialize(),
			fromUncompressed.serialize()
		);
	});

	// Room templates are intentionally unsupported; rooms are defined via dungeon grids.
});

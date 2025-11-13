import { PrimaryAttributeSet, ResourceCapacities } from "./dungeon.js";

export interface GrowthModifierCurve {
	base: number;
	perLevel?: number;
}

export interface ArchetypeSkillDefinition {
	id: string;
	level: number;
}

export interface BaseArchetypeDefinition {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly startingAttributes: PrimaryAttributeSet;
	readonly attributeGrowthPerLevel: PrimaryAttributeSet;
	readonly startingResourceCaps: ResourceCapacities;
	readonly resourceGrowthPerLevel: ResourceCapacities;
	readonly skills: ReadonlyArray<ArchetypeSkillDefinition>;
	readonly passives: ReadonlyArray<string>;
	readonly growthModifier: GrowthModifierCurve;
}

export type ReadonlyArchetype = Readonly<BaseArchetypeDefinition>;
export type Race = ReadonlyArchetype;
export type Class = ReadonlyArchetype;

function freezeAttributes(set: PrimaryAttributeSet): PrimaryAttributeSet {
	return Object.freeze({ ...set });
}

function freezeResources(set: ResourceCapacities): ResourceCapacities {
	return Object.freeze({ ...set });
}

function freezeGrowth(curve: GrowthModifierCurve): GrowthModifierCurve {
	return Object.freeze({
		base: curve.base,
		...(curve.perLevel !== undefined ? { perLevel: curve.perLevel } : {}),
	});
}

function freezeSkills(skills: ReadonlyArray<ArchetypeSkillDefinition>) {
	return Object.freeze(
		skills.map((skill) =>
			Object.freeze({
				id: skill.id,
				level: skill.level,
			})
		)
	);
}

function freezePassives(passives: ReadonlyArray<string>) {
	return Object.freeze(passives.map((value) => value.trim()));
}

export function freezeArchetype(
	def: BaseArchetypeDefinition
): ReadonlyArchetype {
	return Object.freeze({
		id: def.id,
		name: def.name,
		description: def.description,
		startingAttributes: freezeAttributes(def.startingAttributes),
		attributeGrowthPerLevel: freezeAttributes(def.attributeGrowthPerLevel),
		startingResourceCaps: freezeResources(def.startingResourceCaps),
		resourceGrowthPerLevel: freezeResources(def.resourceGrowthPerLevel),
		skills: freezeSkills(def.skills),
		passives: freezePassives(def.passives),
		growthModifier: freezeGrowth(def.growthModifier),
	});
}

export function evaluateGrowthModifier(
	curve: GrowthModifierCurve,
	level: number
): number {
	const safeLevel = Math.max(1, Math.floor(level));
	const perLevel = curve.perLevel ?? 0;
	const value = curve.base + perLevel * (safeLevel - 1);
	return value > 0 ? value : 1;
}

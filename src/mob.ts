import {
	DungeonObjectOptions,
	SerializedDungeonObject,
	registerDungeonObjectType,
	Movable,
	DungeonObject,
	SerializedItem,
	AnySerializedDungeonObject,
} from "./dungeon.js";
import { Race, Class, evaluateGrowthModifier } from "./archetype.js";
import {
	getDefaultRace,
	getDefaultClass,
	getRaceById,
	getClassById,
} from "./package/archetype.js";
import { Character, MESSAGE_GROUP } from "./character.js";
import {
	Equipment,
	Armor,
	Weapon,
	EQUIPMENT_SLOT,
	SerializedEquipment,
	SerializedArmor,
	SerializedWeapon,
} from "./equipment.js";

export interface PrimaryAttributeSet {
	strength: number;
	agility: number;
	intelligence: number;
}

export interface SecondaryAttributeSet {
	attackPower: number;
	vitality: number;
	defense: number;
	critRate: number;
	avoidance: number;
	accuracy: number;
	endurance: number;
	spellPower: number;
	wisdom: number;
	resilience: number;
}

export interface ResourceCapacities {
	maxHealth: number;
	maxMana: number;
}

export interface ResourceSnapshot {
	health: number;
	mana: number;
	exhaustion: number;
}

/**
 * Creation options for {@link Mob}.
 */
export interface MobOptions extends DungeonObjectOptions {
	/** Resolved race definition to use for this mob. */
	race?: Race;
	/** Resolved class definition to use for this mob. */
	class?: Class;
	level?: number;
	experience?: number;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	health?: number;
	mana?: number;
	exhaustion?: number;
}

const SECONDARY_ATTRIBUTE_FACTORS: Readonly<
	Record<keyof SecondaryAttributeSet, Partial<PrimaryAttributeSet>>
> = Object.freeze({
	attackPower: { strength: 0.5 },
	vitality: { strength: 0.5 },
	defense: { strength: 0.5 },
	critRate: { agility: 0.2 },
	avoidance: { agility: 0.2 },
	accuracy: { agility: 0.2 },
	endurance: { agility: 1 },
	spellPower: { intelligence: 0.5 },
	wisdom: { intelligence: 0.5 },
	resilience: { intelligence: 0.5 },
});

const SECONDARY_ATTRIBUTE_BASE: Readonly<
	Record<keyof SecondaryAttributeSet, number>
> = Object.freeze({
	attackPower: 0,
	vitality: 0,
	defense: 0,
	critRate: 0,
	avoidance: 0,
	accuracy: 0,
	endurance: 0,
	spellPower: 0,
	wisdom: 0,
	resilience: 0,
});

const HEALTH_PER_VITALITY = 2;
const MANA_PER_WISDOM = 2;
const MAX_EXHAUSTION = 100;
const EXPERIENCE_THRESHOLD = 100;
const ATTRIBUTE_ROUND_DECIMALS = 2;
const EXPERIENCE_ROUND_DECIMALS = 4;

function sumPrimaryAttributes(
	...components: Array<Partial<PrimaryAttributeSet> | undefined>
): PrimaryAttributeSet {
	let strength = 0;
	let agility = 0;
	let intelligence = 0;
	for (const part of components) {
		if (!part) continue;
		strength += Number(part.strength ?? 0);
		agility += Number(part.agility ?? 0);
		intelligence += Number(part.intelligence ?? 0);
	}
	return {
		strength,
		agility,
		intelligence,
	};
}

function sumSecondaryAttributes(
	...components: Array<Partial<SecondaryAttributeSet> | undefined>
): SecondaryAttributeSet {
	const result: SecondaryAttributeSet = {
		attackPower: 0,
		vitality: 0,
		defense: 0,
		critRate: 0,
		avoidance: 0,
		accuracy: 0,
		endurance: 0,
		spellPower: 0,
		wisdom: 0,
		resilience: 0,
	};
	for (const part of components) {
		if (!part) continue;
		result.attackPower += Number(part.attackPower ?? 0);
		result.vitality += Number(part.vitality ?? 0);
		result.defense += Number(part.defense ?? 0);
		result.critRate += Number(part.critRate ?? 0);
		result.avoidance += Number(part.avoidance ?? 0);
		result.accuracy += Number(part.accuracy ?? 0);
		result.endurance += Number(part.endurance ?? 0);
		result.spellPower += Number(part.spellPower ?? 0);
		result.wisdom += Number(part.wisdom ?? 0);
		result.resilience += Number(part.resilience ?? 0);
	}
	return result;
}

function multiplyPrimaryAttributes(
	source: PrimaryAttributeSet,
	factor: number
): PrimaryAttributeSet {
	return {
		strength: source.strength * factor,
		agility: source.agility * factor,
		intelligence: source.intelligence * factor,
	};
}

function sumResourceCaps(
	...components: Array<Partial<ResourceCapacities> | undefined>
): ResourceCapacities {
	let maxHealth = 0;
	let maxMana = 0;
	for (const part of components) {
		if (!part) continue;
		maxHealth += Number(part.maxHealth ?? 0);
		maxMana += Number(part.maxMana ?? 0);
	}
	return {
		maxHealth,
		maxMana,
	};
}

function multiplyResourceCaps(
	source: ResourceCapacities,
	factor: number
): ResourceCapacities {
	return {
		maxHealth: source.maxHealth * factor,
		maxMana: source.maxMana * factor,
	};
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizePrimaryBonuses(
	bonuses?: Partial<PrimaryAttributeSet>
): PrimaryAttributeSet {
	return sumPrimaryAttributes(bonuses);
}

function normalizeResourceBonuses(
	bonuses?: Partial<ResourceCapacities>
): ResourceCapacities {
	return sumResourceCaps(bonuses);
}

function prunePrimaryBonuses(
	bonuses: PrimaryAttributeSet
): Partial<PrimaryAttributeSet> | undefined {
	const result: Partial<PrimaryAttributeSet> = {};
	if (bonuses.strength !== 0)
		result.strength = roundTo(bonuses.strength, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.agility !== 0)
		result.agility = roundTo(bonuses.agility, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.intelligence !== 0)
		result.intelligence = roundTo(
			bonuses.intelligence,
			ATTRIBUTE_ROUND_DECIMALS
		);
	return Object.keys(result).length > 0 ? result : undefined;
}

function pruneResourceBonuses(
	bonuses: ResourceCapacities
): Partial<ResourceCapacities> | undefined {
	const result: Partial<ResourceCapacities> = {};
	if (bonuses.maxHealth !== 0)
		result.maxHealth = roundTo(bonuses.maxHealth, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.maxMana !== 0)
		result.maxMana = roundTo(bonuses.maxMana, ATTRIBUTE_ROUND_DECIMALS);
	return Object.keys(result).length > 0 ? result : undefined;
}

function computeSecondaryAttributes(
	primary: PrimaryAttributeSet
): SecondaryAttributeSet {
	const result: SecondaryAttributeSet = {
		attackPower: 0,
		vitality: 0,
		defense: 0,
		critRate: 0,
		avoidance: 0,
		accuracy: 0,
		endurance: 0,
		spellPower: 0,
		wisdom: 0,
		resilience: 0,
	};

	(
		Object.keys(SECONDARY_ATTRIBUTE_FACTORS) as Array<
			keyof SecondaryAttributeSet
		>
	).forEach((key) => {
		const base = SECONDARY_ATTRIBUTE_BASE[key];
		const weights = SECONDARY_ATTRIBUTE_FACTORS[key];
		let value = base;
		if (weights.strength)
			value += primary.strength * Number(weights.strength ?? 0);
		if (weights.agility)
			value += primary.agility * Number(weights.agility ?? 0);
		if (weights.intelligence)
			value += primary.intelligence * Number(weights.intelligence ?? 0);
		result[key] = roundTo(value, ATTRIBUTE_ROUND_DECIMALS);
	});

	return result;
}

function createPrimaryAttributesView(
	source: PrimaryAttributeSet
): Readonly<PrimaryAttributeSet> {
	return Object.freeze({
		strength: Math.floor(Number(source.strength) || 0),
		agility: Math.floor(Number(source.agility) || 0),
		intelligence: Math.floor(Number(source.intelligence) || 0),
	});
}

function createSecondaryAttributesView(
	source: SecondaryAttributeSet
): Readonly<SecondaryAttributeSet> {
	return Object.freeze({
		attackPower: Math.floor(Number(source.attackPower) || 0),
		vitality: Math.floor(Number(source.vitality) || 0),
		defense: Math.floor(Number(source.defense) || 0),
		critRate: Math.floor(Number(source.critRate) || 0),
		avoidance: Math.floor(Number(source.avoidance) || 0),
		accuracy: Math.floor(Number(source.accuracy) || 0),
		endurance: Math.floor(Number(source.endurance) || 0),
		spellPower: Math.floor(Number(source.spellPower) || 0),
		wisdom: Math.floor(Number(source.wisdom) || 0),
		resilience: Math.floor(Number(source.resilience) || 0),
	});
}

function createResourceCapsView(
	source: ResourceCapacities
): Readonly<ResourceCapacities> {
	return Object.freeze({
		maxHealth: Math.floor(Number(source.maxHealth) || 0),
		maxMana: Math.floor(Number(source.maxMana) || 0),
	});
}

/**
 * Serialized form for Mob objects.
 * Currently identical to Movable form but defined for type safety and future extensions.
 */
export interface SerializedMob extends SerializedDungeonObject {
	type: "Mob";
	level: number;
	experience: number;
	race: string;
	class: string;
	attributeBonuses: Partial<PrimaryAttributeSet>;
	resourceBonuses: Partial<ResourceCapacities>;
	health: number;
	mana: number;
	exhaustion: number;
	equipped?: Record<
		EQUIPMENT_SLOT,
		SerializedEquipment | SerializedArmor | SerializedWeapon
	>;
}

/**
 * These are mobs. They get into fights, interact with stuff, and die.
 */
export class Mob extends Movable {
	/** Private storage for the Character reference */
	private _character?: Character;
	private _race: Race;
	private _class: Class;
	private _level: number;
	private _experience: number;
	private _attributeBonuses: PrimaryAttributeSet;
	private _resourceBonuses: ResourceCapacities;
	private _primaryAttributes: PrimaryAttributeSet;
	private _primaryAttributesView: Readonly<PrimaryAttributeSet>;
	private _secondaryAttributes: SecondaryAttributeSet;
	private _secondaryAttributesView: Readonly<SecondaryAttributeSet>;
	private _resourceCaps: ResourceCapacities;
	private _resourceCapsView: Readonly<ResourceCapacities>;
	private _health!: number;
	private _mana!: number;
	private _exhaustion!: number;
	private _equipped: Map<EQUIPMENT_SLOT, Equipment>;
	constructor(options?: MobOptions) {
		super(options);

		this._equipped = new Map<EQUIPMENT_SLOT, Equipment>();
		this._attributeBonuses = normalizePrimaryBonuses(options?.attributeBonuses);
		this._resourceBonuses = normalizeResourceBonuses(options?.resourceBonuses);
		this._primaryAttributes = sumPrimaryAttributes();
		this._primaryAttributesView = createPrimaryAttributesView(
			this._primaryAttributes
		);
		this._secondaryAttributes = computeSecondaryAttributes(
			this._primaryAttributes
		);
		this._secondaryAttributesView = createSecondaryAttributesView(
			this._secondaryAttributes
		);
		this._resourceCaps = sumResourceCaps();
		this._resourceCapsView = createResourceCapsView(this._resourceCaps);

		this._race = options?.race ?? getDefaultRace();
		this._class = options?.class ?? getDefaultClass();

		const providedLevel = Math.floor(Number(options?.level ?? 1));
		this._level = providedLevel > 0 ? providedLevel : 1;
		this._experience = 0;

		this.recalculateDerivedAttributes({ bootstrap: true });

		if (options?.experience !== undefined) {
			this.experience = Number(options.experience);
		}

		this.health = options?.health ?? this.maxHealth;
		this.mana = options?.mana ?? this.maxMana;
		this.exhaustion = options?.exhaustion ?? 0;
	}
	/**
	 * Gets the Character that controls this mob (if any).
	 * @returns The Character instance or undefined for NPCs
	 */
	public get character(): Character | undefined {
		return this._character;
	}

	/**
	 * Sets the Character that controls this mob and establishes bidirectional reference.
	 * @param char The Character instance to associate with this mob
	 */
	public set character(char: Character | undefined) {
		if (this.character === char) return;
		const ochar = this.character;
		this._character = char;

		// If we're clearing or there was no change for the new character, still detach previous owner
		if (ochar && ochar.mob === this) {
			ochar.mob = new Mob();
		}

		// Ensure the new character points to this mob
		if (char && char.mob !== this) {
			char.mob = this;
		}
	}
	private captureResourceRatios(): {
		healthRatio?: number;
		manaRatio?: number;
	} {
		return {
			healthRatio:
				this._resourceCaps.maxHealth > 0
					? this._health / this._resourceCaps.maxHealth
					: undefined,
			manaRatio:
				this._resourceCaps.maxMana > 0
					? this._mana / this._resourceCaps.maxMana
					: undefined,
		};
	}

	private recalculateDerivedAttributes(
		opts: { bootstrap?: boolean; healthRatio?: number; manaRatio?: number } = {}
	): void {
		const race = this._race;
		const clazz = this._class;
		const levelStages = Math.max(0, this._level - 1);

		// Collect equipment bonuses
		const equipmentAttributeBonuses: Partial<PrimaryAttributeSet>[] = [];
		const equipmentResourceBonuses: Partial<ResourceCapacities>[] = [];
		const equipmentSecondaryAttributeBonuses: Partial<SecondaryAttributeSet>[] =
			[];
		let totalArmorDefense = 0;
		let totalWeaponAttackPower = 0;
		for (const equipment of this._equipped.values()) {
			if (equipment.attributeBonuses)
				equipmentAttributeBonuses.push(equipment.attributeBonuses);
			if (equipment.resourceBonuses)
				equipmentResourceBonuses.push(equipment.resourceBonuses);
			if (equipment.secondaryAttributeBonuses)
				equipmentSecondaryAttributeBonuses.push(
					equipment.secondaryAttributeBonuses
				);
			// Sum armor defense and weapon attack power separately
			if (equipment instanceof Armor) {
				totalArmorDefense += equipment.defense;
			} else if (equipment instanceof Weapon) {
				totalWeaponAttackPower += equipment.attackPower;
			}
		}

		const rawPrimary = sumPrimaryAttributes(
			race.startingAttributes,
			clazz.startingAttributes,
			multiplyPrimaryAttributes(race.attributeGrowthPerLevel, levelStages),
			multiplyPrimaryAttributes(clazz.attributeGrowthPerLevel, levelStages),
			this._attributeBonuses,
			...equipmentAttributeBonuses
		);
		this._primaryAttributes = {
			strength: roundTo(rawPrimary.strength, ATTRIBUTE_ROUND_DECIMALS),
			agility: roundTo(rawPrimary.agility, ATTRIBUTE_ROUND_DECIMALS),
			intelligence: roundTo(rawPrimary.intelligence, ATTRIBUTE_ROUND_DECIMALS),
		};
		this._primaryAttributesView = createPrimaryAttributesView(
			this._primaryAttributes
		);

		this._secondaryAttributes = computeSecondaryAttributes(
			this._primaryAttributes
		);

		// Add armor defense directly to secondary defense attribute
		if (totalArmorDefense > 0) {
			this._secondaryAttributes.defense = roundTo(
				this._secondaryAttributes.defense + totalArmorDefense,
				ATTRIBUTE_ROUND_DECIMALS
			);
		}

		// Add weapon attack power directly to secondary attackPower attribute
		if (totalWeaponAttackPower > 0) {
			this._secondaryAttributes.attackPower = roundTo(
				this._secondaryAttributes.attackPower + totalWeaponAttackPower,
				ATTRIBUTE_ROUND_DECIMALS
			);
		}

		// Apply equipment secondary attribute bonuses
		if (equipmentSecondaryAttributeBonuses.length > 0) {
			const equipmentSecondaryBonuses = sumSecondaryAttributes(
				...equipmentSecondaryAttributeBonuses
			);
			// Add each bonus to the corresponding secondary attribute
			(
				Object.keys(equipmentSecondaryBonuses) as Array<
					keyof SecondaryAttributeSet
				>
			).forEach((key) => {
				const bonus = equipmentSecondaryBonuses[key];
				if (bonus !== 0) {
					this._secondaryAttributes[key] = roundTo(
						this._secondaryAttributes[key] + bonus,
						ATTRIBUTE_ROUND_DECIMALS
					);
				}
			});
		}

		this._secondaryAttributesView = createSecondaryAttributesView(
			this._secondaryAttributes
		);

		const rawCaps = sumResourceCaps(
			race.startingResourceCaps,
			clazz.startingResourceCaps,
			multiplyResourceCaps(race.resourceGrowthPerLevel, levelStages),
			multiplyResourceCaps(clazz.resourceGrowthPerLevel, levelStages),
			this._resourceBonuses,
			...equipmentResourceBonuses
		);

		this._resourceCaps = {
			maxHealth: roundTo(
				rawCaps.maxHealth +
					this._secondaryAttributes.vitality * HEALTH_PER_VITALITY,
				ATTRIBUTE_ROUND_DECIMALS
			),
			maxMana: roundTo(
				rawCaps.maxMana + this._secondaryAttributes.wisdom * MANA_PER_WISDOM,
				ATTRIBUTE_ROUND_DECIMALS
			),
		};
		this._resourceCapsView = createResourceCapsView(this._resourceCaps);

		if (opts.bootstrap) {
			this._health = this._resourceCaps.maxHealth;
			this._mana = this._resourceCaps.maxMana;
			this._exhaustion = 0;
			return;
		}

		if (opts.healthRatio !== undefined && Number.isFinite(opts.healthRatio)) {
			this._health = clampNumber(
				opts.healthRatio * this._resourceCaps.maxHealth,
				0,
				this._resourceCaps.maxHealth
			);
		} else {
			this._health = clampNumber(this._health, 0, this._resourceCaps.maxHealth);
		}

		if (opts.manaRatio !== undefined && Number.isFinite(opts.manaRatio)) {
			this._mana = clampNumber(
				opts.manaRatio * this._resourceCaps.maxMana,
				0,
				this._resourceCaps.maxMana
			);
		} else {
			this._mana = clampNumber(this._mana, 0, this._resourceCaps.maxMana);
		}

		this._exhaustion = clampNumber(this._exhaustion, 0, MAX_EXHAUSTION);
	}

	private applyLevelDelta(delta: number): void {
		if (delta === 0) return;
		const ratios = this.captureResourceRatios();
		this._level = Math.max(1, this._level + delta);
		this.recalculateDerivedAttributes(ratios);
	}

	private resolveGrowthModifier(): number {
		const raceModifier = evaluateGrowthModifier(
			this._race.growthModifier,
			this._level
		);
		const classModifier = evaluateGrowthModifier(
			this._class.growthModifier,
			this._level
		);
		const combined = raceModifier * classModifier;
		return combined > 0 ? combined : 1;
	}

	public get level(): number {
		return this._level;
	}

	public set level(value: number) {
		const target = Math.max(1, Math.floor(Number(value) || 1));
		this.applyLevelDelta(target - this._level);
	}

	public get experience(): number {
		return roundTo(this._experience, EXPERIENCE_ROUND_DECIMALS);
	}

	public set experience(value: number) {
		let numeric = Number(value);
		if (!Number.isFinite(numeric) || numeric <= 0) {
			this._experience = 0;
			return;
		}

		let delta = 0;
		while (numeric >= EXPERIENCE_THRESHOLD) {
			numeric -= EXPERIENCE_THRESHOLD;
			delta += 1;
		}

		if (delta !== 0) {
			this.applyLevelDelta(delta);
		}

		this._experience = roundTo(numeric, EXPERIENCE_ROUND_DECIMALS);
	}

	public get experienceToLevel(): number {
		return roundTo(
			Math.max(0, EXPERIENCE_THRESHOLD - this._experience),
			EXPERIENCE_ROUND_DECIMALS
		);
	}

	/**
	 * Grant experience and automatically handle level-ups and overflow.
	 *
	 * @param amount Raw experience awarded before growth modifiers.
	 * @returns Adjusted experience actually applied after modifiers.
	 *
	 * @example
	 * const adjusted = mob.gainExperience(120);
	 * console.log(`Applied ${adjusted} XP, now level ${mob.level}`);
	 */
	public gainExperience(amount: number): number {
		const numeric = Number(amount);
		if (!Number.isFinite(numeric) || numeric <= 0) return 0;

		const modifier = this.resolveGrowthModifier();
		const adjusted = numeric / (modifier > 0 ? modifier : 1);

		let total = this._experience + adjusted;
		let levels = 0;
		while (total >= EXPERIENCE_THRESHOLD) {
			total -= EXPERIENCE_THRESHOLD;
			levels += 1;
		}

		this._experience = roundTo(total, EXPERIENCE_ROUND_DECIMALS);
		if (levels > 0) {
			this.applyLevelDelta(levels);
		}

		return adjusted;
	}

	/**
	 * Award the standard kill experience for defeating a target of a given level.
	 * Baseline is 10 and scales with level differences as described in the design doc.
	 *
	 * @example
	 * const xp = mob.awardKillExperience(target.level);
	 * console.log(`Gained ${xp} adjusted XP`);
	 */
	public awardKillExperience(targetLevel: number): number {
		const sanitizedTarget = Math.max(1, Math.floor(Number(targetLevel) || 1));
		const diff = sanitizedTarget - this._level;
		let amount = 10;
		if (diff > 0) amount += diff * 2;
		else if (diff < 0) amount = Math.max(1, amount + diff);
		return this.gainExperience(amount);
	}

	public get primaryAttributes(): Readonly<PrimaryAttributeSet> {
		return this._primaryAttributesView;
	}

	public get race(): Race {
		return this._race;
	}

	public get class(): Class {
		return this._class;
	}

	public get strength(): number {
		return this._primaryAttributesView.strength;
	}

	public get agility(): number {
		return this._primaryAttributesView.agility;
	}

	public get intelligence(): number {
		return this._primaryAttributesView.intelligence;
	}

	/** Get derived secondary attributes such as vitality or spell power. */
	public get secondaryAttributes(): Readonly<SecondaryAttributeSet> {
		return this._secondaryAttributesView;
	}

	public get attackPower(): number {
		return this._secondaryAttributesView.attackPower;
	}

	public get vitality(): number {
		return this._secondaryAttributesView.vitality;
	}

	public get defense(): number {
		return this._secondaryAttributesView.defense;
	}

	public get critRate(): number {
		return this._secondaryAttributesView.critRate;
	}

	public get avoidance(): number {
		return this._secondaryAttributesView.avoidance;
	}

	public get accuracy(): number {
		return this._secondaryAttributesView.accuracy;
	}

	public get endurance(): number {
		return this._secondaryAttributesView.endurance;
	}

	public get spellPower(): number {
		return this._secondaryAttributesView.spellPower;
	}

	public get wisdom(): number {
		return this._secondaryAttributesView.wisdom;
	}

	public get resilience(): number {
		return this._secondaryAttributesView.resilience;
	}

	/**
	 * Runtime-only bucket that equipment and effects should overwrite via {@link setAttributeBonuses}.
	 * These numbers are excluded from serialization and must be rebuilt after login.
	 */
	public get attributeBonuses(): Readonly<PrimaryAttributeSet> {
		return this._attributeBonuses;
	}

	/**
	 * Replace the runtime attribute bonus totals and refresh all derived stats.
	 *
	 * @example
	 * const warrior = new Mob();
	 * warrior.setAttributeBonuses({ strength: 5 }); // apply gear totals
	 * console.log(warrior.primaryAttributes.strength);
	 */
	public setAttributeBonuses(bonuses: Partial<PrimaryAttributeSet>): void {
		this._attributeBonuses = normalizePrimaryBonuses(bonuses);
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Runtime-only resource bonuses (e.g., +HP from gear) that mirror attribute bonuses.
	 * These values are recalculated on demand and are not persisted.
	 */
	public get resourceBonuses(): Readonly<ResourceCapacities> {
		return this._resourceBonuses;
	}

	/**
	 * Replace the runtime resource bonus totals and refresh max health/mana.
	 *
	 * @example
	 * const cleric = new Mob();
	 * cleric.setResourceBonuses({ maxMana: 25 });
	 * console.log(cleric.maxMana);
	 */
	public setResourceBonuses(bonuses: Partial<ResourceCapacities>): void {
		this._resourceBonuses = normalizeResourceBonuses(bonuses);
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	public get maxHealth(): number {
		return this._resourceCapsView.maxHealth;
	}

	public get maxMana(): number {
		return this._resourceCapsView.maxMana;
	}

	public get health(): number {
		return this._health;
	}

	public set health(value: number) {
		this._health = clampNumber(value, 0, this.maxHealth);
	}

	public get mana(): number {
		return this._mana;
	}

	public set mana(value: number) {
		this._mana = clampNumber(value, 0, this.maxMana);
	}

	public get exhaustion(): number {
		return this._exhaustion;
	}

	public set exhaustion(value: number) {
		this._exhaustion = clampNumber(value, 0, MAX_EXHAUSTION);
	}

	public get maxExhaustion(): number {
		return MAX_EXHAUSTION;
	}

	public resetResources(): void {
		this._health = this.maxHealth;
		this._mana = this.maxMana;
		this._exhaustion = 0;
	}

	/**
	 * Snapshot of current mutable resources used by UI and persistence layers.
	 *
	 * @example
	 * const { health, mana } = mob.resources;
	 * console.log(`HP: ${health}/${mob.maxHealth}`);
	 */
	public get resources(): ResourceSnapshot {
		return {
			health: this._health,
			mana: this._mana,
			exhaustion: this._exhaustion,
		};
	}
	/**
	 * Send text to the controlling character's client, if any.
	 */
	public send(text: string): void {
		this.character?.send(text);
	}

	/**
	 * Send a line to the controlling character's client, if any.
	 */
	public sendLine(text: string): void {
		this.character?.sendLine(text);
	}

	public sendMessage(text: string, group: MESSAGE_GROUP) {
		this.character?.sendMessage(text, group);
	}

	/**
	 * Equip an item to the appropriate slot.
	 * If an item is already equipped in that slot, it will be unequipped first.
	 *
	 * @param equipment The equipment item to equip
	 * @returns The previously equipped item in that slot, if any
	 *
	 * @example
	 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5, keywords: "helmet" });
	 * const oldHelmet = mob.equip(helmet);
	 */
	public equip(equipment: Equipment) {
		const slot = equipment.slot;
		this._equipped.set(slot, equipment);

		// Move equipment to mob's inventory if not already there
		if (equipment.location !== this) {
			this.add(equipment);
		}

		// Recalculate attributes with new equipment bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Unequip an item by its Equipment object.
	 *
	 * @param equipment The equipment item to unequip
	 * @returns The unequipped equipment, or undefined if not found/equipped
	 *
	 * @example
	 * const helmet = mob.getEquipped(EQUIPMENT_SLOT.HEAD);
	 * if (helmet) mob.unequip(helmet);
	 */
	public unequip(equipment: Equipment) {
		const slot = equipment.slot;
		const currentEquipment = this._equipped.get(slot);

		if (currentEquipment !== equipment) {
			return undefined; // Equipment not found in this slot
		}

		this._equipped.delete(slot);

		// Recalculate attributes without this equipment's bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Unequip an item from a slot.
	 *
	 * @param slot The equipment slot to unequip
	 * @returns The unequipped equipment, if any
	 *
	 * @example
	 * const helmet = mob.unequipBySlot(EQUIPMENT_SLOT.HEAD);
	 */
	public unequipBySlot(slot: EQUIPMENT_SLOT): Equipment | undefined {
		const equipment = this._equipped.get(slot);
		if (!equipment) {
			return undefined;
		}

		this._equipped.delete(slot);

		// Recalculate attributes without this equipment's bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());

		return equipment;
	}

	/**
	 * Get the equipment currently equipped in a slot.
	 *
	 * @param slot The equipment slot to check
	 * @returns The equipped equipment, or undefined if slot is empty
	 *
	 * @example
	 * const helmet = mob.getEquipped(EQUIPMENT_SLOT.HEAD);
	 */
	public getEquipped(slot: EQUIPMENT_SLOT): Equipment | undefined {
		return this._equipped.get(slot);
	}

	/**
	 * Get all equipped items.
	 *
	 * @returns A map of all equipped items by slot
	 *
	 * @example
	 * const allEquipment = mob.getAllEquipped();
	 * console.log(`Wearing ${allEquipment.size} pieces of equipment`);
	 */
	public getAllEquipped(): Equipment[] {
		return [...this._equipped.values()];
	}

	/**
	 * Get total defense from all equipped armor.
	 *
	 * @returns Total defense value
	 *
	 * @example
	 * const totalDefense = mob.getTotalDefense();
	 */
	public getTotalDefense(): number {
		let total = 0;
		for (const equipment of this._equipped.values()) {
			if (equipment instanceof Armor) {
				total += equipment.defense;
			}
		}
		return total;
	}

	/**
	 * Get total attack power from all equipped weapons.
	 *
	 * @returns Total attack power value
	 *
	 * @example
	 * const totalAttackPower = mob.getTotalAttackPower();
	 */
	public getTotalAttackPower(): number {
		let total = 0;
		for (const equipment of this._equipped.values()) {
			if (equipment instanceof Weapon) {
				total += equipment.attackPower;
			}
		}
		return total;
	}

	/**
	 * Serialize this Mob instance to a serializable format.
	 */
	public serialize(): SerializedMob {
		const base = super.serialize();
		const equipped: Record<
			EQUIPMENT_SLOT,
			SerializedEquipment | SerializedArmor | SerializedWeapon
		> = {} as Record<
			EQUIPMENT_SLOT,
			SerializedEquipment | SerializedArmor | SerializedWeapon
		>;
		for (const [slot, equipment] of this._equipped.entries()) {
			equipped[slot] = equipment.serialize();
		}

		return {
			...base,
			type: "Mob",
			level: this._level,
			experience: this._experience,
			race: this._race.id,
			class: this._class.id,
			attributeBonuses: prunePrimaryBonuses(this._attributeBonuses) ?? {},
			resourceBonuses: pruneResourceBonuses(this._resourceBonuses) ?? {},
			health: this._health,
			mana: this._mana,
			exhaustion: this._exhaustion,
			equipped: Object.keys(equipped).length > 0 ? equipped : undefined,
		};
	}

	/**
	 * Deserialize a SerializedMob into a Mob instance.
	 */
	public static deserialize(data: SerializedMob): Mob {
		const { race: raceId, class: classId, equipped, ...rest } = data;
		const race = getRaceById(raceId);
		const _class = getClassById(classId);
		const mob = new Mob({
			race,
			class: _class,
			...rest,
		});
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				mob.add(contentObj);
			}
		}
		// Restore equipped items
		if (equipped) {
			for (const [slotStr, equipmentData] of Object.entries(equipped)) {
				const slot = slotStr as EQUIPMENT_SLOT;
				// Handle both single items and arrays (for backward compatibility)
				if (Array.isArray(equipmentData)) {
					// Legacy format - take first item only
					const equipment = DungeonObject.deserialize(
						equipmentData[0] as unknown as AnySerializedDungeonObject
					) as Equipment;
					mob._equipped.set(slot, equipment);
					if (!mob.contains(equipment)) {
						mob.add(equipment);
					}
				} else {
					const equipment = DungeonObject.deserialize(
						equipmentData as unknown as AnySerializedDungeonObject
					) as Equipment;
					mob._equipped.set(slot, equipment);
					if (!mob.contains(equipment)) {
						mob.add(equipment);
					}
				}
			}
			// Recalculate attributes with equipment bonuses
			mob.recalculateDerivedAttributes(mob.captureResourceRatios());
		}
		return mob;
	}

	/**
	 * Override destroy to handle Mob-specific cleanup:
	 * - Clear character reference
	 * - Clear equipped items
	 */
	override destroy(destroyContents: boolean = true): void {
		// Clear character reference (this will also clear character.mob)
		this.character = undefined;

		// Clear equipped items map
		this._equipped.clear();

		// Call parent destroy
		super.destroy(destroyContents);
	}
}

registerDungeonObjectType<SerializedMob>({
	type: "Mob",
	deserialize: (data) => Mob.deserialize(data),
	createBaseSerialized: () => new Mob().serialize() as SerializedMob,
	createTemplateInstance: () => new Mob(),
});

import {
	DungeonObjectOptions,
	SerializedDungeonObject,
	registerDungeonObjectType,
	Item,
	DungeonObject,
	SerializedItem,
	DungeonObjectTemplate,
} from "./dungeon.js";
import type {
	PrimaryAttributeSet,
	ResourceCapacities,
	SecondaryAttributeSet,
} from "./mob.js";

/**
 * Equipment slot types that items can be equipped to.
 */
export enum EQUIPMENT_SLOT {
	HEAD = "head",
	NECK = "neck",
	SHOULDERS = "shoulders",
	HANDS = "hands",
	MAIN_HAND = "mainHand",
	OFF_HAND = "offHand",
	FINGER = "finger",
	CHEST = "chest",
	WAIST = "waist",
	LEGS = "legs",
	FEET = "feet",
}

/**
 * Creation options for {@link Equipment}.
 */
export interface EquipmentOptions extends DungeonObjectOptions {
	/** The equipment slot this item occupies when equipped. */
	slot: EQUIPMENT_SLOT;
	/** Defense value provided by this equipment. */
	defense?: number;
	/** Attribute bonuses provided by this equipment (for rare equipment). */
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	/** Resource capacity bonuses provided by this equipment (for rare equipment). */
	resourceBonuses?: Partial<ResourceCapacities>;
	/** Secondary attribute bonuses provided by this equipment (for rare equipment). */
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

export type equipmentType = "Equipment" | "Armor" | "Weapon";

/**
 * Serialized form for Equipment objects.
 */
export interface SerializedEquipment extends SerializedDungeonObject {
	type: equipmentType;
	slot: EQUIPMENT_SLOT;
	defense: number;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

/**
 * Base Equipment class that can be equipped to a Mob.
 * Equipment can have attribute/stat modifiers for rare items.
 */
export class Equipment extends Item {
	protected _slot: EQUIPMENT_SLOT;
	protected _attributeBonuses: Partial<PrimaryAttributeSet>;
	protected _resourceBonuses: Partial<ResourceCapacities>;
	protected _secondaryAttributeBonuses: Partial<SecondaryAttributeSet>;

	constructor(options?: EquipmentOptions) {
		super(options);
		this._slot = options?.slot ?? EQUIPMENT_SLOT.HEAD;
		this._attributeBonuses = options?.attributeBonuses ?? {};
		this._resourceBonuses = options?.resourceBonuses ?? {};
		this._secondaryAttributeBonuses = options?.secondaryAttributeBonuses ?? {};
	}

	/**
	 * Gets the equipment slot this item occupies when equipped.
	 */
	public get slot(): EQUIPMENT_SLOT {
		return this._slot;
	}

	/**
	 * Gets the defense value provided by this equipment.
	 * Overridden by Armor, returns 0 for Weapon.
	 */
	public get defense(): number {
		return 0;
	}

	/**
	 * Gets the attack power value provided by this equipment.
	 * Overridden by Weapon, returns 0 for Armor.
	 */
	public get attackPower(): number {
		return 0;
	}

	/**
	 * Gets the attribute bonuses provided by this equipment.
	 */
	public get attributeBonuses(): Readonly<Partial<PrimaryAttributeSet>> {
		return this._attributeBonuses;
	}

	/**
	 * Gets the resource capacity bonuses provided by this equipment.
	 */
	public get resourceBonuses(): Readonly<Partial<ResourceCapacities>> {
		return this._resourceBonuses;
	}

	/**
	 * Gets the secondary attribute bonuses provided by this equipment.
	 */
	public get secondaryAttributeBonuses(): Readonly<
		Partial<SecondaryAttributeSet>
	> {
		return this._secondaryAttributeBonuses;
	}

	/**
	 * Serialize this Equipment instance to a serializable format.
	 */
	public serialize(): SerializedEquipment {
		const base = super.serialize();
		return {
			...base,
			type: "Equipment",
			slot: this._slot,
			defense: this.defense,
			...(Object.keys(this._attributeBonuses).length > 0
				? { attributeBonuses: this._attributeBonuses }
				: {}),
			...(Object.keys(this._resourceBonuses).length > 0
				? { resourceBonuses: this._resourceBonuses }
				: {}),
			...(Object.keys(this._secondaryAttributeBonuses).length > 0
				? { secondaryAttributeBonuses: this._secondaryAttributeBonuses }
				: {}),
		};
	}

	/**
	 * Deserialize a SerializedEquipment into an Equipment instance.
	 */
	public static deserialize(data: SerializedItem): Equipment {
		const equipmentData = data as unknown as SerializedEquipment;
		const equipment = new Equipment({
			...equipmentData,
			slot: equipmentData.slot,
			defense: equipmentData.defense ?? 0,
			attributeBonuses: equipmentData.attributeBonuses,
			resourceBonuses: equipmentData.resourceBonuses,
			secondaryAttributeBonuses: equipmentData.secondaryAttributeBonuses,
		});
		if (equipmentData.contents && Array.isArray(equipmentData.contents)) {
			for (const contentData of equipmentData.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				equipment.add(contentObj);
			}
		}
		return equipment;
	}

	/**
	 * Override applyTemplate to handle Equipment-specific properties (slot, defense, etc.)
	 */
	override applyTemplate(template: DungeonObjectTemplate): void {
		// Call parent to apply base properties
		super.applyTemplate(template);

		// Handle Equipment-specific properties that may be in the template
		// (even though they're not in the DungeonObjectTemplate interface,
		// they can be present when loading from YAML)
		const equipmentTemplate = template as any;
		if (equipmentTemplate.slot !== undefined) {
			this._slot = equipmentTemplate.slot as EQUIPMENT_SLOT;
		}
		if (equipmentTemplate.attributeBonuses !== undefined) {
			this._attributeBonuses = equipmentTemplate.attributeBonuses;
		}
		if (equipmentTemplate.resourceBonuses !== undefined) {
			this._resourceBonuses = equipmentTemplate.resourceBonuses;
		}
		if (equipmentTemplate.secondaryAttributeBonuses !== undefined) {
			this._secondaryAttributeBonuses =
				equipmentTemplate.secondaryAttributeBonuses;
		}
	}
}

/**
 * Creation options for {@link Armor}.
 */
export interface ArmorOptions extends EquipmentOptions {
	/** Defense value provided by this armor. */
	defense: number;
}

/**
 * Serialized form for Armor objects.
 */
export interface SerializedArmor extends Omit<SerializedEquipment, "type"> {
	type: "Armor";
}

/**
 * Armor is a type of Equipment that provides defense.
 */
export class Armor extends Equipment {
	private _defense: number;

	constructor(options?: ArmorOptions) {
		super(options);
		this._defense = options?.defense ?? 0;
	}

	/**
	 * Gets the defense value provided by this armor.
	 */
	public override get defense(): number {
		return this._defense;
	}

	/**
	 * Serialize this Armor instance to a serializable format.
	 */
	public override serialize(): SerializedArmor {
		const base = super.serialize();
		return {
			...base,
			type: "Armor",
		} as SerializedArmor;
	}

	/**
	 * Deserialize a SerializedArmor into an Armor instance.
	 */
	public static deserialize(data: SerializedItem): Armor {
		const armorData = data as unknown as SerializedArmor;
		const armor = new Armor({
			...armorData,
			slot: armorData.slot,
			defense: armorData.defense ?? 0,
			attributeBonuses: armorData.attributeBonuses,
			resourceBonuses: armorData.resourceBonuses,
			secondaryAttributeBonuses: armorData.secondaryAttributeBonuses,
		});
		if (armorData.contents && Array.isArray(armorData.contents)) {
			for (const contentData of armorData.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				armor.add(contentObj);
			}
		}
		return armor;
	}

	/**
	 * Override applyTemplate to handle Armor-specific properties.
	 */
	override applyTemplate(template: DungeonObjectTemplate): void {
		super.applyTemplate(template);
		const armorTemplate = template as any;
		if (armorTemplate.defense !== undefined) {
			this._defense = armorTemplate.defense;
		}
	}
}

/**
 * Creation options for {@link Weapon}.
 */
export interface WeaponOptions extends EquipmentOptions {
	/** Attack power value provided by this weapon. */
	attackPower: number;
}

/**
 * Serialized form for Weapon objects.
 */
export interface SerializedWeapon
	extends Omit<SerializedEquipment, "type" | "defense"> {
	type: "Weapon";
	attackPower: number;
	defense: 0; // Weapons always have 0 defense
}

/**
 * Weapon is a type of Equipment that provides attack power.
 */
export class Weapon extends Equipment {
	private _attackPower: number;

	constructor(options?: WeaponOptions) {
		super(options);
		this._attackPower = options?.attackPower ?? 0;
	}

	/**
	 * Gets the attack power value provided by this weapon.
	 */
	public override get attackPower(): number {
		return this._attackPower;
	}

	/**
	 * Serialize this Weapon instance to a serializable format.
	 */
	public override serialize(): SerializedWeapon {
		const base = super.serialize();
		return {
			...base,
			type: "Weapon",
			attackPower: this._attackPower,
			defense: 0, // Weapons don't provide defense
		} as SerializedWeapon;
	}

	/**
	 * Deserialize a SerializedWeapon into a Weapon instance.
	 */
	public static deserialize(data: SerializedItem): Weapon {
		const weaponData = data as unknown as SerializedWeapon;
		const weapon = new Weapon({
			...weaponData,
			slot: weaponData.slot,
			attackPower: weaponData.attackPower ?? 0,
			attributeBonuses: weaponData.attributeBonuses,
			resourceBonuses: weaponData.resourceBonuses,
			secondaryAttributeBonuses: weaponData.secondaryAttributeBonuses,
		});
		if (weaponData.contents && Array.isArray(weaponData.contents)) {
			for (const contentData of weaponData.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				weapon.add(contentObj);
			}
		}
		return weapon;
	}

	/**
	 * Override applyTemplate to handle Weapon-specific properties.
	 */
	override applyTemplate(template: DungeonObjectTemplate): void {
		super.applyTemplate(template);
		const weaponTemplate = template as any;
		if (weaponTemplate.attackPower !== undefined) {
			this._attackPower = weaponTemplate.attackPower;
		}
	}
}

registerDungeonObjectType<SerializedEquipment>({
	type: "Equipment",
	deserialize: (data) =>
		Equipment.deserialize(data as unknown as SerializedItem),
	createBaseSerialized: () =>
		new Equipment().serialize() as SerializedEquipment,
	createTemplateInstance: () => new Equipment(),
});

registerDungeonObjectType<SerializedArmor>({
	type: "Armor",
	deserialize: (data) => Armor.deserialize(data as unknown as SerializedItem),
	createBaseSerialized: () =>
		new Armor({
			slot: EQUIPMENT_SLOT.HEAD,
			defense: 0,
		}).serialize() as SerializedArmor,
	createTemplateInstance: () =>
		new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 0 }),
});

registerDungeonObjectType<SerializedWeapon>({
	type: "Weapon",
	deserialize: (data) => Weapon.deserialize(data as unknown as SerializedItem),
	createBaseSerialized: () =>
		new Weapon({
			slot: EQUIPMENT_SLOT.MAIN_HAND,
			attackPower: 0,
		}).serialize() as SerializedWeapon,
	createTemplateInstance: () =>
		new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 0 }),
});

/**
 * Migration System Entry Point
 *
 * This file re-exports migration APIs for convenience.
 * Specific migration systems are in their respective directories:
 * - Dungeon migrations: ./dungeon/
 * - Character migrations: ./character/
 * - Mob migrations: ./mob/
 * - Item migrations: ./item/
 * - Equipment migrations: ./equipment/
 * - Armor migrations: ./armor/
 * - Weapon migrations: ./weapon/
 */

// Export dungeon migration API
export { migrateDungeonData } from "./dungeon/runner.js";
export { registerMigration, findMigrationPath } from "./dungeon/registry.js";
export type { Migration, MigrationInfo } from "./dungeon/types.js";

// Export character migration API
export { migrateCharacterData } from "./character/runner.js";
export {
	registerMigration as registerCharacterMigration,
	findMigrationPath as findCharacterMigrationPath,
} from "./character/registry.js";

// Export mob migration API
export { migrateMobData } from "./mob/runner.js";
export {
	registerMigration as registerMobMigration,
	findMigrationPath as findMobMigrationPath,
} from "./mob/registry.js";
export type {
	Migration as MobMigration,
	MigrationInfo as MobMigrationInfo,
} from "./mob/types.js";

// Export item migration API
export { migrateItemData } from "./item/runner.js";
export {
	registerMigration as registerItemMigration,
	findMigrationPath as findItemMigrationPath,
} from "./item/registry.js";
export type {
	Migration as ItemMigration,
	MigrationInfo as ItemMigrationInfo,
} from "./item/types.js";

// Export equipment migration API
export { migrateEquipmentData } from "./equipment/runner.js";
export {
	registerMigration as registerEquipmentMigration,
	findMigrationPath as findEquipmentMigrationPath,
} from "./equipment/registry.js";
export type {
	Migration as EquipmentMigration,
	MigrationInfo as EquipmentMigrationInfo,
} from "./equipment/types.js";

// Export armor migration API
export { migrateArmorData } from "./armor/runner.js";
export {
	registerMigration as registerArmorMigration,
	findMigrationPath as findArmorMigrationPath,
} from "./armor/registry.js";
export type {
	Migration as ArmorMigration,
	MigrationInfo as ArmorMigrationInfo,
} from "./armor/types.js";

// Export weapon migration API
export { migrateWeaponData } from "./weapon/runner.js";
export {
	registerMigration as registerWeaponMigration,
	findMigrationPath as findWeaponMigrationPath,
} from "./weapon/registry.js";
export type {
	Migration as WeaponMigration,
	MigrationInfo as WeaponMigrationInfo,
} from "./weapon/types.js";

// Export version utilities
export { compareVersions, getCurrentDungeonVersion } from "./version.js";

// Export generic migration system for other data types
export { migrateData } from "./generic/runner.js";
export {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
} from "./generic/registry.js";
export type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "./generic/types.js";

import { Ability } from "../ability.js";

/** Registry of all loaded abilities by ID */
const ABILITY_REGISTRY = new Map<string, Ability>();
export const READONLY_ABILITY_REGISTRY: ReadonlyMap<string, Ability> =
	ABILITY_REGISTRY;
export { READONLY_ABILITY_REGISTRY as ABILITY_REGISTRY };

/**
 * Gets the ability registry.
 * @returns The ability registry
 */
export function getAbilityRegistry(): ReadonlyMap<string, Ability> {
	return ABILITY_REGISTRY;
}

/**
 * Registers an ability in the registry.
 * @param ability The ability to register
 */
export function registerAbility(ability: Ability): void {
	ABILITY_REGISTRY.set(ability.id, ability);
}

/**
 * Gets an ability by its ID.
 * @param id The ability ID to look up
 * @returns The ability or undefined if not found
 */
export function getAbilityById(id: string): Ability | undefined {
	return ABILITY_REGISTRY.get(id);
}

/**
 * Gets all registered abilities.
 * @returns Array of all abilities
 */
export function getAllAbilities(): Ability[] {
	return Array.from(ABILITY_REGISTRY.values());
}

/**
 * Checks if an ability ID is already registered.
 * @param id The ability ID to check
 * @returns true if the ability ID is already registered
 */
export function hasAbility(id: string): boolean {
	return ABILITY_REGISTRY.has(id);
}

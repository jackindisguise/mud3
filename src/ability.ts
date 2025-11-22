/**
 * Ability interface representing skills that mobs can learn.
 * Abilities are things that mobs can learn and use in the game.
 *
 * @property id - Unique identifier for the ability
 * @property name - Display name of the ability
 * @property description - Description of what the ability does
 *
 * @example
 * ```typescript
 * const whirlwind: Ability = {
 *   id: "whirlwind",
 *   name: "Whirlwind",
 *   description: "A spinning attack that hits all nearby enemies."
 * };
 * ```
 */
export interface Ability {
	id: string;
	name: string;
	description: string;
}

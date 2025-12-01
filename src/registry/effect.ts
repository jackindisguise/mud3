import { EffectTemplate } from "../core/effect.js";

/** Registry of all loaded effect templates by ID */
const EFFECT_TEMPLATE_REGISTRY = new Map<string, EffectTemplate>();
export const READONLY_EFFECT_TEMPLATE_REGISTRY: ReadonlyMap<
	string,
	EffectTemplate
> = EFFECT_TEMPLATE_REGISTRY;
export { READONLY_EFFECT_TEMPLATE_REGISTRY as EFFECT_TEMPLATE_REGISTRY };

/**
 * Gets the effect template registry.
 * @returns The effect template registry
 */
export function getEffectTemplateRegistry(): ReadonlyMap<
	string,
	EffectTemplate
> {
	return EFFECT_TEMPLATE_REGISTRY;
}

/**
 * Registers an effect template in the registry.
 * @param template The effect template to register
 */
export function registerEffectTemplate(template: EffectTemplate): void {
	EFFECT_TEMPLATE_REGISTRY.set(template.id, template);
}

/**
 * Gets an effect template by its ID.
 * @param id The effect template ID to look up
 * @returns The effect template or undefined if not found
 */
export function getEffectTemplateById(id: string): EffectTemplate | undefined {
	return EFFECT_TEMPLATE_REGISTRY.get(id);
}

/**
 * Gets all registered effect templates.
 * @returns Array of all effect templates
 */
export function getAllEffectTemplates(): EffectTemplate[] {
	return Array.from(EFFECT_TEMPLATE_REGISTRY.values());
}

/**
 * Checks if an effect template ID is already registered.
 * @param id The effect template ID to check
 * @returns true if the effect template ID is already registered
 */
export function hasEffectTemplate(id: string): boolean {
	return EFFECT_TEMPLATE_REGISTRY.has(id);
}


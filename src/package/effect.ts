/**
 * Package: effects - dynamic effect template loader
 *
 * Loads effect template modules from compiled TypeScript files at startup:
 * - `dist/src/effects` (compiled TypeScript effect templates from `src/effects`)
 *
 * Each effect template file should export:
 * - `EFFECT_TEMPLATE_ID: string` - unique identifier for the effect template
 * - `effectTemplate: EffectTemplate` - the effect template definition object
 *
 * Files beginning with `_` are ignored. Only `.js` files are loaded (compiled from TypeScript).
 * The loader validates that all effect template IDs are unique.
 *
 * @example
 * // src/effects/adaptable.ts
 * export const EFFECT_TEMPLATE_ID = "adaptable";
 * export const effectTemplate: PassiveEffectTemplate = {
 *   id: "adaptable",
 *   name: "Adaptable",
 *   description: "Humans are adaptable and gain bonus attributes.",
 *   type: "passive",
 *   stackable: false,
 *   primaryAttributeModifiers: {
 *     strength: 1,
 *     agility: 1,
 *     intelligence: 1,
 *   },
 * };
 *
 * @module package/effects
 */
import { Package } from "package-loader";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { pathToFileURL } from "url";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { access, constants } from "fs/promises";
import { EffectTemplate } from "../core/effect.js";
import {
	EFFECT_TEMPLATE_REGISTRY,
	hasEffectTemplate,
	registerEffectTemplate,
} from "../registry/effect.js";

/** Directory for compiled TypeScript effect templates */
const ROOT_DIRECTORY = getSafeRootDirectory();
const SRC_EFFECT_DIRECTORY = join(ROOT_DIRECTORY, "dist", "src", "effects");

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function loadEffectTemplates() {
	const directories = [SRC_EFFECT_DIRECTORY];
	for (const effectDir of directories) {
		if (!(await fileExists(effectDir))) continue;
		logger.info(
			`Loading effect templates from ${relative(ROOT_DIRECTORY, effectDir)}`
		);
		try {
			const files = await readdir(effectDir);
			logger.debug(
				`Found ${files.length} files in ${relative(ROOT_DIRECTORY, effectDir)}`
			);

			// Filter for JavaScript files
			const jsFiles = files.filter(
				(file) => file.endsWith(".js") && !file.startsWith("_")
			);
			logger.debug(
				`Found ${jsFiles.length} JavaScript effect template files in ${relative(
					ROOT_DIRECTORY,
					effectDir
				)}`
			);

			// Load JavaScript effect templates
			for (const file of jsFiles) {
				try {
					const filePath = join(effectDir, file);
					logger.debug(
						`Processing effect template file: ${relative(
							ROOT_DIRECTORY,
							filePath
						)}`
					);
					const fileUrl = pathToFileURL(filePath).href;
					const effectModule = await import(fileUrl);

					// Check for required exports
					if (!effectModule.EFFECT_TEMPLATE_ID) {
						logger.warn(
							`Effect template file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} is missing EFFECT_TEMPLATE_ID export`
						);
						continue;
					}

					const effectTemplateId = effectModule.EFFECT_TEMPLATE_ID;
					if (typeof effectTemplateId !== "string") {
						logger.warn(
							`Effect template file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} has invalid EFFECT_TEMPLATE_ID (must be string)`
						);
						continue;
					}

					// Check for duplicate effect template IDs
					if (hasEffectTemplate(effectTemplateId)) {
						logger.error(
							`Duplicate effect template ID "${effectTemplateId}" found in ${relative(
								ROOT_DIRECTORY,
								filePath
							)}. Effect template IDs must be unique.`
						);
						continue;
					}

					// Load effect template definition
					if (!effectModule.effectTemplate) {
						logger.warn(
							`Effect template file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} is missing effectTemplate export`
						);
						continue;
					}

					const effectTemplate: EffectTemplate = effectModule.effectTemplate;
					if (
						!effectTemplate.id ||
						!effectTemplate.name ||
						!effectTemplate.description ||
						!effectTemplate.type
					) {
						logger.warn(
							`Effect template file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} has invalid effect template object (missing id, name, description, or type)`
						);
						continue;
					}

					// Ensure effectTemplate.id matches EFFECT_TEMPLATE_ID
					if (effectTemplate.id !== effectTemplateId) {
						logger.warn(
							`Effect template file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} has mismatched IDs: EFFECT_TEMPLATE_ID="${effectTemplateId}" but effectTemplate.id="${
								effectTemplate.id
							}". Using EFFECT_TEMPLATE_ID.`
						);
						effectTemplate.id = effectTemplateId;
					}

					// Register the effect template
					registerEffectTemplate(effectTemplate);
					logger.debug(
						`Registered effect template "${effectTemplateId}" (${effectTemplate.name})`
					);
				} catch (error) {
					logger.error(
						`Failed to load effect template from ${relative(
							ROOT_DIRECTORY,
							join(effectDir, file)
						)}: ${error}`
					);
				}
			}
		} catch (error) {
			logger.warn(
				`Failed to read effect templates directory ${relative(
					ROOT_DIRECTORY,
					effectDir
				)}: ${error}`
			);
		}
	}

	logger.info(
		`Effect template loading complete. Total effect templates registered: ${EFFECT_TEMPLATE_REGISTRY.size}`
	);
}

export default {
	name: "effects",
	loader: async () => {
		await loadEffectTemplates();
	},
} as Package;

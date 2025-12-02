/**
 * Core helpfile module.
 *
 * Provides interfaces for helpfile data structures.
 *
 * @module core/help
 */

/**
 * Represents a single helpfile entry.
 */
export interface Helpfile {
	/** Primary keyword for this helpfile */
	keyword: string;
	/** Alternative keywords that reference this helpfile */
	aliases?: string[];
	/** Keywords of related helpfiles */
	related?: string[];
	/** Topic tags describing the type of information covered (e.g., "communication", "combat", "magic") */
	topic?: string[];
	/** The help content (supports multiline text) */
	content: string;
}

/**
 * Raw helpfile structure from YAML (before validation)
 */
export interface SerializedHelpfile {
	keyword: string;
	aliases?: string | string[];
	related?: string | string[];
	topic?: string | string[];
	content: string;
}

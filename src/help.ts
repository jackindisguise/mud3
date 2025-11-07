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

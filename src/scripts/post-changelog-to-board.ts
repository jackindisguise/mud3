/**
 * Script to post recent changelog entries to the changes board.
 *
 * Parses CHANGELOG.md to extract the most recent version's changes and posts
 * them to the changes board with SYSTEM as the author.
 *
 * @example
 * ```bash
 * npm run post-changelog
 * ```
 *
 * @module scripts/post-changelog-to-board
 */

import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { loadBoard, saveBoard } from "../package/board.js";
import logger from "../logger.js";
import { string } from "mud-ext";
import { COLOR, color, SIZER, TEXT_STYLE, textStyleToTag } from "../color.js";
import { LINEBREAK } from "../telnet.js";

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const CHANGES_BOARD_NAME = "changes";
const SYSTEM_AUTHOR = "SYSTEM";

/**
 * Parsed bullet point data from a changelog entry.
 */
interface ParsedBulletPoint {
	text: string;
	prefixTag: string | null;
	commitHash: string | null;
	commitUrl: string | null;
	issueNumber: string | null;
	issueUrl: string | null;
	urls: string[];
}

/**
 * Parsed version section from changelog.
 */
interface ParsedVersion {
	version: string;
	content: string;
	fullSection: string;
	features: ParsedBulletPoint[];
	bugFixes: ParsedBulletPoint[];
	breakingChanges: ParsedBulletPoint[];
}

/**
 * Parses a bullet point line to extract prefix tag, commit hash, URLs, and issue numbers.
 *
 * @param bulletText - The bullet point text (without the leading `* `)
 * @returns Parsed bullet point data
 */
function parseBulletPoint(bulletText: string): ParsedBulletPoint {
	const result: ParsedBulletPoint = {
		text: bulletText,
		prefixTag: null,
		commitHash: null,
		commitUrl: null,
		issueNumber: null,
		issueUrl: null,
		urls: [],
	};

	// Extract prefix tag (e.g., **deprecated:**, **deps:**)
	const prefixMatch = bulletText.match(/^\*\*([^*]+):\*\*\s*/);
	if (prefixMatch) {
		result.prefixTag = prefixMatch[1].trim();
		// Remove prefix from text for cleaner display
		result.text = bulletText.replace(/^\*\*[^*]+:\*\*\s*/, "").trim();
	}

	// Extract all markdown links: [text](url)
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	let linkMatch: RegExpExecArray | null;

	while ((linkMatch = linkPattern.exec(bulletText)) !== null) {
		const linkText = linkMatch[1];
		const linkUrl = linkMatch[2];

		// Check if this is a commit hash (7+ character hex string)
		if (/^[a-f0-9]{7,}$/i.test(linkText)) {
			result.commitHash = linkText;
			result.commitUrl = linkUrl;
		}

		// Check if this is an issue number (starts with #)
		if (linkText.startsWith("#")) {
			result.issueNumber = linkText;
			result.issueUrl = linkUrl;
		}

		// Collect all URLs
		result.urls.push(linkUrl);
	}

	// Remove all markdown links from the text (replace [text](url) with just text, or remove entirely)
	result.text = result.text.replace(
		/ \(\[([^\]]+)\]\([^)]+\)\)/g,
		(match, linkText) => {
			// For commit hashes and issue numbers, remove them entirely (we'll add them back in formatBulletPoint)
			if (/^[a-f0-9]{7,}$/i.test(linkText) || linkText.startsWith("#")) {
				return "";
			}
			// For other links, keep just the link text
			return linkText;
		}
	);

	// Clean up extra spaces and trim
	result.text = result.text.replace(/\s+/g, " ").trim();

	return result;
}

/**
 * Parses version content to extract Features, Bug Fixes, and Breaking Changes.
 *
 * @param contentLines - All content lines for this version
 * @param sectionLines - All lines including header
 * @param version - Version number
 * @returns Parsed version data
 */
function parseVersionContent(
	contentLines: string[],
	sectionLines: string[],
	version: string
): ParsedVersion {
	const contentText = contentLines.join("\n");
	const sectionText = sectionLines.join("\n");

	const features: ParsedBulletPoint[] = [];
	const bugFixes: ParsedBulletPoint[] = [];
	const breakingChanges: ParsedBulletPoint[] = [];

	let currentSubsection: string | null = null;

	for (const line of contentLines) {
		// Check for subsection header
		const subsectionMatch = line.match(/^###\s+(.+)/);
		if (subsectionMatch) {
			const subsectionName = subsectionMatch[1].trim().toLowerCase();

			// Normalize subsection names
			if (subsectionName.includes("breaking") || subsectionName.includes("⚠")) {
				currentSubsection = "breaking";
			} else if (subsectionName.includes("feature")) {
				currentSubsection = "feature";
			} else if (
				subsectionName.includes("bug") ||
				subsectionName.includes("fix")
			) {
				currentSubsection = "bugfix";
			} else {
				currentSubsection = null;
			}
			continue;
		}

		// Check for bullet point
		const bulletMatch = line.match(/^\* (.+)/);
		if (bulletMatch && currentSubsection) {
			const bulletText = bulletMatch[1].trim();
			if (!bulletText) continue;

			const parsed = parseBulletPoint(bulletText);

			if (currentSubsection === "feature") {
				features.push(parsed);
			} else if (currentSubsection === "bugfix") {
				bugFixes.push(parsed);
			} else if (currentSubsection === "breaking") {
				breakingChanges.push(parsed);
			}
		}
	}

	return {
		version,
		content: contentText,
		fullSection: sectionText,
		features,
		bugFixes,
		breakingChanges,
	};
}

/**
 * Parses a changelog file and returns structured version sections.
 *
 * @param filePath - Path to the changelog file
 * @returns Array of parsed version sections
 */
function parseChangelog(filePath: string): ParsedVersion[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split(/\r?\n/);

	const versions: ParsedVersion[] = [];
	let currentVersion: string | null = null;
	let currentContent: string[] = [];
	let currentSection: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check if this is a version header (## [version] or ## version)
		const versionMatch = line.match(/^##\s+(?:\[([^\]]+)\]|([^\s(]+))/);

		if (versionMatch) {
			// Save previous version if exists
			if (currentVersion !== null) {
				const parsed = parseVersionContent(
					currentContent,
					currentSection,
					currentVersion
				);
				versions.push(parsed);
			}

			// Start new version
			const version = versionMatch[1] || versionMatch[2];
			currentVersion = version;
			currentContent = [];
			currentSection = [line];
		} else if (currentVersion !== null) {
			// Add line to current version's content
			currentContent.push(line);
			currentSection.push(line);
		}
	}

	// Don't forget the last version
	if (currentVersion !== null) {
		const parsed = parseVersionContent(
			currentContent,
			currentSection,
			currentVersion
		);
		versions.push(parsed);
	}

	return versions;
}

/**
 * Formats a parsed bullet point for display in the board message.
 *
 * @param bullet - Parsed bullet point
 * @returns Formatted string
 */
function formatBulletPoint(bullet: ParsedBulletPoint): string {
	let formatted = bullet.text;

	// Add prefix tag if present
	if (bullet.prefixTag) {
		formatted = `[${bullet.prefixTag}] ${formatted}`;
	}

	// Add commit hash if present (shortened to 7 chars)
	/**
	if (bullet.commitHash) {
		const shortHash = bullet.commitHash.substring(0, 7);
		formatted += ` (${shortHash})`;
	}

	// Add issue number if present
	if (bullet.issueNumber) {
		formatted += ` ${bullet.issueNumber}`;
	}
	*/

	return formatted;
}

/**
 * Formats a parsed version into a board message content string.
 *
 * @param version - Parsed version data
 * @returns Formatted content string
 */
function formatVersionContent(version: ParsedVersion): string[] {
	const lines: string[] = [];

	// Add breaking changes first (if any)
	if (version.breakingChanges.length > 0) {
		lines.push(color("BREAKING CHANGES:", COLOR.CRIMSON));
		for (const change of version.breakingChanges) {
			lines.push(...myformat(change, COLOR.MAROON, COLOR.CRIMSON));
		}
	}

	// Add features
	if (version.features.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Features:", COLOR.YELLOW));
		for (const feature of version.features) {
			lines.push(...myformat(feature, COLOR.OLIVE, COLOR.YELLOW));
		}
	}

	// Add bug fixes
	if (version.bugFixes.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Bug Fixes:", COLOR.LIME));
		for (const fix of version.bugFixes) {
			lines.push(...myformat(fix, COLOR.DARK_GREEN, COLOR.LIME));
		}
	}

	return lines;
}

function myformat(
	point: ParsedBulletPoint,
	bulletColor: COLOR,
	textColor: COLOR
): string[] {
	return string.wrap({
		string: `${color(" *", bulletColor)} ${color(
			formatBulletPoint(point),
			textColor
		)}`,
		width: 72,
		sizer: SIZER,
		prefix: "   ",
		color: (str) => color(str, textColor),
	});
}

/**
 * Parses the CHANGELOG.md file to extract all versions.
 *
 * @returns Array of parsed version entries, ordered from newest to oldest
 */
async function parseAllChangelogVersions(): Promise<ParsedVersion[]> {
	try {
		const versions = parseChangelog(CHANGELOG_PATH);
		if (versions.length === 0) {
			logger.warn("No version headers found in CHANGELOG.md");
			return [];
		}
		return versions;
	} catch (error) {
		logger.error(`Failed to parse CHANGELOG.md: ${error}`);
		return [];
	}
}

/**
 * Posts all unposted changelog entries to the changes board.
 * Posts versions from newest to oldest, stopping when it finds a version that's already posted.
 */
async function postChangelogToBoard(): Promise<void> {
	try {
		const versions = await parseAllChangelogVersions();
		if (versions.length === 0) {
			logger.warn("No changelog versions found");
			return;
		}

		const board = await loadBoard(CHANGES_BOARD_NAME);
		if (!board) {
			logger.error(`Changes board not found: ${CHANGES_BOARD_NAME}`);
			return;
		}

		// Get all existing version messages
		const existingMessages = board.getAllMessages();
		const postedVersions = new Set(
			existingMessages
				.filter((msg) => msg.author === SYSTEM_AUTHOR)
				.map((msg) => {
					const match = msg.subject.match(/^Version (.+)$/);
					return match ? match[1] : null;
				})
				.filter((v): v is string => v !== null)
		);

		// Post all unposted versions, starting from newest
		let postedCount = 0;
		for (const versionData of versions) {
			if (postedVersions.has(versionData.version)) {
				logger.info(`Version ${versionData.version} already posted, skipping`);
				continue;
			}

			const versionSubject = `Version ${versionData.version}`;
			// Format the version content using parsed data
			const formattedContent = formatVersionContent(versionData);
			// Normalize line endings: replace multiple consecutive line breaks with single \n
			const normalizedContent = formattedContent.join(LINEBREAK);
			// Create the message
			board.createMessage(SYSTEM_AUTHOR, versionSubject, normalizedContent);
			postedCount++;

			logger.info(
				`Posted changelog for version ${versionData.version} to changes board`
			);
		}

		if (postedCount > 0) {
			// Save the board after posting all new versions
			await saveBoard(board);
			logger.info(`Posted ${postedCount} new changelog version(s)`);
		} else {
			logger.info("All changelog versions are already posted");
		}
	} catch (error) {
		logger.error(`Failed to post changelog to board: ${error}`);
		throw error;
	}
}

// Run if executed directly
const scriptPath = fileURLToPath(import.meta.url);
const isMainModule =
	process.argv[1] === scriptPath ||
	process.argv[1]?.endsWith("post-changelog-to-board.js");

if (isMainModule) {
	postChangelogToBoard()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			logger.error(`Script failed: ${error}`);
			process.exit(1);
		});
}

export {
	postChangelogToBoard,
	parseAllChangelogVersions,
	parseChangelog,
	parseBulletPoint,
	formatVersionContent,
	type ParsedVersion,
	type ParsedBulletPoint,
};

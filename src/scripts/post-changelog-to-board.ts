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
import { execSync } from "child_process";
import { loadBoard, saveBoard } from "../package/board.js";
import logger from "../logger.js";
import { string } from "mud-ext";
import { COLOR, color, SIZER, TEXT_STYLE, textStyleToTag } from "../color.js";
import { LINEBREAK } from "../telnet.js";

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const CHANGES_BOARD_NAME = "changes";
const SYSTEM_AUTHOR = "SYSTEM";

/**
 * Parsed commit message body data.
 */
interface ParsedCommitBody {
	body: string;
	bulletPoints: ParsedBulletPoint[];
}

/**
 * Parsed bullet point data from a changelog entry.
 */
interface ParsedBulletPoint {
	text: string;
	prefixTag: string | null;
	commitType: string | null; // Conventional commit type (feat, fix, chore, etc.)
	commitHash: string | null;
	commitUrl: string | null;
	commitBody: ParsedCommitBody | null;
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
	miscellaneous: ParsedBulletPoint[];
}

/**
 * Fetches the full commit message body for a given commit hash.
 *
 * @param commitHash - The commit hash to fetch
 * @returns Parsed commit body or null if fetch fails
 */
function fetchCommitBody(commitHash: string): ParsedCommitBody | null {
	try {
		// Get the full commit message body (everything after the subject)
		const commitBody = execSync(`git show --format=%B -s ${commitHash}`, {
			encoding: "utf-8",
			cwd: process.cwd(),
		}).trim();

		if (!commitBody) {
			return null;
		}

		// Parse bullet points from the commit body
		// Treat every non-empty line as a bullet point (remove leading "- " if present)
		// Skip the first line (commit subject) as it's already in the changelog
		const lines = commitBody.split(/\r?\n/);
		const bulletPoints: ParsedBulletPoint[] = [];

		// Skip the first line (commit subject) - start from index 1
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			// Skip empty lines
			if (!trimmed) {
				continue;
			}

			// Remove leading "- " if present (for commits that follow the format)
			const bulletText = trimmed.replace(/^-\s+/, "").trim();

			// Parse each bullet point using the same logic as changelog entries
			const parsed = parseBulletPoint(bulletText);
			bulletPoints.push(parsed);
		}

		return {
			body: commitBody,
			bulletPoints,
		};
	} catch (error) {
		logger.warn(`Failed to fetch commit body for ${commitHash}: ${error}`);
		return null;
	}
}

/**
 * Parses a bullet point line to extract prefix tag, commit hash, URLs, and issue numbers.
 * Also fetches and parses the commit message body if a commit hash is found.
 *
 * @param bulletText - The bullet point text (without the leading `* `)
 * @returns Parsed bullet point data
 */
function parseBulletPoint(bulletText: string): ParsedBulletPoint {
	const result: ParsedBulletPoint = {
		text: bulletText,
		prefixTag: null,
		commitType: null,
		commitHash: null,
		commitUrl: null,
		commitBody: null,
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

	// Extract conventional commit type (e.g., feat:, fix:, chore:, etc.)
	// Common types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
	// Also supports breaking changes with ! (e.g., feat!:, fix!:)
	const commitTypeMatch = result.text.match(
		/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(!)?(\(.+?\))?:\s*(.+)$/i
	);
	if (commitTypeMatch) {
		const type = commitTypeMatch[1].toLowerCase();
		const isBreaking = !!commitTypeMatch[2]; // The ! indicator
		result.commitType = isBreaking ? `${type}!` : type;
		// Remove the commit type prefix from text (including optional scope and !)
		result.text = commitTypeMatch[4].trim();
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
			// Note: We no longer fetch commit body here - it's done at the version level
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
 * Categorizes a bullet point based on its commit type.
 *
 * @param bullet - Parsed bullet point
 * @returns Category name: "feature", "bugfix", "breaking", "misc", or null
 */
function categorizeBulletPoint(
	bullet: ParsedBulletPoint
): "feature" | "bugfix" | "breaking" | "misc" | null {
	if (!bullet.commitType) {
		return null;
	}

	const type = bullet.commitType.toLowerCase();

	// Check for breaking changes (indicated by ! in conventional commits, e.g., feat!:, fix!:)
	if (type.includes("!") || bullet.text.toLowerCase().includes("breaking")) {
		return "breaking";
	}

	// Map commit types to categories
	switch (type) {
		case "feat":
			return "feature";
		case "fix":
			return "bugfix";
		default:
			// Other types (docs, style, refactor, perf, test, build, ci, chore, revert)
			// go to miscellaneous
			return "misc";
	}
}

/**
 * Extracts all commit hashes from a version section.
 *
 * @param contentLines - All content lines for this version
 * @returns Set of commit hashes found in the version
 */
function extractCommitHashes(contentLines: string[]): Set<string> {
	const commitHashes = new Set<string>();
	const commitHashPattern = /\[([a-f0-9]{7,})\]/gi;

	for (const line of contentLines) {
		let match: RegExpExecArray | null;
		while ((match = commitHashPattern.exec(line)) !== null) {
			commitHashes.add(match[1]);
		}
	}

	return commitHashes;
}

/**
 * Parses version content by extracting all commit hashes, fetching their bodies,
 * and compiling all bullet points into categorized lists.
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
	const miscellaneous: ParsedBulletPoint[] = [];

	// Extract all commit hashes from the version section
	const commitHashes = extractCommitHashes(contentLines);
	logger.debug(
		`Found ${
			commitHashes.size
		} commit hash(es) in version ${version}: ${Array.from(commitHashes).join(
			", "
		)}`
	);

	// Fetch and parse all commit bodies
	for (const commitHash of commitHashes) {
		const commitBody = fetchCommitBody(commitHash);
		if (!commitBody) {
			continue;
		}

		// Parse all bullet points from this commit body
		for (const bodyBullet of commitBody.bulletPoints) {
			const category = categorizeBulletPoint(bodyBullet);
			if (category === "feature") {
				features.push(bodyBullet);
			} else if (category === "bugfix") {
				bugFixes.push(bodyBullet);
			} else if (category === "breaking") {
				breakingChanges.push(bodyBullet);
			} else {
				// If category is null or "misc", add to miscellaneous
				// (null means no commit type prefix, which should go to misc)
				miscellaneous.push(bodyBullet);
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
		miscellaneous,
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
 * Replaces non-ASCII characters with a pound symbol.
 *
 * @param text - Text to sanitize
 * @returns Text with non-ASCII characters replaced with #
 */
function replaceNonAscii(text: string): string {
	return text.replace(/[^\x00-\x7F]/g, "#");
}

/**
 * Formats a parsed bullet point for display in the board message.
 *
 * @param bullet - Parsed bullet point
 * @returns Formatted string
 */
function formatBulletPoint(bullet: ParsedBulletPoint): string {
	let formatted = replaceNonAscii(bullet.text);

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

	// Add miscellaneous
	if (version.miscellaneous.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Miscellaneous:", COLOR.CYAN));
		for (const misc of version.miscellaneous) {
			lines.push(...myformat(misc, COLOR.LIGHT_BLUE, COLOR.CYAN));
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
	fetchCommitBody,
	formatVersionContent,
	type ParsedVersion,
	type ParsedBulletPoint,
	type ParsedCommitBody,
};

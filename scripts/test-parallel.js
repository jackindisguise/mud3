#!/usr/bin/env node

/**
 * Parallel test runner that runs all test files asynchronously.
 * Prints simple messages as tests complete.
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { spawn, exec } from "child_process";
import boxen from "boxen";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

/**
 * Recursively find all test files in a directory
 */
async function findTestFiles(dir, pattern = /\.spec\.(ts|js)$/) {
	const files = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				// Skip node_modules and dist directories
				if (
					entry.name !== "node_modules" &&
					entry.name !== "dist" &&
					entry.name !== ".git"
				) {
					files.push(...(await findTestFiles(fullPath, pattern)));
				}
			} else if (pattern.test(entry.name)) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Ignore errors (e.g., permission denied)
	}
	return files;
}

/**
 * Parse test output to count individual test cases and extract failure info
 */
function parseTestCount(output) {
	// Node.js test output format includes summary lines like:
	// ℹ tests 1
	// ℹ pass 0
	// ℹ fail 1
	const lines = output.split("\n");
	let passed = 0;
	let failed = 0;
	let total = 0;
	const failedTests = [];

	let cancelled = 0;
	let skipped = 0;
	let todo = 0;

	// Look for the last occurrence of summary stats (they appear at the end)
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];

		// Look for summary lines with ℹ prefix
		if (line.includes("ℹ")) {
			// Extract test counts - these can be in different formats
			const testsMatch = line.match(/ℹ\s+tests\s+(\d+)/i);
			const passMatch = line.match(/ℹ\s+pass\s+(\d+)/i);
			const failMatch = line.match(/ℹ\s+fail\s+(\d+)/i);
			const cancelledMatch = line.match(/ℹ\s+cancelled\s+(\d+)/i);
			const skippedMatch = line.match(/ℹ\s+skipped\s+(\d+)/i);
			const todoMatch = line.match(/ℹ\s+todo\s+(\d+)/i);

			if (testsMatch && total === 0) {
				total = parseInt(testsMatch[1], 10);
			}
			if (passMatch && passed === 0) {
				passed = parseInt(passMatch[1], 10);
			}
			if (failMatch && failed === 0) {
				failed = parseInt(failMatch[1], 10);
			}
			if (cancelledMatch && cancelled === 0) {
				cancelled = parseInt(cancelledMatch[1], 10);
			}
			if (skippedMatch && skipped === 0) {
				skipped = parseInt(skippedMatch[1], 10);
			}
			if (todoMatch && todo === 0) {
				todo = parseInt(todoMatch[1], 10);
			}
		}
	}

	// Extract failed test names with file/line/column info
	// Pattern in Node.js test output:
	//   test at dist\src\act.spec.js:81:9
	//   ✖ should send user message to user (2.0482ms)
	//     Error: Not implemented
	//         at TestContext.<anonymous> (file:///.../dist/src/act.spec.js:82:19)

	let inFailingTests = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Look for "failing tests:" header
		if (line.includes("✖ failing tests:") || line.includes("failing tests:")) {
			inFailingTests = true;
			continue;
		}

		// Look for "test at file:line:col" pattern
		if (line.includes("test at")) {
			const testAtMatch = line.match(/test at (.+?):(\d+):(\d+)/);
			if (testAtMatch) {
				const filePath = testAtMatch[1];
				// Look for the test name on the next line (✖ test name)
				let testName = "";
				let errorLocation = "";

				// Check next few lines for test name and error location
				for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
					const nextLine = lines[j];

					// Extract test name from "✖ test name (duration)"
					if (!testName && nextLine.match(/^\s*✖\s+/)) {
						const nameMatch = nextLine.match(/^\s*✖\s+(.+?)\s+\(/);
						if (nameMatch) {
							testName = nameMatch[1].trim();
						}
					}

					// Extract error location from stack trace
					// Pattern for compiled JS: at TestContext.<anonymous> (file:///C:/Users/.../dist/src/act.spec.js:82:19)
					// Pattern for TS with tsx: at TestContext.<anonymous> (C:\Users\...\src\act.spec.ts:112:10)
					if (
						!errorLocation &&
						nextLine.includes("at ") &&
						(nextLine.includes(".spec.") ||
							nextLine.includes(".ts") ||
							nextLine.includes(".js"))
					) {
						// Try to match file:/// protocol first (compiled JS format)
						let locationMatch = nextLine.match(
							/\(file:\/\/\/[^)]+[\/\\](.+?\.spec\.(?:js|ts)):(\d+):(\d+)\)/
						);

						// If that doesn't work, try direct path format (tsx format): (C:\Users\...\src\act.spec.ts:112:10)
						if (!locationMatch) {
							locationMatch = nextLine.match(
								/\(([^)]+\.spec\.(?:js|ts)):(\d+):(\d+)\)/
							);
						}

						if (locationMatch) {
							// Extract the file path and normalize it
							let filePath = locationMatch[1];
							const line = locationMatch[2];
							const col = locationMatch[3];

							// Normalize path separators
							filePath = filePath.replace(/\\/g, "/");

							// Extract relative path from project root
							// Match patterns like: .../mud-command2/src/... or .../mud-command2/dist/src/...
							// Or just src/... or dist/src/... if already relative
							if (
								filePath.includes("/src/") ||
								filePath.includes("/dist/src/")
							) {
								// Extract the part after src/ or dist/src/
								const srcMatch = filePath.match(/(?:dist\/)?src\/(.+)$/);
								if (srcMatch) {
									filePath = `src/${srcMatch[1]}`;
								} else {
									// Try to extract from absolute path
									const absMatch = filePath.match(
										/[\/\\]([^\/\\]+[\/\\](?:dist[\/\\])?src[\/\\].+)$/
									);
									if (absMatch) {
										filePath = absMatch[1].replace(/\\/g, "/");
									}
								}
							}

							errorLocation = `${filePath}:${line}:${col}`;
							break; // Found both, we're done
						}
					}

					// Stop if we hit another test or summary
					if (
						nextLine.includes("test at") ||
						nextLine.includes("ℹ") ||
						nextLine.match(/^\s*✖\s+.*\.spec\./)
					) {
						break;
					}
				}

				// Format the failure info
				if (testName) {
					if (errorLocation) {
						failedTests.push(`${testName} - ${errorLocation}`);
					} else {
						// Fallback to test at location
						failedTests.push(
							`${testName} - ${filePath}:${testAtMatch[2]}:${testAtMatch[3]}`
						);
					}
				} else {
					// No test name found, just use location
					failedTests.push(`${filePath}:${testAtMatch[2]}:${testAtMatch[3]}`);
				}
			}
		}

		if (inFailingTests) {
			// Stop when we hit the summary section or file header
			if (line.includes("ℹ") || line.match(/^\s*✖\s+.*\.spec\./)) {
				break;
			}
		}
	}

	// Fallback: count individual test result lines if we didn't get summary
	if (total === 0) {
		for (const line of lines) {
			// Look for passing tests (✓ or checkmark)
			if (line.match(/^\s*[✓√]\s+/)) {
				passed++;
			}
			// Look for failing tests (✗ or X)
			else if (line.match(/^\s*[✗×X]\s+/)) {
				failed++;
			}
		}
		total = passed + failed;
	}

	return { passed, failed, total, failedTests, cancelled, skipped, todo };
}

/**
 * Run a single test file and return the result
 */
function runTestFile(filePath, useTypeScript = false) {
	return new Promise((resolve) => {
		const relativePath = filePath
			.replace(projectRoot + "\\", "")
			.replace(projectRoot + "/", "");

		let command, args;
		if (useTypeScript) {
			command = "node";
			args = [
				"--import",
				"tsx/esm",
				"--test",
				"--test-reporter=spec",
				filePath,
			];
		} else {
			command = "node";
			args = ["--test", "--test-reporter=spec", filePath];
		}

		const testProcess = spawn(command, args, {
			stdio: "pipe",
			shell: true,
			cwd: projectRoot,
		});

		let stdout = "";
		let stderr = "";

		testProcess.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		testProcess.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		testProcess.on("exit", (code) => {
			// Parse test counts from both stdout and stderr (Node.js test output can go to either)
			const testCount = parseTestCount(stdout + "\n" + stderr);
			resolve({
				file: relativePath,
				success: code === 0,
				exitCode: code,
				stdout,
				stderr,
				testCount,
			});
		});
	});
}

/**
 * Format a file path for display (truncate if too long)
 */
function formatFilePath(path, maxLength = 50) {
	if (path.length <= maxLength) return path;
	const parts = path.split("/");
	if (parts.length <= 2) return path;
	// Show last 2 parts
	return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

/**
 * Format elapsed time in 00h00m00s format
 * Only shows units that are >= 1
 */
function formatTime(ms) {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h${minutes.toString().padStart(2, "0")}m${seconds
			.toString()
			.padStart(2, "0")}s`;
	} else if (minutes > 0) {
		return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
	} else {
		return `${seconds}s`;
	}
}

/**
 * Play a system sound notification
 */
function playSound(success = true) {
	// System beep (works on most systems)
	process.stdout.write("\x07");

	// Try to play a system sound (platform-specific)
	if (process.platform === "win32") {
		exec(`powershell -c "[console]::beep(800,200)"`, (error) => {
			// Ignore errors - beep is optional
		});
	} else if (process.platform === "darwin") {
		const sound = success
			? "/System/Library/Sounds/Glass.aiff"
			: "/System/Library/Sounds/Basso.aiff";
		exec(`afplay "${sound}"`, (error) => {
			// Ignore errors - sound is optional
		});
	} else {
		exec("beep", (error) => {
			// Ignore errors - beep is optional
		});
	}
}

/**
 * Main function
 */
async function main() {
	// Check if we should use TypeScript files or compiled JavaScript
	const useTypeScript =
		process.argv.includes("--ts") || process.argv.includes("-t");
	const sourceDir = useTypeScript
		? join(projectRoot, "src")
		: join(projectRoot, "dist", "src");

	if (useTypeScript && !existsSync(join(projectRoot, "node_modules", "tsx"))) {
		console.error(
			"Error: tsx is required to run TypeScript tests. Install it with: npm install --save-dev tsx"
		);
		process.exit(1);
	}

	// Find test files
	process.stdout.write(chalk.blue("Finding test files... "));
	const testFiles = await findTestFiles(sourceDir);
	process.stdout.write(
		chalk.green(`Found ${testFiles.length} test file(s)\n\n`)
	);

	if (testFiles.length === 0) {
		console.error(chalk.red(`No test files found in ${sourceDir}`));
		process.exit(1);
	}

	// Print initial message (we'll update with test count after parsing)
	console.log(
		chalk.blue(`Running ${testFiles.length} test file(s) in parallel...\n`)
	);

	// Track results and timing
	const results = [];
	const parallelStartTime = Date.now();

	// Run all tests in parallel
	const testPromises = testFiles.map(async (file) => {
		const relativePath = file
			.replace(projectRoot + "\\", "")
			.replace(projectRoot + "/", "");
		const startTime = Date.now();

		try {
			// Run the test
			const result = await runTestFile(file, useTypeScript);
			const elapsed = Date.now() - startTime;
			const elapsedStr = formatTime(elapsed);

			// Add duration to result
			result.duration = elapsed;

			// Print result message
			if (result.success) {
				console.log(
					chalk.green(`✓ ${relativePath}`) + chalk.gray(` (${elapsedStr})`)
				);
			} else {
				console.log(
					chalk.red(`✗ ${relativePath}`) + chalk.gray(` (${elapsedStr})`)
				);
			}

			return result;
		} catch (error) {
			const elapsed = Date.now() - startTime;
			const elapsedStr = formatTime(elapsed);
			const result = {
				file: relativePath,
				success: false,
				exitCode: -1,
				stdout: "",
				stderr: String(error),
				duration: elapsed,
			};

			console.log(
				chalk.red(`✗ ${relativePath}`) + chalk.gray(` (${elapsedStr}) - error`)
			);

			return result;
		}
	});

	// Wait for all tests to complete
	const testResults = await Promise.all(testPromises);
	results.push(...testResults);

	const parallelEndTime = Date.now();
	const parallelDuration = parallelEndTime - parallelStartTime;

	// Print blank line before summary
	console.log();

	// Calculate statistics
	const passedFiles = results.filter((r) => r.success).length;
	const failedFiles = results.filter((r) => !r.success).length;

	// Count individual tests
	let totalTests = 0;
	let passedTests = 0;
	let failedTests = 0;
	let cancelledTests = 0;
	let skippedTests = 0;
	let todoTests = 0;

	// Calculate sequential time (sum of all individual test durations)
	let sequentialTime = 0;

	for (const result of results) {
		if (result.testCount) {
			totalTests += result.testCount.total;
			passedTests += result.testCount.passed;
			failedTests += result.testCount.failed;
			cancelledTests += result.testCount.cancelled || 0;
			skippedTests += result.testCount.skipped || 0;
			todoTests += result.testCount.todo || 0;
		}
		if (result.duration) {
			sequentialTime += result.duration;
		}
	}

	// Calculate time saved
	const timeSaved = sequentialTime - parallelDuration;
	const timeSavedPercent =
		sequentialTime > 0
			? ((timeSaved / sequentialTime) * 100).toFixed(1)
			: "0.0";

	// Calculate effective total (excluding skipped and todo tests for success rate)
	const effectiveTotal = totalTests - skippedTests - todoTests;

	// Build summary content
	let summaryContent =
		chalk.bold("Test Results Summary\n\n") +
		chalk.white(`Test Files: ${chalk.bold(testFiles.length)}\n`) +
		chalk.white(`Total Tests: ${chalk.bold(totalTests)}\n`) +
		chalk.green(`✓ Passed: ${chalk.bold(passedTests)}\n`) +
		chalk.red(`✗ Failed: ${chalk.bold(failedTests)}\n`);

	// Add cancelled, skipped, and todo if non-zero
	if (cancelledTests > 0) {
		summaryContent += chalk.yellow(
			`⊘ Cancelled: ${chalk.bold(cancelledTests)}\n`
		);
	}
	if (skippedTests > 0) {
		summaryContent += chalk.blue(`⊘ Skipped: ${chalk.bold(skippedTests)}\n`);
	}
	if (todoTests > 0) {
		summaryContent += chalk.magenta(`⊘ Todo: ${chalk.bold(todoTests)}\n`);
	}

	summaryContent +=
		chalk.gray(
			`\n${chalk.bold("Success Rate:")} ${
				effectiveTotal > 0
					? ((passedTests / effectiveTotal) * 100).toFixed(1)
					: "0.0"
			}%`
		) +
		chalk.cyan(
			`\n\n${chalk.bold("Timing:")}\n` +
				`Sequential: ${chalk.bold(formatTime(sequentialTime))}\n` +
				`Parallel: ${chalk.bold(formatTime(parallelDuration))}\n` +
				`Time Saved: ${chalk.bold.green(
					formatTime(timeSaved)
				)} (${timeSavedPercent}%)`
		);

	const summaryBox = boxen(summaryContent, {
		title: chalk.bold(
			failedTests === 0 ? "✓ All Tests Passed!" : "✗ Some Tests Failed"
		),
		titleAlignment: "center",
		padding: 1,
		margin: { top: 1, bottom: 1 },
		borderStyle: "round",
		borderColor: failedTests === 0 ? "green" : "red",
	});

	console.log(summaryBox);

	// Show failed tests if any
	if (failedFiles > 0) {
		const failedTestFiles = results.filter((r) => !r.success);
		const failedContent =
			chalk.bold.red("Failed Test Files:\n\n") +
			failedTestFiles
				.map((r, idx) => {
					const status = chalk.red("✗");
					const testInfo = r.testCount
						? chalk.gray(
								` (${r.testCount.failed}/${r.testCount.total} tests failed)`
						  )
						: chalk.gray(` (exit code: ${r.exitCode})`);

					// Add failed test names if available
					let failedTestNames = "";
					if (
						r.testCount &&
						r.testCount.failedTests &&
						r.testCount.failedTests.length > 0
					) {
						const testNames = r.testCount.failedTests.slice(0, 3); // Show first 3 failures
						failedTestNames = "\n    " + chalk.red(testNames.join("\n    "));
						if (r.testCount.failedTests.length > 3) {
							failedTestNames += chalk.gray(
								`\n    ... and ${r.testCount.failedTests.length - 3} more`
							);
						}
					}

					return `${status} ${chalk.white(
						r.file
					)}${testInfo}${failedTestNames}`;
				})
				.join("\n\n");

		const failedBox = boxen(failedContent, {
			title: chalk.bold.red("Failed Tests"),
			titleAlignment: "center",
			padding: 1,
			margin: { top: 1, bottom: 1 },
			borderStyle: "round",
			borderColor: "red",
		});

		console.log(failedBox);

		// Show error output for first few failures
		const maxErrors = 3;
		for (let i = 0; i < Math.min(failedTestFiles.length, maxErrors); i++) {
			const result = failedTestFiles[i];
			if (result.stderr) {
				const errorContent = chalk.red(result.stderr.trim().slice(0, 500)); // Limit length
				const errorBox = boxen(errorContent, {
					title: chalk.bold.red(`Error: ${formatFilePath(result.file)}`),
					titleAlignment: "left",
					padding: 1,
					margin: { top: 1, bottom: 1 },
					borderStyle: "round",
					borderColor: "red",
				});
				console.log(errorBox);
			}
		}

		if (failedTestFiles.length > maxErrors) {
			console.log(
				chalk.yellow(
					`\n... and ${
						failedTestFiles.length - maxErrors
					} more failed test file(s)`
				)
			);
		}

		// Play failure sound
		playSound(false);
		process.exit(1);
	} else {
		console.log(chalk.green.bold("\n🎉 All tests passed successfully! 🎉\n"));
		// Play success sound
		playSound(true);
		process.exit(0);
	}
}

main().catch((error) => {
	console.error(chalk.red("Error running tests:"), error);
	process.exit(1);
});

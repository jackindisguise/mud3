import { suite, test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { hostname } from "os";
import lockfilePackage, {
	createLock,
	removeLock,
	checkLock,
	isProcessRunning,
	LOCKFILE_PATH,
	LockInfo,
} from "./lockfile.js";

suite("package/lockfile.ts", () => {
	beforeEach(async () => {
		// Clean up any existing lockfile before each test
		if (existsSync(LOCKFILE_PATH)) {
			await unlink(LOCKFILE_PATH);
		}
	});

	after(async () => {
		// Clean up lockfile after all tests
		if (existsSync(LOCKFILE_PATH)) {
			await unlink(LOCKFILE_PATH);
		}
	});

	suite("isProcessRunning", () => {
		test("should return true for current process", () => {
			const result = isProcessRunning(process.pid);
			assert.strictEqual(result, true);
		});

		test("should return false for non-existent process", () => {
			// Use a very high PID that is unlikely to exist
			const fakePid = 9999999;
			const result = isProcessRunning(fakePid);
			assert.strictEqual(result, false);
		});

		test("should return true for PID 1 (init/system process)", function (t) {
			// Skip on Windows where PID 1 doesn't exist
			if (process.platform === "win32") {
				t.skip("win32 doesn't have PID 1");
				return;
			}
			const result = isProcessRunning(1);
			assert.strictEqual(result, true);
		});
	});

	suite("createLock and removeLock", () => {
		test("should create lockfile with correct structure", async () => {
			await createLock();

			assert.ok(existsSync(LOCKFILE_PATH), "Lockfile should exist");

			const content = await readFile(LOCKFILE_PATH, "utf-8");
			const lockInfo: LockInfo = JSON.parse(content);

			assert.strictEqual(lockInfo.pid, process.pid);
			assert.ok(lockInfo.startTime);
			assert.ok(lockInfo.hostname);
			assert.ok(new Date(lockInfo.startTime).getTime() > 0);

			await removeLock();
		});

		test("should remove lockfile when removeLock is called", async () => {
			await createLock();
			assert.ok(existsSync(LOCKFILE_PATH));

			await removeLock();
			assert.ok(!existsSync(LOCKFILE_PATH), "Lockfile should be removed");
		});

		test("removeLock should not throw if lockfile doesn't exist", async () => {
			await assert.doesNotReject(async () => {
				await removeLock();
			});
		});
	});

	suite("checkLock", () => {
		test("should return false when no lockfile exists", async () => {
			const result = await checkLock();
			assert.strictEqual(result, false);
		});

		test("should return true when valid lockfile exists", async () => {
			await createLock();

			const result = await checkLock();
			assert.strictEqual(result, true);

			await removeLock();
		});

		test("should remove stale lockfile and return false", async () => {
			// Create a lockfile with a non-existent PID
			const staleLockInfo: LockInfo = {
				pid: 9999999, // Very unlikely to exist
				startTime: new Date().toISOString(),
				hostname: hostname(),
			};
			await writeFile(
				LOCKFILE_PATH,
				JSON.stringify(staleLockInfo, null, 2),
				"utf-8"
			);

			const result = await checkLock();
			assert.strictEqual(result, false, "Should return false for stale lock");
			assert.strictEqual(
				existsSync(LOCKFILE_PATH),
				false,
				"Stale lockfile should be removed"
			);
		});

		test("should handle corrupted lockfile gracefully", async () => {
			// Create a corrupted lockfile
			await writeFile(LOCKFILE_PATH, "invalid json {[", "utf-8");

			const result = await checkLock();
			assert.strictEqual(
				result,
				false,
				"Should return false for corrupted lock"
			);
			assert.strictEqual(
				existsSync(LOCKFILE_PATH),
				false,
				"Corrupted lockfile should be removed"
			);
		});
	});

	suite("Package Loader", () => {
		test("loader should have correct package name", () => {
			assert.strictEqual(lockfilePackage.name, "lockfile");
		});

		test("loader should create lockfile on load", async () => {
			await lockfilePackage.loader();

			assert.ok(existsSync(LOCKFILE_PATH), "Loader should create lockfile");

			const content = await readFile(LOCKFILE_PATH, "utf-8");
			const lockInfo: LockInfo = JSON.parse(content);
			assert.strictEqual(lockInfo.pid, process.pid);

			await removeLock();
		});

		test("loader should exit if another instance is running", async () => {
			// Create a lockfile for current process
			await createLock();

			// Mock process.exit to prevent actual exit
			const originalExit = process.exit;
			let exitCode: number | undefined;
			process.exit = ((code?: number) => {
				exitCode = code;
				throw new Error("EXIT_CALLED");
			}) as any;

			try {
				await assert.rejects(
					async () => {
						await lockfilePackage.loader();
					},
					{ message: "EXIT_CALLED" }
				);
				assert.strictEqual(exitCode, 1, "Should exit with code 1");
			} finally {
				// Restore original exit
				process.exit = originalExit;
				await removeLock();
			}
		});

		test("loader should succeed if stale lockfile exists", async () => {
			// Create a stale lockfile
			const staleLockInfo: LockInfo = {
				pid: 9999999,
				startTime: new Date().toISOString(),
				hostname: hostname(),
			};
			await writeFile(
				LOCKFILE_PATH,
				JSON.stringify(staleLockInfo, null, 2),
				"utf-8"
			);

			// Should not throw
			await assert.doesNotReject(async () => {
				await lockfilePackage.loader();
			});

			// Should create new lockfile with current PID
			assert.ok(existsSync(LOCKFILE_PATH));
			const content = await readFile(LOCKFILE_PATH, "utf-8");
			const lockInfo: LockInfo = JSON.parse(content);
			assert.strictEqual(lockInfo.pid, process.pid);

			await removeLock();
		});
	});
});

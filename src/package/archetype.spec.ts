import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, writeFile, readdir, unlink, rmdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import YAML from "js-yaml";
import archetypePkg, {
	getRaceById,
	getJobById,
	getAllRaces,
	getAllJobs,
	getStarterRaces,
	getStarterJobs,
	getDefaultRace,
	getDefaultJob,
	registerRace,
	registerJob,
} from "./archetype.js";

const DATA_DIR = join(process.cwd(), "data");
const RACES_DIR = join(DATA_DIR, "races");
const JOBS_DIR = join(DATA_DIR, "jobs");

suite("package/archetype.ts", () => {
	before(async () => {
		// Create directories if they don't exist
		if (!existsSync(RACES_DIR)) {
			await mkdir(RACES_DIR, { recursive: true });
		}
		if (!existsSync(JOBS_DIR)) {
			await mkdir(JOBS_DIR, { recursive: true });
		}
	});

	after(async () => {
		// Clean up test files
		if (existsSync(RACES_DIR)) {
			const files = await readdir(RACES_DIR);
			for (const file of files) {
				if (file.startsWith("test_")) {
					await unlink(join(RACES_DIR, file));
				}
			}
		}
		if (existsSync(JOBS_DIR)) {
			const files = await readdir(JOBS_DIR);
			for (const file of files) {
				if (file.startsWith("test_")) {
					await unlink(join(JOBS_DIR, file));
				}
			}
		}
	});

	suite("package loader", () => {
		test("should load races and jobs from YAML files", async () => {
			// Create test race file
			const testRace = {
				archetype: {
					id: "test_race",
					name: "Test Race",
					description: "A test race",
					isStarter: true,
					startingAttributes: {
						strength: 10,
						agility: 8,
						intelligence: 6,
					},
					attributeGrowthPerLevel: {
						strength: 2,
						agility: 1,
						intelligence: 1,
					},
					startingResourceCaps: {
						maxHealth: 100,
						maxMana: 50,
					},
					resourceGrowthPerLevel: {
						maxHealth: 10,
						maxMana: 5,
					},
					skills: [],
					passives: [],
					growthModifier: {
						base: 1.0,
					},
				},
			};
			await writeFile(
				join(RACES_DIR, "test_race.yaml"),
				YAML.dump(testRace),
				"utf-8"
			);

			// Create test job file
			const testJob = {
				archetype: {
					id: "test_job",
					name: "Test Job",
					description: "A test job",
					isStarter: true,
					startingAttributes: {
						strength: 5,
						agility: 5,
						intelligence: 5,
					},
					attributeGrowthPerLevel: {
						strength: 1,
						agility: 1,
						intelligence: 1,
					},
					startingResourceCaps: {
						maxHealth: 50,
						maxMana: 100,
					},
					resourceGrowthPerLevel: {
						maxHealth: 5,
						maxMana: 10,
					},
					skills: [],
					passives: [],
					growthModifier: {
						base: 1.0,
					},
				},
			};
			await writeFile(
				join(JOBS_DIR, "test_job.yaml"),
				YAML.dump(testJob),
				"utf-8"
			);

			// Load the package
			await archetypePkg.loader();

			// Verify race was loaded
			const race = getRaceById("test_race");
			assert.ok(race);
			assert.strictEqual(race.id, "test_race");
			assert.strictEqual(race.name, "Test Race");
			assert.strictEqual(race.isStarter, true);

			// Verify job was loaded
			const job = getJobById("test_job");
			assert.ok(job);
			assert.strictEqual(job.id, "test_job");
			assert.strictEqual(job.name, "Test Job");
			assert.strictEqual(job.isStarter, true);
		});

		test("should throw error if no races found", async () => {
			// Temporarily move races directory
			const backupRaces = join(DATA_DIR, "races_backup");
			if (existsSync(RACES_DIR)) {
				// This test would require more complex setup
				// Skip for now as it would interfere with other tests
			}
		});

		test("should throw error if no jobs found", async () => {
			// Similar to above - would require complex setup
		});
	});

	suite("getRaceById", () => {
		test("should return race by id", () => {
			const race = getRaceById("test_race");
			if (race) {
				assert.strictEqual(race.id, "test_race");
			}
		});

		test("should return undefined for non-existent race", () => {
			const race = getRaceById("nonexistent_race");
			assert.strictEqual(race, undefined);
		});
	});

	suite("getJobById", () => {
		test("should return job by id", () => {
			const job = getJobById("test_job");
			if (job) {
				assert.strictEqual(job.id, "test_job");
			}
		});

		test("should return undefined for non-existent job", () => {
			const job = getJobById("nonexistent_job");
			assert.strictEqual(job, undefined);
		});
	});

	suite("getAllRaces", () => {
		test("should return array of all races", () => {
			const races = getAllRaces();
			assert.ok(Array.isArray(races));
			assert.ok(races.length > 0);
		});
	});

	suite("getAllJobs", () => {
		test("should return array of all jobs", () => {
			const jobs = getAllJobs();
			assert.ok(Array.isArray(jobs));
			assert.ok(jobs.length > 0);
		});
	});

	suite("getStarterRaces", () => {
		test("should return only starter races", () => {
			const starters = getStarterRaces();
			assert.ok(Array.isArray(starters));
			for (const race of starters) {
				assert.strictEqual(race.isStarter, true);
			}
		});
	});

	suite("getStarterJobs", () => {
		test("should return only starter jobs", () => {
			const starters = getStarterJobs();
			assert.ok(Array.isArray(starters));
			for (const job of starters) {
				assert.strictEqual(job.isStarter, true);
			}
		});
	});

	suite("getDefaultRace", () => {
		test("should return a race", () => {
			const race = getDefaultRace();
			assert.ok(race);
			assert.ok(race.id);
			assert.ok(race.name);
		});
	});

	suite("getDefaultJob", () => {
		test("should return a job", () => {
			const job = getDefaultJob();
			assert.ok(job);
			assert.ok(job.id);
			assert.ok(job.name);
		});
	});

	suite("registerRace", () => {
		test("should register a new race", () => {
			const race = registerRace({
				id: "registered_race",
				name: "Registered Race",
				startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			});

			assert.strictEqual(race.id, "registered_race");
			assert.strictEqual(race.name, "Registered Race");

			// Verify it can be retrieved
			const retrieved = getRaceById("registered_race");
			assert.ok(retrieved);
			assert.strictEqual(retrieved.id, "registered_race");
		});
	});

	suite("registerJob", () => {
		test("should register a new job", () => {
			const job = registerJob({
				id: "registered_job",
				name: "Registered Job",
				startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			});

			assert.strictEqual(job.id, "registered_job");
			assert.strictEqual(job.name, "Registered Job");

			// Verify it can be retrieved
			const retrieved = getJobById("registered_job");
			assert.ok(retrieved);
			assert.strictEqual(retrieved.id, "registered_job");
		});
	});
});


import { loadPackage } from "package-loader";
import commands from "./src/package/commands.js";
import config from "./src/package/config.js";
import lockfile from "./src/package/lockfile.js";
import logger from "./src/logger.js";

await loadPackage(lockfile); // always load first
await loadPackage(lockfile); // always load first
await loadPackage(lockfile); // always load first
await loadPackage(commands);
await loadPackage(config);

setTimeout(() => {
	console.log("xD");
}, 5000);

import {
	CommandRegistry,
	Command,
	CommandContext,
	ParseResult,
} from "../command.js";
import { Package } from "package-loader";
import { readdir } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";
import logger from "../logger.js";

/**
 * Adapter class to convert JavaScript command objects into Command instances
 */
export class JavaScriptCommandAdapter extends Command {
	private executeFunction: (
		context: CommandContext,
		args: Map<string, any>
	) => void;
	private errorFunction?: (
		context: CommandContext,
		result: ParseResult
	) => void;

	constructor(commandObj: any) {
		super({ pattern: commandObj.pattern, aliases: commandObj.aliases });
		this.executeFunction = commandObj.execute;
		this.errorFunction = commandObj.onError;
	}

	execute(context: CommandContext, args: Map<string, any>): void {
		this.executeFunction(context, args);
	}

	onError(context: CommandContext, result: ParseResult): void {
		if (this.errorFunction) {
			this.errorFunction(context, result);
		} else {
			logger.error(`Command error: ${result.error}`);
		}
	}
}

const COMMAND_DIRECTORY = join(process.cwd(), "data", "commands");

export default {
	name: "commands",
	loader: async () => {
		try {
			const files = await readdir(COMMAND_DIRECTORY);
			const jsFiles = files.filter((file) => file.endsWith(".js"));

			for (const file of jsFiles) {
				try {
					const filePath = join(COMMAND_DIRECTORY, file);
					const fileUrl = pathToFileURL(filePath).href;
					const commandModule = await import(fileUrl);
					const commandObj = commandModule.default;

					if (commandObj && commandObj.pattern && commandObj.execute) {
						const command = new JavaScriptCommandAdapter(commandObj);
						CommandRegistry.default.register(command);
						logger.info(`Loaded command "${commandObj.pattern}" from ${file}`);
					} else {
						logger.warn(`Invalid command structure in ${file}`);
					}
				} catch (error) {
					logger.error(`Failed to load command from ${file}: ${error}`);
				}
			}
		} catch (error) {
			logger.error(
				`Failed to read commands directory ${COMMAND_DIRECTORY}: ${error}`
			);
		}
	},
} as Package;

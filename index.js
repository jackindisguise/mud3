import { string } from "mud-ext";
const poem = string.wrap(
	"When night folds soft around the light, and clocks forget their ticking, a thought drifts loose, half-dream, half-sight, through corners where stars are flicking. It hums of things we’ll never keep, of laughter, loss, and weather, then settles in the arms of sleep— and pulls the dawn together.",
	34
);
const a1 = string.box({
	input: poem,
	width: 38,
	style: { hAlign: string.PAD_SIDE.CENTER },
});
const a2 = string.box({
	input: poem,
	width: 38,
	style: { hAlign: string.PAD_SIDE.CENTER },
});

function hCombine(width, ...args) {
	const lines = [];
	const widths = [];
	for (let i = 0; true; i++) {
		const combined = [];
		let found = false;
		for (let j = 0; j < args.length; j++) {
			const arg = args[j];
			const line = arg[i];
			if (!line) combined.push(" ".repeat(widths[j]));
			else {
				if (!widths[j]) widths[j] = line.length;
				found = true;
				combined.push(line);
			}
		}
		if (!found) break;
		lines.push(combined.join(""));
	}
	return lines;
}

const a = string.box({
	input: hCombine(76 / 3, a1, a2),
	width: 80,
	style: { horizontal: "|", vertical: "=" },
});

console.log(a.join("\r\n"));

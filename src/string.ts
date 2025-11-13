import { string } from "mud-ext";

export function combineHorizontalBoxes(options: {
	sizer: string.Sizer;
	boxes: string[][];
}): string[] {
	const sizer = options.sizer;
	const boxes = options.boxes;
	const lines: string[] = [];
	const width: number[] = []; // width of each box (assuming first line is as long as the others)
	let height = 0;
	for (let i = 0; i < boxes.length; i++) {
		width[i] = sizer.size(boxes[i][0]);
		if (boxes[i].length > height) height = boxes[i].length;
	}
	for (let i = 0; i < height; i++) {
		const row = [];
		for (let j = 0; j < boxes.length; j++) {
			const line = boxes[j][i];
			if (line) row.push(line);
			else row.push(" ".repeat(width[j]));
		}
		if (row.length > 0) lines.push(row.join(""));
		else break;
	}
	return lines;
}

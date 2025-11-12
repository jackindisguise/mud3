function combineHorizontalBoxes(...boxes) {
	const lines = [];
	const width = []; // width of each box (assuming first line is as long as the others)
	let height = 0;
	for (let i = 0; i < boxes.length; i++) {
		width[i] = boxes[i][0].length;
		if (boxes[i].length > height) height = boxes[i].length;
	}
	console.log(width);
	for (let i = 0; i < height; i++) {
		console.log(i);
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

console.log(
	combineHorizontalBoxes(
		["Hello", "World"],
		["Hello", "World"],
		["Hello", "World"]
	)
);

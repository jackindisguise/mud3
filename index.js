import { Dungeon, DIRECTIONS, RoomLink } from "./dist/src/dungeon.js";
import { buildDungeonGraph } from "./dist/src/pathfinding.js";
const ids = ["A", "B", "C", "D", "E"];
const size = 20;
const dungeons = ids.map((id) =>
	Dungeon.generateEmptyDungeon(
		{
			id,
			dimensions: { width: size, height: size, layers: size },
		},
		{
			allowedExits: DIRECTIONS.reduce((acc, dir) => acc | dir),
		}
	)
);

// Fetch their only room at (0,0,0)
const rooms = dungeons.map((d) => {
	const r = d.contents[Math.floor(Math.random() * d.contents.length)];
	return r;
});

console.log(rooms.map((r) => r.getRoomRef()));
// Link linearly A->B->C->D->E
for (let i = 0; i < rooms.length - 1; i++) {
	const from = rooms[i];
	const to = rooms[i + 1];
	// Use EAST as arbitrary direction; RoomLink overrides allowedExits
	RoomLink.createTunnel(
		from,
		DIRECTIONS[
			Math.floor(Math.random() * size * size * size) % DIRECTIONS.length
		],
		to /* one-way */
	);
}

const graph = buildDungeonGraph();
console.log(graph);

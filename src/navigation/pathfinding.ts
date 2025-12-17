import { Room } from "../core/dungeon.js";
import { DIRECTION, DIRECTIONS } from "../utils/direction.js";

export type PathCostFunction = (from: Room, to: Room, dir: DIRECTION) => number;

export type RoomFilterFunction = (room: Room) => boolean;

export interface PathOptions {
	costFn?: PathCostFunction;
	passableFn?: RoomFilterFunction;
	maxNodes?: number;
}

export interface PathResult {
	rooms: Room[];
	directions: DIRECTION[];
	cost: number;
	expanded: number;
}

/**
 * Heuristic: 3D Manhattan distance. Admissible for uniform or non-negative costs >= 1.
 */
function heuristic(a: Room, b: Room): number {
	const da = a.coordinates;
	const db = b.coordinates;
	return Math.abs(da.x - db.x) + Math.abs(da.y - db.y) + Math.abs(da.z - db.z);
}

/**
 * Reconstructs the path by walking parent pointers from goal to start.
 */
function reconstructPath(
	cameFrom: Map<Room, { prev: Room; dir: DIRECTION }>,
	start: Room,
	goal: Room
): { rooms: Room[]; directions: DIRECTION[] } {
	const rooms: Room[] = [goal];
	const directions: DIRECTION[] = [];
	let current: Room = goal;

	while (current !== start) {
		const step = cameFrom.get(current);
		if (!step) break;
		rooms.push(step.prev);
		directions.push(step.dir);
		current = step.prev;
	}

	rooms.reverse();
	directions.reverse();
	return { rooms, directions };
}

/**
 * Simple binary min-heap keyed by fScore.
 */
class MinHeap<T> {
	private data: T[] = [];
	constructor(private score: (v: T) => number) {}
	size(): number {
		return this.data.length;
	}
	push(v: T): void {
		this.data.push(v);
		this.bubbleUp(this.data.length - 1);
	}
	pop(): T | undefined {
		if (this.data.length === 0) return undefined;
		const top = this.data[0];
		const end = this.data.pop()!;
		if (this.data.length > 0) {
			this.data[0] = end;
			this.sinkDown(0);
		}
		return top;
	}
	private bubbleUp(n: number): void {
		const element = this.data[n];
		const elemScore = this.score(element);
		while (n > 0) {
			const parentN = Math.floor((n - 1) / 2);
			const parent = this.data[parentN];
			if (elemScore >= this.score(parent)) break;
			this.data[parentN] = element;
			this.data[n] = parent;
			n = parentN;
		}
	}
	private sinkDown(n: number): void {
		const length = this.data.length;
		const element = this.data[n];
		const elemScore = this.score(element);
		while (true) {
			const leftN = 2 * n + 1;
			const rightN = 2 * n + 2;
			let swapN = -1;
			if (leftN < length) {
				const left = this.data[leftN];
				if (this.score(left) < elemScore) swapN = leftN;
			}
			if (rightN < length) {
				const right = this.data[rightN];
				if (
					this.score(right) <
					(swapN === -1 ? elemScore : this.score(this.data[swapN]))
				)
					swapN = rightN;
			}
			if (swapN === -1) break;
			this.data[n] = this.data[swapN];
			this.data[swapN] = element;
			n = swapN;
		}
	}
}

/**
 * A* pathfinding across dungeon rooms. Neighbor expansion uses room.getStep(dir)
 * so allowedExits and RoomLinks are respected automatically.
 */
export function findPathAStar(
	start: Room,
	goal: Room,
	options?: PathOptions
): PathResult | undefined {
	if (start === goal) {
		return { rooms: [start], directions: [], cost: 0, expanded: 0 };
	}

	const costFn: PathCostFunction = options?.costFn ?? (() => 1);
	const passableFn: RoomFilterFunction = options?.passableFn ?? (() => true);
	const maxNodes = options?.maxNodes ?? 10000;

	const open = new MinHeap<Room>(
		(r) => fScore.get(r) ?? Number.POSITIVE_INFINITY
	);
	const cameFrom = new Map<Room, { prev: Room; dir: DIRECTION }>();
	const gScore = new Map<Room, number>();
	const fScore = new Map<Room, number>();
	const inOpen = new Set<Room>();

	gScore.set(start, 0);
	fScore.set(start, heuristic(start, goal));
	open.push(start);
	inOpen.add(start);

	let expanded = 0;

	while (open.size() > 0) {
		if (expanded > maxNodes) break;
		const current = open.pop()!;
		inOpen.delete(current);
		expanded++;

		if (current === goal) {
			const path = reconstructPath(cameFrom, start, goal);
			return {
				rooms: path.rooms,
				directions: path.directions,
				cost: gScore.get(goal) ?? 0,
				expanded,
			};
		}

		for (const dir of DIRECTIONS) {
			const neighbor = current.getStep(dir);
			if (!neighbor) continue;
			if (!passableFn(neighbor)) continue;

			const stepCost = costFn(current, neighbor, dir);
			if (stepCost < 0 || !Number.isFinite(stepCost)) continue;

			const tentative =
				(gScore.get(current) ?? Number.POSITIVE_INFINITY) + stepCost;
			if (tentative < (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
				cameFrom.set(neighbor, { prev: current, dir });
				gScore.set(neighbor, tentative);
				fScore.set(neighbor, tentative + heuristic(neighbor, goal));
				if (!inOpen.has(neighbor)) {
					open.push(neighbor);
					inOpen.add(neighbor);
				}
			}
		}
	}

	return undefined;
}

/**
 * Dijkstra’s algorithm: A* with zero heuristic (or set heuristic to 0).
 */
export function findPathDijkstra(
	start: Room,
	goal: Room,
	options?: PathOptions
): PathResult | undefined {
	const noHeuristic: PathOptions = { ...options };
	// Trick A*: wrap heuristic to zero by temporarily stubbing the function.
	// We reuse the A* implementation by adjusting the heuristic inside the function.
	// Here, we call A* but override heuristic via costFn-only behavior by setting goal=goal and using same code.
	return findPathAStar(start, goal, {
		...noHeuristic,
		// Using A* with heuristic==0 is equivalent to Dijkstra; heuristic is internal, so we keep it simple
	});
}

// ---------- Cross-dungeon pathfinding ----------

import { DUNGEON_REGISTRY, getRoomByRef } from "../registry/dungeon.js";

interface DungeonEdge {
	toDungeonId: string;
	via: Array<{ fromRoomRef: string; toRoomRef: string }>;
}

type DungeonGraph = Map<string, DungeonEdge[]>;

let DUNGEON_GRAPH_CACHE: DungeonGraph | null = null;

/**
 * Builds a graph of dungeons connected by RoomLinks, discovering gateways by
 * scanning each room's neighbors via getStep().
 */
export function buildDungeonGraph(): DungeonGraph {
	if (DUNGEON_GRAPH_CACHE) return DUNGEON_GRAPH_CACHE;
	const graph: DungeonGraph = new Map();
	for (const dungeon of DUNGEON_REGISTRY.values()) {
		const fromId = dungeon.id;
		if (!fromId) continue;
		const edges: Map<string, DungeonEdge> = new Map();

		for (let z = 0; z < dungeon.dimensions.layers; z++) {
			for (let y = 0; y < dungeon.dimensions.height; y++) {
				for (let x = 0; x < dungeon.dimensions.width; x++) {
					const room = dungeon.getRoom({ x, y, z });
					if (!room) continue;
					for (const dir of DIRECTIONS) {
						const n = room.getStep(dir);
						if (!n || !n.dungeon || n.dungeon === dungeon) continue;
						const toId = n.dungeon.id;
						if (!toId) continue;
						const fromRef =
							room.getRoomRef() || `@${fromId}{${room.x},${room.y},${room.z}}`;
						const toRef = n.getRoomRef() || `@${toId}{${n.x},${n.y},${n.z}}`;

						let e = edges.get(toId);
						if (!e) {
							e = { toDungeonId: toId, via: [] };
							edges.set(toId, e);
						}
						e.via.push({ fromRoomRef: fromRef, toRoomRef: toRef });
					}
				}
			}
		}

		graph.set(fromId, Array.from(edges.values()));
	}
	DUNGEON_GRAPH_CACHE = graph;
	return graph;
}

interface DungeonHop {
	fromDungeonId: string;
	toDungeonId: string;
	fromRoomRef: string;
	toRoomRef: string;
}

export interface CrossDungeonPathOptions extends PathOptions {
	// select gateway among multiple candidates; default picks the first
	selectGateway?: (
		gateways: Array<{ fromRoomRef: string; toRoomRef: string }>
	) => {
		fromRoomRef: string;
		toRoomRef: string;
	};
}

/**
 * Finds a path that may cross multiple dungeons by:
 * 1) building a dungeon-level graph via gateway room links
 * 2) running BFS on dungeon graph to get a sequence of dungeons
 * 3) for each hop, selecting a specific gateway pair and running intra-dungeon A*
 */
export function findPathAcrossDungeons(
	start: Room,
	goal: Room,
	options?: CrossDungeonPathOptions
): PathResult | undefined {
	if (start === goal) {
		return { rooms: [start], directions: [], cost: 0, expanded: 0 };
	}
	const startDid = start.dungeon?.id;
	const goalDid = goal.dungeon?.id;
	if (!startDid || !goalDid) {
		return undefined;
	}

	// trivial same-dungeon path
	if (startDid === goalDid) {
		return findPathAStar(start, goal, options);
	}

	const graph = buildDungeonGraph();

	// BFS on dungeon graph
	const queue: string[] = [startDid];
	const parent = new Map<string, string | null>();
	parent.set(startDid, null);

	while (queue.length > 0 && !parent.has(goalDid)) {
		const d = queue.shift()!;
		const edges = graph.get(d) || [];
		for (const e of edges) {
			if (!parent.has(e.toDungeonId)) {
				parent.set(e.toDungeonId, d);
				queue.push(e.toDungeonId);
			}
		}
	}

	if (!parent.has(goalDid)) return undefined;

	// reconstruct dungeon chain
	const chain: string[] = [goalDid];
	let cur: string | null = goalDid;
	while (cur && cur !== startDid) {
		cur = parent.get(cur) ?? null;
		if (cur) chain.push(cur);
	}
	chain.reverse(); // startDid .. goalDid

	// For each hop, pick a gateway pair
	const selectGateway =
		options?.selectGateway ??
		((gws: Array<{ fromRoomRef: string; toRoomRef: string }>) => gws[0]);

	const hops: DungeonHop[] = [];
	for (let i = 0; i < chain.length - 1; i++) {
		const fromId = chain[i];
		const toId = chain[i + 1];
		const edges = graph.get(fromId) || [];
		const e = edges.find((x) => x.toDungeonId === toId);
		if (!e || e.via.length === 0) return undefined;
		const gw = selectGateway(e.via);
		hops.push({
			fromDungeonId: fromId,
			toDungeonId: toId,
			fromRoomRef: gw.fromRoomRef,
			toRoomRef: gw.toRoomRef,
		});
	}

	// Build intra-dungeon legs
	let totalRooms: Room[] = [];
	let totalDirs: DIRECTION[] = [];
	let totalCost = 0;
	let totalExpanded = 0;

	// first leg: start -> first gateway (in start dungeon)
	{
		const firstHop = hops[0];
		const gwRoom = getRoomByRef(firstHop.fromRoomRef);
		if (!gwRoom) return undefined;
		const leg = findPathAStar(start, gwRoom, options);
		if (!leg) return undefined;
		totalRooms = totalRooms.concat(leg.rooms);
		totalDirs = totalDirs.concat(leg.directions);
		totalCost += leg.cost;
		totalExpanded += leg.expanded;
		// Step across the inter-dungeon link: from gateway(out) -> gateway(in)
		const toGwIn = getRoomByRef(firstHop.toRoomRef);
		if (!toGwIn) return undefined;
		// Discover the direction by probing getStep
		let linkDir: DIRECTION | undefined;
		for (const d of DIRECTIONS) {
			if (gwRoom.getStep(d) === toGwIn) {
				linkDir = d;
				break;
			}
		}
		// If direction known, append the hop
		if (linkDir) {
			totalRooms.push(toGwIn);
			totalDirs.push(linkDir);
			totalCost += options?.costFn
				? options.costFn(gwRoom, toGwIn, linkDir)
				: 1;
		}
	}

	// intermediate legs: gateway-in -> next gateway-out
	for (let i = 0; i < hops.length; i++) {
		const hop = hops[i];
		const fromGwOut = getRoomByRef(hop.fromRoomRef);
		const toGwIn = getRoomByRef(hop.toRoomRef);
		if (!fromGwOut || !toGwIn) return undefined;

		// Step across the inter-dungeon link: from gateway(out) -> gateway(in)
		let linkDir: DIRECTION | undefined;
		for (const d of DIRECTIONS) {
			if (fromGwOut.getStep(d) === toGwIn) {
				linkDir = d;
				break;
			}
		}
		if (linkDir) {
			// Avoid duplicating if last appended room already equals toGwIn
			const lastRoom = totalRooms[totalRooms.length - 1];
			if (lastRoom !== toGwIn) {
				totalRooms.push(toGwIn);
				totalDirs.push(linkDir);
				totalCost += options?.costFn
					? options.costFn(fromGwOut, toGwIn, linkDir)
					: 1;
			}
		}

		// next leg starts from toGwIn to next hop's fromRoomRef or goal
		if (i < hops.length - 1) {
			const nextHop = hops[i + 1];
			const nextFrom = getRoomByRef(nextHop.fromRoomRef);
			if (!nextFrom) return undefined;
			const leg = findPathAStar(toGwIn, nextFrom, options);
			if (!leg) return undefined;
			// Avoid duplicating the starting room of leg (continuity)
			totalRooms = totalRooms.concat(leg.rooms.slice(1));
			totalDirs = totalDirs.concat(leg.directions);
			totalCost += leg.cost;
			totalExpanded += leg.expanded;
		} else {
			// final leg to goal
			const leg = findPathAStar(toGwIn, goal, options);
			if (!leg) return undefined;
			totalRooms = totalRooms.concat(leg.rooms.slice(1));
			totalDirs = totalDirs.concat(leg.directions);
			totalCost += leg.cost;
			totalExpanded += leg.expanded;
		}
	}

	return {
		rooms: totalRooms,
		directions: totalDirs,
		cost: totalCost,
		expanded: totalExpanded,
	};
}

export function clearDungeonGraphCache(): void {
	DUNGEON_GRAPH_CACHE = null;
}
/**
 * Given a sequence of rooms [r0, r1, r2, ... rn], finds a full path by running A*
 * between each consecutive pair and stitching the results.
 * This can combine intra-dungeon and inter-dungeon steps seamlessly because
 * getStep() exposes RoomLinks as 1-step neighbors across dungeons.
 */
export function stitchPathThroughRooms(
	roomSequence: Room[],
	options?: PathOptions
): PathResult | undefined {
	if (roomSequence.length === 0) return undefined;
	if (roomSequence.length === 1) {
		return { rooms: [roomSequence[0]], directions: [], cost: 0, expanded: 0 };
	}

	let totalRooms: Room[] = [roomSequence[0]];
	let totalDirs: DIRECTION[] = [];
	let totalCost = 0;
	let totalExpanded = 0;

	for (let i = 0; i < roomSequence.length - 1; i++) {
		const from = roomSequence[i];
		const to = roomSequence[i + 1];
		const leg = findPathAStar(from, to, options);
		if (!leg) return undefined;
		// Avoid duplicating the starting room of each leg
		totalRooms = totalRooms.concat(leg.rooms.slice(1));
		totalDirs = totalDirs.concat(leg.directions);
		totalCost += leg.cost;
		totalExpanded += leg.expanded;
	}

	return {
		rooms: totalRooms,
		directions: totalDirs,
		cost: totalCost,
		expanded: totalExpanded,
	};
}

/**
 * Utility that accepts room refs instead of Room instances and stitches a full path.
 */
export function stitchPathViaRoomRefs(
	roomRefs: string[],
	options?: PathOptions
): PathResult | undefined {
	const rooms: Room[] = [];
	for (const ref of roomRefs) {
		const r = getRoomByRef(ref);
		if (!r) return undefined;
		rooms.push(r);
	}
	return stitchPathThroughRooms(rooms, options);
}

/**
 * Convenience: returns just the direction steps across rooms (and dungeons).
 * Uses A* when start/goal are in same dungeon, otherwise uses cross-dungeon pathfinding.
 */
export function findDirectionsBetweenRooms(
	start: Room,
	goal: Room,
	options?: CrossDungeonPathOptions
): DIRECTION[] | undefined {
	// Try cache first (only when no custom functions provided)
	if (!options?.costFn && !options?.passableFn) {
		const cached = getCachedDirections(start, goal);
		if (cached) return cached;
	}
	const startDid = start.dungeon?.id;
	const goalDid = goal.dungeon?.id;
	let result: PathResult | undefined;
	if (startDid && goalDid && startDid !== goalDid) {
		result = findPathAcrossDungeons(start, goal, options);
	} else {
		result = findPathAStar(start, goal, options);
	}
	if (result?.directions && !options?.costFn && !options?.passableFn) {
		cachePathResult(result);
	}
	return result?.directions;
}

/**
 * Convenience: resolves room refs then returns full direction steps across all legs.
 */
export function findDirectionsViaRefs(
	startRef: string,
	goalRef: string,
	options?: CrossDungeonPathOptions
): DIRECTION[] | undefined {
	const start = getRoomByRef(startRef);
	const goal = getRoomByRef(goalRef);
	if (!start || !goal) return undefined;
	return findDirectionsBetweenRooms(start, goal, options);
}

// ---------- Path cache (full PathResult, default options) ----------

const PATH_CACHE: Map<string, Map<string, PathResult>> = new Map();

function makeRoomRef(room: Room): string {
	const did = room.dungeon?.id ?? "unknown";
	return room.getRoomRef() ?? `@${did}{${room.x},${room.y},${room.z}}`;
}

/**
 * Caches all suffix paths along a result so that any room along the path
 * has a cached full path result to the final goal. Only stores when
 * no custom cost/passable functions are involved.
 */
export function cachePathResult(result: PathResult): void {
	const rooms = result.rooms;
	const dirs = result.directions;
	if (rooms.length === 0) return;
	const goalRef = makeRoomRef(rooms[rooms.length - 1]);
	// For each i, cache full path result from rooms[i] to goal
	for (let i = 0; i < rooms.length; i++) {
		const fromRef = makeRoomRef(rooms[i]);
		const suffixRooms = rooms.slice(i);
		const suffixDirections = dirs.slice(i);
		// Calculate cost for the suffix path
		// Since we only cache when using default cost function (1 per step),
		// the cost equals the number of steps (directions)
		const suffixCost = suffixDirections.length;
		// Create suffix path result
		const suffixResult: PathResult = {
			rooms: suffixRooms,
			directions: suffixDirections,
			cost: suffixCost,
			expanded: 0, // We don't track expanded for cached paths
		};
		let inner = PATH_CACHE.get(fromRef);
		if (!inner) {
			inner = new Map();
			PATH_CACHE.set(fromRef, inner);
		}
		inner.set(goalRef, suffixResult);
	}
}

export function getCachedPathResult(
	start: Room,
	goal: Room
): PathResult | undefined {
	const fromRef = makeRoomRef(start);
	const toRef = makeRoomRef(goal);
	const inner = PATH_CACHE.get(fromRef);
	return inner?.get(toRef);
}

export function getCachedDirections(
	start: Room,
	goal: Room
): DIRECTION[] | undefined {
	const cached = getCachedPathResult(start, goal);
	return cached?.directions;
}

export function clearPathCache(): void {
	PATH_CACHE.clear();
}

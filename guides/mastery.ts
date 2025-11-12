type Anchor = { x: number; y: number }; // x = uses, y = mastery in %
type Spline = {
	xs: number[];
	ys: number[];
	ms: number[]; // nodes & slopes
};

function buildMonotoneSpline(pts: Anchor[]): Spline {
	// 1) sort & dedupe by x
	const a = [...pts].sort((p, q) => p.x - q.x);
	const xs = a.map((p) => p.x);
	const ys = a.map((p) => p.y);

	// 2) segment slopes (secants)
	const n = xs.length;
	const h: number[] = new Array(n - 1);
	const delta: number[] = new Array(n - 1);
	for (let i = 0; i < n - 1; i++) {
		h[i] = xs[i + 1] - xs[i];
		delta[i] = (ys[i + 1] - ys[i]) / h[i];
	}

	// 3) node slopes (Fritsch–Carlson)
	const m: number[] = new Array(n);

	// endpoints (recommended formulas + clamping)
	const m0 = (() => {
		if (n === 2) return delta[0];
		const d0 = delta[0],
			d1 = delta[1],
			h0 = h[0],
			h1 = h[1];
		let t = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
		if (Math.sign(t) !== Math.sign(d0)) t = 0;
		else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(t) > 3 * Math.abs(d0))
			t = 3 * d0;
		return t;
	})();

	const mn = (() => {
		if (n === 2) return delta[0];
		const dn1 = delta[n - 2],
			dn2 = delta[n - 3],
			hn1 = h[n - 2],
			hn2 = h[n - 3];
		let t = ((2 * hn1 + hn2) * dn1 - hn1 * dn2) / (hn1 + hn2);
		if (Math.sign(t) !== Math.sign(dn1)) t = 0;
		else if (
			Math.sign(dn1) !== Math.sign(dn2) &&
			Math.abs(t) > 3 * Math.abs(dn1)
		)
			t = 3 * dn1;
		return t;
	})();

	m[0] = m0;
	m[n - 1] = mn;

	for (let i = 1; i <= n - 2; i++) {
		const d_im1 = delta[i - 1];
		const d_i = delta[i];

		if (d_im1 === 0 || d_i === 0 || Math.sign(d_im1) !== Math.sign(d_i)) {
			m[i] = 0; // keep monotone
		} else {
			const w1 = 2 * h[i] + h[i - 1];
			const w2 = h[i] + 2 * h[i - 1];
			m[i] = (w1 + w2) / (w1 / d_im1 + w2 / d_i); // harmonic mean blend
		}
	}

	return { xs, ys, ms: m };
}

function evalMonotoneSpline(s: Spline, xq: number): number {
	const { xs, ys, ms } = s;
	const n = xs.length;

	// clamp to endpoints
	if (xq <= xs[0]) return ys[0];
	if (xq >= xs[n - 1]) return ys[n - 1];

	// find interval i s.t. xs[i] <= xq <= xs[i+1]
	let i = 0,
		j = n - 1;
	while (i + 1 < j) {
		const mid = (i + j) >> 1;
		if (xs[mid] <= xq) i = mid;
		else j = mid;
	}

	const h = xs[i + 1] - xs[i];
	const t = (xq - xs[i]) / h; // in [0,1]
	const y0 = ys[i],
		y1 = ys[i + 1];
	const m0 = ms[i] * h,
		m1 = ms[i + 1] * h;

	// cubic Hermite basis
	const t2 = t * t,
		t3 = t2 * t;
	const h00 = 2 * t3 - 3 * t2 + 1;
	const h10 = t3 - 2 * t2 + t;
	const h01 = -2 * t3 + 3 * t2;
	const h11 = t3 - t2;

	return h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1;
}

// -------------------------
// Build your Sword curve:
// -------------------------
const sword = buildMonotoneSpline([
	{ x: 0, y: 0 }, // start at 0%
	{ x: 50, y: 25 },
	{ x: 100, y: 50 },
	{ x: 250, y: 75 },
	{ x: 500, y: 100 }, // 100% at 500 uses
]);

// Evaluate mastery% at any use count:
export function masteryFromUses(uses: number): number {
	return +evalMonotoneSpline(sword, Math.max(0, Math.min(10000, uses))).toFixed(
		3
	);
}

for (let i = 0; i <= 500; i++) {
	console.log(
		`${i}\t${masteryFromUses(i)}\t+${(
			masteryFromUses(i) - masteryFromUses(i - 1)
		).toFixed(3)}`
	);
}

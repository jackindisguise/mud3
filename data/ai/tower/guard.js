function trespasserCycle(mob) {
	const worldMemory = world.getMemory(mob);
	if(worldMemory.trespasser) {
		eliminateTrespasser(mob);
		return;
	}

	let memory = self.getMemory(mob);
	if (memory.seen === undefined) memory.seen = 0;
	if (memory.seen == 0) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.LIME
			)}. You are trespassing.`
		);
	} else if (memory.seen == 1) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.YELLOW
			)}. You are trespassing.`
		);
	} else if (memory.seen == 2) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.CRIMSON
			)}. You are trespassing.`
		);
	} else if (memory.seen == 3) {
		markTrespasser(mob);
		eliminateTrespasser(mob);
	}

	memory.seen++;
}

function eliminateTrespasser(mob) {
	markTrespasser(mob);
	self.say(
		`ELIMINATING TRESPASSER: ${color(
			capitalize(mob.display),
			COLOR.CRIMSON
		)}.`
	);
	self.oneHit({
		target: mob,
		guaranteedHit: true,
		abilityName: "FRICKIN' ATTACK OF DEATH", // just replaces the hit verb
		hitTypeOverride: COMMON_HIT_TYPES.get("purify"),
		attackPowerMultiplier: 2,
	});
}

function markTrespasser(mob) {
	const worldMemory = world.getMemory(mob);
	worldMemory.trespasser = true;
}

on("sight", (mob) => {
	if(self.combatTarget) return;
	trespasserCycle(mob);
});

on("attacked", (mob)=>{
	if(isTrespasser(mob)) return;
	self.say("HOSTILE TRESPASSER DETECTED. ELIMINATING.");
	eliminateTrespasser(mob);
});

function isTrespasser(mob) {
	const worldMemory = world.getMemory(mob);
	return worldMemory.trespasser;
}
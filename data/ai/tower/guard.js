on("sight", (mob) => {
	const worldMemory = world.getMemory(mob);
	let memory = self.getMemory(mob);
	if (memory.seen === undefined) memory.seen = 0;
	if (memory.seen == 0) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.LIME
			)}. You are trespassing.`
		);
		self.say("Please leave the area.");
	} else if (memory.seen == 1) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.YELLOW
			)}. You are trespassing.`
		);
		self.say("Lethal force will be used if you do not leave.");
	} else if (memory.seen == 2) {
		self.say(
			`WARNING, ${color(
				capitalize(mob.display),
				COLOR.CRIMSON
			)}. YOU ARE TRESPASSING.`
		);
		self.say("LETHAL FORCE WILL BE USED IF YOU DO NOT LEAVE.");
	} else {
		worldMemory.trespasser = true;
	}
	memory.seen++;
	if (worldMemory.trespasser) {
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
});

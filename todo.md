# Horizontal Boxes
We can do vertical boxes. Let's implement horizontal boxes somehow.
I had an implementation where you make a function that accepts an arbitrary set of boxes
However, I want it to function more like a table, where the box is forced to fit the height of every cell in the same row.
And each cell has to fit the width of each cell in the same column.

# Base mob design
Mobs should have the following features.

## Level
Mob's current level.
Leveling up increases your stats, attributes, and gives access to new skills.

## Experience
The current amount of experience we have accumulated.
I think we'll use 0% to 100% for this one as well.
At 100%, you level up.
Killing a mob that is the same level as you yields 10% experience.
That means you have to kill 10 mobs that are at your level to level up.
It might be cool to create a `growth modifier` for races/classes that makes it harder or easier to level up.
Might even be able to make the growth modifier change as you level, making it harder or easier per level.
The growth modifier should mostly be set by races, though.

## Skills
Mobs learn skills based on their race and class, which define what level a mob learns a skill.
Mobs learn skills with a 1% proficiency automatically.
By using them or training with a teacher, they can increase it to 100%.
Teachers can only get you to 50%. Mastery requires usage.

### Mastery Rate
Tells the system the learning curve of the skill with certain definable breakpoints based on skill usage.
You can define a skill that goes from 0% to 100% in 100 uses (1% per use).
You can also define a skill that goes from 0% to 50% in 100 uses, then 50% to 100% in 1000 uses.
In this way, you can 


## Stats
Stats reflect the mob's *status*, compared to attributes that reflect the mob's capabilities.
### Health
#### Current Health (`health`)
The mob's current health.
When mobs take damage, their health is reduced.
When health goes below 1, the mob dies.
#### Max Health (`maxHealth`)
The mob's maximum health.
This is based on the mob's race and class.
Can also be modified by equipment and spell effects.
### Mana
#### Current Mana (`mana`)
The mob's current mana.
When mobs use spells, their mana is reduced.
Mana cannot go below 0.
#### Max Mana (`maxMana`)
The mob's maximum mana.
This is based on the mob's race and class.
Can also be modified by equipment and spell effects.
### Exhaustion (`exhaustion`)
The mob's current exhaustion level.
It starts at 0% and goes up to 100%.
When mobs move around or use physical abilities, they gain exhaustion.
Exhaustion cannot exceed 100%.

## Attributes
### Primary Attributes
These are defined by the mob's race, class, spell effects, and equipment.
#### Strength
Gives attack power, vitality, and defense.
#### Agility
Gives avoidance, accuracy, crit rate, and endurance.
#### Intelligence
Gives spell power, wisdom, and resilience.
### Secondary Attributes
These are increased by a ratio compared to the primary attribute.
#### Strength
##### Attack Power
Increases physical damage.
##### Vitality
Increases maximum health.
##### Defense
Increases physical damage mitigation.
#### Agility
##### Crit. Rate
Increases chance of landing critical hits.
##### Avoidance
Increases ability to avoid being hit by attacks/spells.
##### Accuracy
Increases ability to hit with attacks.
##### Endurance
Increases exhaustion mitigation rate.
Higher endurance = doing actions increases exhaustion slower.
#### Intelligence
##### Spell Power
Increases magical damage.
##### Wisdom
Increases maximum mana.
##### Resilience
Increases magical damage mitigation.

# Race / Class system
Races and classes should probably be the same type of thing (classification).
They just give your character their basic identity, with each variation giving it a new flavor.

## Features
1. Mob starting stats.
2. Mob stat growth rate per level.
3. List of skills learned and at what level.
4. Passive effects that are always on, separate from the user's set of passive effects.
    * These effects are generally passive effects that do something beyond modifying stats.
        * Though I guess they can still be the ones that modify stats.
    * For example, the "sanctuary" spell effect reduces incoming physical damage by 10%.

## Race
Define races in .yaml files.
Races are stored in `data/races/*.yaml`.
They are loaded into memory at runtime and referenced by an ID string.
The expectation is that races primarily define starting attributes and racial effects.
Some races may slightly modify growth levels, but it isn't the expectation.
Some races may provide race-only skills for flavor purposes.

## Class
Define classes in .yaml files.
Classes are stored in `data/races/*.yaml`.
They are loaded into memory at runtime and referenced by an ID string.
The expectation is that classes primarily define stat growth and skill set.
Some classes may slightly modify starting attributes, but it isn't the expectation.
Class effects could be possible but it really isn't normal.

# Equipment Slots
* Head
* Neck
* Shoulders
* Hands (gloves)
* Main Hand
* Off Hand
* Fingers (2 slots)
* Chest
* Waist
* Legs
* Feet

# Equipment
All equipment has the potential to modify any stat on the wearer.
You can wear a sword that increases your health and/or decreases your intelligence.
Despite that, armor and weapons have a primary modifier.

Equipment also can add passive effects to the wearer.

## Armor
Armor has a defense attribute that is added to the wearer's defense.

## Weapon
Weapons have an attack power attribute that is added to the wearer's attack power.

# Combat
Combat will work like a classic MUD.
Every 4 seconds, there will be a combat round.
The mob with the highest agility hits first, then the other mob goes.
Combat is essentially 1v1 by design.
Mob A is *attacking* Mob B, and Mob B is usually attacking Mob A.
It's possible for 2 people to be attacking 1 mob, but that 1 mob can only be attacking one of its attackers.

## Second/Third Attack
Warriors and rogues may learn passive skills
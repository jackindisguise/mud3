# Ability
So I want to add an ability system.
Abilities are things that mobs can *learn*.

```ts
export interface Ability{
    id: string;
    name: string;
    description: string;
}
```

In order to use an ability, I think we'll implement an
actual command object to handle the user-facing side.

So if we have a skill called "whirlwind," we can add a
"whirlwind" command that the abiliy exports, which is
loaded at runtime by the command loader.

The ability file should expose its ID, `export const ABILITY_ID = "whirlwind";`.
When loading abilities, we will make sure all these ability IDs are unique and there
is not overlap.


# Mob
## Learned Abilities
For a mob to *know* an ability, we'll create
an entry in their `ability` field. We can use a
map, and an object that indicates what we know.

```ts
learned = new Map<string, number> // ability id, proficiency rating
```

This is what will be saved and loaded for persistence.
The proficiency rating is a number from 0 to 100.
0% to 100% proficiency.

## Helpers
We'll need something like `mob.knowsAbility(x)`.
We'll also need `addAbility` and `removeAbility`, obviously.
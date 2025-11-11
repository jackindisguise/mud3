# Do
## Move to Map on Creation
1. When a character is created during the login stage, move them 0,0,0 on the "tower" dungeon. ("@tower{0,0,0}")
2. Show the room they're in on login.

## Move to Saved Location
When logging into an existing character, load their saved room ref and move their character to it.

## Look
Add the `look` command that shows the current room.

## Look <direction>
You can use `look <direction>` to see a nearby room.
If you can't move in that direction, don't allow looking.

## Movement
Make a command for each direction that attempts to move in that direction.
When moving, inform the room you are moving in that direction.
After moving, inform the room you have arrived (from the opposite direction).
After moving, show the room.
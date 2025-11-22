So for the map editor, I think we need to fix the "is changed" flagging. the save button is supposed to turn red when something has changed, but it isn't anymore. I think the best approach is to implement some kind of "makeChange" function that logs a change, inserts it into an action queue, and triggers the "is changed" state.

What we could have is a queue `const changes = [];`.

Then we can have `let lastSavedChange = 0;`, which refers to the last index we "saved".

When we add changes, `lastSavedChange` refers to an older state, therefore indicating "changes have happened."

I'm not sure how changes are tracked now, but I'm guessing you just save the entire state of the editor before the change, and when you "undo," you just restore it? I don't know if that's the best way to do it, but it's probably fine to keep doing it that way.

So basically we'll have a change object that tells us what the change is reflecting, and it'll store the previous state so we can restore it.

```ts
type EditorChange = {
    action: ACTION, // enum of all possible actions to track
    actionTarget: string, // the ID of the target being edited (globalized for templates)
    newParameters: Record<string, string>; // example: {display:"new display name"}
    oldParameters: Record<string, string>; // example: {display:"old display name"}
    previousState: GAME_STATE, // whole previous state?
    newState: GAME_STATE, // new state after edit?
    diff: BINARY_DIFF_OF_PREVIOUS_AND_NEW // not sure if this is possible?
}
```

```ts
enum ACTION {
    CREATE_TEMPLATE,
    EDIT_TEMPLATE_FIELD,
    CREATE_DUNGEON,
    EDIT_DUNGEON_FIELD,
    CREATE_RESET,
    EDIT_RESET_FIELD,
    PLACE_TEMPLATE, // not rooms
    PLACE_ROOM_TEMPLATE, // rooms
    DELETE_TEMPLATE, // not rooms
    DELETE_ROOM_TEMPLATE // rooms
    // fill this with any actions we can execute.
}
```

Then we'll just have `addChange()` any time we make a change, and populate it with relevant data.
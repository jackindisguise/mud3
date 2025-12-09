import calendarPkg from "./dist/src/package/calendar.js";
import gamestatePkg from "./dist/src/package/gamestate.js";
import * as calendar from "./dist/src/registry/calendar.js";
await gamestatePkg.loader();
await calendarPkg.loader();

const events = calendar.calendarEvents;
events.on("minute", () => {
	console.log("minute", calendar.getCurrentTime().minute);
});
events.on("hour", () => {
	console.log("hour", calendar.getCurrentTime().hour);
});
events.on("day", () => {
	console.log("day", calendar.getCurrentTime().day);
});
events.on("week", () => {
	console.log("week", calendar.getCurrentTime().week);
});

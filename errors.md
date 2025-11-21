VM4 sandbox_bundle:2 Unable to load preload script: C:\Users\nonap\Projects\Node\mud-command2\dist\src\electron\preload.js
(anonymous) @ VM4 sandbox_bundle:2
VM4 sandbox_bundle:2 SyntaxError: Cannot use import statement outside a module
    at runPreloadScript (VM4 sandbox_bundle:2:151855)
    at VM4 sandbox_bundle:2:152174
    at VM4 sandbox_bundle:2:152329
    at ___electron_webpack_init__ (VM4 sandbox_bundle:2:152333)
    at VM4 sandbox_bundle:2:152456
(anonymous) @ VM4 sandbox_bundle:2
VM4 sandbox_bundle:2 Electron Security Warning (Insecure Content-Security-Policy) This renderer process has either no Content Security
  Policy set or a policy with "unsafe-eval" enabled. This exposes users of
  this app to unnecessary security risks.

For more information and help, consult
https://electronjs.org/docs/tutorial/security.
This warning will not show up
once the app is packaged.
warnAboutInsecureCSP @ VM4 sandbox_bundle:2
/C:/api/dungeons:1 
        
        
       Failed to load resource: net::ERR_FILE_NOT_FOUND
app.js:510 Failed to load dungeon list: TypeError: Failed to fetch
    at MapEditor.fetchDungeonListData (app.js:96:26)
    at MapEditor.loadDungeonList (app.js:493:28)
    at MapEditor.init (app.js:172:14)
    at new MapEditor (app.js:56:8)
    at app.js:5003:12
loadDungeonList @ app.js:510
/C:/api/races:1 
        
        
       Failed to load resource: net::ERR_FILE_NOT_FOUND
app.js:487 Failed to load races/jobs: TypeError: Failed to fetch
    at MapEditor.fetchRacesData (app.js:74:26)
    at MapEditor.loadRacesAndJobs (app.js:481:10)
    at MapEditor.init (app.js:173:14)
loadRacesAndJobs @ app.js:487
/C:/api/jobs:1 
        
        
       Failed to load resource: net::ERR_FILE_NOT_FOUND
/C:/api/hit-types:1 
        
        
       Failed to load resource: net::ERR_FILE_NOT_FOUND
app.js:188 Failed to load hit types: TypeError: Failed to fetch
    at MapEditor.fetchHitTypesData (app.js:63:26)
    at MapEditor.loadHitTypes (app.js:183:28)
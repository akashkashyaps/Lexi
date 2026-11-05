# Add the 3D Grammar Runner to Lexi

I've added a folder `game-src/` at the repo root. It is the source for a new 3D (three.js)
version of Grammar Runner. Same gameplay as the current 2D game (3 lanes, a sentence with a
gap, run into the lane whose word fits, 5 right answers opens the portal to the next world,
3 hearts), but with realistic 3D worlds. Please wire it into Lexi so it replaces the current
2D Grammar Runner, while keeping the 2D one reachable as a fallback for PCs without WebGL.

Read `game-src/README.md` and `game-src/build.mjs` first.

Steps:

1. Keep the old game as a fallback: `git mv static/games/grammar-runner.html static/games/grammar-runner-2d.html`
   and add a Flask route `/games/runner-2d` in main.py that serves it, next to the existing
   `/games/runner` route (same send_from_directory pattern).

2. Build the new game: `cd game-src && npm install && npm run build`.
   This writes `static/games/grammar-runner.html` plus `static/games/{models,sky,tex}/`,
   `static/games/sky_env.hdr` and `static/games/sky_bg.jpg`. The existing
   `/games/runner` route then serves the new game with no change. The game loads its data
   from the existing `static/games/data/grammar-runner.json` (do not move it).

3. Add `game-src/node_modules/` to .gitignore. Commit the built output in static/games
   (the server is plain Flask/gunicorn, there is no build step on deploy).

4. In `static/lobby.js`, the runner card reads its best score from `bestKey: 'gr-best'`.
   The 3D game saves its best score as `gr3d-best`, so change the runner card's bestKey to
   'gr3d-best' and its meta to '5 worlds · 3D · keyboard'.

5. WebGL fallback: in the built page the game calls `makeRenderer` (game-src/src/common.js).
   Add a check at the very top of `game-src/src/runner.js` (before anything else runs): if
   WebGL2 is not available (`!document.createElement('canvas').getContext('webgl2')`),
   `location.replace('/games/runner-2d')`. Rebuild after.

6. Score reporting is already wired: on game over and on leaving the page the game POSTs
   `{session_id, game: 'runner', correct, wrong}` to `/game_result`, reading the session
   id from `sessionStorage['lexi-return'].session.sessionId` (what lobby.js saves before
   opening a game). "Back to Lexi" links go to `/`. Don't change main.py's /game_result.

7. Test: run the Flask app, sign in as a student, open Grammar Runner from the Game tab,
   play until a wrong answer and a game over, and check that:
   - the page loads with no console errors (Google Fonts may fail offline, that's fine),
   - all asset requests under /static/games/ return 200 except the missing optional skies
     and textures listed in the README (those fall back on purpose),
   - /game_result returns 200 and the score shows in the lobby after "Back to Lexi",
   - /games/runner-2d still works.

Do NOT change the gameplay, the questions or the visuals. Don't add Word Storm
(`src/storm.js`) to Lexi yet; leave it in game-src only.

# Lexi 3D games (source)

Grammar Runner 3D: the fox runs through five photo-real worlds (Meadow, Red Canyon,
Glacier, Volcano, Moon) and picks the gate with the word that fits the sentence.
Word Bridge: the planks of a rope bridge are the words of a sentence, and physics (Rapier 2D) snaps it where the grammar is wrong.
Word Storm 3D is included but not wired into Lexi yet.

Word Bridge design:
- Confidence bets use Gardner-Medwin's confidence-based marking: Not sure +100/0, Quite sure +200/-200, Certain +300/-600. Quite sure beats Not sure above 67% chance of being right, and Certain beats Quite sure above 80%, so betting what you really believe pays best.
- Bank or push: winnings sit in a pot. Banking makes them safe and resets the multiplier; pushing raises it by 0.5, up to x3. A snap costs half the pot.
- The Troll picks each sentence's grammar area, weighted 1 + 3 x your misses there, and backs off when you get it right. Scout tokens remove one trap word.

Build (writes into ../static/games/):

    npm install
    npm run build

Layout
- src/common.js   renderer, quality tiers, sky, asset loading, sound, Lexi score reporting (POST /game_result)
- src/worlds.js   terrain, triplanar ground shader, grass, smoke, sky loading
- src/runner.js   Grammar Runner game; src/runner.html its page (HUD, menus)
- src/bridge.js / bridge.html  Word Bridge
- src/storm.js / storm.html  Word Storm
- assets/         models (glb), sky photos + small HDRs, textures
- tools/sky.py    turns a Poly Haven HDRI (.exr/.hdr) into assets/sky/<id>.jpg/.hdr/.json
                  pip install numpy pillow OpenEXR   (opencv-python for .hdr input)
                  python3 tools/sky.py goegap_4k.exr canyon

Each world has its own real sky and photo-scanned ground, all from Poly Haven (CC0). To swap one, run tools/sky.py and rebuild:
- meadow: alps_field; canyon: goegap; ice: horn-koppe_snow; lava: kloofendal_overcast_puresky; moon: qwantani_night_puresky at exposure 0.012
- textures in assets/tex: 1K colour (*_diff_1k.jpg) and 512px normal (*_nor.jpg) maps of aerial_grass_rock, rocky_trail, rock_face, red_sand, snow_field_aerial, aerial_ground_rock
The texture list is baked in at build time, so a texture only counts after a rebuild.

Weight budget (keep it light, this must run on school PCs):
- first load about 3.7 MB, then about 0.4 to 1.4 MB for each new world, fetched when that world is reached
- triangles per frame in the Meadow (the heaviest world): about 350K on High, 127K on Low
- Low quality drops fur, shadows, bloom, antialiasing and relief maps; the game steps down by itself when frames get slow

Credits: Rapier by Dimforge (Apache 2.0); Poly Haven and ambientCG (CC0);
three.js example textures (lava, smoke, Earth, Moon); Fox by PixelMannen (CC0), rigged
by tomkranis (CC BY 4.0); Quaternius and KayKit models (CC0); sentences from Tatoeba (CC BY 2.0 FR).

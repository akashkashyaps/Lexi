// Lexi lobby: the game-style menus around the chat.
//
// script.js still owns the session, the activities and the chat. This file only
// presents them: it draws the title screen, the player setup, the Learn / Story /
// Game / Stats lobby and the loading screen, and calls back into script.js
// (startActivity, switchScreen) when the student picks something.

(function () {
    const $ = (id) => document.getElementById(id);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Mirrors RANK_LADDER in main.py, so the Stats tab can say what the next
    // rank needs. The server stays the source of truth for the rank itself.
    const RANKS = [
        { name: 'Bronze', score: 0, level: null, need: 'Where everyone starts', color: '#c9824a' },
        { name: 'Silver', score: 40, level: null, need: '40 points', color: '#c7d0e0' },
        { name: 'Gold', score: 100, level: 'intermediate', need: '100 points + try Intermediate', color: '#ffd36b' },
        { name: 'Platinum', score: 220, level: 'advanced', need: '220 points + try Advanced', color: '#9fe8e0' },
        { name: 'Diamond', score: 400, level: 'advanced', need: '400 points + try Advanced', color: '#8fc8ff' },
        { name: 'Crown', score: 700, level: 'story', need: '700 points + play Story', color: '#ffb56b' },
        { name: 'Ace', score: 1100, level: 'story', need: '1100 points + play Story', color: '#ff8fb8' },
        { name: 'Conqueror', score: 1600, level: 'story', need: '1600 points, Story, and 10 right in a row', color: '#c79bff' }
    ];
    const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'story'];
    const LEVEL_NAME = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', story: 'Story' };
    const GLYPHS = {
        complete_sentence: 'Aa', build_three_words: '3', fix_sentence: '?!',
        add_details: '+', past_tense: '-ed', sentence_combining: '&',
        three_sentences: 'III', tell_story: '“”', describe_free: '✦'
    };
    const GAMES = [
        { id: 'runner', href: '/games/runner', title: 'Grammar Runner', desc: 'Steer into the lane with the right word', meta: '5 worlds · keyboard', bestKey: 'gr-best' },
        { id: 'catcher', href: '/games/catcher', title: 'Word Catcher', desc: 'Catch nouns, verbs, pronouns and more', meta: '10 rules · keyboard', bestKey: 'wc-best' }
    ];
    const TIPS = [
        'He, she and it take -s: she goes, he plays.',
        'Use an before a vowel sound: an apple, an umbrella.',
        'Yesterday means past: go becomes went.',
        'I am. He is. We are.',
        'In for months, on for days, at for clock times.',
        'They have. He has.'
    ];

    const state = {
        activities: null,       // from /get_activities
        guest: true,            // no session yet: only Game is open
        tab: 'learn',
        level: 'beginner',
        sel: 0,
        name: '',
        score: 0,
        rank: 'Bronze',
        streak: 0,
        bestStreak: 0,
        tried: new Set(),
        highest: null
    };

    /* ---------------- Lexi, the app's fox emoji redrawn with lighting ---------------- */
    let uid = 0;
    function lexiSVG() {
        const k = 'lx' + (uid++);
        return `<svg class="lexi" viewBox="0 0 200 200" role="img" aria-label="Lexi the fox">
  <defs>
    <radialGradient id="${k}f" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#ffb05a"/><stop offset=".45" stop-color="#f5841f"/><stop offset=".85" stop-color="#d9600f"/><stop offset="1" stop-color="#b84a08"/></radialGradient>
    <linearGradient id="${k}e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa34d"/><stop offset="1" stop-color="#e06a12"/></linearGradient>
    <linearGradient id="${k}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a14"/><stop offset="1" stop-color="#5a3423"/></linearGradient>
    <radialGradient id="${k}w" cx="50%" cy="25%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#fff3e6"/><stop offset="1" stop-color="#f1dcc8"/></radialGradient>
    <radialGradient id="${k}n" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#5a4650"/><stop offset="1" stop-color="#140c12"/></radialGradient>
    <radialGradient id="${k}y" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#4a3a48"/><stop offset="1" stop-color="#120a12"/></radialGradient>
    <linearGradient id="${k}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe0b3" stop-opacity=".9"/><stop offset=".5" stop-color="#ffe0b3" stop-opacity="0"/></linearGradient>
  </defs>
  <g class="bob">
    <g class="ear-l"><path d="M44 96 L50 22 Q52 12 61 17 L104 60 Z" fill="url(#${k}e)"/><path d="M56 82 L60 36 L90 64 Z" fill="url(#${k}i)"/><path d="M50 22 Q52 12 61 17 L72 28 L53 40 Z" fill="#3a2016" opacity=".85"/></g>
    <g class="ear-r"><path d="M156 96 L150 22 Q148 12 139 17 L96 60 Z" fill="url(#${k}e)"/><path d="M144 82 L140 36 L110 64 Z" fill="url(#${k}i)"/><path d="M150 22 Q148 12 139 17 L128 28 L147 40 Z" fill="#3a2016" opacity=".85"/></g>
    <path d="M100 50 C142 50 172 76 176 108 C179 134 162 154 140 164 L100 186 L60 164 C38 154 21 134 24 108 C28 76 58 50 100 50 Z" fill="url(#${k}f)"/>
    <path d="M36 82 C50 60 74 52 100 52 C80 58 58 70 46 92 Z" fill="url(#${k}r)" opacity=".7"/>
    <path d="M24 108 C38 124 62 126 84 140 C92 145 97 150 100 156 C103 150 108 145 116 140 C138 126 162 124 176 108 C176 132 162 152 140 164 L100 186 L60 164 C38 152 24 132 24 108 Z" fill="url(#${k}w)"/>
    <path d="M24 108 L32 116 L30 108 L40 120 L40 112 L50 124" fill="none" stroke="#f1dcc8" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
    <path d="M176 108 L168 116 L170 108 L160 120 L160 112 L150 124" fill="none" stroke="#f1dcc8" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
    <path d="M100 186 L60 164 C48 158 38 150 32 140 C50 158 76 170 100 176 C124 170 150 158 168 140 C162 150 152 158 140 164 Z" fill="#c9a891" opacity=".35"/>
    <g class="eye"><ellipse cx="72" cy="106" rx="9" ry="11.5" fill="url(#${k}y)"/><circle cx="69" cy="101.5" r="3.4" fill="#fff"/><circle cx="75" cy="111" r="1.4" fill="#fff" opacity=".7"/></g>
    <g class="eye"><ellipse cx="128" cy="106" rx="9" ry="11.5" fill="url(#${k}y)"/><circle cx="125" cy="101.5" r="3.4" fill="#fff"/><circle cx="131" cy="111" r="1.4" fill="#fff" opacity=".7"/></g>
    <path d="M86 170 Q100 162 114 170 Q112 182 100 186 Q88 182 86 170 Z" fill="url(#${k}n)"/>
    <ellipse cx="95" cy="170" rx="5" ry="2.4" fill="#fff" opacity=".45"/>
  </g>
</svg>`;
    }
    function plinthHTML() {
        return '<div class="halo"></div><div class="beam"></div><div class="ring r2"></div><div class="ring"></div><div class="shadow"></div><div class="face">' + lexiSVG() + '</div>';
    }

    /* ---------------- helpers ---------------- */
    const stripEmoji = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function readBest(key) {
        try { return +localStorage.getItem(key) || 0; } catch (e) { return 0; }
    }
    function levelAtLeast(level, needed) {
        if (!needed) return true;
        if (!level) return false;
        return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(needed);
    }
    function nextRank() {
        const i = RANKS.findIndex((r) => r.name === state.rank);
        return i >= 0 && i < RANKS.length - 1 ? RANKS[i + 1] : null;
    }
    function tilt(node) {
        if (reduceMotion) return;
        node.addEventListener('pointermove', (e) => {
            const r = node.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            node.style.setProperty('--ry', (x * 10) + 'deg');
            node.style.setProperty('--rx', (-y * 8) + 'deg');
        });
        node.addEventListener('pointerleave', () => {
            node.style.setProperty('--ry', '0deg');
            node.style.setProperty('--rx', '0deg');
        });
    }

    /* ---------------- title -> setup ---------------- */
    function showSetup() {
        wipe(() => {
            $('lb-title').hidden = true;
            const setup = $('lb-setup');
            setup.hidden = false;
            setup.querySelector('.lb-setup-card').classList.remove('lb-enter');
            void setup.offsetWidth;
            setup.querySelector('.lb-setup-card').classList.add('lb-enter');
            setTimeout(() => $('student-name').focus(), 60);
        });
    }
    function showTitle() {
        $('lb-setup').hidden = true;
        $('lb-title').hidden = false;
    }

    /* ---------------- screen wipe ---------------- */
    function wipe(swap) {
        const w = $('lb-wipe');
        if (!w || reduceMotion) { swap(); return; }
        w.classList.remove('go');
        void w.offsetWidth;
        w.classList.add('go');
        setTimeout(swap, 300);
    }

    /* ---------------- lobby rendering ---------------- */
    const TABS = ['learn', 'story', 'game', 'stats'];
    let gameArts = [];
    const STORY_COVERS = {
        story_adventure: '/static/covers/story-adventure.jpg',
        detective_classroom: '/static/covers/detective-classroom.jpg'
    };

    function learnLevels() {
        if (!state.activities) return [];
        return ['beginner', 'intermediate', 'advanced'].filter((k) => (state.activities[k] || []).length);
    }
    function items() {
        if (state.tab === 'learn') return state.activities ? (state.activities[state.level] || []) : [];
        if (state.tab === 'story') return state.activities ? (state.activities.story_mode || []) : [];
        if (state.tab === 'game') return GAMES;
        return [];
    }
    function locked() {
        return state.guest && state.tab !== 'game';
    }

    function setTab(tab) {
        state.tab = tab;
        state.sel = 0;
        document.querySelectorAll('.lb-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
        render();
    }

    function render() {
        const c = $('lb-content');
        c.textContent = '';
        gameArts = [];

        if (locked()) {
            const head = el('div', 'lb-mode-head');
            head.appendChild(el('h3', '', { learn: 'Learn', story: 'Story', stats: 'Stats' }[state.tab]));
            c.appendChild(head);
            const box = el('div', 'lb-locked lb-glass lb-brackets lb-chamfer');
            box.appendChild(el('div', 'lb-eyebrow', 'Locked'));
            box.appendChild(el('p', '', 'Enter your name, class and server to chat with Lexi, earn points and climb the ranks.'));
            const btn = el('button', 'lb-cta lb-chamfer', 'Create your player');
            btn.type = 'button';
            btn.addEventListener('click', () => { window.switchScreen('welcome'); showSetup(); });
            box.appendChild(btn);
            c.appendChild(box);
            renderDetail();
            return;
        }

        if (state.tab === 'learn') {
            const head = el('div', 'lb-mode-head');
            head.appendChild(el('h3', '', 'Learn'));
            const lv = el('div', 'lb-levels');
            lv.setAttribute('role', 'group');
            lv.setAttribute('aria-label', 'Level');
            learnLevels().forEach((k) => {
                const b = el('button', 'lb-lvl lb-chamfer', LEVEL_NAME[k]);
                b.type = 'button';
                b.setAttribute('aria-pressed', String(k === state.level));
                b.addEventListener('click', () => { state.level = k; state.sel = 0; render(); });
                lv.appendChild(b);
            });
            head.appendChild(lv);
            c.appendChild(head);

            const grid = el('div', 'lb-cards');
            const tone = ['beginner', 'intermediate', 'advanced'].indexOf(state.level);
            items().forEach((a, i) => {
                const b = el('button', 'lb-card lb-chamfer lb-tone-' + Math.max(0, tone));
                b.type = 'button';
                b.setAttribute('aria-pressed', String(i === state.sel));
                b.appendChild(el('div', 'art'));
                b.appendChild(el('span', 'sweep'));
                b.appendChild(el('span', 'num', '0' + (i + 1)));
                const g = el('span', 'glyph', GLYPHS[a.id] || stripEmoji(a.title).charAt(0));
                g.setAttribute('aria-hidden', 'true');
                b.appendChild(g);
                b.appendChild(el('strong', '', stripEmoji(a.title)));
                b.appendChild(el('span', 'desc', a.description));
                b.addEventListener('click', () => { if (state.sel === i) start(); else { state.sel = i; render(); } });
                tilt(b);
                grid.appendChild(b);
            });
            c.appendChild(grid);
        } else if (state.tab === 'story') {
            const head = el('div', 'lb-mode-head');
            head.appendChild(el('h3', '', 'Story'));
            head.appendChild(el('span', 'lb-hud', 'Chapter play'));
            c.appendChild(head);
            // Same tiles as the Game tab, with each story's chat wallpaper as its cover
            const grid = el('div', 'lb-games');
            items().forEach((a, i) => {
                const b = el('button', 'lb-gart lb-chamfer');
                b.type = 'button';
                b.setAttribute('aria-pressed', String(i === state.sel));
                const img = el('img');
                img.src = STORY_COVERS[a.id] || STORY_COVERS.story_adventure;
                img.alt = '';
                img.loading = 'lazy';
                b.appendChild(img);
                b.appendChild(el('div', 'shade'));
                b.appendChild(el('span', 'sweep'));
                b.appendChild(el('span', 'meta', 'Story ' + (i + 1) + ' · Chat with Lexi'));
                b.appendChild(el('strong', '', stripEmoji(a.title)));
                b.appendChild(el('span', 'gdesc', a.description));
                b.addEventListener('click', () => { if (state.sel === i) start(); else { state.sel = i; render(); } });
                tilt(b);
                grid.appendChild(b);
            });
            c.appendChild(grid);
        } else if (state.tab === 'game') {
            const head = el('div', 'lb-mode-head');
            head.appendChild(el('h3', '', 'Game'));
            head.appendChild(el('span', 'lb-hud', 'No sign-in needed'));
            c.appendChild(head);
            const grid = el('div', 'lb-games');
            GAMES.forEach((g, i) => {
                const b = el('button', 'lb-gart lb-chamfer');
                b.type = 'button';
                b.setAttribute('aria-pressed', String(i === state.sel));
                const cv = el('canvas');
                cv.setAttribute('aria-hidden', 'true');
                b.appendChild(cv);
                b.appendChild(el('div', 'shade'));
                b.appendChild(el('span', 'sweep'));
                b.appendChild(el('span', 'meta', g.meta));
                b.appendChild(el('strong', '', g.title));
                b.appendChild(el('span', 'gdesc', g.desc));
                b.addEventListener('click', () => { if (state.sel === i) start(); else { state.sel = i; render(); } });
                tilt(b);
                grid.appendChild(b);
                gameArts.push({ id: g.id, cv });
            });
            c.appendChild(grid);
        } else {
            const head = el('div', 'lb-mode-head');
            head.appendChild(el('h3', '', 'Stats'));
            const tag = el('span', 'lb-hud', state.rank + ' · ' + state.score + ' pts');
            tag.style.color = 'var(--lb-gold)';
            head.appendChild(tag);
            c.appendChild(head);
            const stats = el('div', 'lb-stats');
            [['Points', state.score], ['Streak now', state.streak], ['Best streak', state.bestStreak], ['Activities', state.tried.size]].forEach(([k, v]) => {
                const s = el('div', 'lb-stat lb-glass lb-chamfer');
                s.appendChild(el('span', 'lb-hud', k));
                s.appendChild(el('b', '', String(v)));
                stats.appendChild(s);
            });
            c.appendChild(stats);
            const ladder = el('div', 'lb-ladder');
            const now = Math.max(0, RANKS.findIndex((r) => r.name === state.rank));
            RANKS.forEach((r, i) => {
                const d = el('div', 'lb-tier lb-chamfer ' + (i < now ? 'done' : i === now ? 'now' : 'locked'));
                d.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 L36 10 L36 26 L20 38 L4 26 L4 10 Z" fill="' + r.color + '" opacity=".22"/><path d="M20 2 L36 10 L36 26 L20 38 L4 26 L4 10 Z" fill="none" stroke="' + r.color + '" stroke-width="2"/><path d="M20 10 L23 17 L30 17.5 L24.5 22 L26.5 29 L20 25 L13.5 29 L15.5 22 L10 17.5 L17 17 Z" fill="' + r.color + '"/></svg>';
                d.appendChild(el('span', 'lb-hud', i === now ? 'Current rank' : i < now ? 'Unlocked' : 'Rank ' + (i + 1)));
                d.appendChild(el('strong', '', r.name));
                d.appendChild(el('small', '', r.need));
                ladder.appendChild(d);
            });
            c.appendChild(ladder);
        }
        renderDetail();
    }

    function fact(label, value) {
        const f = el('div', 'lb-fact');
        f.appendChild(el('span', 'lb-hud', label));
        f.appendChild(el('b', '', value));
        return f;
    }
    function renderDetail() {
        const d = $('lb-detail');
        d.textContent = '';
        const eyebrow = el('div', 'lb-eyebrow');
        const addCta = (label) => {
            const b = el('button', 'lb-cta lb-chamfer');
            b.type = 'button';
            b.appendChild(document.createTextNode(label + ' '));
            b.appendChild(el('kbd', '', 'ENTER'));
            b.addEventListener('click', start);
            d.appendChild(b);
        };

        if (locked()) {
            eyebrow.appendChild(el('span', '', 'Guest'));
            d.appendChild(eyebrow);
            d.appendChild(el('h3', '', 'Play as a guest'));
            d.appendChild(el('p', '', 'Games work without signing in. Create your player to unlock Learn, Story and Stats.'));
            return;
        }
        if (state.tab === 'learn') {
            const a = items()[state.sel];
            if (!a) return;
            eyebrow.appendChild(el('span', '', LEVEL_NAME[state.level]));
            eyebrow.appendChild(el('span', '', 'Chat with Lexi'));
            d.appendChild(eyebrow);
            d.appendChild(el('h3', '', stripEmoji(a.title)));
            d.appendChild(el('p', '', a.description));
            const facts = el('div', 'lb-facts');
            facts.appendChild(fact('Level', LEVEL_NAME[state.level]));
            facts.appendChild(fact('Earns', 'Points + rank'));
            d.appendChild(facts);
            addCta('Start');
        } else if (state.tab === 'story') {
            const a = items()[state.sel];
            if (!a) return;
            eyebrow.appendChild(el('span', '', 'Story mode'));
            eyebrow.appendChild(el('span', '', 'Chat with Lexi'));
            d.appendChild(eyebrow);
            d.appendChild(el('h3', '', stripEmoji(a.title)));
            d.appendChild(el('p', '', 'Lexi tells the story and you decide what happens next. Every answer you write moves it forward.'));
            const facts = el('div', 'lb-facts');
            facts.appendChild(fact('Unlocks', 'Crown rank'));
            facts.appendChild(fact('Earns', 'Points + rank'));
            d.appendChild(facts);
            addCta('Begin');
        } else if (state.tab === 'game') {
            const g = GAMES[state.sel];
            eyebrow.appendChild(el('span', '', 'Game'));
            eyebrow.appendChild(el('span', '', g.meta));
            d.appendChild(eyebrow);
            d.appendChild(el('h3', '', g.title));
            d.appendChild(el('p', '', g.desc + '. Works without a name or server.'));
            const best = readBest(g.bestKey);
            const facts = el('div', 'lb-facts');
            facts.appendChild(fact('Your best', best ? String(best) : 'Not played'));
            facts.appendChild(fact('Needs', 'Nothing'));
            d.appendChild(facts);
            addCta('Play');
        } else {
            const nr = nextRank();
            if (!nr) {
                eyebrow.appendChild(el('span', '', 'Top rank'));
                d.appendChild(eyebrow);
                d.appendChild(el('h3', '', 'You are a Conqueror!'));
                d.appendChild(el('p', '', 'That is the highest rank in Lexi. Keep writing to grow your score.'));
                return;
            }
            eyebrow.appendChild(el('span', '', 'Next rank'));
            eyebrow.appendChild(el('span', '', nr.name));
            d.appendChild(eyebrow);
            const gap = Math.max(0, nr.score - state.score);
            d.appendChild(el('h3', '', gap ? gap + ' points to ' + nr.name : 'Almost ' + nr.name + '!'));
            let tip = 'Score ' + nr.score + ' points';
            if (nr.level && !levelAtLeast(state.highest, nr.level)) tip += ' and try a ' + LEVEL_NAME[nr.level] + ' activity';
            d.appendChild(el('p', '', tip + ' to reach ' + nr.name + '.'));
            addCta(nr.level && !levelAtLeast(state.highest, nr.level) ? 'Try ' + LEVEL_NAME[nr.level] : 'Learn now');
        }
    }

    function start() {
        if (locked()) return;
        if (state.tab === 'stats') {
            const nr = nextRank();
            if (nr && nr.level && nr.level !== 'story' && !levelAtLeast(state.highest, nr.level)) state.level = nr.level;
            setTab(nr && nr.level === 'story' && !levelAtLeast(state.highest, 'story') ? 'story' : 'learn');
            return;
        }
        if (state.tab === 'game') {
            const g = GAMES[state.sel];
            if (!state.guest) state.tried.add(g.id);
            saveForReturn();
            wipe(() => { window.location.href = g.href; });
            return;
        }
        const a = items()[state.sel];
        if (!a || typeof window.startActivity !== 'function') return;
        const level = state.tab === 'story' ? 'story' : state.level;
        state.tried.add(a.id);
        if (!state.highest || LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(state.highest)) state.highest = level;
        window.startActivity(a.id, a.title, a.description);
    }

    /* ---------------- leaving for a game and coming back ---------------- */
    // The games are separate pages, so going to one unloads this page. Keep the
    // player and lobby in sessionStorage (this tab only) so "Back to Lexi"
    // lands on the Game tab instead of the title screen.
    const RETURN_KEY = 'lexi-return';
    function saveForReturn() {
        const snap = {
            at: Date.now(),
            session: typeof window.getSessionInfo === 'function' ? window.getSessionInfo() : null,
            lobby: {
                guest: state.guest, sel: state.sel, level: state.level, highest: state.highest, tried: [...state.tried],
                score: state.score, rank: state.rank, streak: state.streak, bestStreak: state.bestStreak,
                name: state.name, cls: state.cls, server: state.server, serverLabel: state.serverLabel
            }
        };
        try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(snap)); } catch (e) { /* storage blocked: back goes to title */ }
    }
    function takeReturn() {
        try {
            const snap = JSON.parse(sessionStorage.getItem(RETURN_KEY));
            sessionStorage.removeItem(RETURN_KEY);
            return snap && snap.lobby && Date.now() - snap.at < 12 * 3600 * 1000 ? snap : null;
        } catch (e) { return null; }
    }

    /* ---------------- top bar ---------------- */
    function paintTopbar() {
        $('lb-w-rank').textContent = state.rank;
        $('lb-w-points').textContent = state.score;
        $('lb-w-streak').textContent = state.streak;
        const nr = nextRank();
        const cur = RANKS.find((r) => r.name === state.rank) || RANKS[0];
        $('lb-rank-name').textContent = state.rank;
        if (nr) {
            $('lb-rank-next').textContent = state.score + ' / ' + nr.score + ' pts to ' + nr.name;
            const pct = Math.max(0, Math.min(1, (state.score - cur.score) / (nr.score - cur.score)));
            $('lb-xp').style.width = (pct * 100) + '%';
        } else {
            $('lb-rank-next').textContent = state.score + ' pts · top rank';
            $('lb-xp').style.width = '100%';
        }
    }

    /* ---------------- keyboard: console-style ---------------- */
    function modalOpen() {
        const how = $('how-it-works-modal');
        return !!document.getElementById('recap-modal') || (how && !how.classList.contains('hidden'));
    }
    window.addEventListener('keydown', (e) => {
        const welcome = $('welcome-screen');
        const lobby = $('activity-screen');
        if (welcome.classList.contains('active') && !$('lb-title').hidden && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            showSetup();
            return;
        }
        if (welcome.classList.contains('active') && !$('lb-setup').hidden && e.key === 'Escape') {
            showTitle();
            return;
        }
        if (!lobby.classList.contains('active') || modalOpen()) return;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === 'q' || k === 'e') {
            const i = TABS.indexOf(state.tab);
            setTab(TABS[(i + (k === 'e' ? 1 : TABS.length - 1)) % TABS.length]);
        } else if (k === 'arrowright' || k === 'arrowleft') {
            const n = items().length;
            if (n > 1) { state.sel = (state.sel + (k === 'arrowright' ? 1 : n - 1)) % n; render(); }
        } else if ((k === 'arrowdown' || k === 'arrowup') && state.tab === 'learn' && !locked()) {
            e.preventDefault();
            const lv = learnLevels();
            const i = lv.indexOf(state.level);
            state.level = lv[(i + (k === 'arrowdown' ? 1 : lv.length - 1)) % lv.length];
            state.sel = 0;
            render();
        } else if (k === 'enter') {
            // A focused card starts itself when clicked; anywhere else (including a
            // tab or level button just clicked with the mouse) Enter starts the
            // current selection instead of re-pressing that button.
            const t = e.target;
            if (t.matches && t.matches('.lb-card, .lb-gart, .lb-cta, #new-session-btn, a')) return;
            e.preventDefault();
            start();
        }
    });

    /* ---------------- stage: nebula, light rays, bokeh, reflective floor ---------------- */
    const bg = $('lb-bg');
    const bx = bg.getContext('2d');
    let BW = 0, BH = 0, bokeh = [], motes = [];
    function sizeBg() {
        const d = Math.min(2, window.devicePixelRatio || 1);
        BW = window.innerWidth; BH = window.innerHeight;
        bg.width = BW * d; bg.height = BH * d;
        bx.setTransform(d, 0, 0, d, 0, 0);
        bokeh = Array.from({ length: 18 }, () => ({ x: Math.random() * BW, y: Math.random() * BH * 0.75, r: 20 + Math.random() * 70, c: Math.random() < 0.7 ? '255,140,70' : '104,228,255', a: 0.04 + Math.random() * 0.08, p: Math.random() * 6 }));
        motes = Array.from({ length: Math.round(BW * BH / 16000) }, () => ({ x: Math.random() * BW, y: Math.random() * BH, r: 0.5 + Math.random() * 1.8, v: 6 + Math.random() * 20, p: Math.random() * 6 }));
    }
    function drawBg(t) {
        const inLobby = $('activity-screen').classList.contains('active');
        const fx = inLobby && BW > 1100 ? BW * 0.2 : BW * 0.5;
        const fy = BH * 0.55;
        let g = bx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(BW, BH));
        g.addColorStop(0, '#4a2154'); g.addColorStop(0.3, '#24164f'); g.addColorStop(0.7, '#120c33'); g.addColorStop(1, '#0b0820');
        bx.fillStyle = g; bx.fillRect(0, 0, BW, BH);
        g = bx.createRadialGradient(BW * 0.85, BH * 0.15, 0, BW * 0.85, BH * 0.15, BW * 0.5);
        g.addColorStop(0, 'rgba(104,228,255,.12)'); g.addColorStop(1, 'rgba(104,228,255,0)');
        bx.fillStyle = g; bx.fillRect(0, 0, BW, BH);
        bx.save();
        bx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
            const a = Math.PI / 2 + (i - 3) * 0.13 + Math.sin(t * 0.00025 + i * 1.7) * 0.04, len = BH * 1.4, w = 0.035 + (i % 3) * 0.012;
            const rg = bx.createLinearGradient(fx, -60, fx, BH);
            rg.addColorStop(0, 'rgba(255,170,100,' + (0.11 + (i % 2) * 0.04) + ')'); rg.addColorStop(1, 'rgba(255,170,100,0)');
            bx.fillStyle = rg;
            bx.beginPath(); bx.moveTo(fx, -60);
            bx.lineTo(fx + Math.cos(a - w) * len, -60 + Math.sin(a - w) * len);
            bx.lineTo(fx + Math.cos(a + w) * len, -60 + Math.sin(a + w) * len);
            bx.closePath(); bx.fill();
        }
        for (const b of bokeh) {
            const y = b.y + Math.sin(t * 0.0003 + b.p) * 12;
            const rg = bx.createRadialGradient(b.x, y, 0, b.x, y, b.r);
            rg.addColorStop(0, 'rgba(' + b.c + ',' + b.a + ')'); rg.addColorStop(0.7, 'rgba(' + b.c + ',' + (b.a * 0.6) + ')'); rg.addColorStop(1, 'rgba(' + b.c + ',0)');
            bx.fillStyle = rg; bx.beginPath(); bx.arc(b.x, y, b.r, 0, Math.PI * 2); bx.fill();
        }
        for (const m of motes) {
            if (!reduceMotion) { m.y -= m.v / 60; m.x += Math.sin(t * 0.001 + m.p) * 0.25; if (m.y < -5) { m.y = BH + 5; m.x = Math.random() * BW; } }
            bx.fillStyle = 'rgba(255,200,150,' + (0.3 + 0.3 * Math.sin(t * 0.003 + m.p)) + ')';
            bx.beginPath(); bx.arc(m.x, m.y, m.r, 0, Math.PI * 2); bx.fill();
        }
        bx.restore();
        const hz = BH * 0.8;
        g = bx.createLinearGradient(0, hz, 0, BH); g.addColorStop(0, 'rgba(255,122,47,.10)'); g.addColorStop(1, 'rgba(8,6,24,.6)');
        bx.fillStyle = g; bx.fillRect(0, hz, BW, BH - hz);
        bx.strokeStyle = 'rgba(255,181,107,.10)'; bx.lineWidth = 1;
        for (let i = -16; i <= 16; i++) { bx.beginPath(); bx.moveTo(fx + i * 24, hz); bx.lineTo(fx + i * 170, BH); bx.stroke(); }
        const off = reduceMotion ? 0 : (t * 0.00012) % 1;
        for (let k = 0; k < 8; k++) { const y = hz + (BH - hz) * Math.pow((k + off) / 8, 1.9); bx.beginPath(); bx.moveTo(0, y); bx.lineTo(BW, y); bx.stroke(); }
        bx.fillStyle = 'rgba(255,200,140,.35)'; bx.fillRect(0, hz, BW, 1);
    }

    /* ---------------- key art for game and story cards ---------------- */
    function fit(cv) {
        const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
        if (!r.width) return null;
        if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
        const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
        return { c, W: r.width, H: r.height };
    }
    function runnerArt(c, W, H, t) {
        const hz = H * 0.42;
        let g = c.createLinearGradient(0, 0, 0, hz);
        g.addColorStop(0, '#1f1a4a'); g.addColorStop(0.55, '#5a3a86'); g.addColorStop(0.85, '#e9735a'); g.addColorStop(1, '#ffb34d');
        c.fillStyle = g; c.fillRect(0, 0, W, hz);
        c.fillStyle = '#ffd67a'; c.beginPath(); c.arc(W / 2, hz, H * 0.13, Math.PI, 0); c.fill();
        c.fillStyle = '#2c2258';
        for (let i = 0; i < 14; i++) { const w = W / 14, h = H * (0.04 + ((i * 37) % 5) * 0.02); c.fillRect(i * w, hz - h, w - 2, h); }
        c.fillStyle = '#6b4d7d'; c.fillRect(0, hz, W, H - hz);
        c.fillStyle = '#2b2450'; c.beginPath(); c.moveTo(W * 0.47, hz); c.lineTo(W * 0.53, hz); c.lineTo(W * 1.1, H); c.lineTo(-W * 0.1, H); c.closePath(); c.fill();
        c.fillStyle = '#ffb627';
        [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(W / 2 + s * W * 0.03, hz); c.lineTo(W / 2 + s * W * 0.034, hz); c.lineTo(W / 2 + s * W * 0.66, H); c.lineTo(W / 2 + s * W * 0.6, H); c.closePath(); c.fill(); });
        const off = (t * 0.0012) % 1;
        c.fillStyle = 'rgba(255,244,220,.75)';
        for (let k = 0; k < 6; k++) { const p = (k + off) / 6, y = hz + (H - hz) * p * p, w = 1 + p * 6; for (const s of [-1, 1]) { const x = W / 2 + s * W * 0.2 * p * p * 1.6; c.fillRect(x - w / 2, y, w, (H - hz) * 0.04 * p + 1); } }
        const cols = ['#e8735a', '#3fb3a7', '#f2c14e', '#9b6bd6'];
        for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const p = 0.25 + i * 0.2, x = W / 2 + s * W * (0.08 + p * 0.6), h = H * (0.1 + p * 0.35), w = W * 0.05 + p * W * 0.12; c.fillStyle = cols[(i + (s > 0 ? 1 : 0)) % 4]; c.fillRect(s < 0 ? x - w : x, hz + (H - hz) * p * p - h, w, h); }
        const fy = H * 0.86 - Math.abs(Math.sin(t * 0.012)) * 6;
        c.fillStyle = '#f0782b'; c.beginPath(); c.ellipse(W / 2, fy - H * 0.08, H * 0.06, H * 0.08, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3fb3a7'; c.fillRect(W / 2 - H * 0.04, fy - H * 0.12, H * 0.08, H * 0.07);
        c.fillStyle = '#f0782b'; c.beginPath(); c.arc(W / 2, fy - H * 0.18, H * 0.05, 0, Math.PI * 2); c.fill();
    }
    function catcherArt(c, W, H, t) {
        let g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#3f8fd6'); g.addColorStop(0.7, '#8fd3ef'); g.addColorStop(1, '#d9f2f7');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(W * 0.84, H * 0.16, H * 0.08, 0, Math.PI * 2); c.fill();
        [['noun', '#ef4f3f'], ['verb', '#3fb3a7'], ['big', '#9b6bd6'], ['she', '#e0607e']].forEach(([w, col], i) => {
            const x = W * (0.18 + i * 0.22), y = ((t * 0.03 + i * 70) % (H * 0.9)) - 20;
            c.fillStyle = col; c.beginPath(); c.ellipse(x, y - 18, 22, 16, 0, Math.PI, 0); c.fill();
            c.strokeStyle = 'rgba(35,26,69,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x, y - 6); c.stroke();
            c.fillStyle = '#fff4dc'; c.strokeStyle = '#231a45'; c.lineWidth = 2;
            c.beginPath(); if (c.roundRect) c.roundRect(x - 26, y - 6, 52, 22, 11); else c.rect(x - 26, y - 6, 52, 22); c.fill(); c.stroke();
            c.fillStyle = '#231a45'; c.font = '800 13px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText(w, x, y + 10);
        });
        const ground = H * 0.86;
        ['#e8735a', '#3fb3a7', '#f2c14e', '#9b6bd6', '#e0607e'].forEach((col, i) => { c.fillStyle = col; const w = W / 5; c.fillRect(i * w, ground - H * (0.08 + (i % 3) * 0.04), w - 3, H); });
        const bxp = W / 2 + Math.sin(t * 0.0015) * W * 0.25;
        c.fillStyle = '#c98a3f'; c.beginPath(); if (c.roundRect) c.roundRect(bxp - 34, ground - H * 0.16, 68, H * 0.09, 8); else c.rect(bxp - 34, ground - H * 0.16, 68, H * 0.09); c.fill();
        c.fillStyle = '#f0782b'; c.beginPath(); c.arc(bxp, ground - H * 0.23, H * 0.06, 0, Math.PI * 2); c.fill();
    }
    function frame(t) {
        if (!document.body.classList.contains('lb-in-chat')) {
            drawBg(t);
            if ($('activity-screen').classList.contains('active')) {
                const tt = reduceMotion ? 0 : t;
                for (const a of gameArts) { const k = fit(a.cv); if (k) (a.id === 'runner' ? runnerArt : catcherArt)(k.c, k.W, k.H, tt); }
            }
        }
        requestAnimationFrame(frame);
    }

    /* ---------------- film grain tile ---------------- */
    function grain() {
        const n = document.createElement('canvas');
        n.width = n.height = 160;
        const x = n.getContext('2d'), im = x.createImageData(160, 160);
        for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        x.putImageData(im, 0, 0);
        $('lb-grain').style.backgroundImage = 'url(' + n.toDataURL() + ')';
    }

    /* ---------------- public API used by script.js ---------------- */
    window.Lobby = {
        setActivities(activities) {
            state.activities = activities;
            const lv = learnLevels();
            if (!lv.includes(state.level)) state.level = lv[0] || 'beginner';
            render();
        },
        // server is the real server id (sent to the app); label is what the student
        // saw in the list, e.g. "Server 3" (working servers are numbered in order)
        setPlayer(name, cls, server, label) {
            state.guest = false;
            state.name = name;
            state.cls = cls;
            state.server = server;
            state.serverLabel = label || 'Server ' + server;
            $('lb-name').textContent = name;
            $('lb-meta').textContent = 'Class ' + cls + ' · ' + state.serverLabel;
            $('lb-hero-line').textContent = 'Ready when you are, ' + name + '!';
            $('new-session-btn').lastElementChild.textContent = 'End session';
            setTab('learn');
            paintTopbar();
        },
        setScore(total, rank, streak) {
            if (total !== undefined && total !== null) state.score = total;
            if (rank) state.rank = rank;
            if (streak !== undefined && streak !== null) { state.streak = streak; state.bestStreak = Math.max(state.bestStreak, streak); }
            paintTopbar();
            if ($('activity-screen').classList.contains('active')) render();
        },
        enterGuest() {
            window.switchScreen('activity');
            setTab('game');
        },
        // Called by script.js on page load. Returns the saved session (or null)
        // after putting the lobby back on the Game tab where the player left it.
        takeReturn,
        restore(l) {
            if (!l.guest && l.name) this.setPlayer(l.name, l.cls, l.server, l.serverLabel);
            Object.assign(state, {
                level: l.level || state.level, highest: l.highest || null, tried: new Set(l.tried || []),
                score: l.score || 0, rank: l.rank || state.rank, streak: l.streak || 0, bestStreak: l.bestStreak || 0
            });
            window.switchScreen('activity');
            setTab('game');
            state.sel = Math.min(Math.max(0, l.sel | 0), GAMES.length - 1);
            render();
            paintTopbar();
        },
        transition(apply, screen) {
            document.body.classList.toggle('lb-in-chat', screen === 'chat');
            if (screen === 'activity') { render(); paintTopbar(); }
            wipe(apply);
        },
        loading(show) {
            if (!show) return;
            $('lb-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
        },
        formError(message) {
            const box = $('lb-form-error');
            if (!box) { window.alert(message); return; }
            box.textContent = message;
            box.hidden = false;
            if ($('lb-setup').hidden) { $('lb-title').hidden = true; $('lb-setup').hidden = false; }
        },
        clearError() {
            const box = $('lb-form-error');
            if (box) box.hidden = true;
        }
    };

    /* ---------------- boot ---------------- */
    document.querySelectorAll('[data-lexi]').forEach((n) => { n.innerHTML = lexiSVG(); });
    document.querySelectorAll('[data-plinth]').forEach((n) => { n.innerHTML = plinthHTML(); });
    document.querySelectorAll('.lb-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('lb-title').addEventListener('click', showSetup);
    $('lb-skip-game').addEventListener('click', () => window.Lobby.enterGuest());
    $('server-number').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('start-btn').click(); } });
    grain();
    sizeBg();
    window.addEventListener('resize', sizeBg);
    paintTopbar();
    render();
    requestAnimationFrame(frame);
})();

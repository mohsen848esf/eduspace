/* ===========================================================
   Jobzlingo Word Quest — game.js
   All gameplay logic, state, UI wiring, FX.
   =========================================================== */

(() => {
  'use strict';

  // ----------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------
  const STORAGE_KEY = 'jobzlingo.wq.v1';
  const TIMER_PER_MODE = { quick: 60, marathon: 60, daily: 60, speed: 30, campaign: 60 };
  const DEV_MODE = /[?&]dev=?1?(&|$)/.test(location.search);
  if (DEV_MODE) { window.__sessionRef = () => session; }
  const QUICK_WORDS = 10;
  const DAILY_WORDS = 5;
  const MAX_WRONG = 6;
  const HINT_COSTS = { 1: 10, 2: 20, 3: 30 };
  const DIFFICULTY_MULT = { easy: 1, medium: 1.5, hard: 2 };
  const POWERUP_THRESHOLDS = { skip: 3, time: 5, '5050': 7 };

  const ACHIEVEMENTS = [
    { id: 'first_win',   name: 'First Win',        desc: 'Complete your first word',          icon: '🏆' },
    { id: 'hot_streak',  name: 'Hot Streak',       desc: '5 correct in a row',                icon: '🔥' },
    { id: 'speed_demon', name: 'Speed Demon',      desc: 'Solve a word under 10 seconds',     icon: '⚡' },
    { id: 'no_help',     name: 'No Help Needed',   desc: 'Complete 5 words without hints',    icon: '🧠' },
    { id: 'vocab_master',name: 'Vocabulary Master',desc: 'Score 1000+ in one game',           icon: '📚' },
    { id: 'daily_devotee',name:'Daily Devotee',    desc: 'Play 7 days in a row',              icon: '📅' }
  ];

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  const defaultState = () => ({
    version: 1,
    profile: {
      name: 'Player',
      createdAt: Date.now(),
      lastPlayedDay: null,
      dayStreak: 0
    },
    settings: { sound: true, haptic: true, theme: false, reduceMotion: false },
    stats: {
      gamesPlayed: 0,
      wordsCorrect: 0,
      wordsTotal: 0,
      bestStreak: 0,
      lifetimePoints: 0,
      totalSolveSeconds: 0,
      noHintCount: 0
    },
    leaderboard: [], // { name, score, mode, date, streak }
    achievements: {}, // id -> unlockedAt
    campaign: { roster: [] } // { id, name, score, solved }
  });

  let state = loadState();
  let session = null; // active game session

  // ── Platform bridge helpers (in-call mode) ───────────────
  // The game runs identically in solo mode; these helpers no-op when
  // the game isn't embedded in a call. We use the `GameBridge` global
  // exposed by game-bridge.js, which carries the postMessage protocol
  // documented at the top of that file.

  function bridge() {
    return (window && window.GameBridge) || null;
  }

  function notifyPlatformScore() {
    const b = bridge();
    if (!b || !b.isInCall || !b.isInCall()) return;
    const me = b.getCurrentPlayer && b.getCurrentPlayer();
    if (!me || !me.userId) return;
    try {
      b.onScoreUpdate(me.userId, session.score, session.idx);
    } catch (e) {
      console.warn('platform score broadcast failed', e);
    }
  }

  function notifyPlatformGameOver() {
    const b = bridge();
    if (!b || !b.isInCall || !b.isInCall()) return;
    const me = b.getCurrentPlayer && b.getCurrentPlayer();
    const scores = {};
    if (me && me.userId) scores[me.userId] = session.score;
    try {
      b.onGameOver(scores);
    } catch (e) {
      console.warn('platform game-over broadcast failed', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.version) return defaultState();
      // shallow merge with defaults to handle additive schema changes
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        profile:  { ...base.profile,  ...(parsed.profile  || {}) },
        settings: { ...base.settings, ...(parsed.settings || {}) },
        stats:    { ...base.stats,    ...(parsed.stats    || {}) },
        leaderboard: parsed.leaderboard || [],
        achievements: parsed.achievements || {},
        campaign: { roster: (parsed.campaign && parsed.campaign.roster) || [] }
      };
    } catch (e) {
      console.warn('State load failed, using defaults', e);
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('State save failed', e);
    }
  }

  // ----------------------------------------------------------
  // DOM helpers
  // ----------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('screen--active'));
    const el = document.getElementById('screen-' + id);
    if (el) {
      el.classList.add('screen--active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const mini = document.getElementById('campaign-mini');
    if (mini) mini.hidden = !(id === 'game' && session && session.mode === 'campaign' && state.campaign.roster.length > 0);
  }

  function toast(msg, kind = '') {
    const c = $('#toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' is-' + kind : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /**
   * Promise-based confirm dialog rendered inside the game iframe.
   *
   * Replaces window.confirm(), which:
   *   - shows native browser chrome (clashes with the EduSpace UI),
   *   - is blocked or muted in some embedded contexts (mobile webviews,
   *     in-call iframes), so the user could click the Back button and
   *     nothing would happen,
   *   - can't be styled to match the rest of the app.
   *
   * Usage:
   *   const ok = await confirmModal({
   *     title: 'Quit run?',
   *     message: 'Your progress this round will be lost.',
   *     confirmLabel: 'Quit',
   *     cancelLabel: 'Stay',
   *   });
   *   if (ok) endSession(false);
   */
  function confirmModal({
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
  } = {}) {
    return new Promise((resolve) => {
      const modal = $('#confirm-modal');
      if (!modal) {
        // Fallback if the page hasn't been updated to include the
        // confirm modal markup. We don't fall back to window.confirm
        // because it doesn't work in some embedded contexts.
        console.warn('confirm-modal markup missing; auto-confirming');
        resolve(true);
        return;
      }

      const titleEl = $('#confirm-modal-title', modal);
      const msgEl = $('#confirm-modal-message', modal);
      const okBtn = $('#confirm-modal-ok', modal);
      const cancelBtn = $('#confirm-modal-cancel', modal);
      const backdrop = modal.querySelector('.modal-backdrop');

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmLabel;
      cancelBtn.textContent = cancelLabel;

      const cleanup = (result) => {
        modal.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onKey = (e) => {
        if (e.key === 'Escape') onCancel();
        else if (e.key === 'Enter') onOk();
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);

      modal.hidden = false;
      // Move focus into the modal so keyboard users land on a real
      // control instead of whatever was focused beneath.
      setTimeout(() => okBtn.focus(), 30);
    });
  }

  // ----------------------------------------------------------
  // AUDIO (Web Audio API tones)
  // ----------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!state.settings.sound) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    return audioCtx;
  }
  function playTone(freq, dur = 0.15, type = 'sine', vol = 0.15) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  const SFX = {
    correct: () => { playTone(660, 0.12); setTimeout(() => playTone(880, 0.15), 80); },
    wrong:   () => playTone(180, 0.2, 'sawtooth', 0.12),
    hint:    () => playTone(520, 0.08, 'triangle', 0.1),
    win:     () => { playTone(523, 0.12); setTimeout(() => playTone(659, 0.12), 120); setTimeout(() => playTone(784, 0.12), 240); setTimeout(() => playTone(1047, 0.25), 360); },
    lose:    () => { playTone(440, 0.15, 'sawtooth'); setTimeout(() => playTone(330, 0.15, 'sawtooth'), 150); setTimeout(() => playTone(220, 0.3, 'sawtooth'), 300); },
    tick:    () => playTone(880, 0.04, 'square', 0.06)
  };
  function vibe(pattern) {
    if (!state.settings.haptic) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ----------------------------------------------------------
  // BACKGROUND PARTICLES (canvas)
  // ----------------------------------------------------------
  function initBackground() {
    const canvas = $('#bg-canvas');
    const ctx = canvas.getContext('2d');
    let w, h, particles, mouseX = 0, mouseY = 0;

    function resize() {
      w = canvas.width = window.innerWidth * window.devicePixelRatio;
      h = canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    function makeParticles() {
      const count = Math.min(50, Math.floor(window.innerWidth / 24));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        hue: 220 + Math.random() * 60
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // Parallax offset based on mouse (desktop)
      const ox = (mouseX - window.innerWidth / 2) * 0.01;
      const oy = (mouseY - window.innerHeight / 2) * 0.01;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x + ox, p.y + oy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, 0.5)`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize(); makeParticles(); draw();
    window.addEventListener('resize', () => { resize(); makeParticles(); });
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  }

  // ----------------------------------------------------------
  // CONFETTI
  // ----------------------------------------------------------
  function burstConfetti() {
    const canvas = $('#confetti-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);

    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#f472b6'];
    const pieces = Array.from({ length: 80 }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 3,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      g: 0.35,
      size: Math.random() * 8 + 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0
    }));
    let frame = 0;
    function step() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      pieces.forEach(p => {
        if (p.life > 120) return;
        alive = true;
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      });
      frame++;
      if (alive && frame < 200) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    step();
  }

  // ----------------------------------------------------------
  // WORD SELECTION
  // ----------------------------------------------------------
  function filterWords(difficulty) {
    if (!difficulty || difficulty === 'mixed') return WORD_DATABASE.slice();
    return WORD_DATABASE.filter(w => w.difficulty === difficulty);
  }
  function shuffle(arr, seed) {
    const a = arr.slice();
    let rand = seed != null ? mulberry32(seed) : Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = seed;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function dailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function pickSessionWords(mode, difficulty) {
    const pool = filterWords(difficulty);
    if (mode === 'daily') {
      const seed = dailySeed();
      return shuffle(pool, seed).slice(0, DAILY_WORDS);
    }
    if (mode === 'quick' || mode === 'speed') {
      return shuffle(pool).slice(0, QUICK_WORDS);
    }
    if (mode === 'campaign') {
      // every word in the pool, easy → medium → hard, no early end
      const order = { easy: 0, medium: 1, hard: 2 };
      return [...pool].sort((a, b) => (order[a.difficulty] ?? 9) - (order[b.difficulty] ?? 9));
    }
    // marathon: full shuffled pool, loops back to start
    return shuffle(pool);
  }

  // ----------------------------------------------------------
  // SESSION (game run)
  // ----------------------------------------------------------
  function startSession(mode, difficulty) {
    session = {
      mode,
      difficulty,
      words: pickSessionWords(mode, difficulty),
      idx: 0,
      score: 0,
      streak: 0,
      bestStreakThisRun: 0,
      wrongsTotalRun: 0,
      noHintRun: 0,
      powerups: { skip: 0, time: 0, '5050': 0 },
      perWord: null,
      finalBreakdown: []
    };
    // comeback bonus
    const lastDay = state.profile.lastPlayedDay;
    if (lastDay) {
      const today = new Date().toISOString().slice(0,10);
      const daysSince = (Date.parse(today) - Date.parse(lastDay)) / 86400000;
      if (daysSince >= 3) {
        session.score += 100;
        toast('Welcome back! +100 comeback bonus 🎁', 'success');
      }
    }
    nextWord();
    showScreen('game');
    if (session && session.mode === 'campaign') renderCampaignMini();
    else $('#campaign-mini').hidden = true;
  }

  function nextWord() {
    if (!session) return;
    // Marathon: loop pool if exhausted
    if (session.idx >= session.words.length) {
      if (session.mode === 'marathon') {
        session.words = shuffle(session.words);
        session.idx = 0;
      } else {
        endSession(true);
        return;
      }
    }
    const w = session.words[session.idx];
    session.perWord = {
      word: w,
      guesses: new Set(),         // letters guessed
      wrongs: 0,
      hintsUsed: new Set(),       // hint numbers used
      revealedIdx: new Set(),     // letter indices currently shown
      hintPenalty: 0,
      timer: TIMER_PER_MODE[session.mode],
      timerMax: TIMER_PER_MODE[session.mode],
      timerHandle: null,
      startedAt: Date.now(),
      eliminated: new Set(),      // letters eliminated via 50/50
      forcedRevealedByHint: new Set()
    };
    if (DEV_MODE) {
      session.powerups.skip = Math.max(session.powerups.skip, 9);
      session.powerups.time = Math.max(session.powerups.time, 9);
      session.powerups['5050'] = Math.max(session.powerups['5050'], 9);
    }
    renderGameWord();
    startTimer();
    setMascotImg('game-mascot', 'thinking');
  }

  // ----------------------------------------------------------
  // RENDER GAME
  // ----------------------------------------------------------
  function renderGameWord() {
    const s = session, p = s.perWord, w = p.word;
    // Header
    $('#game-score').textContent = s.score;
    $('#game-streak').textContent = s.streak;
    const total = s.mode === 'marathon' ? '∞' : s.words.length;
    $('#game-progress').textContent = `${s.idx + 1}/${total}`;
    $('#word-diff').textContent = w.difficulty;
    $('#word-diff').setAttribute('data-diff', w.difficulty);

    // Sentence with blank
    const blankHtml = '<span class="sentence-blank" aria-label="blank"></span>';
    $('#word-sentence').innerHTML = w.sentence.replace(/_+/, blankHtml);

    // Letter boxes
    const row = $('#letter-row');
    row.innerHTML = '';
    [...w.word].forEach((ch, i) => {
      const box = document.createElement('div');
      box.className = 'letter-box';
      box.dataset.idx = i;
      row.appendChild(box);
    });

    // Hint reveal cleared
    $('#hint-reveal').textContent = '';

    // Wrong dots
    const dots = $('#wrongs-dots');
    dots.innerHTML = '';
    for (let i = 0; i < MAX_WRONG; i++) {
      const d = document.createElement('div');
      d.className = 'wrong-dot';
      dots.appendChild(d);
    }

    // Keyboard
    renderKeyboard();

    // Hints reset (state.hintsUsed empty -> all available)
    $$('.hint-btn').forEach(b => {
      b.classList.remove('is-used');
      b.disabled = false;
    });

    // Powerups
    renderPowerups();
  }

  function renderKeyboard() {
    const rows = [
      'QWERTYUIOP'.split(''),
      'ASDFGHJKL'.split(''),
      'ZXCVBNM'.split('')
    ];
    const kb = $('#keyboard');
    kb.innerHTML = '';
    rows.forEach(letters => {
      const r = document.createElement('div');
      r.className = 'kb-row';
      letters.forEach(L => {
        const b = document.createElement('button');
        b.className = 'kb-key';
        b.textContent = L;
        b.dataset.letter = L;
        b.addEventListener('click', () => onGuess(L));
        r.appendChild(b);
      });
      kb.appendChild(r);
    });
  }

  function renderPowerups() {
    $$('.power-btn').forEach(btn => {
      const key = btn.dataset.power;
      const have = session.powerups[key] > 0;
      btn.disabled = !have;
      btn.textContent = have
        ? `${powerLabel(key)} ×${session.powerups[key]}`
        : powerLabel(key);
    });
  }
  function powerLabel(key) {
    if (key === 'skip')  return '⏭ Skip';
    if (key === 'time')  return '⏱ +15s';
    if (key === '5050')  return '🎯 50/50';
    return key;
  }

  // ----------------------------------------------------------
  // TIMER
  // ----------------------------------------------------------
  function startTimer() {
    stopTimer();
    const p = session.perWord;
    if (!p.timerMax) p.timerMax = TIMER_PER_MODE[session.mode];
    updateTimerUI(p.timer, p.timerMax);
    p.timerHandle = setInterval(() => {
      // Classroom mode pauses the timer when the host pauses. We
      // skip the decrement and the SFX/timeout checks until the
      // host resumes.
      if (window.__classroomPaused) return;
      p.timer--;
      updateTimerUI(p.timer, p.timerMax);
      if (p.timer <= 5 && p.timer > 0) SFX.tick();
      if (p.timer <= 0) {
        stopTimer();
        onTimeout();
      }
    }, 1000);
  }
  function stopTimer() {
    if (session && session.perWord && session.perWord.timerHandle) {
      clearInterval(session.perWord.timerHandle);
      session.perWord.timerHandle = null;
    }
  }
  function updateTimerUI(remaining, total) {
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
    const bar = $('#timer-fill');
    bar.style.width = pct + '%';
    bar.classList.toggle('is-warn', pct < 50 && pct >= 25);
    bar.classList.toggle('is-danger', pct < 25);
    $('#timer-text').textContent = Math.max(0, remaining);
  }

  // ----------------------------------------------------------
  // GUESSING
  // ----------------------------------------------------------
  function onGuess(letter) {
    if (!session || !session.perWord) return;
    const p = session.perWord;
    letter = letter.toUpperCase();
    const w = p.word.word;
    // Find ALL positions of this letter that are NOT YET revealed
    const indices = [];
    [...w].forEach((ch, i) => {
      if (ch === letter && !p.revealedIdx.has(i)) indices.push(i);
    });
    const letterInWord = [...w].includes(letter);
    // If letter is in word but every position is already revealed → no-op
    if (letterInWord && indices.length === 0) return;
    // If letter already tried AND not in word → no-op
    if (!letterInWord && p.guesses.has(letter)) return;
    p.guesses.add(letter);

    const keyBtn = $(`.kb-key[data-letter="${letter}"]`);

    if (indices.length) {
      // Correct
      indices.forEach(i => p.revealedIdx.add(i));
      paintLetters();
      if (keyBtn) { keyBtn.classList.remove('is-hint'); keyBtn.classList.add('is-correct'); }
      SFX.correct();
      vibe(15);
      if (isWordSolved()) {
        onWordWin();
      }
    } else {
      // Wrong
      p.wrongs++;
      paintWrongs();
      if (keyBtn) keyBtn.classList.add('is-wrong');
      SFX.wrong();
      vibe([30, 60, 30]);
      // Localized feedback only — no full-screen shake (accessibility)
      if (keyBtn) {
        keyBtn.classList.add('is-wrong-flash');
        setTimeout(() => keyBtn.classList.remove('is-wrong-flash'), 250);
      }
      const wrongsWrap = $('#wrongs-dots');
      if (wrongsWrap) {
        wrongsWrap.classList.add('is-shake-sm');
        setTimeout(() => wrongsWrap.classList.remove('is-shake-sm'), 300);
      }
      setMascotImg('game-mascot', 'sad');
      setTimeout(() => setMascotImg('game-mascot', 'thinking'), 700);
      if (p.wrongs >= MAX_WRONG) {
        onWordLose('Out of guesses');
      }
    }
  }

  function paintLetters() {
    const p = session.perWord;
    const w = p.word.word;
    $$('.letter-box').forEach((box, i) => {
      if (p.revealedIdx.has(i)) {
        if (box.textContent !== w[i]) {
          box.textContent = w[i];
          box.classList.add('is-revealed');
          if (p.forcedRevealedByHint.has(i)) box.classList.add('is-hint');
        }
      }
    });
  }
  function paintWrongs() {
    const dots = $$('#wrongs-dots .wrong-dot');
    const w = session.perWord.wrongs;
    dots.forEach((d, i) => d.classList.toggle('is-active', i < w));
  }
  function isWordSolved() {
    const p = session.perWord;
    return [...p.word.word].every((ch, i) => p.revealedIdx.has(i));
  }

  // ----------------------------------------------------------
  // HINTS
  // ----------------------------------------------------------
  function useHint(num) {
    if (!session) return;
    const p = session.perWord;
    if (p.hintsUsed.has(num)) return;
    p.hintsUsed.add(num);
    p.hintPenalty += HINT_COSTS[num];
    SFX.hint();
    vibe(10);

    const btn = document.querySelector(`.hint-btn[data-hint="${num}"]`);
    btn.classList.add('is-used'); btn.disabled = true;

    if (num === 1) {
      const hintCat = p.word.hintCategory || p.word.category;
      $('#hint-reveal').textContent = `Category: ${hintCat}`;
    } else if (num === 2) {
      const w = p.word.word;
      const firstKnown = p.revealedIdx.has(0);
      const lastKnown = p.revealedIdx.has(w.length - 1);
      let msg = '';
      if (!firstKnown && !lastKnown) {
        revealIndex(0, true);
        revealIndex(w.length - 1, true);
        msg = 'First & last letter revealed';
      } else if (!firstKnown && lastKnown) {
        revealIndex(0, true);
        msg = 'First letter revealed';
      } else if (firstKnown && !lastKnown) {
        revealIndex(w.length - 1, true);
        msg = 'Last letter revealed';
      } else {
        const remaining = [];
        for (let i = 0; i < w.length; i++) if (!p.revealedIdx.has(i)) remaining.push(i);
        if (remaining.length) {
          const pick = remaining[Math.floor(Math.random() * remaining.length)];
          revealIndex(pick, true);
          msg = 'A random letter was revealed';
        } else {
          msg = 'All letters already revealed';
        }
      }
      $('#hint-reveal').textContent = msg;
    } else if (num === 3) {
      const w = p.word.word;
      const mid = [];
      for (let i = 1; i < w.length - 1; i++) {
        if (!p.revealedIdx.has(i)) mid.push(i);
      }
      if (mid.length) {
        const pick = mid[Math.floor(Math.random() * mid.length)];
        revealIndex(pick, true);
        $('#hint-reveal').textContent = `Middle letter revealed`;
      } else {
        $('#hint-reveal').textContent = `No middle letters left to reveal`;
      }
    }
    if (isWordSolved()) onWordWin();
  }
  function revealIndex(i, fromHint) {
    const p = session.perWord;
    if (p.revealedIdx.has(i)) return;
    p.revealedIdx.add(i);
    if (fromHint) p.forcedRevealedByHint.add(i);
    const ch = p.word.word[i];
    const kb = $(`.kb-key[data-letter="${ch}"]`);
    if (kb && !kb.classList.contains('is-correct')) {
      // Mark hint styling only if no positions of this letter remain unrevealed
      const hasRemaining = [...p.word.word].some((c, idx) => c === ch && !p.revealedIdx.has(idx));
      if (!hasRemaining) kb.classList.add('is-hint');
    }
    paintLetters();
  }

  // ----------------------------------------------------------
  // POWERUPS
  // ----------------------------------------------------------
  function usePower(key) {
    if (!session || !session.powerups[key]) return;
    session.powerups[key]--;
    if (key === 'skip') {
      toast('Skipped!', 'warn');
      stopTimer();
      session.idx++;
      session.streak = 0;
      $('#game-streak').textContent = 0;
      nextWord();
    } else if (key === 'time') {
      const p = session.perWord;
      p.timer += 15;
      p.timerMax = Math.max(p.timerMax || TIMER_PER_MODE[session.mode], p.timer);
      toast('+15 seconds', 'success');
      updateTimerUI(p.timer, p.timerMax);
    } else if (key === '5050') {
      do5050();
    }
    renderPowerups();
  }
  function do5050() {
    const p = session.perWord;
    const w = p.word.word;
    const inWord = new Set([...w]);
    const candidates = [];
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(L => {
      if (!inWord.has(L) && !p.guesses.has(L) && !p.eliminated.has(L)) candidates.push(L);
    });
    const elim = shuffle(candidates).slice(0, Math.min(5, candidates.length));
    elim.forEach(L => {
      p.eliminated.add(L);
      const k = $(`.kb-key[data-letter="${L}"]`);
      if (k) { k.classList.add('is-wrong'); k.disabled = true; }
    });
    toast('5 letters eliminated', 'success');
  }

  // ----------------------------------------------------------
  // WORD WIN / LOSE
  // ----------------------------------------------------------
  function onWordWin() {
    stopTimer();
    const p = session.perWord;
    const timeSpent = (TIMER_PER_MODE[session.mode] - p.timer);
    session.bestStreakThisRun = Math.max(session.bestStreakThisRun, session.streak + 1);
    session.streak++;
    if (p.hintsUsed.size === 0) session.noHintRun++;

    SFX.win();
    vibe([50, 30, 50, 30, 80]);
    burstConfetti();
    setMascotImg('game-mascot', session.streak >= 3 ? 'excited' : 'happy');

    // Stats updates
    state.stats.wordsCorrect++;
    state.stats.wordsTotal++;
    state.stats.totalSolveSeconds += timeSpent;
    if (p.hintsUsed.size === 0) state.stats.noHintCount++;
    state.stats.bestStreak = Math.max(state.stats.bestStreak, session.streak);

    // Score breakdown
    const breakdown = computeScore(p, timeSpent, true);
    breakdown.word = p.word.word;
    session.score += breakdown.total;
    session.finalBreakdown.push(breakdown);

    // Broadcast to the platform (in-call mode) so the host overlay
    // can show this user's current score. No-op in solo mode because
    // GameBridge.isInCall() is false.
    notifyPlatformScore();

    // Powerup grants
    grantPowerups();

    // Achievements
    checkAchievements({ wonWord: true, hintsUsed: p.hintsUsed.size, timeSpent, streak: session.streak });

    saveState();
    if (session.mode === 'campaign' && state.campaign.roster.length > 0) {
      openAttribution(breakdown, timeSpent);
      return;
    }
    showWordResult(true, breakdown, timeSpent);
  }

  function onWordLose(reason) {
    stopTimer();
    const p = session.perWord;
    // Reveal full word visually
    [...p.word.word].forEach((_, i) => p.revealedIdx.add(i));
    paintLetters();

    SFX.lose();
    vibe([100, 50, 100]);
    setMascotImg('game-mascot', 'sad');

    state.stats.wordsTotal++;
    session.streak = 0;
    session.wrongsTotalRun++;

    const breakdown = { base: 0, time: 0, streak: 0, diff: 0, perfect: 0, hint: -p.hintPenalty, total: 0, won: false, reason, word: p.word.word };
    session.finalBreakdown.push(breakdown);

    saveState();

    // Marathon end if 3 wrong words
    if (session.mode === 'marathon' && session.wrongsTotalRun >= 3) {
      showWordResult(false, breakdown, TIMER_PER_MODE[session.mode] - p.timer);
      return;
    }
    showWordResult(false, breakdown, TIMER_PER_MODE[session.mode] - p.timer);
  }

  function onTimeout() {
    onWordLose('Time up');
  }

  function computeScore(p, timeSpent, won) {
    if (!won) {
      return { base: 0, time: 0, streak: 0, diff: 0, perfect: 0, hint: -p.hintPenalty, total: 0, won: false };
    }
    const base = 100;
    const timeBonus = Math.max(0, TIMER_PER_MODE[session.mode] - timeSpent) * 2;
    const diffMult = DIFFICULTY_MULT[p.word.difficulty] || 1;
    const streakMult = session.streak >= 10 ? 3 : session.streak >= 5 ? 2 : session.streak >= 3 ? 1.5 : 1;
    const speedBonus = session.mode === 'speed' ? 2 : 1;
    const perfect = (p.hintsUsed.size === 0 && p.wrongs === 0) ? 50 : 0;
    const raw = (base + timeBonus) * diffMult * streakMult * speedBonus + perfect - p.hintPenalty;
    return {
      base, time: timeBonus, streak: streakMult, diff: diffMult, perfect,
      hint: -p.hintPenalty, speed: speedBonus,
      total: Math.max(0, Math.round(raw)),
      won: true
    };
  }

  function grantPowerups() {
    Object.entries(POWERUP_THRESHOLDS).forEach(([key, thresh]) => {
      if (session.streak === thresh) {
        session.powerups[key]++;
        toast(`Power-up earned: ${powerLabel(key)}`, 'success');
      }
    });
  }

  // ----------------------------------------------------------
  // ACHIEVEMENTS
  // ----------------------------------------------------------
  function unlock(id) {
    if (state.achievements[id]) return false;
    state.achievements[id] = Date.now();
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (a) toast(`🏅 Unlocked: ${a.name}`, 'success');
    saveState();
    return true;
  }
  function checkAchievements(ctx) {
    const unlocked = [];
    if (ctx.wonWord && state.stats.wordsCorrect >= 1 && unlock('first_win')) unlocked.push('first_win');
    if (ctx.streak >= 5 && unlock('hot_streak')) unlocked.push('hot_streak');
    if (ctx.wonWord && ctx.timeSpent <= 10 && unlock('speed_demon')) unlocked.push('speed_demon');
    if (state.stats.noHintCount >= 5 && unlock('no_help')) unlocked.push('no_help');
    if (session && session.score >= 1000 && unlock('vocab_master')) unlocked.push('vocab_master');
    if (state.profile.dayStreak >= 7 && unlock('daily_devotee')) unlocked.push('daily_devotee');
    return unlocked;
  }

  // ----------------------------------------------------------
  // WORD RESULT VIEW
  // ----------------------------------------------------------
  function showWordResult(won, breakdown, timeSpent) {
    const p = session.perWord;
    const title = won ? (session.streak >= 3 ? 'Streak! 🔥' : 'Solved!') : (breakdown.reason || 'Missed');
    $('#result-title').textContent = title;
    $('#result-title').classList.toggle('is-loss', !won);
    $('#result-word').textContent = p.word.word;
    $('#result-cat').textContent = `${p.word.category} · ${p.word.difficulty}`;
    $('#result-tip').textContent = p.word.tip;

    setMascotImg('result-mascot', won ? (session.streak >= 3 ? 'excited' : 'happy') : 'sad');

    const bd = $('#score-breakdown');
    if (won) {
      bd.innerHTML = `
        <div class="score-row"><span>Base</span><span>+${breakdown.base}</span></div>
        <div class="score-row"><span>Time bonus (${TIMER_PER_MODE[session.mode] - timeSpent}s left)</span><span>+${breakdown.time}</span></div>
        <div class="score-row"><span>Difficulty ×${breakdown.diff}</span><span></span></div>
        <div class="score-row"><span>Streak ×${breakdown.streak}</span><span></span></div>
        ${breakdown.speed > 1 ? `<div class="score-row"><span>Speed Run ×${breakdown.speed}</span><span></span></div>` : ''}
        ${breakdown.perfect ? `<div class="score-row is-pos"><span>Perfect round</span><span>+${breakdown.perfect}</span></div>` : ''}
        ${breakdown.hint ? `<div class="score-row is-neg"><span>Hints</span><span>${breakdown.hint}</span></div>` : ''}
        <div class="score-row is-total"><span>This word</span><span>+${breakdown.total}</span></div>
      `;
    } else {
      bd.innerHTML = `
        <div class="score-row"><span>Word reveal</span><span>${p.word.word}</span></div>
        <div class="score-row is-neg"><span>No points awarded</span><span>—</span></div>
      `;
    }

    // Recent achievements strip
    const recent = ACHIEVEMENTS.filter(a => state.achievements[a.id] && Date.now() - state.achievements[a.id] < 5000);
    $('#achievements-strip').innerHTML = recent.map(a =>
      `<span class="ach-pop">${a.icon} ${a.name}</span>`
    ).join('');

    // Next button: marathon-end check
    const isRunOver = (session.mode === 'marathon' && session.wrongsTotalRun >= 3) ||
                      (session.mode !== 'marathon' && session.idx + 1 >= session.words.length);
    $('#result-next').textContent = isRunOver ? 'See Final Score' : 'Next Word';

    showScreen('result');
  }

  // ----------------------------------------------------------
  // SESSION END
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // CAMPAIGN — roster, attribution, mini-leaderboard
  // ----------------------------------------------------------
  let pendingAttribution = null; // { breakdown, timeSpent } while attribution modal is open

  function toggleHomeForCampaign() {
    const isCampaign = $('#mode-select') && $('#mode-select').value === 'campaign';
    const inline = $('#roster-inline');
    const list = $('#lb-preview-list');
    const tag = $('#lb-card-tag');
    if (!inline || !list || !tag) return;
    if (isCampaign) {
      inline.hidden = false;
      list.hidden = true;
      tag.textContent = 'Campaign Roster';
      renderRosterInline();
    } else {
      inline.hidden = true;
      list.hidden = false;
      tag.textContent = 'Top Scores';
    }
  }

  function renderRosterInline() {
    const ul = $('#roster-rank-list');
    if (!ul) return;
    const ranked = [...state.campaign.roster].sort((a, b) => b.score - a.score || b.solved - a.solved);
    if (ranked.length === 0) {
      ul.innerHTML = '<li class="lb-empty">No students yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = ranked.map(p => `
      <li data-id="${p.id}"${p.isLocal ? ' class="is-you"' : ''}>
        <span class="rr-name">${escapeHtml(p.name)}${p.isLocal ? ' <span class="rr-you">You</span>' : ''}</span>
        <span class="rr-score">${p.score}</span>
        <button class="rr-remove" data-remove-home="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button>
      </li>
    `).join('');
  }

  function wireRosterInline() {
    const addBtn = $('#roster-add-home');
    const input = $('#roster-input-home');
    const resetBtn = $('#roster-reset-home');
    if (!addBtn || !input) return;
    addBtn.addEventListener('click', () => {
      if (addCampaignPlayer(input.value)) { input.value = ''; renderRosterInline(); input.focus(); }
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') addBtn.click();
    });
    $('#roster-rank-list').addEventListener('click', e => {
      const id = e.target.getAttribute('data-remove-home');
      if (!id) return;
      state.campaign.roster = state.campaign.roster.filter(p => p.id !== id);
      saveState();
      renderRosterInline();
    });
    resetBtn.addEventListener('click', () => {
      if (state.campaign.roster.length === 0) return;
      state.campaign.roster.forEach(p => { p.score = 0; p.solved = 0; });
      saveState();
      renderRosterInline();
      toast('Scores reset', 'success');
    });
  }

  function openCampaignSetup(diff) {
    renderRoster();
    $('#campaign-setup-modal').dataset.diff = diff;
    $('#campaign-setup-modal').hidden = false;
    setTimeout(() => $('#roster-input').focus(), 50);
  }
  function closeCampaignSetup() { $('#campaign-setup-modal').hidden = true; }

  function renderRoster() {
    const ul = $('#roster-list');
    ul.innerHTML = state.campaign.roster.map(p => `
      <li data-id="${p.id}">
        <span class="roster-name">${escapeHtml(p.name)}</span>
        <span class="roster-score">${p.score} pts · ${p.solved} solved</span>
        <button class="roster-remove" data-remove="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button>
      </li>
    `).join('');
    $('#roster-begin').disabled = state.campaign.roster.length < 1;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function addCampaignPlayer(name) {
    const trimmed = String(name || '').trim().slice(0, 20);
    if (!trimmed) return false;
    state.campaign.roster.push({
      id: 'p' + Date.now() + Math.floor(Math.random() * 1000),
      name: trimmed, score: 0, solved: 0
    });
    saveState();
    renderRoster();
    return true;
  }

  function wireCampaignSetup() {
    $('#campaign-setup-modal').addEventListener('click', e => {
      if (e.target.hasAttribute('data-close')) closeCampaignSetup();
      const removeId = e.target.getAttribute('data-remove');
      if (removeId) {
        state.campaign.roster = state.campaign.roster.filter(p => p.id !== removeId);
        saveState();
        renderRoster();
      }
    });
    $('#roster-add-btn').addEventListener('click', () => {
      const input = $('#roster-input');
      if (addCampaignPlayer(input.value)) { input.value = ''; input.focus(); }
    });
    $('#roster-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#roster-add-btn').click();
    });
    $('#roster-reset').addEventListener('click', () => {
      state.campaign.roster.forEach(p => { p.score = 0; p.solved = 0; });
      saveState();
      renderRoster();
      toast('Scores reset', 'success');
    });
    $('#roster-begin').addEventListener('click', () => {
      if (state.campaign.roster.length < 1) return;
      const diff = $('#campaign-setup-modal').dataset.diff || 'mixed';
      closeCampaignSetup();
      startSession('campaign', diff);
      renderCampaignMini();
    });
  }

  function renderCampaignMini() {
    const mini = $('#campaign-mini');
    if (!session || session.mode !== 'campaign' || state.campaign.roster.length === 0) {
      mini.hidden = true; return;
    }
    const top = [...state.campaign.roster].sort((a, b) => b.score - a.score).slice(0, 5);
    $('#campaign-mini-list').innerHTML = top.map(p => `
      <li><span></span><span>${escapeHtml(p.name)}</span><span class="cm-score">${p.score}</span></li>
    `).join('');
    mini.hidden = false;
  }

  function openAttribution(breakdown, timeSpent) {
    pendingAttribution = { breakdown, timeSpent };
    $('#attribution-word').textContent = breakdown.word;
    $('#attribution-points').textContent = `+${breakdown.total} points`;
    const grid = $('#attribution-grid');
    grid.innerHTML = state.campaign.roster.map(p => `
      <button class="attr-btn" data-player="${p.id}">
        ${escapeHtml(p.name)}
        <span class="attr-cur">${p.score} pts</span>
      </button>
    `).join('');
    $('#attribution-modal').hidden = false;
  }

  function wireAttribution() {
    $('#attribution-grid').addEventListener('click', e => {
      const btn = e.target.closest('.attr-btn');
      if (!btn) return;
      const id = btn.dataset.player;
      const player = state.campaign.roster.find(p => p.id === id);
      if (player && pendingAttribution) {
        player.score += pendingAttribution.breakdown.total;
        player.solved += 1;
        saveState();
        toast(`${player.name}: +${pendingAttribution.breakdown.total} pts`, 'success');
      }
      finishAttribution();
    });
    $('#attribution-skip').addEventListener('click', finishAttribution);
  }

  function finishAttribution() {
    $('#attribution-modal').hidden = true;
    if (!pendingAttribution) return;
    const { breakdown, timeSpent } = pendingAttribution;
    pendingAttribution = null;
    renderCampaignMini();
    showWordResult(true, breakdown, timeSpent);
  }

  function endSession(reachedEnd) {
    if (!session) return;
    stopTimer();

    state.stats.gamesPlayed++;
    state.stats.lifetimePoints += session.score;

    // Update daily streak
    const today = new Date().toISOString().slice(0,10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    if (state.profile.lastPlayedDay === today) {
      // already counted today
    } else if (state.profile.lastPlayedDay === yesterday) {
      state.profile.dayStreak++;
    } else {
      state.profile.dayStreak = 1;
    }
    state.profile.lastPlayedDay = today;

    // Leaderboard entry
    if (session.score > 0) {
      state.leaderboard.push({
        name: state.profile.name || 'Player',
        score: session.score,
        mode: session.mode,
        date: today,
        streak: session.bestStreakThisRun
      });
      state.leaderboard.sort((a, b) => b.score - a.score);
      state.leaderboard = state.leaderboard.slice(0, 50);
    }

    // Achievements that depend on session
    checkAchievements({ wonWord: false, streak: session.bestStreakThisRun });

    saveState();
    renderGameOver();
    notifyPlatformGameOver();
  }

  function renderGameOver() {
    $('#final-score').textContent = session.score;
    const summary = `${session.mode === 'marathon' ? 'Marathon' : session.mode[0].toUpperCase() + session.mode.slice(1)} · Best streak ${session.bestStreakThisRun}`;
    $('#final-meta').textContent = summary;
    const wins = session.finalBreakdown.filter(b => b.won).length;
    const losses = session.finalBreakdown.length - wins;
    $('#final-breakdown').innerHTML = `
      <div class="score-row"><span>Words solved</span><span>${wins}</span></div>
      <div class="score-row"><span>Words missed</span><span>${losses}</span></div>
      <div class="score-row"><span>Best streak this run</span><span>${session.bestStreakThisRun} 🔥</span></div>
      <div class="score-row is-total"><span>Final score</span><span>${session.score}</span></div>
    `;
    renderCampaignFinal();
    $('#campaign-mini').hidden = true;

    // In classroom mode, show podium instead of game over
    if (isClassroomMode() && classroom && classroom.players && classroom.players.length > 0) {
      renderPodium();
    } else {
      showScreen('gameover');
    }
  }

  function renderPodium() {
    // Get scores from classroom players
    const players = classroom.players || [];
    // Sort by score descending
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Update podium slots
    const ranks = [1, 2, 3];
    ranks.forEach(rank => {
      const player = sorted[rank - 1];
      const nameEl = document.getElementById(`podium-${rank}-name`);
      const scoreEl = document.getElementById(`podium-${rank}-score`);
      if (nameEl && scoreEl) {
        if (player) {
          nameEl.textContent = player.name || 'Unknown';
          scoreEl.textContent = player.score || 0;
        } else {
          nameEl.textContent = '—';
          scoreEl.textContent = '0';
        }
      }
    });

    showScreen('podium');
  }

  function renderCampaignFinal() {
    const box = $('#campaign-final');
    if (!session || session.mode !== 'campaign' || state.campaign.roster.length === 0) {
      box.hidden = true; return;
    }
    const ranked = [...state.campaign.roster].sort((a, b) => b.score - a.score || b.solved - a.solved);
    $('#campaign-final-list').innerHTML = ranked.map(p => `
      <li>
        <span></span>
        <span class="cf-name">${escapeHtml(p.name)}</span>
        <span class="cf-solved">${p.solved} solved</span>
        <span class="cf-score">${p.score}</span>
      </li>
    `).join('');
    box.hidden = false;
  }

  // ----------------------------------------------------------
  // MASCOTS
  // ----------------------------------------------------------
  const MASCOT_EMOJI = { happy: '😄', thinking: '🤔', sad: '😢', excited: '🤩' };
  function setMascotImg(elemId, mood) {
    const img = document.getElementById(elemId);
    if (!img) return;
    const fb = img.nextElementSibling;
    img.src = `assets/mascot-${mood}.svg`;
    img.classList.remove('is-celebrate', 'is-sad');
    if (mood === 'excited' || mood === 'happy') img.classList.add('is-celebrate');
    if (mood === 'sad') img.classList.add('is-sad');
    if (fb && fb.classList.contains('mascot-fallback')) fb.textContent = MASCOT_EMOJI[mood] || '🤖';
  }

  // ----------------------------------------------------------
  // HOME RENDER
  // ----------------------------------------------------------
  function renderHome() {
    $('#home-streak').textContent = state.profile.dayStreak;
    $('#home-points').textContent = state.stats.lifetimePoints.toLocaleString();
    toggleHomeForCampaign();

    // Word of the day
    const seed = dailySeed();
    const wotd = shuffle(WORD_DATABASE, seed)[0];
    if (wotd) {
      $('#wotd-sentence').textContent = wotd.sentence.replace(/_+/, '_____');
      $('#wotd-category').textContent = wotd.category;
      $('#wotd-play').onclick = () => {
        // Force a single-word session
        session = {
          mode: 'quick', difficulty: 'mixed',
          words: [wotd], idx: 0, score: 0, streak: 0, bestStreakThisRun: 0,
          wrongsTotalRun: 0, noHintRun: 0,
          powerups: { skip: 0, time: 0, '5050': 0 },
          perWord: null, finalBreakdown: []
        };
        nextWord();
        showScreen('game');
      };
    }

    // Leaderboard preview
    renderLeaderboardPreview();
  }
  function renderLeaderboardPreview() {
    const list = $('#lb-preview-list');
    const top = state.leaderboard.slice(0, 3);
    if (!top.length) {
      list.innerHTML = '<li class="lb-empty">No scores yet. Be the first!</li>';
      return;
    }
    list.innerHTML = top.map(e =>
      `<li><span>${escapeHtml(e.name)}</span><span class="lb-meta">${e.score}</span></li>`
    ).join('');
  }
  function renderLeaderboard(filter = 'all') {
    const list = $('#lb-full-list');
    let rows = state.leaderboard.slice();
    if (filter !== 'all') rows = rows.filter(e => e.mode === filter);
    rows = rows.slice(0, 10);
    if (!rows.length) {
      list.innerHTML = '<li class="lb-empty">No scores in this mode yet.</li>';
      return;
    }
    list.innerHTML = rows.map(e =>
      `<li>
        <span>${escapeHtml(e.name)}</span>
        <span class="lb-meta">${e.mode} · ${e.date}</span>
        <span><strong>${e.score}</strong></span>
      </li>`
    ).join('');
  }

  // ----------------------------------------------------------
  // PROFILE
  // ----------------------------------------------------------
  function renderProfile() {
    $('#profile-name').textContent = state.profile.name;
    const since = new Date(state.profile.createdAt).toLocaleDateString();
    $('#profile-since').textContent = `Joined ${since}`;
    $('#stat-games').textContent = state.stats.gamesPlayed;
    const winRate = state.stats.wordsTotal ? Math.round((state.stats.wordsCorrect / state.stats.wordsTotal) * 100) : 0;
    $('#stat-wins').textContent = winRate + '%';
    $('#stat-best').textContent = state.stats.bestStreak;
    const avg = state.stats.wordsCorrect ? Math.round(state.stats.totalSolveSeconds / state.stats.wordsCorrect) : 0;
    $('#stat-avg').textContent = avg ? avg + 's' : '—';
    $('#stat-lifetime').textContent = state.stats.lifetimePoints.toLocaleString();
    $('#stat-daystreak').textContent = state.profile.dayStreak;

    const grid = $('#badges-grid');
    grid.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = !!state.achievements[a.id];
      return `<div class="badge ${unlocked ? 'is-unlocked' : 'is-locked'}">
        <div class="badge-icon">${a.icon}</div>
        <div class="badge-name">${a.name}</div>
        <div class="badge-desc">${a.desc}</div>
      </div>`;
    }).join('');
  }

  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------
  function renderSettings() {
    $('#name-input').value = state.profile.name;
    setToggle('toggle-sound', state.settings.sound);
    setToggle('toggle-haptic', state.settings.haptic);
    setToggle('toggle-theme', state.settings.theme);
    setToggle('toggle-reduce-motion', state.settings.reduceMotion);
  }
  function setToggle(id, val) {
    const el = $('#' + id);
    el.setAttribute('aria-checked', val ? 'true' : 'false');
  }

  // ----------------------------------------------------------
  // SHARE
  // ----------------------------------------------------------
  function buildShareCard() {
    const rows = session.finalBreakdown.map(b => {
      if (!b.won) return '⬛⬛⬛⬛⬛';
      const len = Math.min(5, (b.word || '').length || 5);
      // Yellow squares represent hint reveals, green = clean guess
      const hintCount = Math.max(0, Math.min(len, b.hint ? Math.ceil(-b.hint / 20) : 0));
      let cells = '';
      for (let i = 0; i < len; i++) cells += (i < hintCount ? '🟨' : '🟩');
      return cells;
    }).slice(0, 6);

    return `Jobzlingo Word Quest 🎯
Score: ${session.score} · Best streak: ${session.bestStreakThisRun}
${rows.join('\n')}

Play yours →`;
  }

  function showShare(text) {
    $('#share-text').textContent = text;
    $('#share-modal').hidden = false;
  }
  function closeShare() { $('#share-modal').hidden = true; }

  // ----------------------------------------------------------
  // UTILITIES
  // ----------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // ----------------------------------------------------------
  // EVENTS
  // ----------------------------------------------------------
  function wireEvents() {
    // Nav buttons (data-nav)
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-nav]');
      if (!t) return;
      const target = t.dataset.nav;
      if (target === 'home') { renderHome(); showScreen('home'); }
      else if (target === 'leaderboard') { renderLeaderboard('all'); showScreen('leaderboard'); }
      else if (target === 'profile') { renderProfile(); showScreen('profile'); }
      else if (target === 'settings') { renderSettings(); showScreen('settings'); }
    });

    // Play button
    $('#play-btn').addEventListener('click', () => {
      const mode = $('#mode-select').value;
      const diff = $('#difficulty-select').value;
      if (mode === 'campaign') {
        if (state.campaign.roster.length === 0) {
          toast('Add at least one student first', 'warn');
          $('#roster-input-home').focus();
          return;
        }
      }
      startSession(mode, diff);
    });

    $('#mode-select').addEventListener('change', toggleHomeForCampaign);
    toggleHomeForCampaign();
    wireRosterInline();
    wireCampaignSetup();
    wireAttribution();

    // Game: physical keyboard
    document.addEventListener('keydown', e => {
      const active = $('#screen-game.screen--active');
      if (!active) return;
      // Don't hijack typing in inputs/textareas (e.g. roster name field).
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) onGuess(key);
      else if (key === 'ESCAPE') {
        confirmModal({
          title: 'Quit run?',
          message: 'You will lose any progress in this round.',
          confirmLabel: 'Quit',
          cancelLabel: 'Stay',
        }).then((ok) => {
          if (!ok) return;
          endSession(false);
          renderHome();
          showScreen('home');
        });
      }
    });

    // Game back
    $('#game-back').addEventListener('click', () => {
      confirmModal({
        title: 'Quit this run?',
        message: 'You will lose any progress in this round.',
        confirmLabel: 'Quit',
        cancelLabel: 'Stay',
      }).then((ok) => {
        if (!ok) return;
        endSession(false);
        renderHome();
        showScreen('home');
      });
    });

    // Hints
    $$('.hint-btn').forEach(b => b.addEventListener('click', () => useHint(Number(b.dataset.hint))));
    // Powerups
    $$('.power-btn').forEach(b => b.addEventListener('click', () => usePower(b.dataset.power)));

    // Result actions
    $('#result-next').addEventListener('click', () => {
      session.idx++;
      const done = (session.mode === 'marathon' && session.wrongsTotalRun >= 3) ||
                   (session.mode !== 'marathon' && session.idx >= session.words.length);
      if (done) { endSession(true); }
      else { nextWord(); showScreen('game'); }
    });
    $('#result-share').addEventListener('click', () => showShare(buildShareCard()));
    $('#result-home').addEventListener('click', () => { renderHome(); showScreen('home'); });

    $('#gameover-play').addEventListener('click', () => {
      startSession(session.mode, session.difficulty);
    });
    $('#gameover-share').addEventListener('click', () => showShare(buildShareCard()));
    $('#gameover-home').addEventListener('click', () => { renderHome(); showScreen('home'); });

    // Leaderboard tabs
    $$('#lb-tabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        $$('#lb-tabs .tab').forEach(x => x.classList.remove('tab--active'));
        t.classList.add('tab--active');
        renderLeaderboard(t.dataset.tab);
      });
    });

    // Settings toggles
    $('#toggle-sound').addEventListener('click', () => {
      state.settings.sound = !state.settings.sound;
      setToggle('toggle-sound', state.settings.sound);
      saveState();
    });
    $('#toggle-haptic').addEventListener('click', () => {
      state.settings.haptic = !state.settings.haptic;
      setToggle('toggle-haptic', state.settings.haptic);
      saveState();
    });
    $('#toggle-theme').addEventListener('click', () => {
      state.settings.theme = !state.settings.theme;
      setToggle('toggle-theme', state.settings.theme);
      document.body.classList.toggle('theme-contrast', state.settings.theme);
      saveState();
    });
    $('#toggle-reduce-motion').addEventListener('click', () => {
      state.settings.reduceMotion = !state.settings.reduceMotion;
      setToggle('toggle-reduce-motion', state.settings.reduceMotion);
      document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
      saveState();
    });
    $('#name-input').addEventListener('change', e => {
      state.profile.name = (e.target.value || 'Player').trim().slice(0, 20);
      saveState();
    });
    $('#reset-btn').addEventListener('click', () => {
      confirmModal({
        title: 'Reset everything?',
        message:
          'This wipes all stats, achievements, and the leaderboard. This cannot be undone.',
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      }).then((ok) => {
        if (!ok) return;
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        saveState();
        renderHome();
        toast('All progress reset', 'warn');
      });
    });

    // Share modal close
    $('#share-modal').addEventListener('click', e => {
      if (e.target.hasAttribute('data-close')) closeShare();
    });
    $('#share-copy').addEventListener('click', async () => {
      const text = $('#share-text').textContent;
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard ✓', 'success');
      } catch {
        toast('Copy failed — long-press to copy manually', 'warn');
      }
    });

    // Podium home button
    $('#podium-home').addEventListener('click', () => {
      renderHome();
      showScreen('home');
    });

    // Easter egg: type "jobzlingo" on home screen
    let buffer = '';
    document.addEventListener('keydown', e => {
      if (!$('#screen-home.screen--active')) { buffer = ''; return; }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key.length === 1) {
        buffer = (buffer + e.key.toLowerCase()).slice(-9);
        if (buffer === 'jobzlingo') {
          document.body.classList.add('theme-rainbow');
          toast('🌈 Secret rainbow theme unlocked!', 'success');
          burstConfetti();
          buffer = '';
        }
      }
    });
  }

  // ----------------------------------------------------------
  // BOOT
  // ----------------------------------------------------------
  function applyPersistedTheme() {
    if (state.settings.theme) document.body.classList.add('theme-contrast');
    if (state.settings.reduceMotion) document.documentElement.classList.add('reduce-motion');
  }
  function boot() {
    applyPersistedTheme();
    initBackground();
    wireEvents();
    renderHome();
    // Fade out loading screen after a beat
    setTimeout(() => {
      showScreen('home');
    }, 1500);
  }

  // ── Classroom mode ──────────────────────────────────────────────
  // The variant adds three screens (role pick, lobby, countdown) on
  // top of the regular flow and only activates when the platform
  // tells us we're in-call. The role pick is host-only — players
  // skip straight to the waiting lobby.
  //
  // Once the host hits Start, all clients run the same 3-2-1
  // countdown, then hand off to the regular game screen with the
  // mode + difficulty the host picked.
  let classroom = null;
  // Flag set the first time wireClassroomScreens runs so we don't
  // double-attach listeners across re-inits.
  let classroomWired = false;

  function isClassroomMode() {
    return !!classroom;
  }

  function classroomRoster() {
    return Array.isArray(classroom && classroom.players) ? classroom.players : [];
  }

  function renderClassroomRoster() {
    const ul = document.getElementById('classroom-roster');
    if (!ul) return;
    const roster = classroomRoster();
    if (roster.length === 0) {
      ul.innerHTML = '<li class="lb-empty">No players have accepted yet.</li>';
      return;
    }
    ul.innerHTML = roster
      .map(
        (p) => `
      <li${p.isLocal ? ' class="is-you"' : ''}>
        <span class="rr-name">${escapeHtml(p.name)}${
          p.isLocal ? ' <span class="rr-you">You</span>' : ''
        }</span>
      </li>
    `,
      )
      .join('');
  }

  function showClassroomLobby() {
    if (!classroom) return;
    const isHost = classroom.role === 'host';
    const hostBox = document.getElementById('classroom-host-controls');
    const playerBox = document.getElementById('classroom-player-wait');
    if (hostBox) hostBox.hidden = !isHost;
    if (playerBox) playerBox.hidden = isHost;
    renderClassroomRoster();
    showScreen('classroom-lobby');
  }

  function wireClassroomScreens() {
    if (classroomWired) return;
    classroomWired = true;

    // Role pick — only the call host ever lands here.
    const roleScreen = document.getElementById('screen-classroom-role');
    if (roleScreen) {
      roleScreen.querySelectorAll('button[data-role]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!classroom) return;
          classroom.role = btn.getAttribute('data-role') === 'host' ? 'host' : 'player';
          classroomRecomputePlayers();
          showClassroomLobby();
        });
      });
    }

    // Lobby leave button — return to role pick if the host opened it,
    // otherwise no-op for players (they don't get the back button).
    const leaveBtn = document.getElementById('classroom-leave');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        if (!classroom) return;
        if (classroom.canChooseRole) {
          classroom.role = null;
          classroomRecomputePlayers();
          showScreen('classroom-role');
        }
      });
    }

    // Host: start the round.
    const startBtn = document.getElementById('classroom-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (!classroom || classroom.role !== 'host') return;
        const mode =
          (document.getElementById('classroom-mode') || {}).value || 'quick';
        const difficulty =
          (document.getElementById('classroom-difficulty') || {}).value || 'mixed';
        const bridge = window.GameBridge;
        if (bridge && typeof bridge.broadcast === 'function') {
          bridge.broadcast('CLASSROOM_START', {
            mode,
            difficulty,
            startedAt: Date.now(),
          });
        } else {
          startClassroomCountdown({ mode, difficulty });
        }
      });
    }

    // Host: pause / resume / next during the round. We broadcast the
    // intent; reacting to it (blur overlay for players, pausing the
    // timer, advancing the question) is wired in Part 2.
    const broadcastClassroom = (type, payload) => {
      const bridge = window.GameBridge;
      if (bridge && typeof bridge.broadcast === 'function') {
        bridge.broadcast(type, payload || {});
      }
    };
    const pauseBtn = document.getElementById('classroom-pause');
    const resumeBtn = document.getElementById('classroom-resume');
    const nextBtn = document.getElementById('classroom-next');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (!classroom || classroom.role !== 'host') return;
        broadcastClassroom('CLASSROOM_PAUSE', {});
      });
    }
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        if (!classroom || classroom.role !== 'host') return;
        broadcastClassroom('CLASSROOM_RESUME', {});
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (!classroom || classroom.role !== 'host') return;
        broadcastClassroom('CLASSROOM_NEXT', {});
      });
    }
  }

  /**
   * Re-derive `classroom.players` from the latest call roster.
   *
   * The host is excluded from the player list always — host doesn't
   * play. The local user is included unless the local user IS the
   * host.
   */
  function classroomRecomputePlayers() {
    if (!classroom || !Array.isArray(classroom.basePlayers)) return;
    const hostId = classroom.hostId;
    const localId = classroom.localId;
    classroom.players = classroom.basePlayers.filter(
      (p) => p.id !== hostId,
    );
    // Re-tag isLocal in case basePlayers got rebuilt.
    classroom.players = classroom.players.map((p) => ({
      ...p,
      isLocal: p.id === localId,
    }));
  }

  function startClassroomCountdown({ mode, difficulty }) {
    const numEl = document.getElementById('classroom-countdown-num');
    let n = 3;
    if (numEl) numEl.textContent = String(n);
    showScreen('classroom-countdown');
    const tick = () => {
      n -= 1;
      if (n > 0) {
        if (numEl) numEl.textContent = String(n);
        window.setTimeout(tick, 1000);
        return;
      }
      if (numEl) numEl.textContent = 'Go!';
      window.setTimeout(() => {
        // Bypass the solo home + select screens entirely. Set the
        // mode/difficulty hidden selects and call startSession
        // directly so the user never sees the original landing page.
        try {
          const modeSelect = document.getElementById('mode-select');
          const diffSelect = document.getElementById('difficulty-select');
          if (modeSelect) modeSelect.value = mode || 'quick';
          if (diffSelect) diffSelect.value = difficulty || 'mixed';
          // Show host bar before transitioning to the game screen so
          // it's already mounted when the host arrives. Players keep
          // it hidden.
          const hostBar = document.getElementById('classroom-host-bar');
          if (hostBar) {
            hostBar.hidden = !(classroom && classroom.role === 'host');
          }
          if (typeof startSession === 'function') {
            startSession(mode || 'quick', difficulty || 'mixed');
          } else if (typeof renderHome === 'function') {
            renderHome();
            showScreen('home');
          }
        } catch (e) {
          console.warn('classroom hand-off failed', e);
          if (typeof renderHome === 'function') renderHome();
          showScreen('home');
        }
      }, 700);
    };
    window.setTimeout(tick, 1000);
  }

  // Classroom-relay messages from peers.
  window.onClassroomEvent = function onClassroomEvent(type, payload) {
    if (!isClassroomMode()) return;
    if (type === 'CLASSROOM_START') {
      startClassroomCountdown({
        mode: (payload && payload.mode) || 'quick',
        difficulty: (payload && payload.difficulty) || 'mixed',
      });
      return;
    }
    if (type === 'CLASSROOM_PAUSE') {
      // Freeze the timer for everyone (the host's iframe also has a
      // running timer if they're testing, even though hosts don't
      // play). Players additionally see the blocking overlay.
      window.__classroomPaused = true;
      const isHost = classroom && classroom.role === 'host';
      const overlay = document.getElementById('classroom-paused-overlay');
      if (overlay) overlay.hidden = isHost; // host sees no overlay
      // Toggle host's Pause/Resume button visibility.
      const pauseBtn = document.getElementById('classroom-pause');
      const resumeBtn = document.getElementById('classroom-resume');
      if (pauseBtn) pauseBtn.hidden = true;
      if (resumeBtn) resumeBtn.hidden = false;
      return;
    }
    if (type === 'CLASSROOM_RESUME') {
      window.__classroomPaused = false;
      const overlay = document.getElementById('classroom-paused-overlay');
      if (overlay) overlay.hidden = true;
      const pauseBtn = document.getElementById('classroom-pause');
      const resumeBtn = document.getElementById('classroom-resume');
      if (pauseBtn) pauseBtn.hidden = false;
      if (resumeBtn) resumeBtn.hidden = true;
      return;
    }
    // CLASSROOM_NEXT — advance everyone's question when the host taps
    // the Next button in their host bar.
    if (type === 'CLASSROOM_NEXT') {
      if (session) {
        stopTimer();
        session.idx++;
        session.streak = 0;
        if ($('#game-streak')) $('#game-streak').textContent = '0';
        nextWord();
      }
      return;
    }
  };

  /**
   * Hook called by game-bridge.js when the platform sends GAME_INIT.
   *
   * Hosts (the participant who launched the game) get the role-pick
   * screen so they can choose to run as host or jump in as a player.
   * Everyone else goes straight to the lobby in player mode.
   */
  window.onPlatformInit = function onPlatformInit(payload) {
    if (!payload || payload.mode !== 'in-call') return;
    const rawPlayers = Array.isArray(payload.players) ? payload.players : [];
    if (rawPlayers.length === 0) return;

    const localId =
      (payload.currentPlayer && payload.currentPlayer.userId) || null;
    const isHost = !!(payload.currentPlayer && payload.currentPlayer.isHost);
    // The shell now passes the canonical host identity through. Fall
    // back to "I am host -> use my id" for older shells that don't
    // include hostUserId yet, then to the first roster entry as a
    // last resort.
    let hostId = null;
    if (payload.hostUserId) {
      hostId = String(payload.hostUserId);
    } else if (isHost && localId) {
      hostId = localId;
    } else {
      const first = rawPlayers[0];
      if (first) hostId = String(first.userId || first.username || '');
    }

    const isReinit = !!classroom;
    if (!isReinit) {
      classroom = {
        role: null,
        canChooseRole: isHost,
        basePlayers: [],
        players: [],
        localId,
        hostId,
      };
    }
    classroom.basePlayers = rawPlayers.map((p) => ({
      id: String(p.userId || p.username || p.fullName || ''),
      name: String(p.fullName || p.username || p.userId || 'Player'),
      score: 0,
      isLocal: localId !== null && p.userId === localId,
    }));
    classroom.localId = localId;
    classroom.hostId = hostId;

    // Players default to 'player' role; only the actual host can
    // choose. Re-init keeps whatever role was already picked.
    if (!classroom.role) {
      classroom.role = isHost ? null : 'player';
    }

    classroomRecomputePlayers();
    wireClassroomScreens();

    // Re-init updates the lobby roster live; first init routes the
    // user to the right starting screen.
    if (isReinit) {
      renderClassroomRoster();
      return;
    }
    if (isHost) {
      showScreen('classroom-role');
    } else {
      showClassroomLobby();
    }
  };

  // ── Classroom pause/resume/next handlers (called by game-bridge.js) ──
  function pauseGame() {
    if (!isClassroomMode()) return;
    // The host triggers pause via the UI button, which broadcasts
    // CLASSROOM_PAUSE. This function is only called when the platform
    // forwards GAME_PAUSE (for symmetry with resume/next).
    // In practice, the host uses the UI button, players receive the
    // broadcast and freeze via onClassroomEvent.
  }

  function resumeGame() {
    if (!isClassroomMode()) return;
    // Similar to pauseGame, the host uses the UI button to resume.
  }

  function nextQuestion() {
    if (!isClassroomMode() || !session) return;
    // Advance to the next word immediately, skipping the current one.
    // This is called when the host taps "Next" in the host bar.
    stopTimer();
    session.idx++;
    session.streak = 0;
    $('#game-streak').textContent = '0';
    nextWord();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // ── Anti-inspect: prevent right-click, F12, DevTools ──
  (function() {
    // Disable right-click
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Disable F12 and other dev tools shortcuts
    document.addEventListener('keydown', (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // DevTools detection via debugger
    let isDevToolsOpen = false;
    const checkDevTools = () => {
      const start = performance.now();
      /* eslint no-debugger: "warn" */
      debugger; // This line triggers DevTools if open
      const end = performance.now();
      if (end - start > 100) {
        isDevToolsOpen = true;
        // Hide game content when DevTools detected
        document.body.style.display = 'none';
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#fff;font-family:sans-serif;"><div style="text-align:center;"><h1>DevTools detected</h1><p>Game access is restricted.</p></div></div>';
      } else if (isDevToolsOpen) {
        isDevToolsOpen = false;
        document.body.style.display = '';
      }
    };

    // Check periodically
    setInterval(checkDevTools, 2000);
    // Also check on focus
    window.addEventListener('focus', checkDevTools);
  })();
})();

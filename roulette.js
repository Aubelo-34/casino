/* Roulette américaine — roue animée en canvas, bille, tirage aléatoire. */
(() => {
  "use strict";

  // Ordre des cases dans le sens horaire, en partant du 0 (roue américaine).
  const ORDER = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34",
    "15", "3", "24", "36", "13", "1", "00", "27", "10", "25", "29", "12", "8",
    "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2",
  ];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const N = ORDER.length;
  const SLOT = (Math.PI * 2) / N;
  const TOP = -Math.PI / 2;

  const COLORS = { red: "#c8102e", black: "#1c1c1c", green: "#18a34a" };

  function colorOf(label) {
    if (label === "0" || label === "00") return "green";
    return REDS.has(Number(label)) ? "red" : "black";
  }

  // ---------- Éléments DOM ----------
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const spinBtn = document.getElementById("spin");
  const soundToggle = document.getElementById("sound");
  const resultEl = document.getElementById("result");
  const historyEl = document.getElementById("history");

  // ---------- Géométrie ----------
  const SIZE = 720;
  const C = SIZE / 2;
  const R = SIZE / 2;
  const R_RIM_OUT = R;
  const R_RIM_IN = R * 0.80;
  const R_TRACK = R * 0.875;       // rayon de roulement de la bille
  const R_NUM_OUT = R * 0.80;
  const R_NUM_IN = R * 0.655;
  const R_POCKET_OUT = R * 0.64;
  const R_POCKET_IN = R * 0.535;
  const R_BALL_REST = R * 0.585;   // rayon où la bille se pose
  const R_HUB = R * 0.52;
  const BALL_RADIUS = R * 0.027;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  // ---------- État ----------
  const state = {
    wheelAngle: 0,                 // rotation de la roue (rad)
    ballAngle: TOP,                // angle monde de la bille
    ballRadius: R_BALL_REST,
    ballVisible: false,
    spinning: false,
    history: [],
  };

  // ---------- Aléatoire ----------
  function randomIndex() {
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      // Rejet pour éviter le biais modulo.
      const limit = Math.floor(0x100000000 / N) * N;
      let v;
      do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
      return v % N;
    }
    return Math.floor(Math.random() * N);
  }
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- Easing ----------
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const mod2pi = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // ---------- Son (tic de la bille) ----------
  let audio = null;
  let lastTick = 0;
  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    if (audio && audio.state === "suspended") audio.resume();
  }
  function tick(volume, now) {
    if (!soundToggle.checked || !audio) return;
    if (now - lastTick < 45) return;
    lastTick = now;
    const t0 = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(2200, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.03);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  }

  // ---------- Dessin ----------
  function drawRim() {
    // Bois extérieur
    const g = ctx.createRadialGradient(C, C, R_RIM_IN, C, C, R_RIM_OUT);
    g.addColorStop(0, "#6e4423");
    g.addColorStop(0.35, "#a0683a");
    g.addColorStop(0.7, "#8a5730");
    g.addColorStop(1, "#4f2e15");
    ctx.beginPath();
    ctx.arc(C, C, R_RIM_OUT, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Piste de la bille (gorge)
    const track = ctx.createRadialGradient(C, C, R * 0.83, C, C, R * 0.93);
    track.addColorStop(0, "#5a3417");
    track.addColorStop(0.5, "#b07a45");
    track.addColorStop(1, "#5a3417");
    ctx.beginPath();
    ctx.arc(C, C, R * 0.93, 0, Math.PI * 2);
    ctx.arc(C, C, R * 0.83, 0, Math.PI * 2, true);
    ctx.fillStyle = track;
    ctx.fill();

    // Filets dorés
    ring(R * 0.93, 2, "#e3b94d");
    ring(R * 0.83, 2, "#e3b94d");
    ring(R_RIM_OUT - 2, 3, "#2b1708");

    // Déflecteurs (losanges) fixes sur la piste
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const big = k % 2 === 0;
      ctx.save();
      ctx.translate(C + Math.cos(a) * R * 0.955, C + Math.sin(a) * R * 0.955);
      ctx.rotate(a);
      ctx.beginPath();
      const h = big ? 11 : 7;
      const w = big ? 6 : 4;
      ctx.moveTo(-h, 0); ctx.lineTo(0, -w); ctx.lineTo(h, 0); ctx.lineTo(0, w); ctx.closePath();
      ctx.fillStyle = "#3a2210";
      ctx.fill();
      ctx.strokeStyle = "#e3b94d";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function ring(radius, width, color) {
    ctx.beginPath();
    ctx.arc(C, C, radius, 0, Math.PI * 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function drawRotor(angle) {
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(angle);

    // Anneau des numéros + anneau des alvéoles
    for (let i = 0; i < N; i++) {
      const a0 = TOP + i * SLOT - SLOT / 2;
      const a1 = a0 + SLOT;
      const col = COLORS[colorOf(ORDER[i])];

      // Case numérotée
      ctx.beginPath();
      ctx.arc(0, 0, R_NUM_OUT, a0, a1);
      ctx.arc(0, 0, R_NUM_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = "#e3b94d";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Alvéole intérieure (là où la bille se pose)
      ctx.beginPath();
      ctx.arc(0, 0, R_POCKET_OUT, a0, a1);
      ctx.arc(0, 0, R_POCKET_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = "#f1d27a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Numéros
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < N; i++) {
      const a = TOP + i * SLOT;
      ctx.save();
      ctx.rotate(a);
      ctx.translate((R_NUM_OUT + R_NUM_IN) / 2, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(ORDER[i], 0, 0);
      ctx.restore();
    }

    // Moyeu (cône en bois + rayons)
    const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, R_HUB);
    hub.addColorStop(0, "#b37c4b");
    hub.addColorStop(0.6, "#8c5a31");
    hub.addColorStop(1, "#5d3718");
    ctx.beginPath();
    ctx.arc(0, 0, R_HUB, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "#e3b94d";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = "rgba(60, 32, 12, 0.6)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
      ctx.lineTo(Math.cos(a) * R_HUB, Math.sin(a) * R_HUB);
      ctx.stroke();
    }

    // Tourelle centrale dorée
    const turret = ctx.createRadialGradient(-6, -6, 2, 0, 0, R * 0.13);
    turret.addColorStop(0, "#fff0b0");
    turret.addColorStop(0.5, "#e3b94d");
    turret.addColorStop(1, "#8c6a1c");
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = turret;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = "#b8902e";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = "#fff3c4";
    ctx.fill();

    ctx.restore();

    // Filets dorés fixes entre les anneaux
    ring(R_NUM_OUT, 3, "#e3b94d");
    ring(R_NUM_IN, 3, "#e3b94d");
    ring(R_POCKET_IN, 3, "#e3b94d");
  }

  function drawBall() {
    if (!state.ballVisible) return;
    const x = C + Math.cos(state.ballAngle) * state.ballRadius;
    const y = C + Math.sin(state.ballAngle) * state.ballRadius;

    // Ombre
    ctx.beginPath();
    ctx.arc(x + 3, y + 4, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();

    const g = ctx.createRadialGradient(x - BALL_RADIUS * 0.4, y - BALL_RADIUS * 0.4, 1, x, y, BALL_RADIUS);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#e8e8e8");
    g.addColorStop(1, "#9a9a9a");
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawRim();
    drawRotor(state.wheelAngle);
    drawBall();
  }

  // ---------- Animation du lancer ----------
  function spin() {
    if (state.spinning) return;
    ensureAudio();
    state.spinning = true;
    state.ballVisible = true;
    spinBtn.disabled = true;
    resultEl.innerHTML = '<span class="result-label">La bille tourne…</span>';

    const winner = randomIndex();
    const pocketLocal = TOP + winner * SLOT;

    const T_WHEEL = rand(8500, 10000);           // durée totale (ms)
    const T_BALL = T_WHEEL * rand(0.68, 0.78);   // moment où la bille tombe dans l'alvéole
    const T_DROP = T_BALL * 0.72;                // début de la descente vers l'alvéole

    const wheel0 = state.wheelAngle;
    const wheelDelta = Math.PI * 2 * rand(2.5, 4);          // sens horaire
    const wheelAt = (t) => wheel0 + wheelDelta * easeOutCubic(Math.min(t / T_WHEEL, 1));

    // La bille tourne en sens inverse et doit rejoindre l'alvéole gagnante à T_BALL.
    const ball0 = state.ballAngle;
    const targetAtDrop = wheelAt(T_BALL) + pocketLocal;
    const turns = Math.round(rand(9, 13));
    const ballDelta = -(Math.PI * 2 * turns + mod2pi(ball0 - targetAtDrop));
    const ballAt = (t) => ball0 + ballDelta * easeOutQuart(Math.min(t / T_BALL, 1));

    let start = null;
    let lastRelSlot = null;

    function frame(now) {
      if (start === null) start = now;
      const t = now - start;

      state.wheelAngle = wheelAt(t);

      if (t < T_BALL) {
        state.ballAngle = ballAt(t);
        // Descente progressive de la piste vers l'alvéole, avec quelques rebonds.
        if (t < T_DROP) {
          state.ballRadius = R_TRACK;
        } else {
          const p = (t - T_DROP) / (T_BALL - T_DROP);
          const bounce = Math.abs(Math.sin(p * Math.PI * 4)) * (1 - p) * R * 0.03;
          state.ballRadius = R_TRACK + (R_BALL_REST - R_TRACK) * easeInOut(p) + bounce;
        }
        // Tic quand la bille franchit une cloison, de plus en plus espacé.
        const rel = mod2pi(state.ballAngle - state.wheelAngle - TOP + SLOT / 2);
        const slot = Math.floor(rel / SLOT);
        if (lastRelSlot !== null && slot !== lastRelSlot) {
          const progress = t / T_BALL;
          tick(0.05 + 0.25 * progress, now);
        }
        lastRelSlot = slot;
      } else {
        // La bille est dans l'alvéole : elle suit la roue jusqu'à l'arrêt.
        state.ballAngle = state.wheelAngle + pocketLocal;
        state.ballRadius = R_BALL_REST;
      }

      render();

      if (t < T_WHEEL) {
        requestAnimationFrame(frame);
      } else {
        state.wheelAngle = mod2pi(state.wheelAngle);
        state.ballAngle = state.wheelAngle + pocketLocal;
        render();
        finish(winner);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- Résultat ----------
  function describe(label) {
    const color = colorOf(label);
    const colorName = { red: "Rouge", black: "Noir", green: "Vert" }[color];
    if (color === "green") {
      return { color, lines: [colorName, "Zéro : ni pair, ni impair"] };
    }
    const n = Number(label);
    const parity = n % 2 === 0 ? "Pair" : "Impair";
    const half = n <= 18 ? "Manque (1-18)" : "Passe (19-36)";
    const dozen = n <= 12 ? "1re douzaine" : n <= 24 ? "2e douzaine" : "3e douzaine";
    const column = n % 3 === 1 ? "1re colonne" : n % 3 === 2 ? "2e colonne" : "3e colonne";
    return { color, lines: [`${colorName} · ${parity}`, `${half} · ${dozen} · ${column}`] };
  }

  function finish(winner) {
    const label = ORDER[winner];
    const info = describe(label);

    resultEl.innerHTML = "";
    const num = document.createElement("span");
    num.className = `result-number ${info.color}`;
    num.textContent = label;
    const detail = document.createElement("span");
    detail.className = "result-detail";
    detail.innerHTML = info.lines.map((l) => `<div>${l}</div>`).join("");
    resultEl.append(num, detail);

    state.history.unshift(label);
    state.history = state.history.slice(0, 12);
    historyEl.innerHTML = "";
    for (const h of state.history) {
      const li = document.createElement("li");
      li.className = colorOf(h);
      li.textContent = h;
      historyEl.appendChild(li);
    }

    state.spinning = false;
    spinBtn.disabled = false;
    spinBtn.focus();
  }

  // ---------- Init ----------
  spinBtn.addEventListener("click", spin);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== spinBtn) {
      e.preventDefault();
      spin();
    }
  });
  render();

  // Exposé pour les tests (ne change rien au jeu).
  window.__roulette = { ORDER, colorOf, describe, state };
})();

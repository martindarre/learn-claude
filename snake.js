const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');
const messageEl = document.getElementById('message');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;
const BASE_SPEED = 130;
const MIN_SPEED = 55;

let snake, prevSnake, moveProgress;
let dir, nextDir, food, score, highscore = 0;
let running = false, animId, lastTime = 0;
let particles = [], floaters = [];
let shake = 0;
let foodPulse = 0;
let state = 'start';
let demoSnake, demoDir, demoTimer = 0, demoFood;

// ── Utilities ──────────────────────────────────────────────────────────────

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function speed() { return Math.max(MIN_SPEED, BASE_SPEED - score * 4); }

// ── Particles ──────────────────────────────────────────────────────────────

function spawnParticles(gx, gy, color, count = 14) {
  const cx = gx * GRID + GRID / 2;
  const cy = gy * GRID + GRID / 2;
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const spd = rand(1.5, 5);
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 1, decay: rand(0.03, 0.07), size: rand(2, 5), color
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= p.decay;
    return p.life > 0;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Floating score text ────────────────────────────────────────────────────

function spawnFloater(gx, gy, text) {
  floaters.push({ x: gx * GRID + GRID / 2, y: gy * GRID, text, life: 1, decay: 0.022 });
}

function updateFloaters() {
  floaters = floaters.filter(f => { f.y -= 0.8; f.life -= f.decay; return f.life > 0; });
}

function drawFloaters() {
  floaters.forEach(f => {
    ctx.globalAlpha = f.life;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
}

// ── Food ───────────────────────────────────────────────────────────────────

function placeFood(ref) {
  let pos;
  do { pos = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) }; }
  while (ref.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function drawFood(fx, fy) {
  const cx = fx * GRID + GRID / 2;
  const cy = fy * GRID + GRID / 2;
  const r = GRID / 2 - 2 + Math.sin(foodPulse) * 2;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  glow.addColorStop(0, 'rgba(233,69,96,0.5)');
  glow.addColorStop(1, 'rgba(233,69,96,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, r);
  grad.addColorStop(0, '#ff8fa3');
  grad.addColorStop(1, '#e94560');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Snake drawing (smooth interpolated) ───────────────────────────────────

function segmentPixels(i, segs, prev, t) {
  const cur = segs[i];
  const p = (prev && prev[i]) ? prev[i] : cur;
  return {
    x: lerp(p.x, cur.x, t) * GRID + 1,
    y: lerp(p.y, cur.y, t) * GRID + 1
  };
}

function drawSnake(segments, alphaBase = 1) {
  if (!segments || segments.length === 0) return;
  const t = moveProgress ?? 1;

  // Fading ghost of the tail as it disappears
  if (prevSnake && prevSnake.length === segments.length && t < 1) {
    const tail = prevSnake[prevSnake.length - 1];
    const s = GRID - 2;
    ctx.globalAlpha = (1 - t) * 0.5 * alphaBase;
    ctx.fillStyle = '#2a8f72';
    ctx.beginPath();
    ctx.roundRect(tail.x * GRID + 1, tail.y * GRID + 1, s, s, 4);
    ctx.fill();
  }

  segments.forEach((_seg, i) => {
    const { x: px, y: py } = segmentPixels(i, segments, prevSnake, t);
    const s = GRID - 2;
    const r = i === 0 ? 6 : 4;
    const fade = 1 - (i / segments.length) * 0.7;

    ctx.globalAlpha = fade * alphaBase;

    const g = ctx.createLinearGradient(px, py, px + s, py + s);
    g.addColorStop(0, i === 0 ? '#7fffda' : '#4ecca3');
    g.addColorStop(1, i === 0 ? '#4ecca3' : '#2a8f72');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(px, py, s, s, r);
    ctx.fill();

    if (i === 0) {
      ctx.globalAlpha = 0.25 * alphaBase;
      ctx.fillStyle = '#4ecca3';
      ctx.beginPath();
      ctx.roundRect(px - 3, py - 3, s + 6, s + 6, r + 3);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  // Eyes follow smooth head position
  const { x: hpx, y: hpy } = segmentPixels(0, segments, prevSnake, t);
  drawEyes(hpx + (GRID - 2) / 2, hpy + (GRID - 2) / 2, dir || { x: 1, y: 0 });
}

function drawEyes(cx, cy, d) {
  const perp = { x: -d.y, y: d.x };
  [1, -1].forEach(side => {
    const ex = cx + perp.x * 4 * side + d.x * 3;
    const ey = cy + perp.y * 4 * side + d.y * 3;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(ex + d.x, ey + d.y, 1.5, 0, Math.PI * 2); ctx.fill();
  });
}

// ── Background ─────────────────────────────────────────────────────────────

function drawBackground() {
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

// ── Screen shake ───────────────────────────────────────────────────────────

function triggerShake(amount = 10) { shake = amount; }

function applyShake() {
  if (shake > 0.3) {
    ctx.translate(rand(-shake, shake), rand(-shake, shake));
    shake *= 0.8;
  } else { shake = 0; }
}

// ── Game logic ─────────────────────────────────────────────────────────────

function stepSnake() {
  prevSnake = snake.map(s => ({ ...s }));
  moveProgress = 0;

  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return die();
  if (snake.some(s => s.x === head.x && s.y === head.y)) return die();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = score;
    if (score > highscore) { highscore = score; highscoreEl.textContent = highscore; }
    spawnParticles(food.x, food.y, '#e94560');
    spawnFloater(food.x, food.y, '+1');
    food = placeFood(snake);
  } else {
    snake.pop();
  }
}

function init() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  prevSnake = snake.map(s => ({ ...s }));
  moveProgress = 1;
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0; scoreEl.textContent = 0;
  particles = []; floaters = [];
  shake = 0; state = 'playing';
  messageEl.textContent = '';
  food = placeFood(snake);
  lastTime = 0;
  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function die() {
  state = 'dead';
  triggerShake(12);
  spawnParticles(snake[0].x, snake[0].y, '#4ecca3', 30);
  animId = requestAnimationFrame(deathLoop);
}

// ── Main loop ──────────────────────────────────────────────────────────────

function loop(ts) {
  const dt = ts - (lastTime || ts);
  lastTime = ts;
  foodPulse += 0.08;

  moveProgress = Math.min(1, (moveProgress ?? 1) + dt / speed());

  updateParticles();
  updateFloaters();

  ctx.save();
  applyShake();
  drawBackground();
  drawFood(food.x, food.y);
  drawSnake(snake);
  drawParticles();
  drawFloaters();
  ctx.restore();

  if (moveProgress >= 1 && state === 'playing') stepSnake();
  if (state === 'playing') animId = requestAnimationFrame(loop);
}

let deathTimer = 0;
function deathLoop(ts) {
  const dt = ts - (lastTime || ts);
  lastTime = ts;
  deathTimer += dt;

  updateParticles(); updateFloaters();

  ctx.save();
  applyShake();
  drawBackground();
  if (food) drawFood(food.x, food.y);
  drawSnake(snake, Math.max(0, 1 - deathTimer / 600));
  drawParticles();
  ctx.restore();

  if (deathTimer > 400) drawGameOverScreen(Math.min(1, (deathTimer - 400) / 300));
  if (deathTimer < 2000) animId = requestAnimationFrame(deathLoop);
  else deathTimer = 0;
}

// ── Overlay screens ────────────────────────────────────────────────────────

function drawGameOverScreen(alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,22,40,0.88)';
  ctx.fillRect(30, 110, canvas.width - 60, 200);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 36px Segoe UI';
  ctx.fillText('GAME OVER', canvas.width / 2, 175);
  ctx.fillStyle = '#eee';
  ctx.font = '18px Segoe UI';
  ctx.fillText(`Poeng: ${score}`, canvas.width / 2, 215);
  ctx.fillStyle = '#4ecca3';
  ctx.font = '14px Segoe UI';
  ctx.fillText(`Rekord: ${highscore}`, canvas.width / 2, 245);
  ctx.fillStyle = '#666';
  ctx.font = '13px Segoe UI';
  ctx.fillText('Trykk Enter for å prøve igjen', canvas.width / 2, 278);
  ctx.globalAlpha = 1;
}

function drawOverlay(alpha, text1, text2, text3) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,22,40,0.85)';
  ctx.fillRect(30, 120, canvas.width - 60, 180);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4ecca3';
  ctx.font = 'bold 38px Segoe UI';
  ctx.fillText(text1, canvas.width / 2, 185);
  ctx.fillStyle = '#eee';
  ctx.font = '16px Segoe UI';
  ctx.fillText(text2, canvas.width / 2, 225);
  ctx.fillStyle = '#777';
  ctx.font = '13px Segoe UI';
  ctx.fillText(text3, canvas.width / 2, 260);
  ctx.globalAlpha = 1;
}

// ── Animated start screen ──────────────────────────────────────────────────

function initDemo() {
  demoSnake = [];
  for (let i = 0; i < 6; i++) demoSnake.push({ x: 8 - i, y: 10 });
  demoDir = { x: 1, y: 0 };
  demoFood = { x: 12, y: 10 };
  demoTimer = 0;
}

function updateDemo(dt) {
  demoTimer += dt;
  if (demoTimer < 180) return;
  demoTimer = 0;
  const head = demoSnake[0];
  const dx = demoFood.x - head.x, dy = demoFood.y - head.y;
  let nd = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  if (nd.x !== -demoDir.x || nd.y !== -demoDir.y) demoDir = nd;
  const next = { x: (head.x + demoDir.x + COLS) % COLS, y: (head.y + demoDir.y + ROWS) % ROWS };
  demoSnake.unshift(next);
  if (next.x === demoFood.x && next.y === demoFood.y) {
    spawnParticles(demoFood.x, demoFood.y, '#e94560', 8);
    demoFood = placeFood(demoSnake);
  } else { demoSnake.pop(); }
}

let startAnimId;
function startLoop(ts) {
  if (state !== 'start') return;
  const dt = ts - (lastTime || ts);
  lastTime = ts;
  foodPulse += 0.08;

  updateDemo(dt);
  updateParticles();

  drawBackground();
  if (demoFood) drawFood(demoFood.x, demoFood.y);

  const savedDir = dir, savedPrev = prevSnake, savedProgress = moveProgress;
  dir = demoDir; prevSnake = null; moveProgress = 1;
  drawSnake(demoSnake, 0.45);
  dir = savedDir; prevSnake = savedPrev; moveProgress = savedProgress;

  drawParticles();
  drawOverlay(1, 'SNAKE', 'Trykk Enter eller Space for å starte', 'Styr med piltastene');
  startAnimId = requestAnimationFrame(startLoop);
}

function showStartScreen() {
  state = 'start'; particles = [];
  initDemo(); lastTime = 0;
  startAnimId = requestAnimationFrame(startLoop);
}

// ── Input ──────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (state === 'start' && (e.key === 'Enter' || e.key === ' ')) {
    cancelAnimationFrame(startAnimId); init();
  } else if (state === 'dead' && e.key === 'Enter') {
    cancelAnimationFrame(animId); deathTimer = 0; init();
  } else if (state === 'playing') {
    switch (e.key) {
      case 'ArrowUp':    if (dir.y !== 1)  nextDir = { x: 0, y: -1 }; break;
      case 'ArrowDown':  if (dir.y !== -1) nextDir = { x: 0, y: 1 };  break;
      case 'ArrowLeft':  if (dir.x !== 1)  nextDir = { x: -1, y: 0 }; break;
      case 'ArrowRight': if (dir.x !== -1) nextDir = { x: 1, y: 0 };  break;
    }
  }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});

// ── Boot ───────────────────────────────────────────────────────────────────

showStartScreen();

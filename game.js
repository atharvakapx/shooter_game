const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startBtn = document.querySelector("#startBtn");
const playerHealthEl = document.querySelector("#playerHealth");
const enemyHealthEl = document.querySelector("#enemyHealth");
const playerHealthBar = document.querySelector("#playerHealthBar");
const enemyHealthBar = document.querySelector("#enemyHealthBar");
const weaponChargeBar = document.querySelector("#weaponChargeBar");
const weaponStateEl = document.querySelector("#weaponState");
const weaponNameEl = document.querySelector("#weaponName");
const enemyDistanceEl = document.querySelector("#enemyDistance");
const roundLabelEl = document.querySelector("#roundLabel");
const scoreEl = document.querySelector("#scoreEl");
const playerArmorEl = document.querySelector("#playerArmor");
const playerArmorBar = document.querySelector("#playerArmorBar");
const statusText = document.querySelector("#statusText");

const keys = new Set();
const map = [
  "111111111111",
  "100000000001",
  "101001010101",
  "100000010001",
  "101010000101",
  "100010100001",
  "101000001101",
  "100000000001",
  "111111111111",
];

const TILE = 64;
const FOV = Math.PI / 3;
const RAYS = 240;
const MAX_DEPTH = 900;
const MOUSE_SENSITIVITY = 0.0024;
const MAX_PITCH = 0.62;
const MAX_HEALTH_PACKS = 3;
const HEALTH_PACK_HEAL = 30;
const HEALTH_PACK_INTERVAL = 8;
const PLAYER_WALK_SPEED = 150;
const PLAYER_BACK_SPEED = 105;
const PLAYER_STRAFE_SPEED = 130;
const PLAYER_SPRINT_SPEED = 228;
const PLAYER_CROUCH_SPEED = 72;
const PLAYER_ACCEL = 13;
const JUMP_FORCE = 260;
const GRAVITY = 580;

const WEAPONS = [
  {
    id: "rifle",
    name: "RIFLE",
    damage: 25,
    cooldown: 0.42,
    aimRadius: 0.14,
    ammoMax: 30,
    reloadTime: 2.0,
    recoil: 0.036,
    pellets: 1,
    spread: 0,
    color: "#20d7b5",
  },
  {
    id: "shotgun",
    name: "SHOTGUN",
    damage: 13,
    cooldown: 0.88,
    aimRadius: 0.38,
    ammoMax: 8,
    reloadTime: 2.8,
    recoil: 0.065,
    pellets: 6,
    spread: 0.28,
    color: "#ffce63",
  },
  {
    id: "smg",
    name: "SMG",
    damage: 14,
    cooldown: 0.16,
    aimRadius: 0.22,
    ammoMax: 25,
    reloadTime: 1.5,
    recoil: 0.018,
    pellets: 1,
    spread: 0.05,
    color: "#a0d0ff",
  },
];

let game;
let lastTime = 0;
let audioCtx;

const enemySpawns = [
  { x: TILE * 5.5, y: TILE * 3.5 },
  { x: TILE * 9.5, y: TILE * 1.5 },
  { x: TILE * 7.5, y: TILE * 5.5 },
  { x: TILE * 3.5, y: TILE * 6.5 },
  { x: TILE * 6.5, y: TILE * 7.5 },
  { x: TILE * 2.5, y: TILE * 4.5 },
  { x: TILE * 9.5, y: TILE * 6.5 },
  { x: TILE * 5.5, y: TILE * 1.5 },
];

const healthPackCells = [
  { x: 1, y: 6 },
  { x: 3, y: 1 },
  { x: 4, y: 3 },
  { x: 7, y: 1 },
  { x: 8, y: 4 },
  { x: 10, y: 7 },
];

const armorPackCells = [
  { x: 5, y: 2 },
  { x: 2, y: 7 },
  { x: 9, y: 3 },
  { x: 6, y: 6 },
];

const MAX_ARMOR = 50;

function createEnemy(spawn, index, round = 1) {
  const roundScale = 1 + (round - 1) * 0.12;
  return {
    x: spawn.x,
    y: spawn.y,
    angle: Math.PI + index * 0.35,
    health: Math.round(100 + (round - 1) * 18),
    maxHealth: Math.round(100 + (round - 1) * 18),
    cooldown: 0.8 + index * 0.22,
    hitTimer: 0,
    suppressTimer: 0,
    deathTimer: 0,
    strafe: index % 2 === 0 ? 1 : -1,
    speedBias: (0.9 + index * 0.06) * roundScale,
    awareness: 0,
    wanderTimer: 0.5 + index * 0.4,
    wanderAngle: Math.PI * 0.5 * index,
    reactionTime: Math.max(0.28, 0.7 + index * 0.16 - (round - 1) * 0.06),
    turnSpeed: (1.7 + index * 0.12) * Math.min(1 + (round - 1) * 0.05, 1.5),
  };
}

function resetGame(running = true) {
  game = {
    running,
    mouseHeld: false,
    messageTimer: 0,
    flashTimer: 0,
    damageTimer: 0,
    damageAngle: 0,
    hitMarkerTimer: 0,
    elapsed: 0,
    round: 1,
    score: 0,
    kills: 0,
    roundTransitionTimer: 0,
    killStreakCount: 0,
    killStreakTimer: 0,
    _lastShotHeadshot: false,
    player: {
      x: TILE * 1.5,
      y: TILE * 1.5,
      angle: 0.2,
      pitch: 0,
      health: 100,
      cooldown: 0,
      vx: 0,
      vy: 0,
      footstepDist: 0,
      weaponIndex: 0,
      ammo: WEAPONS[0].ammoMax,
      reloading: false,
      reloadTimer: 0,
      crouching: false,
      jumpVelocity: 0,
      jumpHeight: 0,
      onGround: true,
      armor: 0,
    },
    enemies: spawnEnemiesForRound(1),
    healthPacks: [],
    healthPackTimer: 1.5,
    armorPacks: [],
    armorPackTimer: 12,
    particles: [],
  };
  spawnHealthPack();
  spawnHealthPack();
  spawnArmorPack();
  statusText.textContent = running ? "Survive" : "Click Start";
  startBtn.textContent = running ? "Restart" : "Start";
  updateHud();
  keys.clear();
  if (running) playSound("start");
}

function spawnEnemiesForRound(round) {
  const count = Math.min(enemySpawns.length, 3 + round);
  return enemySpawns.slice(0, count).map((spawn, i) => createEnemy(spawn, i, round));
}

function isWall(x, y) {
  const mx = Math.floor(x / TILE);
  const my = Math.floor(y / TILE);
  return map[my]?.[mx] !== "0";
}

function isWallCell(mx, my) {
  return map[my]?.[mx] !== "0";
}

function moveEntity(entity, dx, dy, radius = 14) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;

  if (!isWall(nextX + Math.sign(dx) * radius, entity.y) && !isWall(nextX, entity.y - radius) && !isWall(nextX, entity.y + radius)) {
    entity.x = nextX;
  }

  if (!isWall(entity.x, nextY + Math.sign(dy) * radius) && !isWall(entity.x - radius, nextY) && !isWall(entity.x + radius, nextY)) {
    entity.y = nextY;
  }
}

function castRay(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  for (let depth = 1; depth < MAX_DEPTH; depth += 3) {
    const x = game.player.x + cos * depth;
    const y = game.player.y + sin * depth;
    if (isWall(x, y)) {
      return { depth, x, y };
    }
  }

  return { depth: MAX_DEPTH, x: game.player.x + cos * MAX_DEPTH, y: game.player.y + sin * MAX_DEPTH };
}

function normalizeAngle(angle) {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

function rotateToward(current, target, maxStep) {
  const delta = normalizeAngle(target - current);
  return current + clamp(delta, -maxStep, maxStep);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getHorizon() {
  const crouchShift = game.player.crouching ? canvas.height * 0.055 : 0;
  const jumpShift = -game.player.jumpHeight * 0.38;
  return canvas.height * (0.5 - game.player.pitch * 0.42) + crouchShift + jumpShift;
}

function getLivingEnemies() {
  return game.enemies.filter((enemy) => enemy.health > 0);
}

function getNearestEnemy() {
  return getLivingEnemies().reduce((nearest, enemy) => {
    const dist = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
    if (!nearest || dist < nearest.dist) return { enemy, dist };
    return nearest;
  }, null);
}

function getAimedEnemy() {
  let best = null;
  const weapon = WEAPONS[game.player.weaponIndex];

  for (const enemy of getLivingEnemies()) {
    const angleToTarget = Math.atan2(enemy.y - game.player.y, enemy.x - game.player.x);
    const aimError = Math.abs(normalizeAngle(angleToTarget - game.player.angle));
    const dist = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
    const clearShot = hasLineOfSight(game.player, enemy);
    const maxRange = weapon.id === "shotgun" ? 380 : 520;

    if (!clearShot || dist > maxRange || aimError > weapon.aimRadius) continue;
    if (!best || aimError < best.aimError) best = { enemy, aimError };
  }

  return best?.enemy ?? getNearestEnemy()?.enemy;
}

function isHeadshot(target) {
  const dist = Math.hypot(target.x - game.player.x, target.y - game.player.y);
  const size = Math.min(canvas.height * 0.65, (TILE * 420) / dist);
  const horizonY = getHorizon();
  const headCenterY = horizonY - size * 0.37;
  const crosshairY = canvas.height / 2;
  return Math.abs(crosshairY - headCenterY) < Math.max(10, size * 0.14);
}

function spawnHealthPack() {
  if (!game || game.healthPacks.length >= MAX_HEALTH_PACKS) return;

  const candidates = healthPackCells
    .map((cell) => ({
      x: (cell.x + 0.5) * TILE,
      y: (cell.y + 0.5) * TILE,
    }))
    .filter((pack) => !isWall(pack.x, pack.y))
    .filter((pack) => Math.hypot(pack.x - game.player.x, pack.y - game.player.y) > TILE * 1.4)
    .filter((pack) => !game.healthPacks.some((existing) => Math.hypot(existing.x - pack.x, existing.y - pack.y) < TILE));

  if (candidates.length === 0) return;
  const pack = candidates[Math.floor(Math.random() * candidates.length)];
  game.healthPacks.push({ ...pack, pulse: Math.random() * Math.PI * 2 });
}

function spawnArmorPack() {
  if (!game || game.armorPacks.length >= 2) return;

  const candidates = armorPackCells
    .map((cell) => ({ x: (cell.x + 0.5) * TILE, y: (cell.y + 0.5) * TILE }))
    .filter((pack) => !isWall(pack.x, pack.y))
    .filter((pack) => Math.hypot(pack.x - game.player.x, pack.y - game.player.y) > TILE * 1.5)
    .filter((pack) => !game.armorPacks.some((existing) => Math.hypot(existing.x - pack.x, existing.y - pack.y) < TILE));

  if (candidates.length === 0) return;
  const pack = candidates[Math.floor(Math.random() * candidates.length)];
  game.armorPacks.push({ ...pack, pulse: Math.random() * Math.PI * 2 });
}

function hasLineOfSight(from, to) {
  if (isWall(from.x, from.y) || isWall(to.x, to.y)) return false;

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] !== "1") continue;

      const wall = {
        left: x * TILE,
        top: y * TILE,
        right: (x + 1) * TILE,
        bottom: (y + 1) * TILE,
      };

      if (segmentIntersectsRect(from, to, wall)) return false;
    }
  }

  return true;
}

function segmentIntersectsRect(a, b, rect) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let tMin = 0;
  let tMax = 1;

  if (dx === 0) {
    if (a.x < rect.left || a.x > rect.right) return false;
    if (a.x >= rect.left && a.x <= rect.right) {
      return Math.max(a.y, b.y) >= rect.top && Math.min(a.y, b.y) <= rect.bottom;
    }
  } else {
    const tx1 = (rect.left - a.x) / dx;
    const tx2 = (rect.right - a.x) / dx;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (dy === 0) {
    if (a.y < rect.top || a.y > rect.bottom) return false;
    if (a.y >= rect.top && a.y <= rect.bottom) {
      return Math.max(a.x, b.x) >= rect.left && Math.min(a.x, b.x) <= rect.right;
    }
  } else {
    const ty1 = (rect.top - a.y) / dy;
    const ty2 = (rect.bottom - a.y) / dy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  return tMax >= tMin && tMax > 0 && tMin < 1;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playSound(type) {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  const osc = audioCtx.createOscillator();
  gain.connect(audioCtx.destination);
  osc.connect(gain);

  if (type === "playerShot") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.15);
    return;
  }

  if (type === "shotgunShot") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.25);
    return;
  }

  if (type === "enemyShot") {
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.13);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.17);
    return;
  }

  if (type === "hit") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
    return;
  }

  if (type === "kill") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
    return;
  }

  if (type === "damage") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
    return;
  }

  if (type === "heal") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
    return;
  }

  if (type === "jump") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.11);
    return;
  }

  if (type === "land") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.start(now);
    osc.stop(now + 0.12);
    return;
  }

  if (type === "footstep") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
    return;
  }

  if (type === "reload") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.11);
    return;
  }

  if (type === "reloadDone") {
    [380, 520].forEach((freq, i) => {
      const n = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const t = now + i * 0.07;
      n.type = "triangle";
      n.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(g);
      g.connect(audioCtx.destination);
      n.start(t);
      n.stop(t + 0.11);
    });
    return;
  }

  if (type === "empty") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
    return;
  }

  if (type === "weaponSwitch") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.11);
    return;
  }

  if (type === "win" || type === "lose" || type === "start") {
    const notes = type === "win" ? [440, 660, 880] : type === "lose" ? [240, 170, 120] : [260, 390];
    notes.forEach((note, index) => {
      const noteOsc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      const start = now + index * 0.09;
      noteOsc.type = "triangle";
      noteOsc.frequency.setValueAtTime(note, start);
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      noteOsc.connect(noteGain);
      noteGain.connect(audioCtx.destination);
      noteOsc.start(start);
      noteOsc.stop(start + 0.15);
    });
  }
}

function startReload() {
  const player = game.player;
  const weapon = WEAPONS[player.weaponIndex];
  if (player.reloading || player.ammo >= weapon.ammoMax) return;
  player.reloading = true;
  player.reloadTimer = weapon.reloadTime;
  playSound("reload");
  setMessage("Reloading...", weapon.reloadTime);
}

function switchWeapon() {
  const player = game.player;
  player.weaponIndex = (player.weaponIndex + 1) % WEAPONS.length;
  player.reloading = false;
  player.reloadTimer = 0;
  player.ammo = WEAPONS[player.weaponIndex].ammoMax;
  player.cooldown = 0.15;
  playSound("weaponSwitch");
  setMessage(WEAPONS[player.weaponIndex].name, 0.8);
}

function shoot(shooter, target, isPlayer) {
  if (shooter.cooldown > 0 || shooter.health <= 0 || target.health <= 0) return;
  if (isPlayer && (game.player.reloading)) return;

  if (isPlayer && game.player.ammo <= 0) {
    playSound("empty");
    startReload();
    return;
  }

  const weapon = isPlayer ? WEAPONS[game.player.weaponIndex] : null;
  shooter.cooldown = isPlayer ? weapon.cooldown : 0.8;

  if (isPlayer) {
    game.player.ammo--;
    shooter.pitch = clamp(shooter.pitch - weapon.recoil, -MAX_PITCH, MAX_PITCH);
    playSound(weapon.id === "shotgun" ? "shotgunShot" : "playerShot");
  } else {
    playSound("enemyShot");
  }

  const angleToTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
  const pellets = isPlayer ? weapon.pellets : 1;
  const spread = isPlayer ? weapon.spread : 0;
  const aimRadiusBase = isPlayer ? weapon.aimRadius : 0.18;
  const clearShot = hasLineOfSight(shooter, target);
  const dist = Math.hypot(target.x - shooter.x, target.y - shooter.y);

  if (!isPlayer && !clearShot) {
    shooter.cooldown = 0.8;
    return;
  }

  let totalDamage = 0;

  for (let p = 0; p < pellets; p++) {
    const pelletSpread = pellets > 1 ? (Math.random() - 0.5) * spread : 0;
    const pelletAngle = angleToTarget + pelletSpread;
    const pelletAimError = Math.abs(normalizeAngle(pelletAngle - shooter.angle));
    const pitchError = isPlayer ? Math.abs(shooter.pitch) : 0;
    const maxRange = isPlayer && weapon.id === "shotgun" ? 380 : 520;
    const canHit = pelletAimError < aimRadiusBase && pitchError < 0.3 && dist < maxRange && clearShot;

    if (canHit) {
      const headshot = isPlayer && pellets === 1 && isHeadshot(target);
      totalDamage += isPlayer ? (headshot ? weapon.damage * 2 : weapon.damage) : 12;
      if (headshot) game._lastShotHeadshot = true;
    } else if (isPlayer) {
      const wallHit = castRay(pelletAngle);
      if (wallHit.depth < MAX_DEPTH * 0.96) {
        addWallSparks(wallHit.x, wallHit.y);
      }
    }

    addShotParticles(shooter, pelletAngle, isPlayer);
  }

  if (isPlayer) addShellCasing(shooter);

  if (totalDamage > 0) {
    const wasAlive = target.health > 0;
    const headshot = game._lastShotHeadshot;
    game._lastShotHeadshot = false;

    if (!isPlayer) {
      const armorAbsorb = Math.min(game.player.armor, Math.ceil(totalDamage * 0.55));
      game.player.armor = Math.max(0, game.player.armor - armorAbsorb);
      totalDamage = Math.max(1, totalDamage - armorAbsorb);
    }

    target.health = Math.max(0, target.health - totalDamage);

    if (isPlayer) {
      target.hitTimer = 0.18;
      game.hitMarkerTimer = 0.22;

      if (wasAlive && target.health <= 0) {
        addDeathParticles(target);
        target.deathTimer = 0.7;
        playSound("kill");
        game.kills++;
        const killScore = headshot ? 200 * game.round : 100 * game.round;
        game.score += killScore;
        game.killStreakTimer = 3.5;
        game.killStreakCount++;
        const streakMsg = game.killStreakCount === 2 ? "Double Kill!" : game.killStreakCount === 3 ? "Triple Kill!" : game.killStreakCount >= 4 ? "MULTI KILL!" : headshot ? "HEADSHOT!" : "Kill!";
        setMessage(streakMsg, 1.0);
      } else if (headshot) {
        game.score += 25;
        game.hitMarkerTimer = 0.35;
        playSound("hit");
        setMessage(`HEADSHOT! ${totalDamage}`, 0.6);
      } else {
        game.score += 10;
        playSound("hit");
        setMessage(`Hit ${totalDamage}`, 0.45);
      }
    } else {
      game.damageTimer = 0.45;
      game.damageAngle = Math.atan2(shooter.y - game.player.y, shooter.x - game.player.x);
      playSound("damage");
      setMessage("Under fire", 0.45);
    }
  } else if (isPlayer) {
    setMessage("Miss", 0.28);
  }

  game.flashTimer = isPlayer ? 0.08 : game.flashTimer;
  updateHud();
  checkWinner();
}

function addShotParticles(shooter, angle, isPlayer) {
  const color = isPlayer ? "#20d7b5" : "#ff5d6c";
  for (let i = 0; i < 8; i++) {
    game.particles.push({
      x: shooter.x,
      y: shooter.y,
      dx: Math.cos(angle + (Math.random() - 0.5) * 0.18) * (140 + Math.random() * 150),
      dy: Math.sin(angle + (Math.random() - 0.5) * 0.18) * (140 + Math.random() * 150),
      life: 0.22,
      color,
    });
  }
}

function addDeathParticles(enemy) {
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 190;
    game.particles.push({
      x: enemy.x,
      y: enemy.y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 0.38 + Math.random() * 0.28,
      color: Math.random() > 0.45 ? "#ff5d6c" : "#ffce63",
    });
  }
}

function addWallSparks(x, y) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 75;
    game.particles.push({
      x, y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 0.18 + Math.random() * 0.14,
      color: Math.random() > 0.45 ? "#ffce63" : "#c8c8c8",
    });
  }
}

function addShellCasing(shooter) {
  const ejectAngle = shooter.angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
  game.particles.push({
    x: shooter.x,
    y: shooter.y,
    dx: Math.cos(ejectAngle) * (55 + Math.random() * 35),
    dy: Math.sin(ejectAngle) * (55 + Math.random() * 35),
    life: 0.55 + Math.random() * 0.25,
    color: "#d4a300",
  });
}

function setMessage(text, seconds) {
  statusText.textContent = text;
  game.messageTimer = seconds;
}

function checkWinner() {
  if (game.player.health <= 0 && game.running) {
    game.running = false;
    statusText.textContent = `Game Over  Score: ${game.score}`;
    playSound("lose");
    return;
  }
  if (getLivingEnemies().length === 0 && game.running && game.roundTransitionTimer <= 0) {
    game.roundTransitionTimer = 3.2;
    statusText.textContent = `Round ${game.round} Clear!`;
    game.score += 500 * game.round;
    playSound("win");
  }
}

function updateHud() {
  const living = getLivingEnemies();
  const totalEnemyHealth = game.enemies.reduce((sum, enemy) => sum + enemy.health, 0);
  const nearest = getNearestEnemy();
  const player = game.player;
  const weapon = WEAPONS[player.weaponIndex];

  playerHealthEl.textContent = player.health;
  playerArmorEl.textContent = player.armor;
  playerHealthBar.style.width = `${player.health}%`;
  playerArmorBar.style.width = `${(player.armor / MAX_ARMOR) * 100}%`;
  enemyHealthEl.textContent = `${living.length}/${game.enemies.length}`;
  enemyHealthBar.style.width = `${totalEnemyHealth / game.enemies.length}%`;

  weaponNameEl.textContent = weapon.name;
  roundLabelEl.textContent = `ROUND ${game.round}`;
  scoreEl.textContent = game.score;

  if (player.reloading) {
    const progress = 1 - player.reloadTimer / weapon.reloadTime;
    weaponChargeBar.style.width = `${Math.round(progress * 100)}%`;
    weaponStateEl.textContent = "RELOAD";
  } else {
    const charge = Math.round((1 - player.cooldown / weapon.cooldown) * 100);
    weaponChargeBar.style.width = `${Math.max(0, Math.min(100, charge))}%`;
    weaponStateEl.textContent = `${player.ammo}`;
  }

  enemyDistanceEl.textContent = nearest ? `${Math.round(nearest.dist / TILE * 5)}m` : "--m";
}

function update(dt) {
  if (!game?.running) return;

  const player = game.player;
  game.elapsed += dt;
  game.healthPackTimer = Math.max(0, game.healthPackTimer - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  game.flashTimer = Math.max(0, game.flashTimer - dt);
  game.damageTimer = Math.max(0, game.damageTimer - dt);
  game.hitMarkerTimer = Math.max(0, game.hitMarkerTimer - dt);
  game.killStreakTimer = Math.max(0, game.killStreakTimer - dt);
  if (game.killStreakTimer <= 0) game.killStreakCount = 0;

  if (game.roundTransitionTimer > 0) {
    game.roundTransitionTimer -= dt;
    if (game.roundTransitionTimer <= 0) {
      game.round++;
      game.enemies = spawnEnemiesForRound(game.round);
      game.healthPacks = [];
      game.armorPacks = [];
      spawnHealthPack();
      spawnHealthPack();
      spawnArmorPack();
      setMessage(`Round ${game.round}`, 2.0);
      playSound("start");
    }
  }

  for (const enemy of game.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
  }

  player.crouching = keys.has("KeyC") && player.onGround;

  if (player.onGround && keys.has("Space") && !player.crouching) {
    player.jumpVelocity = JUMP_FORCE;
    player.onGround = false;
    playSound("jump");
  }

  if (!player.onGround) {
    player.jumpVelocity -= GRAVITY * dt;
    player.jumpHeight += player.jumpVelocity * dt;
    if (player.jumpHeight <= 0) {
      player.jumpHeight = 0;
      player.jumpVelocity = 0;
      player.onGround = true;
      if (Math.hypot(player.vx, player.vy) > 30) playSound("land");
    }
  }

  if (player.reloading) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      player.reloading = false;
      player.ammo = WEAPONS[player.weaponIndex].ammoMax;
      playSound("reloadDone");
      setMessage("Ready", 0.5);
    }
  }

  if (player.ammo <= 0 && !player.reloading) {
    startReload();
  }

  const sprinting = !player.crouching && (keys.has("ShiftLeft") || keys.has("ShiftRight"));

  let targetFwd = 0;
  if (keys.has("KeyW")) {
    targetFwd += player.crouching ? PLAYER_CROUCH_SPEED : sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  }
  if (keys.has("KeyS")) {
    targetFwd -= player.crouching ? PLAYER_CROUCH_SPEED * 0.7 : PLAYER_BACK_SPEED;
  }

  let targetSide = 0;
  const sideSpeed = player.crouching ? PLAYER_CROUCH_SPEED : sprinting ? PLAYER_SPRINT_SPEED * 0.86 : PLAYER_STRAFE_SPEED;
  if (keys.has("KeyA")) targetSide -= sideSpeed;
  if (keys.has("KeyD")) targetSide += sideSpeed;

  const fwdX = Math.cos(player.angle);
  const fwdY = Math.sin(player.angle);
  const rightX = Math.cos(player.angle + Math.PI / 2);
  const rightY = Math.sin(player.angle + Math.PI / 2);

  const targetVx = fwdX * targetFwd + rightX * targetSide;
  const targetVy = fwdY * targetFwd + rightY * targetSide;

  player.vx += (targetVx - player.vx) * Math.min(1, PLAYER_ACCEL * dt);
  player.vy += (targetVy - player.vy) * Math.min(1, PLAYER_ACCEL * dt);

  moveEntity(player, player.vx * dt, player.vy * dt);

  const movSpeed = Math.hypot(player.vx, player.vy);
  if (movSpeed > 20) {
    player.footstepDist += movSpeed * dt;
    const stepInterval = player.crouching ? 110 : sprinting ? 50 : 76;
    if (player.footstepDist >= stepInterval) {
      player.footstepDist = 0;
      playSound("footstep");
    }
  }

  if (game.mouseHeld && player.cooldown <= 0 && !player.reloading) {
    const target = getAimedEnemy();
    if (target) shoot(player, target, true);
  }

  updateHealthPacks(dt);
  updateArmorPacks(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateHud();

  if (game.messageTimer > 0) {
    game.messageTimer -= dt;
    if (game.messageTimer <= 0 && game.running) statusText.textContent = "Survive";
  }
}

function updateHealthPacks(dt) {
  if (game.healthPackTimer <= 0) {
    spawnHealthPack();
    game.healthPackTimer = HEALTH_PACK_INTERVAL;
  }

  game.healthPacks = game.healthPacks.filter((pack) => {
    pack.pulse += dt * 4;
    const canHeal = game.player.health < 100;
    const touching = Math.hypot(pack.x - game.player.x, pack.y - game.player.y) < 28;

    if (canHeal && touching) {
      game.player.health = Math.min(100, game.player.health + HEALTH_PACK_HEAL);
      game.healthPackTimer = Math.min(game.healthPackTimer, HEALTH_PACK_INTERVAL * 0.7);
      setMessage("Health restored", 0.7);
      playSound("heal");
      return false;
    }

    return true;
  });
}

function updateArmorPacks(dt) {
  game.armorPackTimer = Math.max(0, game.armorPackTimer - dt);
  if (game.armorPackTimer <= 0) {
    spawnArmorPack();
    game.armorPackTimer = 14;
  }

  game.armorPacks = game.armorPacks.filter((pack) => {
    pack.pulse += dt * 3.5;
    const touching = Math.hypot(pack.x - game.player.x, pack.y - game.player.y) < 28;
    if (touching && game.player.armor < MAX_ARMOR) {
      game.player.armor = Math.min(MAX_ARMOR, game.player.armor + 25);
      setMessage("Armor +25", 0.7);
      playSound("heal");
      return false;
    }
    return true;
  });
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    if (enemy.health <= 0) {
      enemy.deathTimer = Math.max(0, enemy.deathTimer - dt);
    } else {
      updateEnemy(enemy, dt);
    }
  }
}

function updateEnemy(enemy, dt) {
  if (enemy.health <= 0) return;

  const player = game.player;
  const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const clearSight = hasLineOfSight(enemy, player);
  const playerInRange = dist < 520;
  const aimGap = Math.abs(normalizeAngle(angleToPlayer - enemy.angle));
  const seesPlayer = clearSight && playerInRange && aimGap < 1.45;

  if (seesPlayer) {
    enemy.awareness = Math.min(enemy.reactionTime + 1, enemy.awareness + dt);
    enemy.wanderAngle = angleToPlayer;
  } else {
    enemy.awareness = Math.max(0, enemy.awareness - dt * 0.65);
  }

  if (enemy.hitTimer > 0 && enemy.suppressTimer <= 0) {
    enemy.suppressTimer = 1.4 + Math.random() * 1.0;
    enemy.strafe *= -1;
  }
  enemy.suppressTimer = Math.max(0, enemy.suppressTimer - dt);

  if (Math.random() < 0.01) enemy.strafe *= -1;

  enemy.wanderTimer -= dt;
  if (enemy.wanderTimer <= 0) {
    enemy.wanderTimer = 1.4 + Math.random() * 1.6;
    enemy.wanderAngle += (Math.random() - 0.5) * 1.8;
  }

  const trackingPlayer = enemy.awareness > 0.25 && clearSight;
  const suppressed = enemy.suppressTimer > 0;
  const desiredAim = trackingPlayer ? angleToPlayer : enemy.wanderAngle;
  enemy.angle = rotateToward(enemy.angle, desiredAim, enemy.turnSpeed * dt);

  let moveAngle = trackingPlayer ? angleToPlayer : enemy.wanderAngle;
  if (trackingPlayer && dist < 190) moveAngle += Math.PI;
  if (suppressed) {
    moveAngle += Math.PI * 0.55 * enemy.strafe;
  } else if (trackingPlayer && dist >= 190 && dist <= 330) {
    moveAngle += Math.PI / 2 * enemy.strafe;
  }

  const baseSpeed = suppressed ? 74 : trackingPlayer ? 58 : 36;
  const speed = baseSpeed * enemy.speedBias;
  moveEntity(enemy, Math.cos(moveAngle) * speed * dt, Math.sin(moveAngle) * speed * dt);

  const finalAimError = Math.abs(normalizeAngle(angleToPlayer - enemy.angle));
  const fireSuppression = suppressed ? 0.72 : 0.28;
  const readyToFire = clearSight && enemy.awareness > enemy.reactionTime && finalAimError < 0.18 && Math.random() > fireSuppression;
  if (readyToFire) shoot(enemy, player, false);
}

function updateParticles(dt) {
  game.particles = game.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.dx * dt;
    particle.y += particle.dy * dt;
    return particle.life > 0 && !isWall(particle.x, particle.y);
  });
}

function render() {
  resizeCanvas();
  drawWorld();
  drawHealthPacks();
  drawArmorPacks();
  drawEnemies();
  drawEnemyIndicator();
  drawWeapon();
  drawMiniMap();
  drawScreenEffects();
  drawDamageIndicator();
  drawHitMarker();
  drawRoundBanner();
  requestAnimationFrame(loop);
}

function drawWorld() {
  const w = canvas.width;
  const h = canvas.height;
  const horizon = getHorizon();

  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon);
  ceiling.addColorStop(0, "#202a31");
  ceiling.addColorStop(0.55, "#101820");
  ceiling.addColorStop(1, "#06080a");
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, w, Math.max(0, horizon));

  const floor = ctx.createLinearGradient(0, horizon, 0, h);
  floor.addColorStop(0, "#26302c");
  floor.addColorStop(0.45, "#141917");
  floor.addColorStop(1, "#060806");
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, w, h - horizon);
  drawCeilingLights(horizon);
  drawFloorGrid(horizon);

  const sliceW = w / RAYS + 1;
  for (let i = 0; i < RAYS; i++) {
    const rayAngle = game.player.angle - FOV / 2 + (i / RAYS) * FOV;
    const hit = castRay(rayAngle);
    const corrected = hit.depth * Math.cos(rayAngle - game.player.angle);
    const wallH = Math.min(h * 1.35, (TILE * 620) / corrected);
    const shade = Math.max(0.18, 1 - corrected / MAX_DEPTH);
    const edge = (Math.floor(hit.x / TILE) + Math.floor(hit.y / TILE)) % 2;
    const pulse = 0.04 * Math.sin(performance.now() / 450 + i * 0.08);
    ctx.fillStyle = edge ? `rgba(32, 215, 181, ${shade + pulse})` : `rgba(103, 137, 151, ${shade})`;
    ctx.fillRect(i * sliceW, horizon - wallH / 2, sliceW, wallH);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.42 - shade * 0.26})`;
    ctx.fillRect(i * sliceW, horizon - wallH / 2, sliceW, wallH);
    if (i % 12 === 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.04 * shade})`;
      ctx.fillRect(i * sliceW, horizon - wallH / 2, 1, wallH);
    }
  }

  drawParticles3D();
}

function drawCeilingLights(horizon) {
  const y = clamp(horizon * 0.35, 26, canvas.height * 0.45);
  const spacing = canvas.width / 6;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 1; i < 6; i++) {
    const glow = ctx.createRadialGradient(spacing * i, y, 2, spacing * i, y, canvas.width * 0.11);
    glow.addColorStop(0, "rgba(32, 215, 181, 0.28)");
    glow.addColorStop(1, "rgba(32, 215, 181, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(spacing * i - canvas.width * 0.13, y - canvas.height * 0.12, canvas.width * 0.26, canvas.height * 0.24);
  }
  ctx.restore();
}

function drawFloorGrid(horizon) {
  ctx.save();
  ctx.strokeStyle = "rgba(32, 215, 181, 0.13)";
  ctx.lineWidth = Math.max(1, canvas.width / 900);

  for (let i = 1; i < 18; i++) {
    const t = i / 18;
    const y = horizon + (canvas.height - horizon) * (1 - Math.pow(1 - t, 2.4));
    ctx.globalAlpha = 1 - t * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (let i = -7; i <= 7; i++) {
    const x = canvas.width / 2 + i * canvas.width * 0.075;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, horizon);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemies() {
  const enemiesToDraw = game.enemies
    .filter((e) => e.health > 0 || e.deathTimer > 0)
    .map((enemy) => ({
      enemy,
      dist: Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y),
    }))
    .sort((a, b) => b.dist - a.dist);

  for (const item of enemiesToDraw) {
    drawEnemy(item.enemy);
  }
}

function drawHealthPacks() {
  const packsToDraw = game.healthPacks
    .map((pack) => ({
      pack,
      dist: Math.hypot(pack.x - game.player.x, pack.y - game.player.y),
    }))
    .sort((a, b) => b.dist - a.dist);

  for (const item of packsToDraw) {
    const pack = item.pack;
    const dx = pack.x - game.player.x;
    const dy = pack.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normalizeAngle(Math.atan2(dy, dx) - game.player.angle);

    if (Math.abs(angle) > FOV * 0.58 || !hasLineOfSight(game.player, pack)) continue;

    const size = Math.min(canvas.height * 0.26, (TILE * 190) / dist);
    const x = canvas.width / 2 + (angle / (FOV / 2)) * (canvas.width / 2) - size / 2;
    const y = getHorizon() + size * 0.35 + Math.sin(pack.pulse) * size * 0.05;

    ctx.save();
    ctx.shadowColor = "rgba(77, 255, 159, 0.75)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(x + size * 0.5, y + size * 0.9, size * 0.42, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#17231d";
    ctx.beginPath();
    ctx.roundRect(x + size * 0.18, y + size * 0.18, size * 0.64, size * 0.58, size * 0.08);
    ctx.fill();
    ctx.strokeStyle = "#4dff9f";
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.stroke();

    ctx.fillStyle = "#4dff9f";
    ctx.fillRect(x + size * 0.44, y + size * 0.28, size * 0.12, size * 0.38);
    ctx.fillRect(x + size * 0.31, y + size * 0.41, size * 0.38, size * 0.12);
    ctx.restore();
  }
}

function drawArmorPacks() {
  for (const pack of game.armorPacks) {
    const dx = pack.x - game.player.x;
    const dy = pack.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normalizeAngle(Math.atan2(dy, dx) - game.player.angle);

    if (Math.abs(angle) > FOV * 0.58 || !hasLineOfSight(game.player, pack)) continue;

    const size = Math.min(canvas.height * 0.24, (TILE * 175) / dist);
    const x = canvas.width / 2 + (angle / (FOV / 2)) * (canvas.width / 2) - size / 2;
    const y = getHorizon() + size * 0.3 + Math.sin(pack.pulse) * size * 0.06;

    ctx.save();
    ctx.shadowColor = "rgba(77, 153, 255, 0.85)";
    ctx.shadowBlur = 18;

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x + size * 0.5, y + size * 0.88, size * 0.38, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0e1a2e";
    ctx.beginPath();
    ctx.roundRect(x + size * 0.18, y + size * 0.18, size * 0.64, size * 0.58, size * 0.1);
    ctx.fill();
    ctx.strokeStyle = "#4d9fff";
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.stroke();

    ctx.fillStyle = "#4d9fff";
    const cx = x + size * 0.5;
    const cy = y + size * 0.47;
    const r = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.4);
    ctx.lineTo(cx, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.4, cy + r * 0.4);
    ctx.lineTo(cx - r * 0.7, cy - r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemy(enemy) {
  const dying = enemy.health <= 0 && enemy.deathTimer > 0;

  const dx = enemy.x - game.player.x;
  const dy = enemy.y - game.player.y;
  const dist = Math.hypot(dx, dy);
  const angle = normalizeAngle(Math.atan2(dy, dx) - game.player.angle);

  if (Math.abs(angle) > FOV * 0.62 || !hasLineOfSight(game.player, enemy)) return;

  const size = Math.min(canvas.height * 0.65, (TILE * 420) / dist);
  const deathAlpha = dying ? enemy.deathTimer / 0.7 : 1;
  const deathDrop = dying ? (1 - deathAlpha) * size * 0.5 : 0;
  const x = canvas.width / 2 + (angle / (FOV / 2)) * (canvas.width / 2) - size / 2;
  const y = getHorizon() - size * 0.5 + deathDrop;
  const hitGlow = enemy.hitTimer > 0 ? 1 : 0;

  ctx.save();
  ctx.globalAlpha = deathAlpha;
  ctx.shadowColor = hitGlow ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 93, 108, 0.7)";
  ctx.shadowBlur = hitGlow ? 34 : 22;

  const body = ctx.createLinearGradient(x, y, x + size, y + size);
  body.addColorStop(0, hitGlow ? "#ffe2e5" : "#ff7b86");
  body.addColorStop(0.5, "#b92539");
  body.addColorStop(1, "#3b1018");

  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.ellipse(x + size * 0.5, y + size * 1.04, size * 0.36, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#171b20";
  ctx.fillRect(x + size * 0.2, y + size * 0.48, size * 0.12, size * 0.34);
  ctx.fillRect(x + size * 0.68, y + size * 0.48, size * 0.12, size * 0.34);
  ctx.fillRect(x + size * 0.28, y + size * 0.82, size * 0.15, size * 0.26);
  ctx.fillRect(x + size * 0.57, y + size * 0.82, size * 0.15, size * 0.26);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x + size * 0.24, y + size * 0.25, size * 0.52, size * 0.62, size * 0.07);
  ctx.fill();

  ctx.fillStyle = "#252d35";
  ctx.beginPath();
  ctx.roundRect(x + size * 0.3, y + size * 0.08, size * 0.4, size * 0.25, size * 0.08);
  ctx.fill();

  ctx.fillStyle = "#ffccd1";
  ctx.fillRect(x + size * 0.35, y + size * 0.17, size * 0.3, size * 0.055);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fillRect(x + size * 0.39, y + size * 0.18, size * 0.08, size * 0.02);

  ctx.strokeStyle = "rgba(255, 206, 99, 0.8)";
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.34, y + size * 0.4);
  ctx.lineTo(x + size * 0.66, y + size * 0.4);
  ctx.stroke();

  ctx.fillStyle = "#0d1114";
  ctx.fillRect(x + size * 0.68, y + size * 0.53, size * 0.18, size * 0.08);
  ctx.fillStyle = "#ffce63";
  ctx.fillRect(x + size * 0.82, y + size * 0.55, size * 0.08, size * 0.035);

  if (enemy.health < enemy.maxHealth) {
    const barW = size * 0.58;
    const barH = Math.max(3, size * 0.044);
    const barX = x + size * 0.21;
    const barY = y - barH - size * 0.02;
    const pct = enemy.health / enemy.maxHealth;

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = pct > 0.6 ? "#4dff9f" : pct > 0.3 ? "#ffce63" : "#ff5d6c";
    ctx.fillRect(barX, barY, barW * pct, barH);
  }

  ctx.restore();
}

function drawEnemyIndicator() {
  const hiddenEnemies = getLivingEnemies().filter((enemy) => !hasLineOfSight(game.player, enemy));
  if (hiddenEnemies.length === 0) return;

  const enemy = hiddenEnemies.reduce((nearest, candidate) => {
    const candidateDist = Math.hypot(candidate.x - game.player.x, candidate.y - game.player.y);
    const nearestDist = Math.hypot(nearest.x - game.player.x, nearest.y - game.player.y);
    return candidateDist < nearestDist ? candidate : nearest;
  });

  const angle = normalizeAngle(Math.atan2(enemy.y - game.player.y, enemy.x - game.player.x) - game.player.angle);
  const x = canvas.width / 2 + Math.max(-1, Math.min(1, angle / Math.PI)) * canvas.width * 0.42;
  const y = canvas.height * 0.18;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(255, 93, 108, 0.88)";
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-9, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-9, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles3D() {
  for (const particle of game.particles) {
    const dx = particle.x - game.player.x;
    const dy = particle.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normalizeAngle(Math.atan2(dy, dx) - game.player.angle);
    if (Math.abs(angle) > FOV / 2 || dist < 8) continue;
    const size = Math.max(2, 90 / dist);
    const x = canvas.width / 2 + (angle / (FOV / 2)) * (canvas.width / 2);
    const y = getHorizon() + (Math.random() - 0.5) * 24;
    ctx.fillStyle = particle.color;
    ctx.fillRect(x, y, size * 10, size * 3);
  }
}

function drawWeapon() {
  const w = canvas.width;
  const h = canvas.height;
  const player = game.player;
  const weapon = WEAPONS[player.weaponIndex];
  const movSpeed = Math.hypot(player.vx, player.vy);
  const bobAmt = clamp(movSpeed / PLAYER_WALK_SPEED, 0, 1);
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const bobFreq = sprinting ? 130 : 185;
  const bob = Math.sin(performance.now() / bobFreq) * 6 * bobAmt;
  const sway = Math.cos(performance.now() / (bobFreq * 2)) * 4 * bobAmt;
  const reloadBob = player.reloading ? Math.sin(performance.now() / 90) * 8 : 0;

  ctx.save();
  ctx.translate(w * 0.5 + sway, h + bob + reloadBob + player.pitch * h * 0.14 - player.jumpHeight * 0.28);

  if (weapon.id === "shotgun") {
    drawShotgunModel();
  } else if (weapon.id === "smg") {
    drawSMGModel();
  } else {
    drawRifleModel();
  }

  if (game.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 206, 99, ${game.flashTimer > 0.04 ? 0.86 : 0.5})`;
    ctx.beginPath();
    ctx.moveTo(-30, -195);
    ctx.lineTo(0, weapon.id === "shotgun" ? -240 : -268);
    ctx.lineTo(30, -195);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawRifleModel() {
  const weaponGradient = ctx.createLinearGradient(-60, -190, 60, -40);
  weaponGradient.addColorStop(0, "#4a565d");
  weaponGradient.addColorStop(0.5, "#242c31");
  weaponGradient.addColorStop(1, "#090d10");

  ctx.fillStyle = weaponGradient;
  ctx.fillRect(-58, -126, 116, 126);
  ctx.fillStyle = "#38444b";
  ctx.fillRect(-39, -174, 78, 92);
  ctx.fillStyle = "#20d7b5";
  ctx.shadowColor = "rgba(32, 215, 181, 0.7)";
  ctx.shadowBlur = 12;
  ctx.fillRect(-26, -154, 52, 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0c1113";
  ctx.fillRect(-18, -195, 36, 48);
}

function drawShotgunModel() {
  const grad = ctx.createLinearGradient(-70, -160, 70, -20);
  grad.addColorStop(0, "#5c4a35");
  grad.addColorStop(0.5, "#2e2218");
  grad.addColorStop(1, "#0a0805");

  ctx.fillStyle = grad;
  ctx.fillRect(-68, -110, 136, 110);

  ctx.fillStyle = "#3d4a50";
  ctx.fillRect(-48, -158, 96, 74);

  ctx.fillStyle = "#ffce63";
  ctx.shadowColor = "rgba(255, 206, 99, 0.7)";
  ctx.shadowBlur = 10;
  ctx.fillRect(-30, -138, 60, 7);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#1a1008";
  ctx.fillRect(-22, -178, 44, 52);

  ctx.fillStyle = "#8b6914";
  ctx.fillRect(-24, -165, 8, 32);
  ctx.fillRect(16, -165, 8, 32);
}

function drawSMGModel() {
  const grad = ctx.createLinearGradient(-45, -145, 45, -10);
  grad.addColorStop(0, "#38454c");
  grad.addColorStop(0.5, "#1c2428");
  grad.addColorStop(1, "#070b0d");

  ctx.fillStyle = grad;
  ctx.fillRect(-44, -96, 88, 96);
  ctx.fillStyle = "#2a363d";
  ctx.fillRect(-28, -138, 56, 66);
  ctx.fillStyle = "#a0d0ff";
  ctx.shadowColor = "rgba(160, 208, 255, 0.7)";
  ctx.shadowBlur = 10;
  ctx.fillRect(-20, -118, 40, 7);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0c1113";
  ctx.fillRect(-14, -152, 28, 38);
  ctx.fillStyle = "#1e2a30";
  ctx.fillRect(-44, -60, 18, 60);
  ctx.fillStyle = "#a0d0ff";
  ctx.fillRect(-38, -50, 6, 4);
  ctx.fillRect(-38, -38, 6, 4);
  ctx.fillRect(-38, -26, 6, 4);
}

function drawDamageIndicator() {
  if (game.damageTimer <= 0) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) * 0.7;
  const alpha = clamp(game.damageTimer / 0.45, 0, 1);
  const relAngle = normalizeAngle(game.damageAngle - game.player.angle);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(relAngle - Math.PI / 2);

  const grad = ctx.createLinearGradient(0, -radius, 0, -radius * 0.55);
  grad.addColorStop(0, `rgba(255, 93, 108, ${alpha * 0.72})`);
  grad.addColorStop(1, "rgba(255, 93, 108, 0)");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(0, 0, radius, -0.44, 0.44);
  ctx.arc(0, 0, radius * 0.62, 0.44, -0.44, true);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawHitMarker() {
  if (!game.hitMarkerTimer || game.hitMarkerTimer <= 0) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const alpha = clamp(game.hitMarkerTimer / 0.22, 0, 1);
  const s = 11;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.92})`;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(32, 215, 181, 0.8)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.stroke();
  ctx.restore();
}

function drawRoundBanner() {
  if (game.roundTransitionTimer <= 0) return;

  const t = game.roundTransitionTimer / 3.2;
  const alpha = Math.min(1, t * 3) * Math.min(1, (1 - t) * 6 + 0.3);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.55})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(32, 215, 181, ${alpha})`;
  ctx.font = `bold ${Math.round(canvas.width * 0.055)}px Inter, ui-sans-serif, sans-serif`;
  ctx.fillText(`ROUND ${game.round} CLEAR`, canvas.width / 2, canvas.height * 0.41);

  ctx.fillStyle = `rgba(255, 206, 99, ${alpha * 0.9})`;
  ctx.font = `${Math.round(canvas.width * 0.032)}px Inter, ui-sans-serif, sans-serif`;
  ctx.fillText(`+${(500 * game.round).toLocaleString()} POINTS`, canvas.width / 2, canvas.height * 0.52);
  ctx.fillText(`Round ${game.round + 1} incoming...`, canvas.width / 2, canvas.height * 0.62);
  ctx.restore();
}

function drawScreenEffects() {
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.2,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.65,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.48)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (game.damageTimer > 0) {
    ctx.fillStyle = `rgba(255, 93, 108, ${game.damageTimer * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawMiniMap() {
  const scale = 0.23;
  const pad = 18;
  const mapW = map[0].length * TILE * scale;
  const mapH = map.length * TILE * scale;
  const x0 = canvas.width - mapW - pad;
  const y0 = canvas.height - mapH - pad - canvas.height * 0.12;

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "rgba(7, 9, 11, 0.72)";
  ctx.fillRect(x0 - 8, y0 - 8, mapW + 16, mapH + 16);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      ctx.fillStyle = map[y][x] === "1" ? "#60737c" : "#151a1b";
      ctx.fillRect(x0 + x * TILE * scale, y0 + y * TILE * scale, TILE * scale - 1, TILE * scale - 1);
    }
  }

  drawDot(game.player, "#20d7b5", 4);
  for (const enemy of getLivingEnemies()) {
    drawDot(enemy, "#ff5d6c", 4);
  }
  for (const pack of game.healthPacks) {
    drawDot(pack, "#4dff9f", 3);
  }
  ctx.restore();

  function drawDot(entity, color, radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + entity.x * scale, y0 + entity.y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function loop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  render();
}

window.addEventListener("keydown", (event) => {
  const moveKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "KeyC", "Space"];
  if (moveKeys.includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }

  if (!game?.running) return;

  if (event.code === "KeyR") {
    const weapon = WEAPONS[game.player.weaponIndex];
    if (!game.player.reloading && game.player.ammo < weapon.ammoMax) {
      startReload();
    }
  }

  if (event.code === "KeyQ") {
    switchWeapon();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (!game?.running) return;

  if (document.pointerLockElement === canvas) {
    game.player.angle += event.movementX * MOUSE_SENSITIVITY;
    game.player.pitch = clamp(game.player.pitch + event.movementY * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const insideCanvas =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (insideCanvas) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    game.player.angle += (event.clientX - centerX) * MOUSE_SENSITIVITY * 0.08;
    game.player.pitch = clamp(game.player.pitch + (event.clientY - centerY) * MOUSE_SENSITIVITY * 0.08, -MAX_PITCH, MAX_PITCH);
  }
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !game?.running) return;
  initAudio();
  canvas.requestPointerLock?.();
  game.mouseHeld = true;
  if (!game.player.reloading) {
    const target = getAimedEnemy();
    if (target) shoot(game.player, target, true);
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0 && game) game.mouseHeld = false;
});

startBtn.addEventListener("click", () => {
  initAudio();
  resetGame(true);
  canvas.requestPointerLock?.();
});

resetGame(false);
requestAnimationFrame(loop);

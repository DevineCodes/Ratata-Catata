/*
  Cat & Rats - 60s Chase
  - Cat follows the user's cursor or touch
  - Rats spawn from all screen edges and traverse the playfield
  - Catch rats by colliding with them; score as many as possible in 60 seconds
*/

(function () {
  /** @type {HTMLElement} */
  const gameArea = document.getElementById('game');
  /** @type {HTMLElement} */
  const catElement = document.getElementById('cat');
  /** @type {HTMLElement} */
  const scoreElement = document.getElementById('score');
  /** @type {HTMLElement} */
  const timerElement = document.getElementById('timer');
  /** @type {HTMLButtonElement} */
  const restartButton = document.getElementById('restart');
  /** @type {HTMLElement} */
  const overlay = document.getElementById('overlay');
  /** @type {HTMLButtonElement} */
  const startBtn = document.getElementById('startBtn');

  const RAT_EMOJI = '🐭';

  let isRunning = false;
  let score = 0;
  let timeLeftSeconds = 60;
  let lastFrameTs = 0;
  let animationFrameId = 0;
  let spawnIntervalId = 0;
  let countdownIntervalId = 0;

  /** Cat motion state */
  const catMotion = {
    currentX: window.innerWidth / 2,
    currentY: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    speedPixelsPerSecond: 1800
  };

  /** Active rats */
  /** @type {Array<{el: HTMLElement, x: number, y: number, vx: number, vy: number, size: number, alive: boolean}>} */
  let rats = [];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setCatPosition(x, y) {
    catElement.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function centerToTopLeft(x, y, width = 0, height = 0) {
    return { left: x - width / 2, top: y - height / 2 };
  }

  function placeCatAt(x, y) {
    const rect = catElement.getBoundingClientRect();
    const { left, top } = centerToTopLeft(x, y, rect.width, rect.height);
    setCatPosition(left, top);
  }

  function updateHud() {
    scoreElement.textContent = `Score: ${score}`;
    timerElement.textContent = `${timeLeftSeconds}`;
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function spawnRat() {
    const margin = 60; // spawn slightly off-screen
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Choose a spawn edge and starting position
    const edges = ['left', 'right', 'top', 'bottom'];
    const edge = randomChoice(edges);

    let startX = 0, startY = 0;
    if (edge === 'left') {
      startX = -margin;
      startY = randomBetween(0, h);
    } else if (edge === 'right') {
      startX = w + margin;
      startY = randomBetween(0, h);
    } else if (edge === 'top') {
      startX = randomBetween(0, w);
      startY = -margin;
    } else {
      startX = randomBetween(0, w);
      startY = h + margin;
    }

    // Aim the rat roughly through the screen towards the opposite side
    const targetX = randomBetween(w * 0.2, w * 0.8);
    const targetY = randomBetween(h * 0.2, h * 0.8);
    const dirX = targetX - startX;
    const dirY = targetY - startY;
    const magnitude = Math.hypot(dirX, dirY) || 1;
    const unitX = dirX / magnitude;
    const unitY = dirY / magnitude;

    const speed = randomBetween(140, 260); // px/s
    const vx = unitX * speed;
    const vy = unitY * speed;

    const rat = document.createElement('div');
    rat.className = 'rat';
    rat.textContent = RAT_EMOJI;
    rat.setAttribute('aria-label', 'Rat');
    rat.setAttribute('role', 'img');

    // Set initial transform position via CSS variable for animation fallback
    rat.style.setProperty('--x', `${Math.round(startX)}px`);
    rat.style.setProperty('--y', `${Math.round(startY)}px`);
    rat.style.transform = `translate(${Math.round(startX)}px, ${Math.round(startY)}px)`;

    gameArea.appendChild(rat);

    const ratObj = {
      el: rat,
      x: startX,
      y: startY,
      vx,
      vy,
      size: 32,
      alive: true
    };
    rats.push(ratObj);
  }

  function removeRat(ratObj) {
    ratObj.alive = false;
    if (ratObj.el && ratObj.el.parentElement) {
      ratObj.el.remove();
    }
  }

  function catchRat(ratObj) {
    ratObj.alive = false;
    score += 1;
    updateHud();
    const el = ratObj.el;
    if (el) {
      el.classList.add('caught');
      // Freeze position for the pop animation using CSS vars
      el.style.setProperty('--x', `${Math.round(ratObj.x)}px`);
      el.style.setProperty('--y', `${Math.round(ratObj.y)}px`);
      setTimeout(() => {
        if (el.parentElement) el.remove();
      }, 260);
    }
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(deltaSeconds) {
    // Move cat towards target position smoothly
    const dx = catMotion.targetX - catMotion.currentX;
    const dy = catMotion.targetY - catMotion.currentY;
    const dist = Math.hypot(dx, dy);
    const maxMove = catMotion.speedPixelsPerSecond * deltaSeconds;
    if (dist > 0.1) {
      const move = Math.min(dist, maxMove);
      catMotion.currentX += (dx / dist) * move;
      catMotion.currentY += (dy / dist) * move;
    }

    placeCatAt(catMotion.currentX, catMotion.currentY);

    // Update rats
    const w = window.innerWidth;
    const h = window.innerHeight;
    const removeBeyond = 220; // remove when well outside screen

    // Get cat bounds
    const catRect = catElement.getBoundingClientRect();
    const catX = catRect.left;
    const catY = catRect.top;
    const catW = catRect.width;
    const catH = catRect.height;

    for (let i = rats.length - 1; i >= 0; i--) {
      const r = rats[i];
      if (!r.alive) {
        rats.splice(i, 1);
        continue;
      }
      r.x += r.vx * deltaSeconds;
      r.y += r.vy * deltaSeconds;
      r.el.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;

      // Collision detection by rects
      const ratRect = r.el.getBoundingClientRect();
      if (rectsOverlap(catX, catY, catW, catH, ratRect.left, ratRect.top, ratRect.width, ratRect.height)) {
        catchRat(r);
        rats.splice(i, 1);
        continue;
      }

      // Remove rats far outside the viewport
      if (r.x < -removeBeyond || r.x > w + removeBeyond || r.y < -removeBeyond || r.y > h + removeBeyond) {
        removeRat(r);
        rats.splice(i, 1);
      }
    }
  }

  function frame(ts) {
    if (!isRunning) return;
    if (lastFrameTs === 0) lastFrameTs = ts;
    const deltaSeconds = Math.min(0.05, (ts - lastFrameTs) / 1000); // clamp large frames
    lastFrameTs = ts;
    update(deltaSeconds);
    animationFrameId = requestAnimationFrame(frame);
  }

  function startSpawning() {
    const baseIntervalMs = 650;
    let tick = 0;
    spawnIntervalId = setInterval(() => {
      // Spawn 1-3 rats per tick as time progresses
      const difficultyFactor = Math.min(1.0, (60 - timeLeftSeconds) / 60);
      const count = 1 + (Math.random() < difficultyFactor ? 1 : 0) + (Math.random() < difficultyFactor * 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) spawnRat();
      // Occasionally add an extra burst
      if (tick % 7 === 0 && Math.random() < 0.35) spawnRat();
      tick++;
    }, baseIntervalMs);
  }

  function stopSpawning() {
    clearInterval(spawnIntervalId);
  }

  function startCountdown() {
    countdownIntervalId = setInterval(() => {
      timeLeftSeconds -= 1;
      updateHud();
      if (timeLeftSeconds <= 0) {
        endGame();
      }
    }, 1000);
  }

  function stopCountdown() {
    clearInterval(countdownIntervalId);
  }

  function beginGame() {
    isRunning = true;
    score = 0;
    timeLeftSeconds = 60;
    rats.forEach(r => removeRat(r));
    rats = [];
    updateHud();
    overlay.style.display = 'none';
    restartButton.hidden = true;
    lastFrameTs = 0;
    startSpawning();
    startCountdown();
    animationFrameId = requestAnimationFrame(frame);
  }

  function endGame() {
    if (!isRunning) return;
    isRunning = false;
    stopSpawning();
    stopCountdown();
    cancelAnimationFrame(animationFrameId);
    restartButton.hidden = false;
    overlay.style.display = 'grid';
    overlay.querySelector('h1').textContent = 'Time\'s up!';
    overlay.querySelector('p').textContent = `You caught ${score} rat${score === 1 ? '' : 's'}.`;
    startBtn.textContent = 'Play again';
  }

  // Pointer handling (mouse + touch)
  function handlePointer(clientX, clientY) {
    // Clamp slightly inside the viewport edges
    const x = clamp(clientX, 0, window.innerWidth);
    const y = clamp(clientY, 0, window.innerHeight);
    catMotion.targetX = x;
    catMotion.targetY = y;
    // If not running yet, also place the cat immediately
    if (!isRunning) {
      catMotion.currentX = x;
      catMotion.currentY = y;
      placeCatAt(x, y);
    }
  }

  window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) handlePointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) handlePointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // Start/Restart controls
  startBtn.addEventListener('click', () => {
    beginGame();
  });
  restartButton.addEventListener('click', () => beginGame());

  // Place cat initially at center
  window.addEventListener('load', () => {
    placeCatAt(catMotion.currentX, catMotion.currentY);
    updateHud();
  });

  // Handle resize to keep cat within bounds
  window.addEventListener('resize', () => {
    catMotion.currentX = clamp(catMotion.currentX, 0, window.innerWidth);
    catMotion.currentY = clamp(catMotion.currentY, 0, window.innerHeight);
    placeCatAt(catMotion.currentX, catMotion.currentY);
  });
})();


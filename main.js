// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 20;
const COLS = CANVAS_WIDTH / TILE_SIZE;
const ROWS = CANVAS_HEIGHT / TILE_SIZE;

// Game state
let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let dotsCollected = 0;
let totalDots = 0;

// Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Maze
let maze = [];

// Player (Pac-Shooter)
const player = {
  gridX: 0, // grid column
  gridY: 0, // grid row
  x: 0, // pixel position (for drawing)
  y: 0,
  size: TILE_SIZE - 4,
  direction: "right", // 'up', 'down', 'left', 'right'
  nextDirection: "right", // queued direction
  moveProgress: 0, // 0 to 1, for smooth movement animation
  moveSpeed: 0.15, // how fast to move between tiles
  mouthOpen: 0,
  mouthOpening: true,
  color: "#FFFF00",
};

// Projectiles
let projectiles = [];

// Ghosts
let ghosts = [];
const ghostColors = [
  "#FF0000",
  "#00FFFF",
  "#FFA500",
  "#FFB8FF",
  "#00FF00",
  "#FF00FF",
];

// Power-ups
let powerUps = [];
let powerUpActive = false;
let powerUpTimer = 0;

// Keys
const keys = {};

// Generate maze
function generateMaze() {
  maze = [];
  for (let row = 0; row < ROWS; row++) {
    maze[row] = [];
    for (let col = 0; col < COLS; col++) {
      // Edges are always walls
      if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) {
        maze[row][col] = 1;
      }
      // Create maze structure
      else if (row % 4 === 0 && col % 6 === 0) {
        maze[row][col] = 1;
      } else if (row % 4 === 0 && col % 6 === 3) {
        maze[row][col] = 1;
      } else if (Math.random() < 0.15) {
        maze[row][col] = 1;
      }
      // Dots (2) and Power-ups (3)
      else if (Math.random() < 0.05) {
        maze[row][col] = 3; // power-up
      } else {
        maze[row][col] = 2; // dot
      }
    }
  }

  // Clear player starting position
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (maze[startY + i] && maze[startY + i][startX + j]) {
        maze[startY + i][startX + j] = 0;
      }
    }
  }

  // Count total dots
  totalDots = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (maze[row][col] === 2) totalDots++;
    }
  }
}

// Initialize player
function initPlayer() {
  player.gridX = Math.floor(COLS / 2);
  player.gridY = Math.floor(ROWS / 2);
  player.x = player.gridX * TILE_SIZE + TILE_SIZE / 2;
  player.y = player.gridY * TILE_SIZE + TILE_SIZE / 2;
  player.direction = "right";
  player.nextDirection = "right";
  player.moveProgress = 0;
}

// Initialize ghosts
function initGhosts() {
  ghosts = [];
  const numGhosts = 4 + level * 3; // More ghosts with each level

  for (let i = 0; i < numGhosts; i++) {
    let x, y;
    do {
      x =
        Math.floor(Math.random() * (COLS - 2) + 1) * TILE_SIZE + TILE_SIZE / 2;
      y =
        Math.floor(Math.random() * (ROWS - 2) + 1) * TILE_SIZE + TILE_SIZE / 2;
    } while (
      isWall(x, y) ||
      (Math.abs(x - player.x) < 100 && Math.abs(y - player.y) < 100)
    );

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    ghosts.push({
      gridX: gridX,
      gridY: gridY,
      x: gridX * TILE_SIZE + TILE_SIZE / 2,
      y: gridY * TILE_SIZE + TILE_SIZE / 2,
      size: TILE_SIZE - 4,
      direction: ["up", "down", "left", "right"][Math.floor(Math.random() * 4)],
      moveProgress: 0,
      moveSpeed: 0.08 + level * 0.01,
      color: ghostColors[i % ghostColors.length],
      scared: false,
    });
  }
}

// Check wall collision
function isWall(x, y) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return maze[row][col] === 1;
}

// Check if grid cell is wall
function isGridWall(gridX, gridY) {
  if (gridY < 0 || gridY >= ROWS || gridX < 0 || gridX >= COLS) return true;
  return maze[gridY][gridX] === 1;
}

// Check if entity collides with wall (checks multiple points)
function isWallCollision(x, y, size) {
  const radius = size / 2;
  const checkPoints = [
    { x: x, y: y }, // center
    { x: x - radius, y: y }, // left
    { x: x + radius, y: y }, // right
    { x: x, y: y - radius }, // top
    { x: x, y: y + radius }, // bottom
    { x: x - radius * 0.7, y: y - radius * 0.7 }, // top-left
    { x: x + radius * 0.7, y: y - radius * 0.7 }, // top-right
    { x: x - radius * 0.7, y: y + radius * 0.7 }, // bottom-left
    { x: x + radius * 0.7, y: y + radius * 0.7 }, // bottom-right
  ];

  for (let point of checkPoints) {
    if (isWall(point.x, point.y)) {
      return true;
    }
  }
  return false;
}

// Check dot collision
function checkDotCollision() {
  const gridX = player.gridX;
  const gridY = player.gridY;

  if (maze[gridY] && maze[gridY][gridX] === 2) {
    maze[gridY][gridX] = 0;
    score += 10;
    dotsCollected++;
    updateHUD();
  } else if (maze[gridY] && maze[gridY][gridX] === 3) {
    maze[gridY][gridX] = 0;
    score += 50;
    activatePowerUp();
    updateHUD();
  }
}

// Activate power-up
function activatePowerUp() {
  powerUpActive = true;
  powerUpTimer = 300; // 5 seconds at 60 FPS
  ghosts.forEach((ghost) => (ghost.scared = true));
}

// Shoot
function shoot() {
  let dx = 0,
    dy = 0;
  if (player.direction === "left") dx = -5;
  else if (player.direction === "right") dx = 5;
  else if (player.direction === "up") dy = -5;
  else if (player.direction === "down") dy = 5;

  const bullet = {
    x: player.x,
    y: player.y,
    size: 6,
    speed: 5,
    dx: dx,
    dy: dy,
    life: 100,
  };
  projectiles.push(bullet);
}

// Update projectiles
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const bullet = projectiles[i];
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
    bullet.life--;

    // Remove if hits wall or life expires
    if (isWall(bullet.x, bullet.y) || bullet.life <= 0) {
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with ghosts
    for (let j = ghosts.length - 1; j >= 0; j--) {
      const ghost = ghosts[j];
      const dx = bullet.x - ghost.x;
      const dy = bullet.y - ghost.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < ghost.size / 2 + bullet.size) {
        ghosts.splice(j, 1);
        projectiles.splice(i, 1);
        score += ghost.scared ? 200 : 100;
        updateHUD();
        break;
      }
    }
  }
}

// Update ghosts
function updateGhosts() {
  for (let i = 0; i < ghosts.length; i++) {
    const ghost = ghosts[i];

    // If at grid center, decide next direction
    if (ghost.moveProgress === 0) {
      // Find valid directions
      const directions = [];
      const opposite = { up: "down", down: "up", left: "right", right: "left" };

      if (!isGridWall(ghost.gridX - 1, ghost.gridY)) directions.push("left");
      if (!isGridWall(ghost.gridX + 1, ghost.gridY)) directions.push("right");
      if (!isGridWall(ghost.gridX, ghost.gridY - 1)) directions.push("up");
      if (!isGridWall(ghost.gridX, ghost.gridY + 1)) directions.push("down");

      // Remove opposite direction to prevent back-and-forth
      const validDirs = directions.filter(
        (d) => d !== opposite[ghost.direction]
      );

      if (validDirs.length > 0) {
        if (ghost.scared) {
          // Run away from player
          const dx = ghost.gridX - player.gridX;
          const dy = ghost.gridY - player.gridY;
          let preferredDir = "";
          if (Math.abs(dx) > Math.abs(dy)) {
            preferredDir = dx > 0 ? "right" : "left";
          } else {
            preferredDir = dy > 0 ? "down" : "up";
          }

          if (validDirs.includes(preferredDir) && Math.random() < 0.7) {
            ghost.direction = preferredDir;
          } else {
            ghost.direction =
              validDirs[Math.floor(Math.random() * validDirs.length)];
          }
        } else {
          // Chase player
          const dx = player.gridX - ghost.gridX;
          const dy = player.gridY - ghost.gridY;
          let preferredDir = "";
          if (Math.abs(dx) > Math.abs(dy)) {
            preferredDir = dx > 0 ? "right" : "left";
          } else {
            preferredDir = dy > 0 ? "down" : "up";
          }

          if (validDirs.includes(preferredDir) && Math.random() < 0.7) {
            ghost.direction = preferredDir;
          } else {
            ghost.direction =
              validDirs[Math.floor(Math.random() * validDirs.length)];
          }
        }
      } else if (directions.length > 0) {
        ghost.direction =
          directions[Math.floor(Math.random() * directions.length)];
      }

      // Start moving if possible
      let nextGridX = ghost.gridX;
      let nextGridY = ghost.gridY;

      if (ghost.direction === "left") nextGridX--;
      else if (ghost.direction === "right") nextGridX++;
      else if (ghost.direction === "up") nextGridY--;
      else if (ghost.direction === "down") nextGridY++;

      if (!isGridWall(nextGridX, nextGridY)) {
        ghost.moveProgress = ghost.moveSpeed;
      }
    } else {
      // Continue moving
      ghost.moveProgress += ghost.moveSpeed;

      // If reached next tile
      if (ghost.moveProgress >= 1) {
        ghost.moveProgress = 0;

        // Update grid position
        if (ghost.direction === "left") ghost.gridX--;
        else if (ghost.direction === "right") ghost.gridX++;
        else if (ghost.direction === "up") ghost.gridY--;
        else if (ghost.direction === "down") ghost.gridY++;
      }
    }

    // Update pixel position for smooth animation
    const fromX = ghost.gridX * TILE_SIZE + TILE_SIZE / 2;
    const fromY = ghost.gridY * TILE_SIZE + TILE_SIZE / 2;
    let toX = fromX;
    let toY = fromY;

    if (ghost.moveProgress > 0) {
      if (ghost.direction === "left") toX = fromX - TILE_SIZE;
      else if (ghost.direction === "right") toX = fromX + TILE_SIZE;
      else if (ghost.direction === "up") toY = fromY - TILE_SIZE;
      else if (ghost.direction === "down") toY = fromY + TILE_SIZE;

      ghost.x = fromX + (toX - fromX) * ghost.moveProgress;
      ghost.y = fromY + (toY - fromY) * ghost.moveProgress;
    } else {
      ghost.x = fromX;
      ghost.y = fromY;
    }

    // Check collision with player (on same grid cell)
    if (ghost.gridX === player.gridX && ghost.gridY === player.gridY) {
      if (ghost.scared) {
        ghosts.splice(i, 1);
        score += 200;
        i--;
        updateHUD();
      } else {
        lives--;
        updateHUD();
        if (lives <= 0) {
          gameOver();
        } else {
          initPlayer();
          initGhosts();
        }
      }
    }
  }

  // Update power-up timer
  if (powerUpActive) {
    powerUpTimer--;
    if (powerUpTimer <= 0) {
      powerUpActive = false;
      ghosts.forEach((ghost) => (ghost.scared = false));
    }
  }
}

// Update player
function updatePlayer() {
  // If at grid center (moveProgress = 0), can change direction or start moving
  if (player.moveProgress === 0) {
    // Try to move in next direction
    let nextGridX = player.gridX;
    let nextGridY = player.gridY;

    if (player.nextDirection === "left") nextGridX--;
    else if (player.nextDirection === "right") nextGridX++;
    else if (player.nextDirection === "up") nextGridY--;
    else if (player.nextDirection === "down") nextGridY++;

    // Check if can move in next direction
    if (!isGridWall(nextGridX, nextGridY)) {
      player.direction = player.nextDirection;
    }

    // Try to move in current direction
    nextGridX = player.gridX;
    nextGridY = player.gridY;

    if (player.direction === "left") nextGridX--;
    else if (player.direction === "right") nextGridX++;
    else if (player.direction === "up") nextGridY--;
    else if (player.direction === "down") nextGridY++;

    // Start moving if no wall
    if (!isGridWall(nextGridX, nextGridY)) {
      player.moveProgress = player.moveSpeed;
    }
  } else {
    // Continue moving
    player.moveProgress += player.moveSpeed;

    // If reached next tile
    if (player.moveProgress >= 1) {
      player.moveProgress = 0;

      // Update grid position
      if (player.direction === "left") player.gridX--;
      else if (player.direction === "right") player.gridX++;
      else if (player.direction === "up") player.gridY--;
      else if (player.direction === "down") player.gridY++;

      checkDotCollision();
    }
  }

  // Update pixel position for smooth animation
  const fromX = player.gridX * TILE_SIZE + TILE_SIZE / 2;
  const fromY = player.gridY * TILE_SIZE + TILE_SIZE / 2;
  let toX = fromX;
  let toY = fromY;

  if (player.moveProgress > 0) {
    if (player.direction === "left") toX = fromX - TILE_SIZE;
    else if (player.direction === "right") toX = fromX + TILE_SIZE;
    else if (player.direction === "up") toY = fromY - TILE_SIZE;
    else if (player.direction === "down") toY = fromY + TILE_SIZE;

    player.x = fromX + (toX - fromX) * player.moveProgress;
    player.y = fromY + (toY - fromY) * player.moveProgress;
  } else {
    player.x = fromX;
    player.y = fromY;
  }

  // Mouth animation
  if (player.mouthOpening) {
    player.mouthOpen += 0.1;
    if (player.mouthOpen >= 0.5) player.mouthOpening = false;
  } else {
    player.mouthOpen -= 0.1;
    if (player.mouthOpen <= 0) player.mouthOpening = true;
  }

  // Check level completion
  if (dotsCollected >= totalDots) {
    levelComplete();
  }
}

// Draw maze
function drawMaze() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      if (maze[row][col] === 1) {
        // Wall
        ctx.fillStyle = "#0000FF";
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "#4169E1";
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (maze[row][col] === 2) {
        // Dot
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (maze[row][col] === 3) {
        // Power-up
        ctx.fillStyle = "#FF69B4";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 6, 0, Math.PI * 2);
        ctx.fill();

        // Blinking effect
        if (Math.floor(Date.now() / 200) % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

// Draw player
function drawPlayer() {
  const directionAngles = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
  };
  const angle = directionAngles[player.direction];

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(
    player.x,
    player.y,
    player.size / 2,
    angle + player.mouthOpen,
    angle + Math.PI * 2 - player.mouthOpen
  );
  ctx.lineTo(player.x, player.y);
  ctx.fill();
}

// Draw projectiles
function drawProjectiles() {
  ctx.fillStyle = "#FFFFFF";
  projectiles.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Draw ghosts
function drawGhosts() {
  ghosts.forEach((ghost) => {
    ctx.fillStyle = ghost.scared ? "#0000FF" : ghost.color;

    // Ghost body
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y - ghost.size / 4, ghost.size / 2, Math.PI, 0);
    ctx.lineTo(ghost.x + ghost.size / 2, ghost.y + ghost.size / 2);
    ctx.lineTo(ghost.x + ghost.size / 3, ghost.y + ghost.size / 3);
    ctx.lineTo(ghost.x + ghost.size / 6, ghost.y + ghost.size / 2);
    ctx.lineTo(ghost.x, ghost.y + ghost.size / 3);
    ctx.lineTo(ghost.x - ghost.size / 6, ghost.y + ghost.size / 2);
    ctx.lineTo(ghost.x - ghost.size / 3, ghost.y + ghost.size / 3);
    ctx.lineTo(ghost.x - ghost.size / 2, ghost.y + ghost.size / 2);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(
      ghost.x - ghost.size / 6,
      ghost.y - ghost.size / 6,
      ghost.size / 8,
      0,
      Math.PI * 2
    );
    ctx.arc(
      ghost.x + ghost.size / 6,
      ghost.y - ghost.size / 6,
      ghost.size / 8,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (!ghost.scared) {
      ctx.fillStyle = "#0000FF";
      ctx.beginPath();
      ctx.arc(
        ghost.x - ghost.size / 6,
        ghost.y - ghost.size / 6,
        ghost.size / 16,
        0,
        Math.PI * 2
      );
      ctx.arc(
        ghost.x + ghost.size / 6,
        ghost.y - ghost.size / 6,
        ghost.size / 16,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  });
}

// Main game loop
function gameLoop() {
  if (!gameRunning) return;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawMaze();
  drawPlayer();
  drawProjectiles();
  drawGhosts();

  updatePlayer();
  updateProjectiles();
  updateGhosts();

  requestAnimationFrame(gameLoop);
}

// Initialize game
function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  dotsCollected = 0;
  projectiles = [];
  gameRunning = true;

  generateMaze();
  initPlayer();
  initGhosts();
  updateHUD();

  document.getElementById("game-over").classList.add("hidden");
  document.getElementById("level-complete").classList.add("hidden");

  gameLoop();
}

// Next level
function nextLevel() {
  level++;
  dotsCollected = 0;
  projectiles = [];

  generateMaze();
  initPlayer();
  initGhosts();
  updateHUD();

  document.getElementById("level-complete").classList.add("hidden");
  gameRunning = true;
  gameLoop();
}

// Game over
function gameOver() {
  gameRunning = false;
  document.getElementById("final-score").textContent = score;
  document.getElementById("game-over").classList.remove("hidden");
}

// Level complete
function levelComplete() {
  gameRunning = false;
  document.getElementById("level-complete").classList.remove("hidden");
}

// Update HUD
function updateHUD() {
  document.getElementById("score").textContent = score;
  document.getElementById("lives").textContent = lives;
  document.getElementById("level").textContent = level;
}

// Keyboard controls
document.addEventListener("keydown", (e) => {
  if (!gameRunning) return;

  if (e.key === "ArrowLeft" || e.key === "a") {
    e.preventDefault();
    player.nextDirection = "left";
  } else if (e.key === "ArrowRight" || e.key === "d") {
    e.preventDefault();
    player.nextDirection = "right";
  } else if (e.key === "ArrowUp" || e.key === "w") {
    e.preventDefault();
    player.nextDirection = "up";
  } else if (e.key === "ArrowDown" || e.key === "s") {
    e.preventDefault();
    player.nextDirection = "down";
  } else if (e.key === " ") {
    e.preventDefault();
    shoot();
  }
});

// Buttons
document.getElementById("restart-btn").addEventListener("click", initGame);
document.getElementById("next-level-btn").addEventListener("click", nextLevel);

// Start game
initGame();

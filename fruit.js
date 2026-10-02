// --- GAME STATE ---
let score = 0, currentLevel = 1, lives = 3;
let targetScore = 100;
let gameActive = false, isPaused = false, isCountingDown = false;
let currentEquation = { n1: 0, n2: 0, answer: 0, timesMissed: 0 };
let activeFruits = [];
let spawnLoop, physicsLoop, musicLoop;
let mouseIsDown = false;
let mouseX = 0, mouseY = 0;

// --- AUDIO SYSTEM ---
let audioMuted = false;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(freq, type, duration, endFreq = null) {
    if (audioMuted) return;
    initAudio();
    try {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

function startMusic() {
    clearInterval(musicLoop);
    // New BGM: Fast, bouncy pentatonic rhythm (different from frog game)
    const melody = [261, 329, 392, 440, 392, 329];
    let i = 0;
    musicLoop = setInterval(() => {
        if (gameActive && !isPaused) {
            playSound(melody[i % melody.length], 'square', 0.15);
            i++;
        }
    }, 300);
}

// Custom specific sounds
function playCorrectSound() { playSound(600, 'sine', 0.1, 900); setTimeout(() => playSound(900, 'sine', 0.2, 1200), 100); }
function playWrongCutSound() { playSound(150, 'sawtooth', 0.3, 50); }
function playLoseLifeSound() { playSound(300, 'square', 0.4, 100); setTimeout(() => playSound(150, 'sawtooth', 0.5, 50), 300); }
function playLifeGainSound() { playSound(400, 'triangle', 0.1, 800); setTimeout(() => playSound(800, 'triangle', 0.3, 1600), 100); }

// --- PERSISTENCE ---
function saveGame() { localStorage.setItem('fruitGameSave', JSON.stringify({ level: currentLevel })); }
function loadGame() {
    const data = JSON.parse(localStorage.getItem('fruitGameSave'));
    currentLevel = data ? data.level : 1;
    lives = 3; score = 0;
}

// --- BUTTON LISTENERS ---
document.getElementById('btn-main-play').addEventListener('click', () => {
    initAudio(); loadGame();
    document.getElementById('screen-start').classList.add('hidden');
    startCountdown();
});
document.getElementById('btn-main-rules').addEventListener('click', () => document.getElementById('rules-overlay').classList.remove('hidden'));
document.getElementById('btn-rules-close').addEventListener('click', () => document.getElementById('rules-overlay').classList.add('hidden'));
document.getElementById('btn-toggle-sound').addEventListener('click', (e) => {
    audioMuted = !audioMuted; e.target.innerText = audioMuted ? "🔇 SOUND: OFF" : "🔊 SOUND: ON";
});
document.getElementById('btn-game-pause').addEventListener('click', () => {
    if (!gameActive) return; isPaused = true; document.getElementById('pause-overlay').classList.remove('hidden');
});
document.getElementById('btn-pause-resume').addEventListener('click', () => {
    isPaused = false; document.getElementById('pause-overlay').classList.add('hidden');
});
document.getElementById('btn-pause-home').addEventListener('click', () => location.reload());
document.getElementById('btn-board-retry').addEventListener('click', () => location.reload());

// --- BLADE ANIMATION (SWIPE TRAIL) ---
document.addEventListener('pointerdown', (e) => { mouseIsDown = true; updateMousePos(e); });
document.addEventListener('pointerup', () => mouseIsDown = false);
document.addEventListener('pointermove', (e) => {
    if (!gameActive || isPaused) return;
    const lastX = mouseX; const lastY = mouseY;
    updateMousePos(e);
    if (mouseIsDown) drawBladeTrail(lastX, lastY, mouseX, mouseY);
});

function updateMousePos(e) {
    const rect = document.getElementById('active-arena').getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
}

function drawBladeTrail(x1, y1, x2, y2) {
    const trail = document.createElement('div');
    trail.className = 'blade-trail';
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    trail.style.width = `${length}px`;
    trail.style.left = `${x1}px`;
    trail.style.top = `${y1}px`;
    trail.style.transform = `rotate(${angle}rad)`;
    document.getElementById('active-arena').appendChild(trail);
    setTimeout(() => { trail.style.opacity = '0'; setTimeout(() => trail.remove(), 150); }, 50);
}

// --- CORE LOOPS ---
function startCountdown() {
    isCountingDown = true; gameActive = false;
    let count = 3;
    document.getElementById('screen-gameplay').classList.remove('hidden');
    const overlay = document.getElementById('countdown-ticker-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('txt-countdown-number').innerText = count;
    playSound(440, 'sine', 0.1);

    let ticker = setInterval(() => {
        count--;
        if (count > 0) { document.getElementById('txt-countdown-number').innerText = count; playSound(440, 'sine', 0.1); }
        else if (count === 0) { document.getElementById('txt-countdown-number').innerText = "SLICE!"; playSound(880, 'sine', 0.3, 1200); }
        else { clearInterval(ticker); overlay.classList.add('hidden'); isCountingDown = false; initLevel(); }
    }, 1000);
}

function initLevel() {
    document.getElementById('active-arena').innerHTML = '';
    activeFruits = [];
    targetScore = currentLevel * 100;
    score = 0;
    lives = 3;
    gameActive = true;
    isPaused = false;

    updateHUD();
    generateEquation();
    startMusic();

    clearInterval(spawnLoop);
    let spawnRate = Math.max(2000 - (currentLevel * 150), 1000);
    spawnLoop = setInterval(() => { if (gameActive && !isPaused) spawnFruit(); }, spawnRate);

    if (!physicsLoop) requestAnimationFrame(updatePhysics);
}

function updateHUD() {
    document.getElementById('txt-score').innerText = String(score).padStart(3, '0');
    document.getElementById('txt-target').innerText = targetScore;
    document.getElementById('txt-level').innerText = currentLevel;
    document.getElementById('txt-lives').innerText = lives > 0 ? "❤️".repeat(lives) : "☠️";
}

// --- MATH LOGIC FOR KIDS ---
function generateEquation() {
    let maxTotal = 5 + (currentLevel * 1.5);
    if (maxTotal > 20) maxTotal = 20; // Hard cap at 20 for ages 5-10

    let n1 = Math.floor(Math.random() * (maxTotal - 2)) + 2;
    let n2 = Math.floor(Math.random() * (n1 - 1)) + 1; // Ensures answer is always positive!

    currentEquation = { n1: n1, n2: n2, answer: n1 - n2, timesMissed: 0 };
    document.getElementById('txt-math-problem').innerText = `${n1} - ${n2} = ?`;
}

// --- SPAWN & PHYSICS LOGIC ---
const emojis = ['🍎', '🍏', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🥝', '🥥'];

function spawnFruit() {
    // Should we spawn a life recovery item? (Levels 4+, 10% chance)
    let isLifeHeart = false;
    if (currentLevel >= 4 && Math.random() > 0.90) {
        isLifeHeart = true;
    }

    const isCorrect = isLifeHeart ? false : Math.random() > 0.5;
    let numberOnFruit = "";

    if (!isLifeHeart) {
        if (isCorrect) {
            numberOnFruit = currentEquation.answer;
        } else {
            numberOnFruit = currentEquation.answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
            if (numberOnFruit < 0) numberOnFruit = currentEquation.answer + 2;
            if (numberOnFruit === currentEquation.answer) numberOnFruit += 1; // Strict bug fix
        }
    }

    const fruitEl = document.createElement('div');
    fruitEl.className = 'fruit-entity';
    const emoji = isLifeHeart ? '💖' : emojis[Math.floor(Math.random() * emojis.length)];
    fruitEl.innerHTML = `<span class="fruit-bg">${emoji}</span> <span>${numberOnFruit}</span>`;

    let startX = Math.random() * 500 + 150; // Keeps it safely away from screen edges

    let fruitData = {
        el: fruitEl, emoji: emoji, x: startX, y: 650,
        vx: (Math.random() - 0.5) * 4,
        vy: -(Math.random() * 3 + 13 + (currentLevel * 0.2)),
        rotation: 0, rotSpeed: (Math.random() - 0.5) * 10,
        isCorrect: isCorrect, isLifeHeart: isLifeHeart, sliced: false
    };

    fruitEl.addEventListener('pointerdown', () => sliceFruit(fruitData));
    fruitEl.addEventListener('pointerenter', (e) => { if (e.buttons > 0) sliceFruit(fruitData); });

    document.getElementById('active-arena').appendChild(fruitEl);
    activeFruits.push(fruitData);
}

function updatePhysics() {
    if (gameActive && !isPaused) {
        for (let i = activeFruits.length - 1; i >= 0; i--) {
            let f = activeFruits[i];
            f.vy += 0.25; f.x += f.vx; f.y += f.vy; f.rotation += f.rotSpeed;

            // Wall bounce
            if (f.x < 30 || f.x > 700) f.vx *= -1;

            if (!f.sliced) f.el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rotation}deg)`;

            // Memory Cleanup (Crucial to prevent lag)
            if (f.y > 700) {
                if (f.isCorrect && !f.sliced) {
                    currentEquation.timesMissed++;
                    if (currentEquation.timesMissed >= 2) { lives--; updateHUD(); generateEquation(); }
                }
                f.el.remove();
                activeFruits.splice(i, 1);
            }
        }
    }
    physicsLoop = requestAnimationFrame(updatePhysics);
}
// Start loop once
requestAnimationFrame(updatePhysics);

// --- CUTTING LOGIC ---
function sliceFruit(f) {
    if (f.sliced || !gameActive || isPaused) return;
    f.sliced = true;

    // Splitting Animation!
    f.el.innerHTML = `
        <span class="fruit-half half-left" style="transform: translateX(-60px) rotate(-45deg); opacity: 0;">${f.emoji}</span>
        <span class="fruit-half half-right" style="transform: translateX(60px) rotate(45deg); opacity: 0;">${f.emoji}</span>
    `;

    if (f.isLifeHeart) {
        if (lives < 3) lives++;
        playLifeGainSound();
        updateHUD();
        setTimeout(() => f.el.remove(), 500);
        return;
    }

    if (f.isCorrect) {
        playCorrectSound();
        score += 20;
        updateHUD();

        if (score >= targetScore) endGame(true);
        else generateEquation();
    } else {
        playWrongCutSound();
        lives--;
        updateHUD();
        document.getElementById('active-arena').style.backgroundColor = "rgba(255,0,0,0.3)";
        setTimeout(() => document.getElementById('active-arena').style.backgroundColor = "transparent", 200);
        if (lives <= 0) endGame(false);
    }

    // Clean up sliced fruit
    setTimeout(() => { if (f.el) f.el.remove(); }, 500);
}

// --- GAME OVER ---
function endGame(win) {
    gameActive = false; clearInterval(spawnLoop); clearInterval(musicLoop);
    document.getElementById('screen-gameplay').classList.add('hidden');
    const board = document.getElementById('screen-scoreboard');
    board.classList.remove('hidden');
    document.getElementById('txt-final-score').innerText = score; document.getElementById('txt-final-level').innerText = currentLevel;

    if (win) {
        if (currentLevel >= 10) {
            document.getElementById('txt-board-title').innerText = `YOU BEAT THE GAME!`;
            document.getElementById('txt-board-desc').innerText = "You are a Math Ninja Master!";
            document.getElementById('btn-board-next').innerText = "PLAY AGAIN";
            currentLevel = 1; // Reset to 1 if they beat the game
        } else {
            document.getElementById('txt-board-title').innerText = `LEVEL ${currentLevel} CLEARED!`;
            document.getElementById('txt-board-desc').innerText = "Incredible slicing!";
            currentLevel++;
            document.getElementById('btn-board-next').innerText = "NEXT LEVEL";
        }
        saveGame();
        document.getElementById('btn-board-next').onclick = () => { board.classList.add('hidden'); startCountdown(); };
    } else {
        document.getElementById('txt-board-title').innerText = "YOU LOST!";
        document.getElementById('txt-board-desc').innerText = "Minus 1 Level!";
        playLoseLifeSound(); // Extra sad sound for game over
        if (currentLevel > 1) currentLevel--;
        saveGame();
        document.getElementById('btn-board-next').innerText = "RETRY";
        document.getElementById('btn-board-next').onclick = () => { board.classList.add('hidden'); loadGame(); startCountdown(); };
    }

    // --- IMPROVED GLOBAL AUDIO UNLOCKER ---
    document.addEventListener('click', function unlockAudio() {
        // 1. Initialize Audio immediately on the first click anywhere
        if (!audioCtx) {
            initAudio();

            // 2. Start the music immediately upon the first interaction
            // We use a small timeout to ensure the AudioContext is fully resumed
            setTimeout(() => {
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume().then(() => {
                        console.log("Audio Context Resumed");
                        startMusic();
                    });
                } else {
                    startMusic();
                }
            }, 100);

            // 3. Remove the listener so it only runs once
            document.removeEventListener('click', unlockAudio);
        }
    }, { once: true });
}
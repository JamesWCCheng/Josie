document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('game-board');
    const nextPieceCanvas = document.getElementById('next-piece');
    const holdPieceCanvas = document.getElementById('hold-piece');
    const ctx = canvas.getContext('2d');
    const nextPieceCtx = nextPieceCanvas.getContext('2d');
    const holdPieceCtx = holdPieceCanvas.getContext('2d');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const scoreElement = document.getElementById('score');
    const linesElement = document.getElementById('lines');
    const levelElement = document.getElementById('level');
    const toggleMusicBtn = document.getElementById('toggle-music');
    const toggleSoundBtn = document.getElementById('toggle-sound');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');
    
    // Audio Elements
    const bgmAudio = document.getElementById('bgm');
    const moveSound = document.getElementById('move-sound');
    const rotateSound = document.getElementById('rotate-sound');
    const dropSound = document.getElementById('drop-sound');
    const lineClearSound = document.getElementById('line-clear-sound');
    const gameOverSound = document.getElementById('game-over-sound');
    
    // Sound settings
    let soundEnabled = true;

    // Game constants
    const BLOCK_SIZE = 30;
    const ROWS = 20;
    const COLS = 10;
    const COLORS = [
        null,
        '#FF0D72', // I - Cyan
        '#0DC2FF', // J - Blue
        '#0DFF72', // L - Orange
        '#F538FF', // O - Yellow
        '#FF8E0D', // S - Green
        '#FFE138', // T - Purple
        '#3877FF'  // Z - Red
    ];

    // Game variables
    let board = createBoard(ROWS, COLS);
    let score = 0;
    let lines = 0;
    let level = 1;
    let gameOver = false;
    let gameRunning = false;
    let dropCounter = 0;
    let dropInterval = 1000; // Start with 1 second
    let lastTime = 0;
    let keyRepeatDelay = 150; // Initial key repeat delay in ms
    let keyRepeatSpeed = 50;  // Initial key repeat speed in ms
    let movingSensitivity = 100; // Current sensitivity value (100%)
    let gameOverAnimationFrame = 0; // Counter for game over animation
    let gameOverAnimationTime = 0; // Timer for game over animation
    let gameOverParticles = []; // Particles for explosion effect
    let player = {
        pos: { x: 0, y: 0 },
        piece: null,
        nextPiece: null
    };
    let holdPiece = null; // For storing the held piece
    let canHold = true; // Flag to prevent multiple holds in a row
    let hasSavedGame = false;

    // Tetrominos
    const TETROMINOS = {
        1: [ // I
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        2: [ // J
            [2, 0, 0],
            [2, 2, 2],
            [0, 0, 0]
        ],
        3: [ // L
            [0, 0, 3],
            [3, 3, 3],
            [0, 0, 0]
        ],
        4: [ // O
            [4, 4],
            [4, 4]
        ],
        5: [ // S
            [0, 5, 5],
            [5, 5, 0],
            [0, 0, 0]
        ],
        6: [ // T
            [0, 6, 0],
            [6, 6, 6],
            [0, 0, 0]
        ],
        7: [ // Z
            [7, 7, 0],
            [0, 7, 7],
            [0, 0, 0]
        ]
    };

    // Initialize game
    initGame();
    
    // Check for saved game
    checkSavedGame();

    // Event listeners for buttons
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    toggleMusicBtn.addEventListener('click', toggleBGM);
    toggleSoundBtn.addEventListener('click', toggleSound);
    sensitivitySlider.addEventListener('input', updateSensitivity);

    // Key event handling for continuous movement
    let keysPressed = {};
    let keyIntervals = {};
    
    document.addEventListener('keydown', (e) => {
        // If key is already pressed, don't set up another interval
        if (keysPressed[e.keyCode]) return;
        
        keysPressed[e.keyCode] = true;
        handleKeyPress(e);
        
        // Set up continuous movement for left, right, and down keys
        if (e.keyCode === 37 || e.keyCode === 39 || e.keyCode === 40) {
            // Initial delay before repeating
            keyIntervals[e.keyCode] = setTimeout(() => {
                // After initial delay, repeat at the repeat speed
                keyIntervals[e.keyCode] = setInterval(() => {
                    handleKeyPress(e);
                }, keyRepeatSpeed);
            }, keyRepeatDelay);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keysPressed[e.keyCode] = false;
        
        // Clear any intervals/timeouts for this key
        if (keyIntervals[e.keyCode]) {
            clearTimeout(keyIntervals[e.keyCode]);
            clearInterval(keyIntervals[e.keyCode]);
            keyIntervals[e.keyCode] = null;
        }
    });
    
    // Add event listener for window unload to save game state
    window.addEventListener('beforeunload', saveGameState);
    
    // Make pause button text and state consistent with saved game state
    function updateSavedGameUI() {
        // Force enable the button if there's a saved game
        if (hasSavedGame) {
            pauseBtn.disabled = false;
        }
        
        if (hasSavedGame && !gameRunning) {
            pauseBtn.textContent = 'Resume Saved Game';
            pauseBtn.disabled = false; // Explicitly ensure it's enabled
        } else if (!gameRunning) {
            pauseBtn.textContent = 'Resume';
            // Always enable the button when game is paused
            pauseBtn.disabled = false;
        } else {
            pauseBtn.textContent = 'Pause';
            pauseBtn.disabled = false;
        }
    }
    
    // Sound functions
    function playSound(sound) {
        if (soundEnabled) {
            // Reset sound to beginning if it's already playing
            sound.currentTime = 0;
            sound.play().catch(e => console.error('Error playing sound:', e));
        }
    }
    
    function toggleBGM() {
        if (bgmAudio.paused) {
            bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
            toggleMusicBtn.textContent = 'Music: ON';
        } else {
            bgmAudio.pause();
            toggleMusicBtn.textContent = 'Music: OFF';
        }
    }
    
    function toggleSound() {
        soundEnabled = !soundEnabled;
        if (!soundEnabled) {
            // Stop all audio when turning off sound
            bgmAudio.pause();
            gameOverSound.pause();
            toggleSoundBtn.textContent = 'Sound FX: OFF';
            toggleMusicBtn.textContent = 'Music: OFF';
        } else {
            toggleSoundBtn.textContent = 'Sound FX: ON';
            toggleMusicBtn.textContent = 'Music: ON';
            if (gameRunning) {
                bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
            } else if (gameOver) {
                // Resume game over music if the game is over
                gameOverSound.play().catch(e => console.error('Error playing game over sound:', e));
            }
        }
    }

    // Game initialization
    function initGame() {
        // Clear the canvas
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid lines
        drawGrid();

        // Generate first pieces
        player.piece = randomPiece();
        player.nextPiece = randomPiece();
        holdPiece = null; // Reset hold piece
        canHold = true; // Allow using hold on the first piece of a new game
        
        // Reset position
        resetPosition();
        
        // Draw next piece preview
        drawNextPiece();
        
        // Clear hold piece display
        clearHoldPiece();
        
        // Load saved sensitivity if available
        const savedSensitivity = localStorage.getItem('tetrisSensitivity');
        if (savedSensitivity) {
            sensitivitySlider.value = savedSensitivity;
            updateSensitivity();
        }
    }
    
    // Save game state to localStorage
    function saveGameState() {
        if (gameRunning && !gameOver) {
            const gameState = {
                board: board,
                score: score,
                lines: lines,
                level: level,
                player: {
                    pos: player.pos,
                    piece: player.piece,
                    nextPiece: player.nextPiece
                },
                holdPiece: holdPiece,
                canHold: canHold, // Track if the player can use hold with current piece
                dropInterval: dropInterval,
                soundEnabled: soundEnabled,
                bgmPlaying: !bgmAudio.paused,
                gameOverPlaying: !gameOverSound.paused,
                sensitivity: movingSensitivity, // Save sensitivity setting
                timestamp: Date.now()
            };
            
            localStorage.setItem('tetrisGameState', JSON.stringify(gameState));
            hasSavedGame = true;
            updateSavedGameUI();
        }
    }
    
    // Load game state from localStorage
    function loadGameState() {
        try {
            const savedState = JSON.parse(localStorage.getItem('tetrisGameState'));
            
            if (savedState) {
                // Load board state
                board = savedState.board;
                
                // Load score and level
                score = savedState.score;
                lines = savedState.lines;
                level = savedState.level;
                
                // Load player state
                player.pos = savedState.player.pos;
                player.piece = savedState.player.piece;
                player.nextPiece = savedState.player.nextPiece;
                
                // Load hold piece state
                holdPiece = savedState.holdPiece || null;
                canHold = savedState.canHold !== undefined ? savedState.canHold : true;
                
                // Load game settings
                dropInterval = savedState.dropInterval;
                
                // Load movement sensitivity if available
                if (savedState.sensitivity) {
                    movingSensitivity = savedState.sensitivity;
                    sensitivitySlider.value = movingSensitivity;
                    sensitivityValue.textContent = movingSensitivity + '%';
                    
                    // Update key repeat settings
                    keyRepeatDelay = 300 - (movingSensitivity * 1.5);
                    keyRepeatSpeed = 100 - (movingSensitivity * 0.5);
                    
                    // Ensure minimum values
                    keyRepeatDelay = Math.max(keyRepeatDelay, 50);
                    keyRepeatSpeed = Math.max(keyRepeatSpeed, 20);
                }
                
                // Load sound settings if available
                if (savedState.soundEnabled !== undefined) {
                    soundEnabled = savedState.soundEnabled;
                    toggleSoundBtn.textContent = soundEnabled ? 'Sound FX: ON' : 'Sound FX: OFF';
                }
                
                if (savedState.bgmPlaying !== undefined && soundEnabled) {
                    if (savedState.bgmPlaying) {
                        bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
                        toggleMusicBtn.textContent = 'Music: ON';
                    } else {
                        bgmAudio.pause();
                        toggleMusicBtn.textContent = 'Music: OFF';
                    }
                }
                
                // If game over sound was playing (unlikely but possible)
                if (savedState.gameOverPlaying && soundEnabled && gameOver) {
                    gameOverSound.play().catch(e => console.error('Error playing game over sound:', e));
                } else {
                    gameOverSound.pause();
                    gameOverSound.currentTime = 0;
                }
                
                // Update UI
                updateScore();
                drawNextPiece();
                
                // Set game as paused but ready to resume
                gameOver = false;
                gameRunning = false;
                pauseBtn.textContent = 'Resume';
                pauseBtn.disabled = false;
                startBtn.textContent = 'New Game';
                
                // Clear localStorage to prevent multiple loads
                localStorage.removeItem('tetrisGameState');
                
                return true;
            }
        } catch (error) {
            console.error('Error loading saved game:', error);
            // If an error occurs, clear the saved game to prevent further errors
            localStorage.removeItem('tetrisGameState');
        }
        
        return false;
    }
    
    // Check if there's a saved game and update UI accordingly
    function checkSavedGame() {
        const savedGame = localStorage.getItem('tetrisGameState');
        
        if (savedGame) {
            try {
                const gameState = JSON.parse(savedGame);
                
                // Only consider saved games from the last 24 hours
                const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                const now = Date.now();
                
                if (gameState.timestamp && (now - gameState.timestamp) < ONE_DAY) {
                    hasSavedGame = true;
                    startBtn.textContent = 'New Game';
                    pauseBtn.textContent = 'Resume Saved Game';
                    pauseBtn.disabled = false;
                    
                    // Draw a notification on the canvas
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);
                    ctx.font = '20px Arial';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.fillText('Saved Game Available', canvas.width / 2, canvas.height / 2 - 30);
                    ctx.font = '16px Arial';
                    ctx.fillText('Click "Resume Saved Game" to continue', canvas.width / 2, canvas.height / 2);
                    ctx.fillText('or "New Game" to start over', canvas.width / 2, canvas.height / 2 + 25);
                } else {
                    // If saved game is too old, remove it
                    localStorage.removeItem('tetrisGameState');
                }
            } catch (e) {
                console.error('Error checking saved game:', e);
                localStorage.removeItem('tetrisGameState');
            }
        }
    }

    // Start game function
    function startGame() {
        // When starting a new game, we preserve the saved game
        // so that the player can still resume later if desired
        const hadSavedGame = hasSavedGame;
        
        // Stop game over sound if it's playing
        gameOverSound.pause();
        gameOverSound.currentTime = 0;
        
        // Start background music when game starts if sound is enabled
        if (soundEnabled) {
            bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
        }
        
        // Reset the board and game state completely when Restart is clicked or when starting a new game
        board = createBoard(ROWS, COLS);
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = 1000;
        gameOver = false;
            
        // Reset game over animation state
        gameOverAnimationFrame = 0;
        gameOverAnimationTime = 0;
        gameOverParticles = [];
            
        // Generate new pieces
        player.piece = randomPiece();
        player.nextPiece = randomPiece();
        resetPosition();
        updateScore();

        if (!gameRunning) {
            gameRunning = true;
            startBtn.textContent = 'Restart';
            pauseBtn.textContent = 'Pause';
            pauseBtn.disabled = false;
            requestAnimationFrame(update);
            updateSavedGameUI();
        }
    }

    // Toggle pause function
    function togglePause() {
        if (gameOver) return;
        
        // If we have a saved game and the game isn't running, load it
        if (hasSavedGame && !gameRunning) {
            if (loadGameState()) {
                // We've loaded the saved game, so remove it from localStorage
                localStorage.removeItem('tetrisGameState');
                hasSavedGame = false;
                gameRunning = true;
                startBtn.textContent = 'Restart'; // Update start button text
                pauseBtn.textContent = 'Pause';
                pauseBtn.disabled = false; // Ensure pause button is enabled
                requestAnimationFrame(update);
                
                // Stop game over sound if it's playing
                gameOverSound.pause();
                gameOverSound.currentTime = 0;
                
                // Start background music if it was playing and sound is enabled
                if (soundEnabled && !bgmAudio.paused) {
                    bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
                }
                
                // Update UI after loading saved game
                updateSavedGameUI();
                return;
            } else {
                // If loading fails, make sure pause button is still enabled
                pauseBtn.disabled = false;
            }
        }

        gameRunning = !gameRunning;
        if (gameRunning) {
            pauseBtn.textContent = 'Pause';
            requestAnimationFrame(update);
            // Resume BGM if sound is enabled
            if (soundEnabled) {
                bgmAudio.play().catch(e => console.error('Error playing BGM:', e));
            }
        } else {
            pauseBtn.textContent = 'Resume';
            // Pause BGM when game is paused
            bgmAudio.pause();
            
            // Save game state when pausing
            saveGameState();
        }
        
        // Update UI after toggling pause
        updateSavedGameUI();
    }

    // Create board
    function createBoard(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    // Generate random tetromino
    function randomPiece() {
        const pieces = 'IJLOSTZ';
        const pieceIndex = Math.floor(Math.random() * pieces.length) + 1;
        return TETROMINOS[pieceIndex];
    }
    
    // Reset player position
    function resetPosition() {
        // Calculate center position for the piece
        player.pos.y = 0;
        player.pos.x = Math.floor(COLS / 2) - Math.floor(player.piece[0].length / 2);
        
        // Check if the new piece causes a collision immediately (game over)
        if (checkCollision(player.piece, player.pos)) {
            // Game over state
            gameOver = true;
            gameRunning = false;
            
            // Reset animation variables
            gameOverAnimationFrame = 0;
            gameOverAnimationTime = 0;
            gameOverParticles = [];
            
            // Stop the main BGM
            if (!bgmAudio.paused) {
                bgmAudio.pause();
            }
            
            // Play game over sound if sound is enabled
            if (soundEnabled) {
                gameOverSound.currentTime = 0;
                gameOverSound.play().catch(e => console.error('Error playing game over sound:', e));
            }
            
            // Update UI to reflect game over state
            updateSavedGameUI();
            
            // Force the animation to continue for game over effects
            requestAnimationFrame(update);
        }
        
        // Important: We do NOT reset canHold here
        // canHold should only be reset when a piece is placed (in dropPiece or hardDrop)
    }

    // Draw the grid
    function drawGrid() {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;

        // Draw columns
        for (let i = 0; i <= COLS; i++) {
            ctx.beginPath();
            ctx.moveTo(i * BLOCK_SIZE, 0);
            ctx.lineTo(i * BLOCK_SIZE, canvas.height);
            ctx.stroke();
        }

        // Draw rows
        for (let i = 0; i <= ROWS; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * BLOCK_SIZE);
            ctx.lineTo(canvas.width, i * BLOCK_SIZE);
            ctx.stroke();
        }
    }

    // Draw the board
    function drawBoard() {
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = COLORS[value];
                    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    }

    // Draw the current piece
    function drawPiece() {
        // First draw the ghost piece (landing preview)
        drawGhostPiece();
        
        // Iterate through the piece matrix
        for (let y = 0; y < player.piece.length; y++) {
            for (let x = 0; x < player.piece[y].length; x++) {
                // If the current cell has a value (not 0), draw a block
                if (player.piece[y][x] !== 0) {
                    ctx.fillStyle = COLORS[player.piece[y][x]];
                    const posX = (player.pos.x + x) * BLOCK_SIZE;
                    const posY = (player.pos.y + y) * BLOCK_SIZE;
                    
                    // Draw filled square
                    ctx.fillRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);
                    
                    // Draw border
                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);
                    
                    // Draw a highlight on top and left edges for 3D effect
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.beginPath();
                    ctx.moveTo(posX, posY + BLOCK_SIZE);
                    ctx.lineTo(posX, posY);
                    ctx.lineTo(posX + BLOCK_SIZE, posY);
                    ctx.stroke();
                }
            }
        }
    }
    
    // Draw ghost piece (landing preview)
    function drawGhostPiece() {
        // Calculate the drop position
        const ghostPos = {...player.pos};
        
        // Move the ghost piece down until it collides
        while (!checkCollision(player.piece, ghostPos)) {
            ghostPos.y++;
        }
        
        // Move back up one because we went too far
        ghostPos.y--;
        
        // Don't draw ghost if it's at the same position as current piece
        if (ghostPos.y === player.pos.y) return;
        
        // Iterate through the piece matrix to draw ghost
        for (let y = 0; y < player.piece.length; y++) {
            for (let x = 0; x < player.piece[y].length; x++) {
                if (player.piece[y][x] !== 0) {
                    const posX = (ghostPos.x + x) * BLOCK_SIZE;
                    const posY = (ghostPos.y + y) * BLOCK_SIZE;
                    
                    // Draw just the outline of the block
                    ctx.strokeStyle = COLORS[player.piece[y][x]];
                    ctx.lineWidth = 2;
                    ctx.strokeRect(posX + 2, posY + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
                    
                    // Add subtle fill to make it visible on dark background
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(posX + 3, posY + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
                }
            }
        }
    }

    // Draw the next piece preview
    function drawNextPiece() {
        // Clear the canvas first
        nextPieceCtx.fillStyle = '#ecf0f1';
        nextPieceCtx.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
        
        if (!player.nextPiece) return;
        
        // Size calculation for the next piece preview
        const matrix = player.nextPiece;
        const blockSize = Math.min(
            Math.floor(nextPieceCanvas.width / 4),
            Math.floor(nextPieceCanvas.height / 4)
        );
        
        // Center the piece on the canvas
        const offsetX = (nextPieceCanvas.width - matrix[0].length * blockSize) / 2;
        const offsetY = (nextPieceCanvas.height - matrix.length * blockSize) / 2;
        
        // Draw each cell of the next piece
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextPieceCtx.fillStyle = COLORS[value];
                    nextPieceCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    
                    // Draw cell border
                    nextPieceCtx.strokeStyle = '#333';
                    nextPieceCtx.lineWidth = 1;
                    nextPieceCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            });
        });
    }
    
    // Draw the hold piece
    function drawHoldPiece() {
        // Clear the canvas first
        holdPieceCtx.fillStyle = '#ecf0f1';
        holdPieceCtx.fillRect(0, 0, holdPieceCanvas.width, holdPieceCanvas.height);
        
        // Nothing to draw if there's no held piece
        if (!holdPiece) return;
        
        // Size calculation for the hold piece preview
        const matrix = holdPiece;
        const blockSize = Math.min(
            Math.floor(holdPieceCanvas.width / 4),
            Math.floor(holdPieceCanvas.height / 4)
        );
        
        // Center the piece on the canvas
        const offsetX = (holdPieceCanvas.width - matrix[0].length * blockSize) / 2;
        const offsetY = (holdPieceCanvas.height - matrix.length * blockSize) / 2;
        
        // Visual indicator when hold is unavailable
        holdPieceCtx.globalAlpha = 1.0; // Reset alpha before drawing
        
        if (!canHold) {
            // Add a light red background to indicate hold is disabled
            holdPieceCtx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            holdPieceCtx.fillRect(0, 0, holdPieceCanvas.width, holdPieceCanvas.height);
            
            // Draw a subtle "locked" overlay
            holdPieceCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            holdPieceCtx.lineWidth = 2;
            holdPieceCtx.strokeRect(4, 4, holdPieceCanvas.width - 8, holdPieceCanvas.height - 8);
            
            // Dim the piece to indicate it can't be used
            holdPieceCtx.globalAlpha = 0.4;
        }
        
        // Draw each cell of the hold piece
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    holdPieceCtx.fillStyle = COLORS[value];
                    holdPieceCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    
                    // Draw cell border
                    holdPieceCtx.strokeStyle = '#333';
                    holdPieceCtx.lineWidth = 1;
                    holdPieceCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            });
        });
        
        // Reset transparency
        holdPieceCtx.globalAlpha = 1;
    }

    function clearHoldPiece() {
        holdPieceCtx.fillStyle = '#ecf0f1';
        holdPieceCtx.fillRect(0, 0, holdPieceCanvas.width, holdPieceCanvas.height);
    }

    // Merge the current piece with the board
    function mergePiece() {
        player.piece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    board[player.pos.y + y][player.pos.x + x] = value;
                }
            });
        });
    }
    
    // Move piece left or right
    function movePiece(dir) {
        player.pos.x += dir;
        if (checkCollision(player.piece, player.pos)) {
            player.pos.x -= dir;
            return false;
        }
        playSound(moveSound);
        return true;
    }
    
    // Check for collision
    function checkCollision(piece = player.piece, pos = player.pos) {
        for (let y = 0; y < piece.length; y++) {
            for (let x = 0; x < piece[y].length; x++) {
                if (piece[y][x] !== 0) {
                    const newX = pos.x + x;
                    const newY = pos.y + y;
                    
                    // Check if out of bounds or if already occupied
                    if (
                        newX < 0 || newX >= COLS ||
                        newY >= ROWS ||
                        (newY >= 0 && board[newY][newX] !== 0)
                    ) {
                        return true; // Collision detected
                    }
                }
            }
        }
        return false; // No collision
    }

    // Rotate the current piece
    function rotatePiece() {
        // Clone the current piece to avoid modifying the original directly
        const rotated = [];
        for (let i = 0; i < player.piece[0].length; i++) {
            rotated.push([]);
            for (let j = player.piece.length - 1; j >= 0; j--) {
                rotated[i].push(player.piece[j][i]);
            }
        }
        
        // Save original position in case we need to revert
        const originalPiece = player.piece;
        const originalX = player.pos.x;
        
        // Apply the rotation
        player.piece = rotated;
        
        // Wall kicks - attempt to adjust position if rotation causes collision
        // Try moving right, then left, then up, before giving up
        if (checkCollision(player.piece, player.pos)) {
            player.pos.x += 1; // Try move right
            
            if (checkCollision(player.piece, player.pos)) {
                player.pos.x -= 2; // Try move left (from original + 1)
                
                if (checkCollision(player.piece, player.pos)) {
                    player.pos.x = originalX; // Reset X position
                    player.pos.y -= 1; // Try move up
                    
                    if (checkCollision(player.piece, player.pos)) {
                        // If all attempts fail, revert to original state
                        player.pos.y += 1;
                        player.piece = originalPiece;
                        return; // Cancel rotation
                    }
                }
            }
        }
        
        // Play rotate sound
        playSound(rotateSound);
    }

    // Drop the piece by one row
    function dropPiece() {
        player.pos.y++;
        
        // Check if the piece has landed on something
        if (checkCollision(player.piece, player.pos)) {
            // Move back up one row
            player.pos.y--;
            
            // Place the piece on the board
            mergePiece();
            
            // Play drop sound when the piece lands
            playSound(dropSound);
            
            // Check for completed lines
            checkLines();
            
            // Enable hold for the next piece
            canHold = true;
            
            // Get the next piece
            player.piece = player.nextPiece;
            player.nextPiece = randomPiece();
            
            // Reset position for the new piece
            resetPosition();
            
            // Update UI
            drawNextPiece();
            drawHoldPiece();
            
            // Return true to indicate the piece has landed
            return true;
        }
        
        // Return false to indicate the piece is still falling
        return false;
    }

    // Hard drop - instantly place the piece as far down as it can go
    function hardDrop() {
        if (gameOver) return; // Don't hard drop if the game is over
        
        // Track the original position to restore if needed
        const originalY = player.pos.y;
        
        // Count how far we drop
        let dropDistance = 0;
        
        // Drop the piece until it collides with something
        while (!checkCollision(player.piece, player.pos)) {
            player.pos.y++;
            dropDistance++;
        }
        
        // Move back up one position since we went too far
        player.pos.y--;
        
        // Play sound only if we moved
        if (dropDistance > 0) {
            playSound(dropSound);
        }
        
        // Place the piece on the board
        mergePiece();
        
        // Check for completed lines
        checkLines();
        
        // Allow hold for the next piece
        canHold = true;
        
        // Move to next piece
        player.piece = player.nextPiece;
        player.nextPiece = randomPiece();
        
        // Reset position for new piece
        resetPosition();
        
        // Update UI
        drawNextPiece();
        drawHoldPiece();
    }

    // Check for completed lines
    function checkLines() {
        let linesCleared = 0;
        
        // Check each row from bottom to top
        loop: for (let y = ROWS - 1; y >= 0; y--) {
            for (let x = 0; x < COLS; x++) {
                if (board[y][x] === 0) {
                    continue loop;
                }
            }
            
            // Remove the completed line and add an empty line at the top
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            y++; // Check the same row again
            linesCleared++;
        }
        
        // Update score
        if (linesCleared > 0) {
            // Scoring based on number of lines cleared at once
            const points = [0, 100, 300, 500, 800];
            score += points[linesCleared] * level;
            lines += linesCleared;
            
            // Play line clear sound
            playSound(lineClearSound);
            
            // Store previous level before updating
            const previousLevel = level;
            
            // Update level every 10 lines
            level = Math.floor(lines / 10) + 1;
            
            // Improved drop speed formula for more challenging progression
            // Uses an exponential curve that gets much faster at higher levels
            if (level <= 10) {
                // Level 1-10: Linear decrease from 1000ms to 100ms
                dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            } else if (level <= 20) {
                // Level 11-20: Faster decrease from 100ms to 50ms
                dropInterval = Math.max(50, 100 - (level - 10) * 5);
            } else {
                // Level 21+: Minimum interval of 30ms for extreme difficulty
                dropInterval = Math.max(30, 50 - Math.floor((level - 20) / 2) * 5);
            }
            
            // Display visual level up effect if level increased
            if (level > previousLevel) {
                showLevelUpEffect();
            }
            
            updateScore();
        }
    }

    // Update score display
    function updateScore() {
        scoreElement.textContent = score;
        linesElement.textContent = lines;
        levelElement.textContent = level;
    }
    
    // Show a visual effect when player levels up
    function showLevelUpEffect() {
        // Play a special sound for level up
        playSound(lineClearSound);
        
        // Flash the level indicator
        let flashCount = 0;
        const maxFlashes = 6;
        const flashInterval = setInterval(() => {
            if (flashCount >= maxFlashes) {
                clearInterval(flashInterval);
                levelElement.style.backgroundColor = '';
                levelElement.style.color = '';
                return;
            }
            
            // Toggle flash colors
            if (flashCount % 2 === 0) {
                levelElement.style.backgroundColor = '#FFD700'; // Gold background
                levelElement.style.color = '#000';
            } else {
                levelElement.style.backgroundColor = '';
                levelElement.style.color = '';
            }
            
            flashCount++;
        }, 150);
        
        // Display level up message on canvas
        let messageAlpha = 1.0;
        const fadeMessage = () => {
            if (messageAlpha <= 0 || gameOver) return;
            
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 25, 200, 50);
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = `rgba(255, 215, 0, ${messageAlpha})`;  // Gold text
            ctx.textAlign = 'center';
            ctx.fillText(`LEVEL UP: ${level}`, canvas.width/2, canvas.height/2 + 5);
            ctx.restore();
            
            messageAlpha -= 0.02;
            if (messageAlpha > 0 && !gameOver) {
                requestAnimationFrame(fadeMessage);
            }
        };
        
        // Start the fade animation
        fadeMessage();
    }

    // Hold the current piece and swap with previously held piece
    function holdCurrentPiece() {
        // Check if we can use the hold feature
        // Cannot use hold if: 
        // 1. We've already used hold for this piece (canHold is false)
        // 2. Game is over
        // 3. Game is paused
        if (!canHold || gameOver || !gameRunning) {
            return;
        }
        
        // Play sound effect for holding a piece
        playSound(rotateSound);
        
        // Do the hold/swap operation
        if (holdPiece === null) {
            // First use of hold - store current piece and get the next one
            holdPiece = player.piece;
            player.piece = player.nextPiece;
            player.nextPiece = randomPiece();
        } else {
            // Swap current piece with the held piece
            const temp = player.piece;
            player.piece = holdPiece;
            holdPiece = temp;
        }
        
        // Mark that hold has been used for this piece
        // This flag will be reset when a new piece enters play
        canHold = false;
        
        // Reset position for the new active piece
        resetPosition();
        
        // Update the hold and next piece displays
        drawHoldPiece();
        drawNextPiece();
    }

    function handleKeyPress(e) {
        // Ignore keypresses if the game isn't running or is over
        if (!gameRunning || gameOver) return;

        switch (e.keyCode) {
            case 37: // Left arrow - move piece left
                movePiece(-1);
                break;
                
            case 39: // Right arrow - move piece right
                movePiece(1);
                break;
                
            case 40: // Down arrow - soft drop
                dropPiece();
                break;
                
            case 38: // Up arrow - rotate piece
                rotatePiece();
                break;
                
            case 32: // Space - hard drop
                e.preventDefault(); // Prevent page scroll
                hardDrop();
                break;
                
            case 67: // C key - Hold piece
                holdCurrentPiece();
                break;
                
            case 77: // M key - Toggle music
                toggleBGM();
                break;
                
            case 78: // N key - Toggle all sounds
                toggleSound();
                break;
        }
    }
    
    // Function to update movement sensitivity based on slider value
    function updateSensitivity() {
        // Get slider value (50-200%)
        movingSensitivity = parseInt(sensitivitySlider.value);
        
        // Update displayed value
        sensitivityValue.textContent = movingSensitivity + '%';
        
        // Adjust key repeat timings based on sensitivity
        keyRepeatDelay = 300 - (movingSensitivity * 1.5); // 150ms at 100% sensitivity
        keyRepeatSpeed = 100 - (movingSensitivity * 0.5); // 50ms at 100% sensitivity
        
        // Ensure minimum values
        keyRepeatDelay = Math.max(keyRepeatDelay, 50);
        keyRepeatSpeed = Math.max(keyRepeatSpeed, 20);
        
        // Save the sensitivity setting
        localStorage.setItem('tetrisSensitivity', movingSensitivity);
    }

    // Game update function
    function update(time = 0) {
        // Even if game is not running, we still need to animate game over
        // if the game over state is active
        if (!gameRunning && !gameOver) return;

        const deltaTime = time - lastTime;
        lastTime = time;

        // Only handle game physics if the game is running and not over
        if (gameRunning && !gameOver) {
            // Apply level-based gravity
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                dropPiece();
                dropCounter = 0;
            }
        }

        // Clear the canvas
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the board and current piece
        drawBoard();
        drawPiece();
        drawGrid();
        drawHoldPiece(); // Make sure hold piece is updated every frame

        // Game over animation and message
        if (gameOver) {
            // Update game over animation
            gameOverAnimationTime += deltaTime;
            
            // Create explosion particles when game over is first triggered
            if (gameOverParticles.length === 0) {
                // Scan the board for filled blocks to create particles
                for (let y = 0; y < ROWS; y++) {
                    for (let x = 0; x < COLS; x++) {
                        if (board[y][x] !== 0) {
                            // Create multiple particles for each block
                            for (let i = 0; i < 3; i++) {
                                gameOverParticles.push({
                                    x: x * BLOCK_SIZE + BLOCK_SIZE/2,
                                    y: y * BLOCK_SIZE + BLOCK_SIZE/2,
                                    size: Math.random() * 8 + 2,
                                    color: COLORS[board[y][x]],
                                    vx: (Math.random() - 0.5) * 5,
                                    vy: (Math.random() - 0.5) * 5 - 2,
                                    gravity: 0.1,
                                    alpha: 1,
                                    rotation: Math.random() * 360,
                                    rotationSpeed: (Math.random() - 0.5) * 10
                                });
                            }
                        }
                    }
                }
            }
            
            // Draw board first (frozen state)
            drawBoard();
            
            // Update and draw particles
            for (let i = 0; i < gameOverParticles.length; i++) {
                const p = gameOverParticles[i];
                
                // Update position
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.alpha -= 0.005;
                p.rotation += p.rotationSpeed;
                
                // Draw particle
                if (p.alpha > 0) {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation * Math.PI / 180);
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                    ctx.restore();
                }
            }
            
            // Flashing effect for the game over text
            const flashSpeed = 500; // ms per flash cycle
            const flashIntensity = Math.abs(Math.sin(gameOverAnimationTime / flashSpeed));
            
            // Draw semi-transparent overlay with pulsing opacity
            ctx.fillStyle = `rgba(0, 0, 0, ${0.6 + flashIntensity * 0.2})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw border around the game over message
            const messageBoxWidth = 300;
            const messageBoxHeight = 180;
            const messageBoxX = canvas.width/2 - messageBoxWidth/2;
            const messageBoxY = canvas.height/2 - messageBoxHeight/2;
            
            // Draw box with pulsing border
            ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
            ctx.fillRect(messageBoxX, messageBoxY, messageBoxWidth, messageBoxHeight);
            
            // Pulsing border
            ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + flashIntensity * 0.5})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(messageBoxX, messageBoxY, messageBoxWidth, messageBoxHeight);
            
            // Game over text with shadow and glow
            ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
            ctx.shadowBlur = 10 + flashIntensity * 10;
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = `rgba(255, ${50 + flashIntensity * 205}, ${50 + flashIntensity * 50}, 1)`;
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
            ctx.shadowBlur = 0;
            
            // Show final score
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
            
            // Instructions
            ctx.font = '16px Arial';
            ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + flashIntensity * 0.3})`;
            ctx.fillText('Press SPACE to restart', canvas.width / 2, canvas.height / 2 + 60);
            
            // Always update UI on game over
            updateSavedGameUI();
            requestAnimationFrame(update);
            return;
        }

        requestAnimationFrame(update);
    }
});

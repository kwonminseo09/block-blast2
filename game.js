// 기본 설정
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const gridSize = 8;
const cellSize = canvas.width / gridSize;

// 프리뷰 Canvas들
const previewCanvases = [
    document.getElementById('preview1').getContext('2d'),
    document.getElementById('preview2').getContext('2d'),
    document.getElementById('preview3').getContext('2d')
];

// 블록 모양 정의 (좌표 배열)
const blockShapes = {
    I: [[0,0], [1,0], [2,0], [3,0]],
    O: [[0,0], [1,0], [0,1], [1,1]],
    T: [[0,0], [1,0], [2,0], [1,1]],
    S: [[1,0], [2,0], [0,1], [1,1]],
    Z: [[0,0], [1,0], [1,1], [2,1]],
    J: [[0,0], [0,1], [1,1], [2,1]],
    L: [[2,0], [0,1], [1,1], [2,1]],
    Plus: [[1,0], [0,1], [1,1], [2,1], [1,2]], // 십자
    U: [[0,0], [2,0], [0,1], [1,1], [2,1]], // U자
    Corner: [[0,0], [1,0], [0,1]] // L자 작은
};

// 네온 컬러
const neonColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#ff8800', '#8800ff'];

// 보드 데이터
let board = Array.from({length: gridSize}, () => Array(gridSize).fill(false));

// 점수, 레벨
let score = 0;
let combo = 0;
let highScore = localStorage.getItem('highScore') || 0;
let level = 1;
let linesCleared = 0;

// 현재 블록들
let currentBlocks = generateBlocks();
let selectedBlock = null;
let isDragging = false;
let dragOffset = {x: 0, y: 0};
let gameOver = false;

// 파티클
let particles = [];

// Web Audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 랜덤 블록 생성 함수 (3개 한 세트)
function generateBlocks() {
    const shapes = Object.keys(blockShapes);
    const blocks = [];
    for (let i = 0; i < 3; i++) {
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = neonColors[Math.floor(Math.random() * neonColors.length)];
        blocks.push({ shape, color, positions: blockShapes[shape] });
    }
    return blocks;
}

// 프리뷰에 블록 그리기
function drawPreview(blocks) {
    previewCanvases.forEach((ctx, index) => {
        ctx.clearRect(0, 0, 80, 80);
        if (blocks[index]) {
            const block = blocks[index];
            const previewCellSize = 16; // 작은 크기
            block.positions.forEach(([x, y]) => {
                ctx.fillStyle = block.color;
                ctx.fillRect(x * previewCellSize, y * previewCellSize, previewCellSize, previewCellSize);
                ctx.strokeStyle = '#000';
                ctx.strokeRect(x * previewCellSize, y * previewCellSize, previewCellSize, previewCellSize);
            });
        }
    });
}

// 마우스/터치 위치를 보드 좌표로 환산
function getBoardCoords(x, y) {
    const rect = canvas.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;
    return {
        col: Math.floor(cx / cellSize),
        row: Math.floor(cy / cellSize)
    };
}

// 배치 가능 여부 체크
function isPlaceable(block, row, col) {
    for (const [dx, dy] of block.positions) {
        const newRow = row + dy;
        const newCol = col + dx;
        if (newRow < 0 || newRow >= gridSize || newCol < 0 || newCol >= gridSize || board[newRow][newCol]) {
            return false;
        }
    }
    return true;
}

// 고스트 가이드 표시
function drawGhost(block, row, col) {
    ctx.globalAlpha = 0.5;
    block.positions.forEach(([dx, dy]) => {
        drawBlock(col + dx, row + dy, block.color);
    });
    ctx.globalAlpha = 1;
}

// 보드 그리기
function drawBoard() {
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (board[row][col]) {
                drawBlock(col, row, board[row][col]);
            }
        }
    }
}

// 줄이 꽉 찼는지 검사
function checkFullLines() {
    const fullRows = [];
    const fullCols = [];
    for (let i = 0; i < gridSize; i++) {
        if (board[i].every(cell => cell)) {
            fullRows.push(i);
        }
        if (board.every(row => row[i])) {
            fullCols.push(i);
        }
    }
    return { fullRows, fullCols };
}

// 줄 제거 및 보드 갱신
function removeLines(fullRows, fullCols) {
    // 행 제거
    fullRows.sort((a, b) => b - a); // 뒤에서부터 제거
    fullRows.forEach(row => {
        board.splice(row, 1);
        board.unshift(Array(gridSize).fill(false));
    });
    // 열 제거
    fullCols.sort((a, b) => b - a);
    fullCols.forEach(col => {
        board.forEach(row => row.splice(col, 1, false));
    });
    return fullRows.length + fullCols.length;
}

// 점수 계산
function calculateScore(linesRemoved) {
    if (linesRemoved > 0) {
        combo++;
        const baseScore = linesRemoved * 10 * level;
        const comboBonus = combo * 5 * level;
        score += baseScore + comboBonus;
        linesCleared += linesRemoved;
        if (linesCleared >= level * 5) {
            level++;
            document.getElementById('level').textContent = level;
        }
    } else {
        combo = 0;
    }
    document.getElementById('score').textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        document.getElementById('high-score').textContent = highScore;
    }
}

// 게임 오버 체크
function checkGameOver() {
    for (const block of currentBlocks) {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (isPlaceable(block, row, col)) {
                    return false;
                }
            }
        }
    }
    return true;
}

// 게임 오버 처리
function handleGameOver() {
    gameOver = true;
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-popup').classList.remove('hidden');
}

// 게임 리셋
function resetGame() {
    board = Array.from({length: gridSize}, () => Array(gridSize).fill(false));
    score = 0;
    combo = 0;
    level = 1;
    linesCleared = 0;
    gameOver = false;
    currentBlocks = generateBlocks();
    particles = [];
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('game-over-popup').classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawBoard();
    drawPreview(currentBlocks);
}

// 파티클 생성
function createParticles(x, y, color) {
    // 파티클 효과 제거로 속도 향상
    // for (let i = 0; i < 10; i++) {
    //     particles.push({
    //         x: x + Math.random() * cellSize,
    //         y: y + Math.random() * cellSize,
    //         vx: (Math.random() - 0.5) * 4,
    //         vy: (Math.random() - 0.5) * 4,
    //         life: 30,
    //         color: color
    //     });
    // }
}

// 파티클 업데이트 및 그리기
function updateParticles() {
    // particles = particles.filter(p => p.life > 0);
    // particles.forEach(p => {
    //     p.x += p.vx;
    //     p.y += p.vy;
    //     p.life--;
    //     ctx.fillStyle = p.color;
    //     ctx.fillRect(p.x, p.y, 2, 2);
    // });
}

// 화면 흔들림
let shake = 0;
function screenShake() {
    // shake = 10; // 흔들림 효과 제거로 속도 향상
}

// 사운드 재생
function playSound(frequency, duration) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 격자 그리기
function drawGrid() {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
    }
}

// 블록 유닛 디자인 함수 (단순 사각형)
function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    // 입체감 추가 (그림자)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
}

// 이벤트 핸들러
function handleStart(e) {
    if (gameOver) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        // 메인 캔버스 클릭 시 무시 (드래그 시작 안 함)
    }
}

function handleMove(e) {
    if (gameOver || !isDragging || !selectedBlock) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const {row, col} = getBoardCoords(touch.clientX, touch.clientY);
    if (isPlaceable(selectedBlock, row, col)) {
        drawGhost(selectedBlock, row, col);
    }
}

function handleEnd(e) {
    if (gameOver || !isDragging || !selectedBlock) return;
    e.preventDefault();
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const {row, col} = getBoardCoords(touch.clientX, touch.clientY);
    if (isPlaceable(selectedBlock, row, col)) {
        selectedBlock.positions.forEach(([dx, dy]) => {
            board[row + dy][col + dx] = selectedBlock.color;
        });
        const index = currentBlocks.indexOf(selectedBlock);
        currentBlocks.splice(index, 1);
        if (currentBlocks.length < 3) {
            currentBlocks.push(generateBlocks()[0]);
        }
        drawPreview(currentBlocks);
        const { fullRows, fullCols } = checkFullLines();
        const linesRemoved = removeLines(fullRows, fullCols);
        if (linesRemoved > 0) {
            // 파티클 생성 제거로 속도 향상
            // fullRows.forEach(r => {
            //     for (let c = 0; c < gridSize; c++) {
            //         createParticles(c * cellSize, r * cellSize, board[r][c]);
            //     }
            // });
            // fullCols.forEach(c => {
            //     for (let r = 0; r < gridSize; r++) {
            //         createParticles(c * cellSize, r * cellSize, board[r][c]);
            //     }
            // });
            playSound(440 + combo * 50, 0.2); // 콤보에 따라 음 높이
        }
        calculateScore(linesRemoved);
        // screenShake(); // 흔들림 제거로 속도 향상
        if (checkGameOver()) {
            handleGameOver();
            playSound(200, 1); // 게임 오버 사운드
        } else {
            playSound(330, 0.1); // 배치 사운드
        }
    }
    selectedBlock = null;
    isDragging = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawBoard();
}

// 프리뷰 클릭 핸들러
function handlePreviewClick(index, e) {
    if (gameOver || currentBlocks[index]) {
        selectedBlock = currentBlocks[index];
        isDragging = true;
    }
}

// 이벤트 리스너
document.addEventListener('mousedown', handleStart);
document.addEventListener('mousemove', handleMove);
document.addEventListener('mouseup', handleEnd);
document.addEventListener('touchstart', handleStart);
document.addEventListener('touchmove', handleMove);
document.addEventListener('touchend', handleEnd);

// 프리뷰 Canvas에 이벤트 리스너 추가
previewCanvases.forEach((ctx, index) => {
    const canvas = ctx.canvas;
    canvas.addEventListener('mousedown', (e) => handlePreviewClick(index, e));
    canvas.addEventListener('touchstart', (e) => handlePreviewClick(index, e));
});

// 애니메이션 루프
function animate() {
    // updateParticles(); // 파티클 업데이트 제거로 속도 향상
    requestAnimationFrame(animate);
}
animate();

// 리셋 버튼
document.getElementById('reset-btn').addEventListener('click', resetGame);

// 초기화
console.log('Initializing game...');
document.getElementById('high-score').textContent = highScore;
document.getElementById('level').textContent = level;
console.log('Drawing grid...');
drawGrid();
console.log('Drawing preview...');
drawPreview(currentBlocks);
console.log('Game initialized.');
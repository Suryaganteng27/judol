// --- SISTEM SUARA (Synthesizer Audio Bawaan Web) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hit') {
        // Suara benturan bola
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'pocket') {
        // Suara bola masuk lubang
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

// --- VARIABEL UTAMA ---
let scene, camera, renderer;
let balls = [], cueBall, cueStick;
let gameMode = 'pvp'; // 'pvp' atau 'cpu'
let currentPlayer = 1;
let level = 1;
let timeLeft = 30;
let timerInterval = null;
let isMoving = false;

// --- INITIALIZE THREE.JS SCENE ---
function initEngine() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111115); // Latar latar ruangan sintetis

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 18, 15);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Pencahayaan Realistis
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.SpotLight(0xffffff, 1.2);
    mainLight.position.set(0, 25, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    buildTable();
    createBalls();
    createCueStick();

    // Event Listener
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onShoot);

    animate();
}

// --- DESAIN MEJA BILIAR 3D ---
function buildTable() {
    // Permukaan Meja (Hijau Biliar)
    const tableGeo = new THREE.BoxGeometry(12, 0.5, 22);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x076324, roughness: 0.4 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = -0.25;
    table.receiveShadow = true;
    scene.add(table);

    // Pinggiran Kayu Meja
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.2 });
    
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 1), borderMat);
    b1.position.set(0, 0.15, 11.5); b1.castShadow = true; scene.add(b1);
    
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 1), borderMat);
    b2.position.set(0, 0.15, -11.5); b2.castShadow = true; scene.add(b2);

    const b3 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 24), borderMat);
    b3.position.set(6.5, 0.15, 0); b3.castShadow = true; scene.add(b3);

    const b4 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 24), borderMat);
    b4.position.set(-6.5, 0.15, 0); b4.castShadow = true; scene.add(b4);
}

// --- MEMBUAT BOLA 3D ---
function createBalls() {
    const ballRadius = 0.4;
    const sphereGeo = new THREE.SphereGeometry(ballRadius, 32, 32);

    // Cue Ball (Bola Putih)
    const cueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    cueBall = new THREE.Mesh(sphereGeo, cueMat);
    cueBall.position.set(0, ballRadius, 6);
    cueBall.castShadow = true;
    cueBall.velocity = new THREE.Vector3();
    scene.add(cueBall);

    // Bola Target sederhanakan susunan
    const colors = [0xff0000, 0xffff00, 0x0000ff, 0xff00ff, 0xff8800, 0x00ff00, 0x880000];
    let index = 0;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col <= row; col++) {
            const mat = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.1 });
            const ball = new THREE.Mesh(sphereGeo, mat);
            ball.position.set((col - row / 2) * 0.9, ballRadius, -4 - (row * 0.8));
            ball.castShadow = true;
            ball.velocity = new THREE.Vector3();
            balls.push(ball);
            scene.add(ball);
            index++;
        }
    }
}

// --- MEMBUAT TONGKAT CUE ---
function createCueStick() {
    const cueGeo = new THREE.CylinderGeometry(0.05, 0.15, 10);
    const cueMat = new THREE.MeshStandardMaterial({ color: 0xddaa77 });
    cueStick = new THREE.Mesh(cueGeo, cueMat);
    cueStick.rotation.x = Math.PI / 2;
    cueStick.position.set(0, 0.4, 12);
    scene.add(cueStick);
}

// --- NOTIFIKASI & LOGIKA WAKTU ---
function showNotification(text) {
    const notif = document.getElementById('notification');
    notif.innerText = text;
    notif.classList.remove('hidden');
    setTimeout(() => notif.classList.add('hidden'), 2500);
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 30;
    document.getElementById('timer-display').innerText = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-display').innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showNotification("Waktu Habis! Berganti Giliran.");
            switchTurn();
        }
    }, 1000);
}

function switchTurn() {
    if (gameMode === 'cpu') {
        currentPlayer = currentPlayer === 1 ? 'Computer' : 1;
        document.getElementById('turn-display').innerText = `Giliran: ${currentPlayer === 1 ? 'Player 1' : 'Computer'}`;
        if (currentPlayer === 'Computer') {
            setTimeout(playComputerTurn, 1500);
        }
    } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        document.getElementById('turn-display').innerText = `Giliran: Player ${currentPlayer}`;
    }
    startTimer();
}

// --- LOGIKA TEMBAKAN & FISIKA SEDERHANA ---
function onShoot() {
    if (isMoving || (gameMode === 'cpu' && currentPlayer === 'Computer')) return;

    // Dorong bola putih ke depan
    cueBall.velocity.z = -0.8;
    playSound('hit');
    isMoving = true;
}

function playComputerTurn() {
    showNotification("Computer sedang berpikir...");
    setTimeout(() => {
        cueBall.velocity.x = (Math.random() - 0.5) * 0.4;
        cueBall.velocity.z = -0.7;
        playSound('hit');
        isMoving = true;
    }, 1000);
}

function updatePhysics() {
    let moving = false;

    // Pergerakan Bola Putih
    if (cueBall.velocity.length() > 0.001) {
        cueBall.position.add(cueBall.velocity);
        cueBall.velocity.multiplyScalar(0.98); // Gesekan
        moving = true;
    } else {
        cueBall.velocity.set(0, 0, 0);
    }

    // Pergerakan Bola Lainnya & Deteksi Tabrakan
    balls.forEach(ball => {
        if (ball.velocity.length() > 0.001) {
            ball.position.add(ball.velocity);
            ball.velocity.multiplyScalar(0.98);
            moving = true;
        } else {
            ball.velocity.set(0, 0, 0);
        }

        // Tabrakan Cue Ball dengan Bola Lain
        if (cueBall.position.distanceTo(ball.position) < 0.8) {
            playSound('hit');
            ball.velocity.copy(cueBall.velocity).multiplyScalar(0.8);
            cueBall.velocity.multiplyScalar(0.3);
        }
    });

    // Posisikan Tongkat Cue Mengikuti Bola Putih
    cueStick.position.set(cueBall.position.x, cueBall.position.y, cueBall.position.z + 6);

    if (isMoving && !moving) {
        isMoving = false;
        switchTurn();
    }
}

// --- START GAME & LOOP ---
function startGame(mode) {
    gameMode = mode;
    document.getElementById('mode-display').innerText = `Mode: ${mode === 'cpu' ? 'VS Computer' : '2 Player'}`;
    document.getElementById('menu-overlay').style.display = 'none';
    
    initEngine();
    showNotification("Game Dimulai!");
    startTimer();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    renderer.render(scene, camera);
}

import './socket-client.js';
import './chips-animation.js';
import { initLoadingScene, startLoading, stopLoading } from './three-loading.js';
import { renderLeaderboard } from './ui-manager.js';
import { updateRaiseLabels, setRaisePercent, setRaiseBB, sendAction } from './bet-controls.js';
import { sendChat } from './chat.js';
import { setMyCurrentBalance, setBBValue, setLastGameState, setMyCards, setRoomType } from './shared.js';
import { socket } from './socket-client.js';

window.socket = socket;

function connectWallet() {
    const name = document.getElementById('player-name').value;
    if (!name) { alert('Ingresa tu nombre'); return; }
    localStorage.setItem('playerName', name);
    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('lobby-controls').style.display = 'block';
}

function startMatchmaking() {
    startLoading(); // Activa la pantalla de carga con animación
    document.getElementById('lobby-overlay').classList.add('hidden');
    
    setTimeout(() => {
        stopLoading(); // Oculta la pantalla de carga
        document.getElementById('game-interface').style.display = 'block';
    }, 3000);
}
function createRoom() {
    alert('Creando sala...');
    document.getElementById('lobby-overlay').classList.add('hidden');
    document.getElementById('game-interface').style.display = 'block';
}

function joinRoom() {
    const code = document.getElementById('room-input').value;
    if (!code) { alert('Ingresa un código'); return; }
    alert('Uniendo a sala ' + code);
    document.getElementById('lobby-overlay').classList.add('hidden');
    document.getElementById('game-interface').style.display = 'block';
}

const CHIPS_PER_ETH = 10000;
const TREASURY_ADDRESS = "0xTU_DIRECCION_DE_BILLETERA_AQUI";

async function initDeposit() {
    if (window.ethereum) {
        try {
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            document.getElementById('user-address').innerText = accounts[0].slice(0,6) + '...' + accounts[0].slice(-4);
            window.userAddress = accounts[0];
        } catch (error) {
            console.error("Error connecting to MetaMask:", error);
        }
    } else {
        document.getElementById('user-address').innerText = 'MetaMask no detectado';
    }
}

function calculateChips() {
    const eth = document.getElementById('crypto-amount').value;
    const chips = eth * CHIPS_PER_ETH;
    document.getElementById('chips-preview').innerText = chips.toLocaleString();
}

async function executeDeposit() {
    const amount = document.getElementById('crypto-amount').value;
    if (!amount || amount <= 0) return alert("Ingresa una cantidad válida");

    const status = document.getElementById('status-msg');
    const btn = document.getElementById('btn-deposit');

    try {
        btn.disabled = true;
        status.innerHTML = "Esperando confirmación en MetaMask...";
        status.className = "";

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        const tx = await signer.sendTransaction({
            to: TREASURY_ADDRESS,
            value: ethers.utils.parseEther(amount.toString())
        });

        status.innerHTML = "Transacción enviada. Esperando confirmación de red...";
        
        const receipt = await tx.wait();

        status.innerHTML = `<span class="success">¡DEPÓSITO EXITOSO!<br>Las fichas se acreditarán en breve.</span>`;
        console.log("TX Hash:", receipt.transactionHash);

    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="error">Error: ${err.message.slice(0, 40)}...</span>`;
        btn.disabled = false;
    }
}

window.connectWallet = connectWallet;
window.startMatchmaking = startMatchmaking;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.updateRaiseLabels = updateRaiseLabels;
window.setRaisePercent = setRaisePercent;
window.setRaiseBB = setRaiseBB;
window.sendAction = sendAction;
window.sendChat = sendChat;
window.calculateChips = calculateChips;
window.executeDeposit = executeDeposit;

window.onload = () => {
    setBBValue(20);
    setMyCurrentBalance(1000);
    setMyCards([]);
    setRoomType('free');

    initLoadingScene('canvas-container-loading');
    initDeposit();

    // Pestañas del sidebar
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            // Desactivar todas
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            // Activar la seleccionada
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`).classList.add('active');
        });
    });
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            document.getElementById('game-interface').style.display = 'none';
            document.getElementById('lobby-overlay').classList.remove('hidden');
            // Opcional: detener animaciones de la mesa
        });
    }

    const btnEntrar = document.getElementById('btn-entrar-lobby');
    if (btnEntrar) {
        btnEntrar.addEventListener('click', connectWallet);
    }
};
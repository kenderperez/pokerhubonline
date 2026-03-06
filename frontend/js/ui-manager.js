export function renderLeaderboard(lb) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    const sorted = Object.entries(lb).map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins).slice(0, 5);
    if (sorted.length === 0) {
        container.innerHTML = `<div style="font-size:10px; color:#555; text-align:center;">No hay victorias registradas</div>`;
        return;
    }
    container.innerHTML = sorted.map((player, index) => `
        <div class="leaderboard-row">
            <span class="rank">#${index + 1}</span>
            <span class="name">${player.name}</span>
            <span class="wins">${player.wins} ${player.wins === 1 ? 'Win' : 'Wins'}</span>
        </div>`).join('');
}

window.copyRoomId = function(id, btnElement) {
    navigator.clipboard.writeText(id).then(() => {
        const originalText = btnElement.innerText;
        const originalBg = btnElement.style.background;
        
        btnElement.innerText = '¡COPIADO!';
        btnElement.style.background = '#fff';
        
        setTimeout(() => {
            btnElement.innerText = originalText;
            btnElement.style.background = originalBg;
        }, 2000);
        
    }).catch(err => {
        console.error('Error: ', err);
        alert('Cópialo manualmente: ' + id);
    });
};
const cantidadFichas = 25;
let fichasActivas = 0;

function crearFicha() {
    if (fichasActivas >= cantidadFichas) return;

    const contenedorCaida = document.createElement('div');
    contenedorCaida.classList.add('contenedor-caida');

    const contenedorRotacion = document.createElement('div');
    contenedorRotacion.classList.add('contenedor-rotacion');

    for (let i = -18; i <= 18; i++) {
        const z = i * 0.5;
        const capaGrosor = document.createElement('div');
        capaGrosor.classList.add('capa-grosor');
        capaGrosor.style.transform = `translateZ(${z}px)`;
        contenedorRotacion.appendChild(capaGrosor);
    }

    const diseñoCara = `
        <div class="corte-blanco">
            <div class="centro-rojo">
                <div class="pica">♠</div>
            </div>
        </div>
    `;
    
    const caraFrente = document.createElement('div');
    caraFrente.classList.add('cara', 'cara-frente');
    caraFrente.innerHTML = diseñoCara;

    const caraDorso = document.createElement('div');
    caraDorso.classList.add('cara', 'cara-dorso');
    caraDorso.innerHTML = diseñoCara;

    contenedorRotacion.appendChild(caraFrente);
    contenedorRotacion.appendChild(caraDorso);
    contenedorCaida.appendChild(contenedorRotacion);

    const posX = (Math.random() * 90 + 5) + 'vw';
    const posZ = (Math.random() * 800 - 400) + 'px';
    const escala = Math.random() * 0.6 + 0.4;
    const tiempoCaida = Math.random() * 7 + 8;

    const giroX = (Math.random() * 720 + 360) * (Math.random() > 0.5 ? 1 : -1) + 'deg';
    const giroY = (Math.random() * 720 + 360) * (Math.random() > 0.5 ? 1 : -1) + 'deg';
    const giroZ = (Math.random() * 360) + 'deg';

    contenedorCaida.style.setProperty('--posX', posX);
    contenedorCaida.style.setProperty('--posZ', posZ);
    contenedorCaida.style.setProperty('--escala', escala);
    contenedorCaida.style.animationDuration = `${tiempoCaida}s`;

    contenedorRotacion.style.setProperty('--giroX', giroX);
    contenedorRotacion.style.setProperty('--giroY', giroY);
    contenedorRotacion.style.setProperty('--giroZ', giroZ);
    contenedorRotacion.style.animationDuration = `${tiempoCaida}s`;

    document.body.appendChild(contenedorCaida);
    fichasActivas++;

    setTimeout(() => {
        contenedorCaida.remove();
        fichasActivas--;
    }, tiempoCaida * 1000);
}

setInterval(crearFicha, 5500);
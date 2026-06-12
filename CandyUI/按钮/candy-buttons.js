// CandyUI Button JavaScript - 从index.html和index2.html提取并优化

document.addEventListener('DOMContentLoaded', function() {
    // --- Dot Trail Interaction (index2.html) ---
    const dotTrailBtn = document.getElementById('dotTrailBtn');
    if (dotTrailBtn) {
        dotTrailBtn.addEventListener('mousemove', (e) => {
            const btn = e.currentTarget;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;

            btn.appendChild(dot);

            setTimeout(() => {
                dot.remove();
            }, 1000);
        });
    }

    // --- Magnetic Pull Interaction (index2.html) ---
    const magneticBtn = document.getElementById('magneticBtn');
    if (magneticBtn) {
        magneticBtn.addEventListener('mousemove', (e) => {
            const btnRect = magneticBtn.getBoundingClientRect();
            const btnCenterX = btnRect.left + btnRect.width / 2;
            const btnCenterY = btnRect.top + btnRect.height / 2;

            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const deltaX = mouseX - btnCenterX;
            const deltaY = mouseY - btnCenterY;

            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 150;

            if (distance < maxDistance) {
                const moveX = (deltaX / maxDistance) * 10;
                const moveY = (deltaY / maxDistance) * 10;
                magneticBtn.style.transform = `translate(${moveX}px, ${moveY}px)`;
            }
        });

        magneticBtn.addEventListener('mouseleave', () => {
            magneticBtn.style.transform = 'translate(0, 0)';
        });
    }

    // --- Plasma Globe Interaction ---
    const plasmaBtn = document.getElementById('plasmaBtn');
    if (plasmaBtn) {
        plasmaBtn.addEventListener('mousemove', (e) => {
            const btn = e.currentTarget;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const bolt = document.createElement('span');
            bolt.className = 'plasma-bolt';
            bolt.style.left = `${x}px`;
            bolt.style.top = `${y}px`;
            const size = Math.random() * 10 + 5;
            bolt.style.width = `${size}px`;
            bolt.style.height = `${size}px`;
            bolt.style.animation = `fadeOut ${Math.random() * 1 + 0.5}s forwards`;

            btn.appendChild(bolt);

            if (!document.querySelector('#plasmaFadeOutStyle')) {
                const style = document.createElement('style');
                style.id = 'plasmaFadeOutStyle';
                style.textContent = `
                    @keyframes fadeOut {
                        to { opacity: 0; transform: scale(0); }
                    }
                `;
                document.head.appendChild(style);
            }

            setTimeout(() => {
                bolt.remove();
            }, 1000);
        });
    }

    // --- Solar Flare Interaction ---
    const solarBtn = document.getElementById('solarBtn');
    if (solarBtn) {
        solarBtn.addEventListener('mousemove', (e) => {
            const btn = e.currentTarget;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const flare = document.createElement('span');
            flare.className = 'flare';
            flare.style.left = `${x}px`;
            flare.style.top = `${y}px`;
            const size = Math.random() * 20 + 5;
            flare.style.width = `${size}px`;
            flare.style.height = `${size}px`;
            flare.style.animation = `fadeOut ${Math.random() * 1 + 0.3}s forwards`;

            btn.appendChild(flare);

            setTimeout(() => {
                flare.remove();
            }, 1000);
        });
    }

    // --- Laser Grid Generator ---
    function createLaserGrid(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const linesContainer = document.createDocumentFragment();
        for (let i = 0; i < btn.offsetHeight; i += 10) {
            const line = document.createElement('div');
            line.className = 'grid-line-h';
            line.style.top = `${i}px`;
            linesContainer.appendChild(line);
        }
        for (let i = 0; i < btn.offsetWidth; i += 10) {
            const line = document.createElement('div');
            line.className = 'grid-line-v';
            line.style.left = `${i}px`;
            linesContainer.appendChild(line);
        }
        btn.appendChild(linesContainer);
    }

    window.addEventListener('load', () => {
        createLaserGrid('laserGridBtn');
    });

    window.addEventListener('resize', () => {
        document.querySelectorAll('.candy-btn-laser-grid').forEach(btn => {
            btn.innerHTML = '';
            const idMatch = [...btn.attributes].find(attr => attr.name.startsWith('id'));
            if (idMatch) createLaserGrid(idMatch.value);
        });
    });

    // --- Dataglobe Data Points ---
    function populateDataglobe(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const pointsContainer = document.createDocumentFragment();
        for (let i = 0; i < 20; i++) {
            const point = document.createElement('span');
            point.className = 'data-point';
            point.style.left = `${Math.random() * 100}%`;
            point.style.top = `${Math.random() * 100}%`;
            point.style.animationDelay = `${Math.random() * 2}s`;
            pointsContainer.appendChild(point);
        }
        btn.appendChild(pointsContainer);

        if (!document.querySelector('#dataPointPulseStyle')) {
            const style = document.createElement('style');
            style.id = 'dataPointPulseStyle';
            style.textContent = `
                @keyframes dataPulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.5); opacity: 0.4; }
                }
                .data-point {
                    animation: dataPulse 2s infinite ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }
    }

    window.addEventListener('load', () => {
        populateDataglobe('dataglobeBtn');
    });

    // --- Quantum Tunnel Circles ---
    const quantumTunnelBtn = document.getElementById('quantumTunnelBtn');
    if (quantumTunnelBtn) {
        quantumTunnelBtn.addEventListener('mousemove', (e) => {
            const btn = e.currentTarget;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const tunnel = document.createElement('div');
            tunnel.className = 'tunnel';
            tunnel.style.left = `${x}px`;
            tunnel.style.top = `${y}px`;
            const size = Math.random() * 30 + 10;
            tunnel.style.width = `${size}px`;
            tunnel.style.height = `${size}px`;
            tunnel.style.animation = `fadeOut ${Math.random() * 1 + 0.5}s forwards`;

            btn.appendChild(tunnel);

            setTimeout(() => {
                tunnel.remove();
            }, 1000);
        });
    }

    // --- Digital Rain Characters ---
    function generateDigitalRain(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const rainContainer = document.createDocumentFragment();
        const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < 30; i++) {
            const charSpan = document.createElement('span');
            charSpan.className = 'rain-char';
            charSpan.textContent = chars.charAt(Math.floor(Math.random() * chars.length));
            charSpan.style.left = `${Math.random() * 100}%`;
            charSpan.style.animationDelay = `${Math.random() * 2}s`;
            charSpan.style.animationDuration = `${Math.random() * 3 + 2}s`;
            rainContainer.appendChild(charSpan);
        }
        btn.appendChild(rainContainer);

        if (!document.querySelector('#rainFallStyle')) {
            const style = document.createElement('style');
            style.id = 'rainFallStyle';
            style.textContent = `
                @keyframes rainFall {
                    to { transform: translateY(100px); opacity: 0; }
                }
                .rain-char {
                    animation: rainFall linear infinite;
                }
            `;
            document.head.appendChild(style);
        }
    }

    window.addEventListener('load', () => {
        generateDigitalRain('digitalRainBtn');
    });

    // --- Hologram Circuit Lines ---
    function drawCircuitPattern(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const linesContainer = document.createDocumentFragment();
        const width = btn.offsetWidth;
        const height = btn.offsetHeight;

        for (let i = 0; i < 5; i++) {
            const hLine = document.createElement('div');
            hLine.className = 'circuit-line';
            hLine.style.width = `${Math.random() * width * 0.5}px`;
            hLine.style.left = `${Math.random() * width * 0.5}px`;
            hLine.style.top = `${Math.random() * height}px`;
            linesContainer.appendChild(hLine);
        }
        for (let i = 0; i < 5; i++) {
            const vLine = document.createElement('div');
            vLine.className = 'circuit-line';
            vLine.style.height = `${Math.random() * height * 0.5}px`;
            vLine.style.top = `${Math.random() * height * 0.5}px`;
            vLine.style.left = `${Math.random() * width}px`;
            vLine.style.width = '2px';
            linesContainer.appendChild(vLine);
        }
        btn.appendChild(linesContainer);
    }

    window.addEventListener('load', () => {
        drawCircuitPattern('circuitBtn');
    });

    window.addEventListener('resize', () => {
        const btn = document.getElementById('circuitBtn');
        if (btn) {
            btn.innerHTML = '';
            drawCircuitPattern('circuitBtn');
        }
    });

    // --- Nano Scan Line ---
    window.addEventListener('load', () => {
        const nanoBtn = document.querySelector('.candy-btn-nano');
        if (nanoBtn) {
            const line = document.createElement('div');
            line.className = 'nano-line';
            nanoBtn.appendChild(line);
        }
    });

    // --- Implant Lines ---
    window.addEventListener('load', () => {
        const implantBtn = document.querySelector('.candy-btn-implant');
        if (implantBtn) {
            const linesContainer = document.createDocumentFragment();
            const hLine = document.createElement('div');
            hLine.className = 'implant-line';
            hLine.style.width = '100%';
            hLine.style.top = '50%';
            hLine.style.animation = 'nanoScan 2s linear infinite';
            linesContainer.appendChild(hLine);

            const vLine = document.createElement('div');
            vLine.className = 'implant-line';
            vLine.style.height = '100%';
            vLine.style.left = '50%';
            vLine.style.width = '1px';
            linesContainer.appendChild(vLine);

            implantBtn.appendChild(linesContainer);
        }
    });
});
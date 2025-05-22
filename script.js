// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDaxiCwD9P1UCf7IW1My78kcAvUivfvqZs",
    authDomain: "torneos-bh.firebaseapp.com",
    projectId: "torneos-bh",
    storageBucket: "torneos-bh.firebasestorage.app",
    messagingSenderId: "199366363777",
    appId: "1:199366363777:web:c5044a8b8e1fc967f45b80",
    measurementId: "G-JZGGBJTR36"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Clase para gestionar los torneos
class TournamentManager {
    constructor() {
        this.tournaments = [];
        this.currentTournament = null;
        this.initializeEventListeners();
        this.loadTournaments();
    }

    initializeEventListeners() {
        // Navegación
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToSection(link.dataset.section);
            });
        });

        // Formulario de creación de torneo
        document.getElementById('tournament-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTournament();
        });

        // Formulario de registro de jugador
        document.getElementById('player-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.registerPlayer();
        });

        // Toggle de tema
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Botones de CTA
        document.querySelectorAll('.cta-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateToSection(btn.dataset.section);
            });
        });
    }

    navigateToSection(sectionId) {
        // Ocultar todas las secciones
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar la sección seleccionada
        document.getElementById(sectionId).classList.add('active');

        // Actualizar navegación
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.section === sectionId) {
                link.classList.add('active');
            }
        });
    }

    async loadTournaments() {
        try {
            const snapshot = await db.collection('tournaments').get();
            this.tournaments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.updateTournamentsUI();
        } catch (error) {
            console.error("Error al cargar torneos:", error);
            alert("Error al cargar los torneos. Por favor, intenta de nuevo.");
        }
    }

    updateTournamentsUI() {
        const tournamentsList = document.getElementById('tournaments-list');
        const tournamentSelect = document.getElementById('tournament-select');
        
        // Limpiar listas
        tournamentsList.innerHTML = '';
        tournamentSelect.innerHTML = '<option value="">Seleccionar Torneo</option>';

        // Cargar torneos activos
        this.tournaments.forEach(tournament => {
            // Agregar a la lista de torneos
            const tournamentCard = document.createElement('div');
            tournamentCard.className = 'tournament-card';
            tournamentCard.innerHTML = `
                <h3>${tournament.name}</h3>
                <p>Jugadores: ${tournament.players.length}/${tournament.playerCount}</p>
                <p>Registro: ${new Date(tournament.createdAt).toLocaleDateString()}</p>
                <div class="tournament-actions">
                    <button class="btn primary" onclick="tournamentManager.viewBracket('${tournament.id}')">
                        Ver Bracket
                    </button>
                    <button class="btn secondary" onclick="tournamentManager.viewParticipants('${tournament.id}')">
                        Ver Participantes
                    </button>
                </div>
            `;
            tournamentsList.appendChild(tournamentCard);

            // Agregar al select de registro
            const option = document.createElement('option');
            option.value = tournament.id;
            option.textContent = tournament.name;
            tournamentSelect.appendChild(option);
        });
    }

    async createTournament() {
        const name = document.getElementById('tournament-name').value.trim();
        const playerCount = parseInt(document.getElementById('player-count').value);

        if (!name) {
            alert('Por favor, ingresa un nombre para el torneo');
            return;
        }

        try {
            const tournament = {
                name,
                playerCount,
                players: [],
                matches: this.generateBracket(playerCount),
                createdAt: new Date().toISOString()
            };

            const docRef = await db.collection('tournaments').add(tournament);
            tournament.id = docRef.id;
            this.tournaments.push(tournament);
            
            this.updateTournamentsUI();
            this.navigateToSection('view-brackets');
            alert('Torneo creado exitosamente');
        } catch (error) {
            console.error("Error al crear torneo:", error);
            alert("Error al crear el torneo. Por favor, intenta de nuevo.");
        }
    }

    generateBracket(playerCount) {
        const matches = [];
        const rounds = Math.log2(playerCount);
        
        for (let round = 0; round < rounds; round++) {
            const matchesInRound = playerCount / Math.pow(2, round + 1);
            
            for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
                matches.push({
                    id: `${round}-${matchIndex}`,
                    player1: null,
                    player2: null,
                    winner: null,
                    roundIndex: round,
                    matchIndex
                });
            }
        }
        
        return matches;
    }

    async registerPlayer() {
        const name = document.getElementById('player-name').value.trim();
        const tournamentId = document.getElementById('tournament-select').value;
        const contact = document.getElementById('player-contact').value.trim();

        // Validación básica
        if (name.length < 3) {
            alert('El nombre debe tener al menos 3 caracteres');
            return;
        }

        const tournament = this.tournaments.find(t => t.id === tournamentId);
        
        if (!tournament) {
            alert('Torneo no encontrado');
            return;
        }

        if (tournament.players.length >= tournament.playerCount) {
            alert('El torneo está lleno');
            return;
        }

        if (tournament.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert('Este nombre ya está registrado en el torneo');
            return;
        }

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const player = {
            id: Date.now().toString(),
            name,
            contact,
            timezone,
            registeredAt: new Date().toISOString()
        };

        try {
            // Agregar el nuevo jugador al array de players en Firestore
            await db.collection('tournaments').doc(tournamentId).update({
                players: firebase.firestore.FieldValue.arrayUnion(player)
            });

            // Actualizar el array local de players
            tournament.players.push(player);
            
            // Si el torneo está lleno después de este registro, asignar jugadores a la primera ronda
            if (tournament.players.length === tournament.playerCount) {
                this.assignPlayersToFirstRound(tournament);
                 // Guardar la asignación de jugadores en la primera ronda en Firestore
                await db.collection('tournaments').doc(tournamentId).update({
                    matches: tournament.matches
                });
            }

            // Actualizar la UI y mostrar mensaje de éxito
            this.updateTournamentsUI();
            // Si estamos viendo el bracket de este torneo, refrescarlo
            if (this.currentTournament && this.currentTournament.id === tournamentId) {
                this.viewBracket(tournamentId);
            }

            alert(`¡Registro exitoso! Bienvenido a ${tournament.name}, ${name}`);
        } catch (error) {
            console.error("Error al registrar jugador:", error);
            alert("Error al registrar el jugador. Por favor, intenta de nuevo.");
        }
    }

    // Nueva función para asignar jugadores a la primera ronda
    assignPlayersToFirstRound(tournament) {
        const matches = tournament.matches;
        const players = tournament.players;

        // Asignar jugadores a los partidos de la ronda 0
        const firstRoundMatches = matches.filter(match => match.roundIndex === 0);
        // Aleatorizar el orden de los jugadores (opcional, pero común en torneos)
        players.sort(() => Math.random() - 0.5);

        for (let i = 0; i < firstRoundMatches.length; i++) {
            const match = firstRoundMatches[i];
            // Asegurarse de que haya suficientes jugadores para el partido
            if (players[i * 2]) match.player1 = players[i * 2];
            if (players[i * 2 + 1]) match.player2 = players[i * 2 + 1];
        }
        // Nota: No guardamos en Firestore aquí, se guarda en registerPlayer
    }

    updateBracket(tournament) {
        // Esta función ya no necesita asignar jugadores,
        // solo nos aseguramos de que la lógica del bracket funcione con el array plano.
        // La asignación inicial se hace en assignPlayersToFirstRound.
    }

    viewBracket(tournamentId) {
        const tournament = this.tournaments.find(t => t.id === tournamentId);
        if (!tournament) return;

        this.currentTournament = tournament;
        const container = document.getElementById('bracket-container');
        container.innerHTML = '';

        // Agrupar partidos por ronda
        const rounds = {};
        tournament.matches.forEach(match => {
            if (!rounds[match.roundIndex]) {
                rounds[match.roundIndex] = [];
            }
            rounds[match.roundIndex].push(match);
        });

        // Mostrar rondas y partidos
        Object.keys(rounds).sort().forEach(roundIndex => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'bracket-round';
            roundDiv.innerHTML = `<h3>Ronda ${parseInt(roundIndex) + 1}</h3>`;

            rounds[roundIndex].forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'bracket-match';
                matchDiv.innerHTML = `
                    <div class="player ${match.winner === match.player1?.id ? 'winner' : ''}">
                        ${match.player1 ? match.player1.name : 'TBD'}
                    </div>
                    <div class="player ${match.winner === match.player2?.id ? 'winner' : ''}">
                        ${match.player2 ? match.player2.name : 'TBD'}
                    </div>
                    ${match.player1 && match.player2 ? `
                        <button class="btn small" onclick="tournamentManager.setWinner('${tournament.id}', ${match.roundIndex}, ${match.matchIndex}, ${match.player1.id})">
                            ${match.player1.name}
                        </button>
                        <button class="btn small" onclick="tournamentManager.setWinner('${tournament.id}', ${match.roundIndex}, ${match.matchIndex}, ${match.player2.id})">
                            ${match.player2.name}
                        </button>
                    ` : ''}
                `;
                roundDiv.appendChild(matchDiv);
            });

            container.appendChild(roundDiv);
        });
    }

    async setWinner(tournamentId, roundIndex, matchIndex, winnerId) {
        try {
            const tournament = this.tournaments.find(t => t.id === tournamentId);
            if (!tournament) return;

            // Encontrar el partido correcto usando roundIndex y matchIndex
            const match = tournament.matches.find(m => m.roundIndex === roundIndex && m.matchIndex === matchIndex);
            
            if (!match) return; // Partido no encontrado

            match.winner = winnerId;

            // Avanzar al ganador a la siguiente ronda (si no es la última)
            const totalRounds = Math.log2(tournament.playerCount);
            if (roundIndex < totalRounds - 1) {
                const nextRoundIndex = roundIndex + 1;
                // Determinar si es el primer o segundo partido de la siguiente ronda
                const nextMatchIndex = Math.floor(matchIndex / 2);

                // Encontrar el partido de la siguiente ronda
                const nextMatch = tournament.matches.find(m => m.roundIndex === nextRoundIndex && m.matchIndex === nextMatchIndex);

                if (nextMatch) {
                     if (matchIndex % 2 === 0) { // Si este partido es el primero de su par en la ronda actual
                        nextMatch.player1 = tournament.players.find(p => p.id === winnerId);
                    } else { // Si este partido es el segundo de su par en la ronda actual
                        nextMatch.player2 = tournament.players.find(p => p.id === winnerId);
                    }
                }
            }

            await db.collection('tournaments').doc(tournamentId).update({
                matches: tournament.matches
            });

            this.viewBracket(tournamentId);
        } catch (error) {
            console.error("Error al actualizar ganador:", error);
            alert("Error al actualizar el ganador. Por favor, intenta de nuevo.");
        }
    }

    viewParticipants(tournamentId) {
        const tournament = this.tournaments.find(t => t.id === tournamentId);
        if (!tournament) return;

        const participantsList = tournament.players.map(player => `
            <div class="participant-card">
                <h4>${player.name}</h4>
                <p>Contacto: ${player.contact || 'No especificado'}</p>
                <p>Zona Horaria: ${player.timezone}</p>
                <p>Registrado: ${new Date(player.registeredAt).toLocaleString()}</p>
            </div>
        `).join('');

        const container = document.getElementById('bracket-container');
        container.innerHTML = `
            <div class="participants-container">
                <h3>Participantes de ${tournament.name}</h3>
                <div class="participants-grid">
                    ${participantsList}
                </div>
            </div>
        `;
    }

    toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        const themeIcon = document.querySelector('.theme-toggle i');
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Inicializar el gestor de torneos
const tournamentManager = new TournamentManager();

// Cargar tema guardado
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
    const themeIcon = document.querySelector('.theme-toggle i');
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
} 
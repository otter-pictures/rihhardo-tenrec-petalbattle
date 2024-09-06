const socket = io();
const gameState = {};
const sounds = {
    wrong: new Audio('/sounds/wrong.mp3'),
    correct: new Audio('/sounds/correct.mp3')
};
const interfaces = {
    host: document.getElementById('host-interface'),
    audience: document.getElementById('audience-interface')
};

// Socket event listeners
socket.on('connect', () => console.log('Connected to the server with Socket.io'));
socket.on('game-update', handleGameUpdate);

// Main render functions
function renderView(gameState) {
    if (interfaces.host) renderHostView(gameState);
    if (interfaces.audience) renderAudienceView(gameState);
}

function renderAudienceView(gameState) {
    const { gameStarted, revealedQuestions, currentQuestionIndex } = gameState;
    if (!gameStarted) {
        renderStartScreen(gameState);
    } else if (!revealedQuestions.includes(currentQuestionIndex)) {
        renderEmptyBoard(gameState);
    } else {
        renderGameBoard(gameState);
    }
}

// Helper functions for rendering
function renderStartScreen(gameState) {
    interfaces.audience.innerHTML = `
        <div class="start-screen">
            <p>Rihhardo-Tenrec-Tulbilahing esitleb:</p>
            <h1>Joomamäng</h1>
            <div class="team-names">
                <h2>${gameState.teamNames[0]}</h2>
                <h2>VS</h2>
                <h2>${gameState.teamNames[1]}</h2>
            </div>
        </div>
    `;
}

function renderEmptyBoard(gameState) {
    interfaces.audience.innerHTML = `
        <div class="audience-container">
            <div class="question-header hidden">
                <h2>Get ready for the next question!</h2>
            </div>
            <div class="gameboard">
                <div class="row">
                    ${renderEmptyCell()}
                    ${renderEmptyCell()}
                </div>
                <div class="row">
                    ${renderEmptyCell()}
                    ${renderEmptyCell()}
                </div>
                <div class="row">
                    ${renderEmptyCell()}
                    ${renderEmptyCell()}
                </div>
                <div class="row">
                    ${renderEmptyCell()}
                    ${renderEmptyCell()}
                </div>
                <div class="small-gap"></div>               
                <div class="row team-names">
                    <div class="cell team-name-left">${gameState.teamNames[0]}</div>
                    <div class="cell team-name-right">${gameState.teamNames[1]}</div>
                </div>
                <div class="row scores-strikes">
                    <div class="cell team-score-left">${gameState.teamScores[0]}</div>
                    <div class="strikes">
                        <div class="strike"></div>
                        <div class="strike"></div>
                        <div class="strike"></div>
                    </div>
                    <div class="cell team-score-right">${gameState.teamScores[1]}</div>
                </div>
            </div>
        </div>`;
}

function renderEmptyCell() {
    return `<div class="cell answer-cell empty"></div>`;
}

function renderGameBoard(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

    interfaces.audience.innerHTML = `
        <div class="audience-container">
            <div class="question-header">
                <h2>${currentQuestion.question}</h2>
            </div>
            <div class="gameboard">
                <div class="row">
                    ${renderAnswerCell(currentQuestion.answers[0], 1)}
                    ${renderAnswerCell(currentQuestion.answers[4], 5)}
                </div>
                <div class="row">
                    ${renderAnswerCell(currentQuestion.answers[1], 2)}
                    ${renderAnswerCell(currentQuestion.answers[5], 6)}
                </div>
                <div class="row">
                    ${renderAnswerCell(currentQuestion.answers[2], 3)}
                    ${renderAnswerCell(currentQuestion.answers[6], 7)}
                </div>
                <div class="row">
                    ${renderAnswerCell(currentQuestion.answers[3], 4)}
                    ${renderAnswerCell(currentQuestion.answers[7], 8)}
                </div>
                 <div class="small-gap"></div>               
                <div class="row team-names">
                    <div class="cell team-name-left">${gameState.teamNames[0]}</div>
                    <div class="cell team-name-right">${gameState.teamNames[1]}</div>
                </div>
                <div class="row scores-strikes">
                    <div class="cell team-score-left">${gameState.teamScores[0]}</div>
                    <div class="strikes">
                        <div class="strike">${gameState.wrongAnswers >= 1 ? '❌' : ''}</div>
                        <div class="strike">${gameState.wrongAnswers >= 2 ? '❌' : ''}</div>
                        <div class="strike">${gameState.wrongAnswers >= 3 ? '❌' : ''}</div>
                    </div>
                    <div class="cell team-score-right">${gameState.teamScores[1]}</div>
                </div>
            </div>
        </div>`;
}

// Helper function to render each answer cell
function renderAnswerCell(answer, sequenceNumber) {
    if (!answer) {
        return `<div class="cell answer-cell empty"></div>`;
    }

    const cellClass = answer.revealed ? "revealed" : "unrevealed";
    const answerText = answer.revealed ? answer.answer : '';
    const pointsText = answer.revealed ? `${answer.points}` : '';
    const sequenceSpan = answer.revealed ? '' : `<span class="sequence">${sequenceNumber}</span>`;

    return `
        <div class="cell answer-cell ${cellClass}">
            ${sequenceSpan}
            <span class="text">${answerText}</span>
            <span class="points">${pointsText}</span>
        </div>
    `;
}

// Render Host Interface
function renderHostView(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    const isQuestionRevealed = gameState.revealedQuestions.includes(gameState.currentQuestionIndex);
    const anyAnswerRevealed = currentQuestion.answers.some(answer => answer.revealed);
    const allAnswersRevealed = currentQuestion.answers.every(answer => answer.revealed);

    const isFirstQuestion = gameState.currentQuestionIndex === 0;
    const isLastQuestion = gameState.currentQuestionIndex === gameState.questions.length - 1;

    interfaces.host.innerHTML = `
        <div class="host-container">
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Question</h2>
                    <button class="btn primary" onclick="actions.revealQuestion()" ${isQuestionRevealed || !gameState.gameStarted ? 'disabled' : ''}>
                        ${isQuestionRevealed ? 'Revealed' : 'Reveal'}
                    </button>
                </div>
                <div class="content-box">
                    <p class="question-text">${currentQuestion.question}</p>
                    <div class="button-group">
                        <button class="btn secondary" onclick="actions.changeQuestion('prev')" ${!gameState.gameStarted || !isQuestionRevealed || isFirstQuestion ? 'disabled' : ''}>Previous</button>
                        <button class="btn secondary" onclick="actions.changeQuestion('next')" ${!gameState.gameStarted || !isQuestionRevealed || !allAnswersRevealed || isLastQuestion ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Answers</h2>
                    <button class="btn primary" onclick="actions.markWrongAnswer()" ${!isQuestionRevealed ? 'disabled' : ''}>
                        Mark Wrong (${gameState.wrongAnswers}/3)
                    </button>
                </div>
                <ul class="answer-list">
                    ${currentQuestion.answers.map((answer, index) => `
                        <li class="answer-item">
                            <span class="answer-text">${answer.answer}</span>
                            <span class="answer-points">${answer.points}</span>
                            <button class="btn ${answer.revealed ? 'disabled' : 'secondary'}" 
                                    onclick="actions.revealAnswer(${gameState.currentQuestionIndex}, ${index})" 
                                    ${answer.revealed || !isQuestionRevealed ? 'disabled' : ''}>
                                ${answer.revealed ? 'Revealed' : 'Reveal'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Controls</h2>
                    <button class="btn primary" onclick="actions.startGame()" ${gameState.gameStarted ? 'disabled' : ''}>
                        ${gameState.gameStarted ? 'Game Started' : 'Start Game'}
                    </button>
                </div>
                <div class="content-box">
                    <div class="team-controls">
                        ${[0, 1].map(teamIndex => `
                            <div class="team-control">
                                ${gameState.editingTeam === teamIndex ? `
                                    <div class="team-name-edit">
                                        <input type="text" class="input" value="${gameState.teamNames[teamIndex]}" id="team${teamIndex+1}-name-input" />
                                        <button class="btn secondary" onclick="actions.updateTeamName(${teamIndex}, document.getElementById('team${teamIndex+1}-name-input').value)">Save</button>
                                        <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Cancel</button>
                                    </div>
                                ` : `
                                    <div class="team-control-row">
                                        <span class="team-name">${gameState.teamNames[teamIndex]}</span>
                                        <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Edit</button>
                                        <input type="number" class="input short-input" id="team${teamIndex+1}-points" value="${gameState.teamScores[teamIndex]}" min="0" />
                                        <button class="btn secondary" onclick="actions.setManualPoints(${teamIndex})">Set</button>
                                        <button class="btn ${gameState.assignedPoints[teamIndex] || !anyAnswerRevealed ? 'disabled' : 'secondary'} assign-revealed-btn" 
                                                onclick="actions.assignRevealedPoints(${teamIndex})"
                                                ${gameState.assignedPoints[teamIndex] || !anyAnswerRevealed ? 'disabled' : ''}>
                                            ${gameState.assignedPoints[teamIndex] ? 'Assigned' : 'Assign Revealed'}
                                        </button>
                                    </div>
                                `}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Event handlers
function handleGameUpdate(updatedGameState) {
    Object.assign(gameState, updatedGameState);
    console.log('Game update received:', gameState);
    renderView(gameState);
}

// Action functions
const actions = {
    toggleEditTeamName: (teamIndex) => {
        gameState.editingTeam = gameState.editingTeam === teamIndex ? null : teamIndex;
        renderHostView(gameState);
    },
    updateTeamName: (teamIndex, newName) => {
        socket.emit('update-team-name', { teamIndex, newName });
        gameState.editingTeam = null;
        renderHostView(gameState);
    },
    assignRevealedPoints: (teamIndex) => {
        if (!gameState.questions) return console.error("Game state is not yet available.");
        const points = gameState.questions[gameState.currentQuestionIndex].answers.reduce((sum, answer) => 
            answer.revealed ? sum + answer.points : sum, 0);
        console.log(`Assigning ${points} points to Team ${teamIndex + 1}`);
        socket.emit('assign-revealed-points', { teamIndex, points });
    },
    setManualPoints: (teamIndex) => {
        const points = parseInt(document.getElementById(`team${teamIndex + 1}-points`).value);
        if (isNaN(points)) return console.error("Invalid points input.");
        socket.emit('set-manual-points', { teamIndex, points });
    },
    revealAnswer: (questionIndex, answerIndex) => {
        socket.emit('reveal-answer', { questionIndex, answerIndex });
        if (!gameState.assignedPoints[0] && !gameState.assignedPoints[1]) {
            sounds.correct.play();
        }
    },
    markWrongAnswer: () => {
        if (gameState.wrongAnswers < 3) {
            socket.emit('wrong-answer');
        }
        sounds.wrong.play();
    },
    changeQuestion: (direction) => socket.emit('change-question', { direction }),
    resetWrongAnswers: () => socket.emit('reset-wrong-answers'),
    startGame: () => socket.emit('start-game'),
    revealQuestion: () => socket.emit('reveal-question')
};

// Background animation
function setupBackgroundAnimation() {
    const body = document.body;
    if (interfaces.audience) {
        body.style.backgroundImage = `
            linear-gradient(
                0deg,
                var(--main-bg-color) 0%,
                var(--main-bg-color) 50%,
                var(--stripe-color-1) 50%,
                var(--stripe-color-1) 100%
            )
        `;
        body.style.backgroundSize = '100% 16px';
        let offset = 0;
        (function animate() {
            offset = (offset + 0.5) % 16;
            body.style.backgroundPosition = `0 ${offset}px`;
            requestAnimationFrame(animate);
        })();
    } else if (interfaces.host) {
        body.style.backgroundColor = 'var(--main-bg-color)';
        body.style.backgroundImage = 'none';
    }
}

document.addEventListener('DOMContentLoaded', setupBackgroundAnimation);

// Expose necessary functions to global scope
window.actions = actions;
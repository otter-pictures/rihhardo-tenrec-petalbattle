let gameState = {};  // Global variable to store the game state

const socket = io();

socket.on('connect', () => {
    console.log('Connected to the server with Socket.io');
});

// Handle game state updates from the server
socket.on('game-update', (updatedGameState) => {
    gameState = updatedGameState;  // Update the global game state
    console.log('Game update received:', gameState);

    // Render the game state for the host or audience
    if (hostInterface) {
        renderHostView(gameState);
    }
    if (audienceInterface) {
        renderAudienceView(gameState);
    }
});

// DOM elements for Host and Audience view
const hostInterface = document.getElementById('host-interface');
const audienceInterface = document.getElementById('audience-interface');

function renderAudienceView(gameState) {
    if (!gameState.gameStarted) {
        renderStartScreen(gameState);
    } else if (!gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
        renderEmptyBoard(gameState);
    } else {
        renderGameBoard(gameState);
    }
}

function renderStartScreen(gameState) {
    audienceInterface.innerHTML = `
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
    audienceInterface.innerHTML = `
        <div class="audience-container">
            <div class="question-header">
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

    audienceInterface.innerHTML = `
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

    hostInterface.innerHTML = `
        <div class="host-container">
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Question</h2>
                    <button class="btn primary" onclick="revealQuestion()" ${isQuestionRevealed ? 'disabled' : ''}>
                        ${isQuestionRevealed ? 'Revealed' : 'Reveal'}
                    </button>
                </div>
                <div class="content-box">
                    <p class="question-text">${currentQuestion.question}</p>
                    <div class="button-group">
                        <button class="btn secondary" onclick="prevQuestion()">Previous</button>
                        <button class="btn secondary" onclick="nextQuestion()">Next</button>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Answers</h2>
                    <button class="btn primary" onclick="markWrongAnswer()" ${gameState.wrongAnswers >= 3 ? 'disabled' : ''}>
                        Mark Wrong (${gameState.wrongAnswers}/3)
                    </button>
                </div>
                <ul class="answer-list">
                    ${currentQuestion.answers.map((answer, index) => `
                        <li class="answer-item">
                            <span class="answer-text">${answer.answer}</span>
                            <span class="answer-points">${answer.points}</span>
                            <button class="btn ${answer.revealed ? 'disabled' : 'secondary'}" 
                                    onclick="revealAnswer(${gameState.currentQuestionIndex}, ${index})" 
                                    ${answer.revealed ? 'disabled' : ''}>
                                ${answer.revealed ? 'Revealed' : 'Reveal'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Controls</h2>
                    <button class="btn primary" onclick="startGame()" ${gameState.gameStarted ? 'disabled' : ''}>
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
                                        <button class="btn secondary" onclick="updateTeamName(${teamIndex}, document.getElementById('team${teamIndex+1}-name-input').value)">Save</button>
                                        <button class="btn secondary" onclick="toggleEditTeamName(${teamIndex})">Cancel</button>
                                    </div>
                                ` : `
                                    <div class="team-control-row">
                                        <span class="team-name">${gameState.teamNames[teamIndex]}</span>
                                        <button class="btn secondary" onclick="toggleEditTeamName(${teamIndex})">Edit</button>
                                        <input type="number" class="input short-input" id="team${teamIndex+1}-points" value="${gameState.teamScores[teamIndex]}" min="0" />
                                        <button class="btn secondary" onclick="setManualPoints(${teamIndex})">Set</button>
                                        <button class="btn ${gameState.assignedPoints[teamIndex] ? 'disabled' : 'secondary'} assign-revealed-btn" 
                                                onclick="assignRevealedPoints(${teamIndex})"
                                                ${gameState.assignedPoints[teamIndex] ? 'disabled' : ''}>
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

// New function to toggle team name edit state
function toggleEditTeamName(teamIndex) {
    if (gameState.editingTeam === teamIndex) {
        gameState.editingTeam = null;
    } else {
        gameState.editingTeam = teamIndex;
    }
    renderHostView(gameState);
}

// Update the updateTeamName function
function updateTeamName(teamIndex, newName) {
    socket.emit('update-team-name', { teamIndex, newName });
    gameState.editingTeam = null;
    renderHostView(gameState);
}

// Function to assign revealed points
function assignRevealedPoints(teamIndex) {
    if (!gameState || !gameState.questions) {
        console.error("Game state is not yet available.");
        return;  // Exit if gameState is not available
    }

    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

    // Calculate the total points for revealed answers
    const points = currentQuestion.answers.reduce((sum, answer) => {
        return answer.revealed ? sum + answer.points : sum;
    }, 0);

    console.log(`Assigning ${points} points to Team ${teamIndex + 1}`);

    // Emit the event to assign revealed points to the team
    socket.emit('assign-revealed-points', { teamIndex, points });
}

// Emit event to manually set team points
function setManualPoints(teamIndex) {
    const points = parseInt(document.getElementById(`team${teamIndex + 1}-points`).value);
    if (isNaN(points)) {
        console.error("Invalid points input.");
        return;
    }

    // Emit the event to manually set points for the team
    socket.emit('set-manual-points', { teamIndex, points });
}

function revealAnswer(questionIndex, answerIndex) {
    socket.emit('reveal-answer', { questionIndex, answerIndex });
}

// Function to mark wrong answer, restricted to a max of 3 strikes
function markWrongAnswer() {
    if (gameState.wrongAnswers < 3) {
        socket.emit('wrong-answer');
    }
}

// Handle question navigation
function nextQuestion() {
    socket.emit('change-question', { direction: 'next' });
}

function prevQuestion() {
    socket.emit('change-question', { direction: 'prev' });
}

// Function to reset wrong answers
function resetWrongAnswers() {
    socket.emit('reset-wrong-answers');
}

// New function to start the game
function startGame() {
    socket.emit('start-game');
}

function revealQuestion() {
    socket.emit('reveal-question');
}
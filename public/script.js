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
            ${!gameState.gameStarted ? `
                <div class="section game-start-section">
                    <h2 class="section-title">Start Game</h2>
                    <div class="content-box">
                        <button class="btn primary" onclick="startGame()">Start Game</button>
                    </div>
                </div>
            ` : ''}
            
            <div class="section question-section">
                <h2 class="section-title">Current Question</h2>
                <div class="content-box">
                    <p class="question-text">${currentQuestion.question}</p>
                    <div class="button-group">
                        <button class="btn secondary" onclick="prevQuestion()">Previous</button>
                        <button class="btn primary" onclick="revealQuestion()" ${isQuestionRevealed ? 'disabled' : ''}>
                            ${isQuestionRevealed ? 'Question Revealed' : 'Reveal Question'}
                        </button>
                        <button class="btn secondary" onclick="nextQuestion()">Next</button>
                    </div>
                </div>
            </div>

            <div class="section answers-section">
                <h2 class="section-title">Answers</h2>
                <ul class="answer-list content-box">
                    ${currentQuestion.answers.map((answer, index) => `
                        <li class="answer-item">
                            <span class="answer-text">${answer.answer}</span>
                            <span class="answer-points">${answer.points}</span>
                            <button class="btn ${answer.revealed ? 'disabled' : 'primary'}" 
                                    onclick="revealAnswer(${gameState.currentQuestionIndex}, ${index})" 
                                    ${answer.revealed ? 'disabled' : ''}>
                                ${answer.revealed ? 'Revealed' : 'Reveal'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <div class="section team-controls">
                <h2 class="section-title">Team Controls</h2>
                <ul class="team-list content-box">
                    ${[0, 1].map(teamIndex => `
                        <li class="team-item">
                            <div class="team-name-edit">
                                <input type="text" class="input team-name-input" value="${gameState.teamNames[teamIndex]}" id="team${teamIndex+1}-name-input" />
                                <button class="btn secondary" onclick="updateTeamName(${teamIndex}, document.getElementById('team${teamIndex+1}-name-input').value)">Update</button>
                            </div>
                            <div class="team-points">
                                <input type="number" class="input points-input" id="team${teamIndex+1}-points" value="${gameState.teamScores[teamIndex]}" min="0" />
                                <button class="btn secondary" onclick="setManualPoints(${teamIndex})">Set Points</button>
                            </div>
                            <button class="btn ${gameState.assignedPoints[teamIndex] ? 'disabled' : 'primary'}" 
                                    onclick="assignRevealedPoints(${teamIndex})"
                                    ${gameState.assignedPoints[teamIndex] ? 'disabled' : ''}>
                                ${gameState.assignedPoints[teamIndex] ? 'Assigned' : 'Assign Revealed'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <div class="section game-controls">
                <h2 class="section-title">Game Controls</h2>
                <div class="content-box">
                    <div class="control-group">
                        <label class="control-label">Wrong Answers:</label>
                        <div class="button-group">
                            <button class="btn ${gameState.wrongAnswers >= 3 ? 'disabled' : 'primary'}" 
                                    onclick="markWrongAnswer()" ${gameState.wrongAnswers >= 3 ? 'disabled' : ''}>
                                Mark Wrong (${gameState.wrongAnswers}/3)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Emit event to update team names
function updateTeamName(teamIndex, newName) {
    socket.emit('update-team-name', { teamIndex, newName });
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
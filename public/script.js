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

    hostInterface.innerHTML = 
        `<h2>Current Question: ${currentQuestion.question}</h2>
        <ul>
            ${currentQuestion.answers.map((answer, index) => 
                `<li>${answer.answer} (${answer.points} points)
                <button onclick="revealAnswer(${gameState.currentQuestionIndex}, ${index})" 
                        ${answer.revealed ? 'disabled' : ''}>
                    ${answer.revealed ? 'Revealed' : 'Reveal'}
                </button>
                </li>`
            ).join('')}
        </ul>
        <div>
            <button onclick="prevQuestion()">Previous Question</button>
            <button onclick="nextQuestion()">Next Question</button>
        </div>
        <h3>Edit Team Names</h3>
        <div>
            <label>Team 1 Name: </label>
            <input type="text" value="${gameState.teamNames[0]}" onchange="updateTeamName(0, this.value)" />
        </div>
        <div>
            <label>Team 2 Name: </label>
            <input type="text" value="${gameState.teamNames[1]}" onchange="updateTeamName(1, this.value)" />
        </div>
        
        <h3>Assign Revealed Points</h3>
        <div>
            <button onclick="assignRevealedPoints(0)">Assign to ${gameState.teamNames[0]}</button>
            <button onclick="assignRevealedPoints(1)">Assign to ${gameState.teamNames[1]}</button>
        </div>

        <h3>Manual Point Adjustment</h3>
        <div>
            <label>Team 1 Points:</label>
            <input type="number" id="team1-points" value="${gameState.teamScores[0]}" min="0" />
            <button onclick="setManualPoints(0)">Set Points</button>
        </div>
        <div>
            <label>Team 2 Points:</label>
            <input type="number" id="team2-points" value="${gameState.teamScores[1]}" min="0" />
            <button onclick="setManualPoints(1)">Set Points</button>
        </div>

        <h3>Wrong Answers</h3>
        <button onclick="markWrongAnswer()" ${gameState.wrongAnswers >= 3 ? 'disabled' : ''}>
            Mark Wrong Answer (${gameState.wrongAnswers}/3)
        </button>
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
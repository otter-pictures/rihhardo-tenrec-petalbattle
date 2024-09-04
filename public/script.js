const socket = io();

// DOM elements for Host and Audience view
const hostInterface = document.getElementById('host-interface');
const audienceInterface = document.getElementById('audience-interface');

// Handle game state updates from the server
socket.on('game-update', (gameState) => {
    if (hostInterface) {
        renderHostView(gameState);
    }
    if (audienceInterface) {
        renderAudienceView(gameState);
    }
});

// Render Host Interface - Host can edit team names
function renderHostView(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    hostInterface.innerHTML = `
        <h2>Current Question: ${currentQuestion.question}</h2>
        <ul>
            ${currentQuestion.answers.map((answer, index) => `
                <li>${answer.answer} (${answer.points} points)
                <button onclick="revealAnswer(${gameState.currentQuestionIndex}, ${index})">
                    ${answer.revealed ? 'Revealed' : 'Reveal'}
                </button>
                </li>
            `).join('')}
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
        <h3>Assign Points</h3>
        <button onclick="assignPoints(0)">Assign to ${gameState.teamNames[0]}</button>
        <button onclick="assignPoints(1)">Assign to ${gameState.teamNames[1]}</button>
        <h3>Wrong Answers</h3>
        <button onclick="incrementWrongAnswer(0)">${gameState.teamNames[0]} Wrong Answer</button>
        <button onclick="incrementWrongAnswer(1)">${gameState.teamNames[1]} Wrong Answer</button>
    `;
}

// Emit Socket event to update team names
function updateTeamName(teamIndex, newName) {
    socket.emit('update-team-name', { teamIndex, newName });
}

function renderAudienceView(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

    // Calculate the total points for revealed answers
    const totalRevealedPoints = currentQuestion.answers.reduce((sum, answer) => {
        return answer.revealed ? sum + answer.points : sum;
    }, 0);

    audienceInterface.innerHTML = `
        <h2>Current Question: ${currentQuestion.question}</h2>
        <h3>Total Points on the Board: ${totalRevealedPoints}</h3>
        <ul>
            ${currentQuestion.answers.map((answer) => `
                <li>${answer.revealed ? `${answer.answer} (${answer.points} points)` : '???'}</li>
            `).join('')}
        </ul>
        <h3>Team Scores</h3>
        <p>${gameState.teamNames[0]}: ${gameState.teamScores[0]}</p>
        <p>${gameState.teamNames[1]}: ${gameState.teamScores[1]}</p>
        <h3>Wrong Answers</h3>
        <p>${gameState.teamNames[0]}: ${gameState.wrongAnswers[0]}</p>
        <p>${gameState.teamNames[1]}: ${gameState.wrongAnswers[1]}</p>
    `;
}

// Emit Socket events for Host actions
function revealAnswer(questionIndex, answerIndex) {
    socket.emit('reveal-answer', { questionIndex, answerIndex });
}

function assignPoints(teamIndex) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    const points = currentQuestion.answers.reduce((sum, answer) => answer.revealed ? sum + answer.points : sum, 0);
    socket.emit('assign-points', { teamIndex, points });
}

function incrementWrongAnswer(teamIndex) {
    socket.emit('wrong-answer', { teamIndex });
}

// Handle question navigation
function nextQuestion() {
    socket.emit('change-question', { direction: 'next' });
}

function prevQuestion() {
    socket.emit('change-question', { direction: 'prev' });
}
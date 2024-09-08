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
    const { gameStarted, revealedQuestions, currentQuestionIndex, gameEnded } = gameState;
    let renderFunction;
    
    if (!gameStarted) {
        renderFunction = renderStartScreen;
    } else if (gameEnded) {
        renderFunction = renderGameOverScreen;
    } else if (!revealedQuestions.includes(currentQuestionIndex)) {
        renderFunction = renderEmptyBoard;
    } else {
        renderFunction = renderGameBoard;
    }
    
    interfaces.audience.innerHTML = renderFunction(gameState);
}

// Helper functions for rendering audience view
function renderStartScreen(gameState) {
    return `
        <div class="start-screen">
            <div class="presenter">Rihhardo-Tenrec Tulbilahing™ esitleb:</div>
            <div class="ellipse-container">
                <img src="/images/title_@3x.png" alt="Rooside sõda" class="title-image" style="max-width: 80%; height: auto;">
                <!-- <div class="ellipse-container">
                    <img src="/images/ellipse.svg" alt="Ellipse background" class="ellipse-svg">
                    <div class="title-container">
                        <div class="title-primary" data-text="Rooside">Rooside</div>
                        <div class="title-primary" data-text="sõda">sõda</div>
                    </div>
                </div> -->
            </div>
            <div class="copyright">©2024</div>
        </div>
    `;
}

function renderEmptyBoard(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    return `
        <div class="audience-container">
            <div class="question-header hidden">
                ${currentQuestion.question}
            </div>
            <div class="gameboard">
                ${renderEmptyRows()}
                <div class="small-gap"></div>               
                ${renderTeamNamesAndScores(gameState)}
            </div>
        </div>`;
}

function renderEmptyRows() {
    return Array(4).fill().map(() => `
        <div class="row">
            ${renderEmptyCell()}
            ${renderEmptyCell()}
        </div>
    `).join('');
}

function renderEmptyCell() {
    return `<div class="cell answer-cell empty"></div>`;
}

function renderGameBoard(gameState) {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

    return `
        <div class="audience-container">
            <div class="question-header">
                ${currentQuestion.question}
            </div>
            <div class="gameboard">
                ${renderAnswerRows(currentQuestion)}
                <div class="small-gap"></div>               
                ${renderTeamNamesAndScores(gameState)}
            </div>
        </div>`;
}

function renderAnswerRows(currentQuestion) {
    return Array(4).fill().map((_, rowIndex) => `
        <div class="row">
            ${renderAnswerCell(currentQuestion.answers[rowIndex], rowIndex + 1)}
            ${renderAnswerCell(currentQuestion.answers[rowIndex + 4], rowIndex + 5)}
        </div>
    `).join('');
}

function renderAnswerCell(answer, sequenceNumber) {
    if (!answer) {
        return `<div class="cell answer-cell empty"></div>`;
    }

    const cellClass = answer.revealed ? "revealed" : "unrevealed";
    const answerText = answer.revealed ? answer.answer : '';
    const pointsText = answer.revealed ? `${answer.points}` : '';
    const sequenceSpan = answer.revealed ? '' : `<span class="sequence">${sequenceNumber}</span>`;

    return `
        <div class="cell answer-cell ${cellClass} ${answer.justRevealed ? 'animate-reveal' : ''}">
            ${sequenceSpan}
            <span class="text">${answerText}</span>
            <span class="points">${pointsText}</span>
        </div>
    `;
}

function renderTeamNamesAndScores(gameState) {
    return `
        <div class="row team-names">
            <div class="cell team-name-left">${gameState.teamNames[0]}</div>
            <div class="cell team-name-right">${gameState.teamNames[1]}</div>
        </div>
        <div class="row scores-strikes">
            <div class="cell team-score-left">${gameState.teamScores[0]}</div>
            <div class="strikes">
                ${renderStrikes(gameState.wrongAnswers)}
            </div>
            <div class="cell team-score-right">${gameState.teamScores[1]}</div>
        </div>
    `;
}

function renderStrikes(wrongAnswers) {
    return Array(3).fill().map((_, index) => `
        <div class="strike">${wrongAnswers > index ? '❌' : ''}</div>
    `).join('');
}

function renderGameOverScreen(gameState) {
    const winner = gameState.teamScores[0] > gameState.teamScores[1] ? 0 : 1;
    return `
        <div class="start-screen">
            <div class="presenter">Võitja on:</div>
            <div class="logo-card">
                <div class="ellipse-container">
                    <img src="/images/ellipse.svg" alt="Ellipse background" class="ellipse-svg">
                    <div class="title-container">
                        <div class="title-primary">${gameState.teamNames[winner]}!</div>
                    </div>
                </div>
            </div>
            <div class="copyright">${gameState.teamNames[0]}: ${gameState.teamScores[0]}</div>
            <div class="copyright">${gameState.teamNames[1]}: ${gameState.teamScores[1]}</div>
        </div>
    `;
}

// Render Host Interface
function renderHostView(gameState) {
    const { currentQuestionIndex, questions, gameStarted, revealedQuestions, wrongAnswers, teamNames, assignedPoints, gameEnded } = gameState;
    const currentQuestion = questions[currentQuestionIndex];
    const isQuestionRevealed = revealedQuestions.includes(currentQuestionIndex);
    const anyAnswerRevealed = currentQuestion.answers.some(answer => answer.revealed);
    const allAnswersRevealed = currentQuestion.answers.every(answer => answer.revealed);
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    interfaces.host.innerHTML = `
        <div class="host-container">
            ${renderQuestionSection(currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded)}
            ${renderAnswersSection(currentQuestion, isQuestionRevealed, wrongAnswers, currentQuestionIndex, gameEnded)}
            ${renderControlsSection(gameStarted, teamNames, assignedPoints, anyAnswerRevealed, gameEnded)}
        </div>
    `;
}

// Helper functions for renderHostView
function renderQuestionSection(currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded) {
    if (gameEnded) {
        return `
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Game Over</h2>
                    <button class="btn primary" onclick="actions.revealQuestion()" disabled>
                        ${isQuestionRevealed ? 'Revealed' : 'Reveal'}
                    </button>
                </div>
                <div class="content-box">
                    <p class="question-text">${currentQuestion.question}</p>
                    <div class="button-group">
                        <button class="btn secondary" onclick="actions.changeQuestion('prev')" ${isFirstQuestion ? 'disabled' : ''}>Previous</button>
                        <button class="btn secondary" onclick="actions.changeQuestion('next')" ${isLastQuestion ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">Question</h2>
                <button class="btn primary" onclick="actions.revealQuestion()" ${isQuestionRevealed || !gameStarted ? 'disabled' : ''}>
                    ${isQuestionRevealed ? 'Revealed' : 'Reveal'}
                </button>
            </div>
            <div class="content-box">
                <p class="question-text">${currentQuestion.question}</p>
                <div class="button-group">
                    <button class="btn secondary" onclick="actions.changeQuestion('prev')" ${!gameStarted || !isQuestionRevealed || isFirstQuestion ? 'disabled' : ''}>Previous</button>
                    <button class="btn secondary" onclick="actions.changeQuestion('next')" ${!gameStarted || !isQuestionRevealed || !allAnswersRevealed || isLastQuestion ? 'disabled' : ''}>Next</button>
                    <button class="btn primary" onclick="actions.endGame()" ${!isLastQuestion || !allAnswersRevealed ? 'disabled' : ''}>End Game</button>
                </div>
            </div>
        </div>
    `;
}

function renderAnswersSection(currentQuestion, isQuestionRevealed, wrongAnswers, currentQuestionIndex, gameEnded) {
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">Answers</h2>
                <button class="btn primary" onclick="actions.markWrongAnswer()" ${!isQuestionRevealed || gameEnded ? 'disabled' : ''}>
                    Mark Wrong (${wrongAnswers}/3)
                </button>
            </div>
            <ul class="answer-list">
                ${currentQuestion.answers.map((answer, index) => `
                    <li class="answer-item">
                        <span class="answer-text">${answer.answer}</span>
                        <span class="answer-points">${answer.points}</span>
                        <button class="btn ${answer.revealed ? 'disabled' : 'secondary'}" 
                                onclick="actions.revealAnswer(${currentQuestionIndex}, ${index})" 
                                ${answer.revealed || !isQuestionRevealed || gameEnded ? 'disabled' : ''}>
                            ${answer.revealed ? 'Revealed' : 'Reveal'}
                        </button>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function renderControlsSection(gameStarted, teamNames, assignedPoints, anyAnswerRevealed, gameEnded) {
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">Controls</h2>
                <button class="btn primary" onclick="actions.startGame()" ${gameStarted ? 'disabled' : ''}>
                    ${gameStarted ? 'Game Started' : 'Start Game'}
                </button>
            </div>
            <div class="content-box">
                <div class="team-controls">
                    ${[0, 1].map(teamIndex => renderTeamControl(teamIndex, teamNames[teamIndex], assignedPoints[teamIndex], anyAnswerRevealed, gameEnded)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderTeamControl(teamIndex, teamName, assignedPoints, anyAnswerRevealed, gameEnded) {
    return `
        <div class="team-control">
            ${gameState.editingTeam === teamIndex ? renderTeamNameEdit(teamIndex, teamName) : renderTeamControlRow(teamIndex, teamName, assignedPoints, anyAnswerRevealed, gameEnded)}
        </div>
    `;
}

function renderTeamNameEdit(teamIndex, teamName) {
    return `
        <div class="team-name-edit">
            <input type="text" class="input" value="${teamName}" id="team${teamIndex+1}-name-input" />
            <button class="btn secondary" onclick="actions.updateTeamName(${teamIndex}, document.getElementById('team${teamIndex+1}-name-input').value)">Save</button>
            <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Cancel</button>
        </div>
    `;
}

function renderTeamControlRow(teamIndex, teamName, assignedPoints, anyAnswerRevealed, gameEnded) {
    return `
        <div class="team-control-row">
            <span class="team-name">${teamName}</span>
            <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Edit</button>
            <input type="number" class="input short-input" id="team${teamIndex+1}-points" value="${gameState.teamScores[teamIndex]}" min="0" />
            <button class="btn secondary" onclick="actions.setManualPoints(${teamIndex})">Set</button>
            <button class="btn ${assignedPoints || !anyAnswerRevealed || gameEnded ? 'disabled' : 'secondary'} assign-revealed-btn" 
                    onclick="actions.assignRevealedPoints(${teamIndex})"
                    ${assignedPoints || !anyAnswerRevealed || gameEnded ? 'disabled' : ''}>
                ${assignedPoints ? 'Assigned' : 'Assign Revealed'}
            </button>
        </div>
    `;
}

function handleGameUpdate(updatedGameState) {
    if (gameState.questions && updatedGameState.questions) {
        updatedGameState.questions.forEach((question, qIndex) => {
            question.answers.forEach((answer, aIndex) => {
                if (answer.revealed && (!gameState.questions[qIndex] || !gameState.questions[qIndex].answers[aIndex].revealed)) {
                    answer.justRevealed = true;
                    setTimeout(() => {
                        delete updatedGameState
                        .questions[qIndex].answers[aIndex].justRevealed;
                        renderView(updatedGameState);
                    }, 300);
                }
            });
        });
    }

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
    changeQuestion: (direction) => {
        socket.emit('change-question', { direction });
        // Force update the audience view
        socket.emit('force-update-audience');
    },
    resetWrongAnswers: () => socket.emit('reset-wrong-answers'),
    startGame: () => socket.emit('start-game'),
    revealQuestion: () => socket.emit('reveal-question'),
    endGame: () => {
        socket.emit('end-game');
    },
};

function setupBackgroundAnimation() {
    const body = document.body;
    if (interfaces.audience) {
        body.style.backgroundImage = `
            url("/images/stripe.png"),
            url("/images/noise.png"),
            url("/images/vignette.png")
        `;
        body.style.backgroundRepeat = 'repeat, repeat, no-repeat';
        body.style.backgroundSize = '1px 16px, auto, 110% 110%';
        body.style.backgroundPosition = '0 0, 0 0, center center';
        body.style.backgroundBlendMode = 'normal, overlay, normal';
        let offset = 0;
        (function animate() {
            offset = (offset + 0.25) % 16;
            body.style.backgroundPosition = `0 ${offset}px, 0 0, center center`;
            requestAnimationFrame(animate);
        })();
    } else if (interfaces.host) {
        body.style.backgroundColor = 'var(--main-bg-color)';
    }
}

document.addEventListener('DOMContentLoaded', setupBackgroundAnimation);

window.actions = actions;

// Simplify the renderQuestion function
function renderQuestion(question) {
    const questionHeader = document.querySelector('.question-header');
    if (questionHeader) {
        questionHeader.textContent = question;
    }
}

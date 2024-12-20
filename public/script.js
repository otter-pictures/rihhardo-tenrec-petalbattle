const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

const gameState = {
    audioPermissionGranted: false,
    lastUpdateTime: null,
    isReconnecting: false,
    editingTeam: null
};

const sounds = {
    wrong: Array.from({length: 10}, (_, i) => new Audio(`/sounds/wrong-${i+1}.mp3`)),
    correct: new Audio('/sounds/correct.mp3')
};

const interfaces = {
    host: document.getElementById('host-interface'),
    audience: document.getElementById('audience-interface')
};

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to the server with Socket.io');
    if (gameState.lastUpdateTime) {
        console.log('Requesting state after reconnection');
        socket.emit('request-state', gameState.lastUpdateTime);
    }
});

socket.on('game-update', (updatedState) => {
    gameState.lastUpdateTime = updatedState.lastUpdateTime;
    handleGameUpdate(updatedState);
    
    // Save state to localStorage for persistence
    try {
        localStorage.setItem('gameLastUpdateTime', gameState.lastUpdateTime);
    } catch (error) {
        console.error('Error saving state to localStorage:', error);
    }
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    gameState.isReconnecting = true;
    updateConnectionStatus('Disconnected - attempting to reconnect...');
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
    updateConnectionStatus(`Reconnecting... (attempt ${attemptNumber})`);
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
    gameState.isReconnecting = false;
    updateConnectionStatus('Connected');
});

socket.on('reconnect_failed', () => {
    console.log('Failed to reconnect');
    gameState.isReconnecting = false;
    updateConnectionStatus('Connection failed - please refresh the page');
});

socket.on('play-sound', (soundType) => {
    if (interfaces.audience) {
        if (soundType === 'correct') {
            sounds.correct.play();
        } else if (soundType === 'wrong') {
            const randomIndex = Math.floor(Math.random() * sounds.wrong.length);
            sounds.wrong[randomIndex].play();
        }
    }
});

socket.on('error', (error) => {
    console.error('Server error:', error.message);
    alert('An error occurred. Please try again.');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Failed to connect to the server. Please check your internet connection and try again.');
});

// Main render functions
function renderView(gameState) {
    if (interfaces.host) renderHostView(gameState);
    if (interfaces.audience) renderAudienceView(gameState);
}

// Add this function near the top of the file
function setupAudioPermission() {
    if (interfaces.audience) {
        const permissionButton = document.querySelector('.audio-permission-btn');
        if (permissionButton) {
            permissionButton.onclick = () => {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                audioContext.resume().then(() => {
                    return sounds.correct.play();
                }).then(() => {
                    console.log('Audio permission granted');
                    gameState.audioPermissionGranted = true;
                    permissionButton.style.display = 'none';
                }).catch(error => {
                    console.error('Audio permission denied:', error);
                    alert('Failed to enable audio. Please check your browser settings and try again.');
                });
            };
        }
    }
}

// Modify the renderAudienceView function
function renderAudienceView(gameState) {
    const { gameStarted, revealedQuestions, currentQuestionIndex, gameEnded, audioPermissionGranted } = gameState;
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
    
    interfaces.audience.innerHTML = `
        ${!audioPermissionGranted ? '<button class="btn secondary audio-permission-btn">Enable sound</button>' : ''}
        ${renderFunction(gameState)}
    `;
    
    setupAudioPermission();
}

// Helper functions for rendering audience view
function renderStartScreen(gameState) {
    return `
        <div class="start-screen">
            <div class="title-secondary">Rihhardo-Tenrec Ossborne Tulbilahing™ presents:</div>
            <div class="presentation">
                <img src="/images/title_@3x.png" alt="Family Feud" class="title-image pop-animation" style="height: auto; max-height: 64vh; width: auto; max-width: 100%;">
            </div>
            <div class="title-secondary">2024 • Kratt & Näkk productions</div>
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
    const isDraw = gameState.teamScores[0] === gameState.teamScores[1];
    const winner = isDraw ? -1 : (gameState.teamScores[0] > gameState.teamScores[1] ? 0 : 1);
    
    return `
        <div class="start-screen">
            <div class="title-secondary">${isDraw ? 'Viik!' : 'Võitja on:'}</div>
            <div class="presentation">
                <div class="title-primary pop-animation">
                    ${isDraw ? "Viik!" : `${gameState.teamNames[winner]}!`}
                </div>
            </div>
            <div class="scores-container">
                <div class="title-secondary">${gameState.teamNames[0]} - ${gameState.teamScores[0]}</div>
                <div class="title-secondary">${gameState.teamNames[1]} - ${gameState.teamScores[1]}</div>
            </div>
        </div>
    `;
}

// Render Host Interface
function renderHostView(gameState) {
    const { currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded, finishedEarly } = getGameState(gameState);
    
    interfaces.host.innerHTML = `
        <div class="host-container">
            ${renderQuestionSection(currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded, finishedEarly)}
            ${renderAnswersSection(currentQuestion, isQuestionRevealed, gameState.wrongAnswers, gameState.currentQuestionIndex, gameEnded)}
            ${renderControlsSection(gameStarted, gameState.teamNames, gameState.assignedPoints, anyAnswerRevealed(currentQuestion), gameEnded)}
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Administration</h2>
                </div>
                <div class="content-box">
                    <div class="button-group">
                        <button class="btn danger" onclick="actions.resetGame()">
                            <i class="fas fa-redo"></i>
                            <span>Reset Game</span>
                        </button>
                        <div class="file-upload">
                            <label for="questions-upload" class="btn secondary">
                                <i class="fas fa-file-upload"></i>
                                <span>Upload Questions</span>
                            </label>
                            <input type="file" id="questions-upload" accept=".csv" style="display: none" onchange="actions.uploadQuestions(event)">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper functions for renderHostView
function renderQuestionSection(currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded, finishedEarly) {
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
                        ${finishedEarly ? '<button class="btn primary" onclick="actions.resumeGame()">Resume Game</button>' : ''}
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
                    <button class="btn primary" onclick="actions.endGame()" ${!isLastQuestion || !allAnswersRevealed ? 'disabled' : ''}>End game</button>
                    <button class="btn danger" onclick="actions.finishGameEarly()">Finish game early</button>
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
                    Strike (${wrongAnswers}/3)
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
                    ${gameStarted ? 'Game started' : 'Start game'}
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
            ${gameState.editingTeam === teamIndex ? renderTeamNameEdit(teamIndex, teamName) : renderTeamControlContent(teamIndex, teamName, assignedPoints, anyAnswerRevealed, gameEnded)}
        </div>
    `;
}

function renderTeamNameEdit(teamIndex, teamName) {
    return `
        <div class="team-name-edit">
            <input type="text" class="input" value="${teamName}" id="team${teamIndex+1}-name-input" />
            <button class="btn primary" onclick="actions.updateTeamName(${teamIndex}, document.getElementById('team${teamIndex+1}-name-input').value)">Save</button>
            <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Cancel</button>
        </div>
    `;
}

function renderTeamControlContent(teamIndex, teamName, assignedPoints, anyAnswerRevealed, gameEnded) {
    return `
        <span class="team-name">${teamName}</span>
        <button class="btn secondary" onclick="actions.toggleEditTeamName(${teamIndex})">Edit name</button>
        <input type="number" class="input short-input" id="team${teamIndex+1}-points" value="${gameState.teamScores[teamIndex]}" min="0" />
        <button class="btn secondary" onclick="actions.setManualPoints(${teamIndex})">Set</button>
        <button class="btn ${assignedPoints || !anyAnswerRevealed || gameEnded ? 'disabled' : 'primary'} assign-revealed-btn" 
                onclick="actions.assignRevealedPoints(${teamIndex})"
                ${assignedPoints || !anyAnswerRevealed || gameEnded ? 'disabled' : ''}>
            ${assignedPoints ? 'Assigned' : 'Assign revealed'}
        </button>
    `;
}

function handleGameUpdate(updatedGameState) {
    // Preserve the audio permission state
    updatedGameState.audioPermissionGranted = gameState.audioPermissionGranted;

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
        if (typeof newName !== 'string' || newName.trim().length === 0) {
            alert('Please enter a valid team name');
            return;
        }
        socket.emit('update-team-name', { teamIndex, newName: newName.trim() });
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
            socket.emit('play-sound', 'correct');
        }
    },
    markWrongAnswer: () => {
        if (gameState.wrongAnswers < 3) {
            socket.emit('wrong-answer');
        }
        socket.emit('play-sound', 'wrong');
    },
    changeQuestion: (direction) => {
        socket.emit('change-question', { direction });
        socket.emit('force-update-audience');
    },
    resetWrongAnswers: () => socket.emit('reset-wrong-answers'),
    startGame: () => socket.emit('start-game'),
    revealQuestion: () => socket.emit('reveal-question'),
    endGame: () => {
        socket.emit('end-game');
    },
    finishGameEarly: () => {
        if (confirm('Are you sure you want to finish the game early?')) {
            socket.emit('finish-game-early');
        }
    },
    resumeGame: () => {
        if (confirm('Are you sure you want to resume the game?')) {
            socket.emit('resume-game');
        }
    },
    resetGame() {
        if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
            socket.emit('reset-game');
        }
    },

    async uploadQuestions(event) {
        const fileInput = event.target;
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Please select a file');
            return;
        }

        if (!file.name.endsWith('.csv')) {
            alert('Please upload a CSV file');
            fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('questions', file);

        try {
            const response = await fetch('/upload-questions', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to upload questions');
            }

            alert('Questions uploaded successfully!');
            fileInput.value = '';
        } catch (error) {
            console.error('Error uploading questions:', error);
            alert(error.message);
        }
    }
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
        body.style.backgroundSize = '2px 32px, auto, 110% 110%';
        body.style.backgroundPosition = '0 0, 0 0, center center';
        body.style.backgroundBlendMode = 'normal, overlay, normal';
        let offset = 0;
        // (function animate() {
        //     offset = (offset + 0.25) % 16;
        //     body.style.backgroundPosition = `0 ${offset}px, 0 0, center center`;
        //     requestAnimationFrame(animate);
        // })();
    } else if (interfaces.host) {
        body.style.backgroundColor = 'var(--main-bg-color)';
    }
}

function updateConnectionStatus(message) {
    let statusEl = document.getElementById('connection-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'connection-status';
        statusEl.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    statusEl.style.opacity = message === 'Connected' ? '0' : '1';
}

// Load saved state on page load
document.addEventListener('DOMContentLoaded', () => {
    setupBackgroundAnimation();
    setupAudioPermission();
    
    try {
        const savedUpdateTime = localStorage.getItem('gameLastUpdateTime');
        if (savedUpdateTime) {
            gameState.lastUpdateTime = parseInt(savedUpdateTime);
        }
    } catch (error) {
        console.error('Error loading saved state:', error);
    }
});

window.actions = actions;

function renderQuestion(question) {
    const questionHeader = document.querySelector('.question-header');
    if (questionHeader) {
        questionHeader.textContent = question;
    }
}

function getGameState(gameState) {
    const { currentQuestionIndex, questions, gameStarted, revealedQuestions, wrongAnswers, teamNames, assignedPoints, gameEnded, finishedEarly } = gameState;
    const currentQuestion = questions[currentQuestionIndex];
    const isQuestionRevealed = revealedQuestions.includes(currentQuestionIndex);
    const anyAnswerRevealed = currentQuestion.answers.some(answer => answer.revealed);
    const allAnswersRevealed = currentQuestion.answers.every(answer => answer.revealed);
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return { currentQuestion, isQuestionRevealed, gameStarted, isFirstQuestion, isLastQuestion, allAnswersRevealed, gameEnded, finishedEarly };
}

function anyAnswerRevealed(currentQuestion) {
    return currentQuestion.answers.some(answer => answer.revealed);
}

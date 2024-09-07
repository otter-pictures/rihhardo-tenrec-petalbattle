const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Game state
let gameState = {
    currentQuestionIndex: 0,
    questions: [],
    teamScores: [0, 0],
    wrongAnswers: 0, 
    teamNames: ['-', '-'],
    assignedPoints: [false, false],
    gameStarted: false,  // New property to track if the game has started
    questionRevealed: false,  // New property to track if the question is revealed
    revealedQuestions: [],  // New array to track which questions have been revealed
    gameEnded: false,  // New property to track if the game has ended
};

// Refactor the loadQuestions function to use async/await
const loadQuestions = async () => {
    const questions = {};
    return new Promise((resolve, reject) => {
        fs.createReadStream('questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (!questions[row.question]) {
                    questions[row.question] = [];
                }
                questions[row.question].push({ answer: row.answer, points: parseInt(row.points), revealed: false });
            })
            .on('end', () => resolve(questions))
            .on('error', (error) => reject(error));
    });
};

// Use async/await for initializing questions
(async () => {
    try {
        const data = await loadQuestions();
        gameState.questions = Object.keys(data).map((key) => ({
            question: key,
            answers: data[key]
        }));
        console.log("Questions loaded", gameState.questions);
    } catch (error) {
        console.error("Error loading questions:", error);
    }
})();

// Serve static frontend files from the "public" folder
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('New client connected with ID:', socket.id);
    
    // Send the initial game state to the newly connected client
    socket.emit('game-update', gameState);

    // Host updates team names
    socket.on('update-team-name', (data) => {
        const { teamIndex, newName } = data;
        gameState.teamNames[teamIndex] = newName;  // Update the team name
        io.emit('game-update', gameState);  // Broadcast the updated game state to all clients
    });

    // Refactor the reveal-answer event handler
    socket.on('reveal-answer', ({ questionIndex, answerIndex }) => {
        if (gameState.gameStarted && gameState.revealedQuestions.includes(questionIndex)) {
            gameState.questions[questionIndex].answers[answerIndex].revealed = true;
            io.emit('game-update', gameState);
        }
    });

    // Refactor the assign-revealed-points event handler
    socket.on('assign-revealed-points', ({ teamIndex }) => {
        const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        const canAssignPoints = gameState.gameStarted && 
            gameState.revealedQuestions.includes(gameState.currentQuestionIndex) &&
            currentQuestion.answers.some(answer => answer.revealed) &&
            !gameState.assignedPoints[teamIndex];

        if (canAssignPoints) {
            const points = currentQuestion.answers.reduce((sum, answer) => 
                answer.revealed ? sum + answer.points : sum, 0);

            gameState.teamScores[teamIndex] += points;
            gameState.assignedPoints[teamIndex] = true;

            console.log(`Assigned ${points} points to Team ${teamIndex + 1}`);
            io.emit('game-update', gameState);
        } else {
            console.log(`Unable to assign points to Team ${teamIndex + 1}.`);
        }
    });

    // Host sets manual points for a team
    socket.on('set-manual-points', (data) => {
        const { teamIndex, points } = data;

        // Directly set the team's score
        gameState.teamScores[teamIndex] = points;
        console.log(`Manually set Team ${teamIndex + 1} score to ${points}`);

        // Emit the updated game state to all clients
        io.emit('game-update', gameState);
    });

    // Track wrong answers
    socket.on('wrong-answer', () => {
        gameState.wrongAnswers += 1;  // Increment global strikes

        // Check if the strikes hit the limit (3 wrong answers)
        if (gameState.wrongAnswers >= 3) {
            io.emit('strike-limit-reached', { message: '3 wrong answers reached!' });
        }

        io.emit('game-update', gameState);
    });

    // New event handler for starting the game
    socket.on('start-game', () => {
        gameState.gameStarted = true;
        gameState.questionRevealed = false;
        io.emit('game-update', gameState);
    });

    // New event handler for revealing the question
    socket.on('reveal-question', () => {
        if (gameState.gameStarted && !gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
            gameState.revealedQuestions.push(gameState.currentQuestionIndex);
            gameState.questionRevealed = true;
            io.emit('game-update', gameState);
        }
    });

    // Refactor the change-question event handler
    socket.on('change-question', ({ direction }) => {
        if (gameState.gameStarted && gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
            if (direction === 'next' && gameState.currentQuestionIndex < gameState.questions.length - 1) {
                gameState.currentQuestionIndex++;
            } else if (direction === 'prev' && gameState.currentQuestionIndex > 0) {
                gameState.currentQuestionIndex--;
            }

            gameState.wrongAnswers = 0;
            gameState.assignedPoints = [false, false];
            gameState.questionRevealed = gameState.revealedQuestions.includes(gameState.currentQuestionIndex);

            io.emit('game-update', gameState);
        } else {
            console.log('Cannot change question: game not started or current question not revealed');
        }
    });

    // New event handler for ending the game
    socket.on('end-game', () => {
        if (gameState.gameStarted && gameState.currentQuestionIndex === gameState.questions.length - 1) {
            gameState.gameEnded = true;
            io.emit('game-update', gameState);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server on port 4000
server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

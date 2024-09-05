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
    wrongAnswers: 0,  // Global strike count
    teamNames: ['Team 1', 'Team 2']  // Default team names
};

// Track which team was assigned points for the current question
let assignedTeam = null;

// Load questions from CSV
const loadQuestions = () => {
    return new Promise((resolve, reject) => {
        let questions = {};
        fs.createReadStream('questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (!questions[row.question]) {
                    questions[row.question] = [];
                }
                questions[row.question].push({ answer: row.answer, points: parseInt(row.points), revealed: false });
            })
            .on('end', () => {
                resolve(questions);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

// Initialize questions on server startup
loadQuestions().then((data) => {
    gameState.questions = Object.keys(data).map((key) => ({
        question: key,
        answers: data[key]
    }));
    console.log("Questions loaded", gameState.questions);
});

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

    // Host reveals an answer
    socket.on('reveal-answer', (data) => {
        const { questionIndex, answerIndex } = data;
        gameState.questions[questionIndex].answers[answerIndex].revealed = true;
        io.emit('game-update', gameState);
    });

    // Host assigns revealed points to a team
    socket.on('assign-revealed-points', (data) => {
        const { teamIndex, points } = data;

        // If points have already been assigned to the opposite team, deduct from them
        if (assignedTeam !== null && assignedTeam !== teamIndex) {
            gameState.teamScores[assignedTeam] -= points;
            console.log(`Deducted ${points} points from Team ${assignedTeam + 1}`);
        }

        // Assign points to the selected team
        gameState.teamScores[teamIndex] += points;
        console.log(`Assigned ${points} points to Team ${teamIndex + 1}`);

        // Update the assigned team for the current question
        assignedTeam = teamIndex;

        // Emit the updated game state to all clients
        io.emit('game-update', gameState);
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

    // Handle changing questions
    socket.on('change-question', (data) => {
        const { direction } = data;
        if (direction === 'next' && gameState.currentQuestionIndex < gameState.questions.length - 1) {
            gameState.currentQuestionIndex += 1;
        } else if (direction === 'prev' && gameState.currentQuestionIndex > 0) {
            gameState.currentQuestionIndex -= 1;
        }

        // Reset wrong answers (strikes) for the new question
        gameState.wrongAnswers = 0;  

        io.emit('game-update', gameState);  // Broadcast updated state
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server on port 4000
server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

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
    revealedAnswers: [],
    teamScores: [0, 0],
    wrongAnswers: [0, 0]
};

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
    console.log('New client connected');
    socket.emit('game-update', gameState);

    // Host reveals an answer
    socket.on('reveal-answer', (data) => {
        const { questionIndex, answerIndex } = data;
        gameState.questions[questionIndex].answers[answerIndex].revealed = true;
        io.emit('game-update', gameState);
    });

    // Host assigns points to a team
    socket.on('assign-points', (data) => {
        const { teamIndex, points } = data;
        gameState.teamScores[teamIndex] += points;  // Update the team score
        io.emit('game-update', gameState);  // Broadcast the updated game state to all clients
    });

    // Track wrong answers
    socket.on('wrong-answer', (data) => {
        const { teamIndex } = data;
        gameState.wrongAnswers[teamIndex] += 1;
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
        io.emit('game-update', gameState); // Broadcast updated state
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server on port 4000
server.listen(4000, () => {
    console.log('Server is running on port 4000');
});
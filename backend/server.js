const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let gameState = {
    currentQuestionIndex: 0,
    questions: [],
    teamScores: [0, 0],
    wrongAnswers: 0, 
    teamNames: ['-', '-'],
    assignedPoints: [false, false],
    gameStarted: false,
    questionRevealed: false,
    revealedQuestions: [],
    gameEnded: false,
};

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

app.use(express.static(path.join(__dirname, '../public')));

io.on('connection', (socket) => {
    console.log('New client connected with ID:', socket.id);
    
    socket.emit('game-update', gameState);

    socket.on('update-team-name', (data) => {
        const { teamIndex, newName } = data;
        gameState.teamNames[teamIndex] = newName;
        io.emit('game-update', gameState);
    });

    socket.on('reveal-answer', ({ questionIndex, answerIndex }) => {
        if (gameState.gameStarted && gameState.revealedQuestions.includes(questionIndex)) {
            gameState.questions[questionIndex].answers[answerIndex].revealed = true;
            io.emit('game-update', gameState);
        }
    });

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

    socket.on('set-manual-points', (data) => {
        const { teamIndex, points } = data;

        gameState.teamScores[teamIndex] = points;
        console.log(`Manually set Team ${teamIndex + 1} score to ${points}`);
        io.emit('game-update', gameState);
    });

    socket.on('wrong-answer', () => {
        gameState.wrongAnswers += 1;

        if (gameState.wrongAnswers >= 3) {
            io.emit('strike-limit-reached', { message: '3 wrong answers reached!' });
        }

        io.emit('game-update', gameState);
    });

    socket.on('start-game', () => {
        gameState.gameStarted = true;
        gameState.questionRevealed = false;
        io.emit('game-update', gameState);
    });

    socket.on('reveal-question', () => {
        if (gameState.gameStarted && !gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
            gameState.revealedQuestions.push(gameState.currentQuestionIndex);
            gameState.questionRevealed = true;
            io.emit('game-update', gameState);
        }
    });

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

    socket.on('end-game', () => {
        if (gameState.gameStarted && gameState.currentQuestionIndex === gameState.questions.length - 1) {
            gameState.gameEnded = true;
            io.emit('game-update', gameState);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('play-sound', (soundType) => {
        io.emit('play-sound', soundType);
    });
});

server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

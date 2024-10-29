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
    earlyFinishQuestionIndex: null,
    finishedEarly: false,
};

const loadQuestions = async () => {
    const questions = {};
    return new Promise((resolve, reject) => {
        fs.createReadStream('questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (!row.question || !row.answer || !row.points) {
                    console.warn('Invalid row in CSV:', row);
                    return;
                }
                if (!questions[row.question]) {
                    questions[row.question] = [];
                }
                questions[row.question].push({ answer: row.answer, points: parseInt(row.points), revealed: false });
            })
            .on('end', () => {
                if (Object.keys(questions).length === 0) {
                    reject(new Error('No valid questions found in the CSV file'));
                } else {
                    resolve(questions);
                }
            })
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
        try {
            const { teamIndex, newName } = data;
            if (teamIndex !== 0 && teamIndex !== 1) {
                throw new Error('Invalid team index');
            }
            if (typeof newName !== 'string' || newName.length === 0) {
                throw new Error('Invalid team name');
            }
            gameState.teamNames[teamIndex] = newName;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error updating team name:', error.message);
            socket.emit('error', { message: 'Failed to update team name' });
        }
    });

    socket.on('reveal-answer', ({ questionIndex, answerIndex }) => {
        try {
            if (!gameState.gameStarted || !gameState.revealedQuestions.includes(questionIndex)) {
                throw new Error('Cannot reveal answer: game not started or question not revealed');
            }
            if (questionIndex < 0 || questionIndex >= gameState.questions.length || 
                answerIndex < 0 || answerIndex >= gameState.questions[questionIndex].answers.length) {
                throw new Error('Invalid question or answer index');
            }
            gameState.questions[questionIndex].answers[answerIndex].revealed = true;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error revealing answer:', error.message);
            socket.emit('error', { message: 'Failed to reveal answer' });
        }
    });

    socket.on('assign-revealed-points', ({ teamIndex }) => {
        try {
            const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
            const canAssignPoints = gameState.gameStarted && 
                gameState.revealedQuestions.includes(gameState.currentQuestionIndex) &&
                currentQuestion.answers.some(answer => answer.revealed) &&
                !gameState.assignedPoints[teamIndex];

            if (!canAssignPoints) {
                throw new Error('Cannot assign points');
            }

            const points = currentQuestion.answers.reduce((sum, answer) => 
                answer.revealed ? sum + answer.points : sum, 0);

            gameState.teamScores[teamIndex] += points;
            gameState.assignedPoints[teamIndex] = true;

            console.log(`Assigned ${points} points to Team ${teamIndex + 1}`);
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error assigning points:', error.message);
            socket.emit('error', { message: 'Failed to assign points' });
        }
    });

    socket.on('set-manual-points', (data) => {
        try {
            const { teamIndex, points } = data;
            if (teamIndex !== 0 && teamIndex !== 1) {
                throw new Error('Invalid team index');
            }
            if (typeof points !== 'number' || points < 0) {
                throw new Error('Invalid points value');
            }
            gameState.teamScores[teamIndex] = points;
            console.log(`Manually set Team ${teamIndex + 1} score to ${points}`);
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error setting manual points:', error.message);
            socket.emit('error', { message: 'Failed to set manual points' });
        }
    });

    socket.on('wrong-answer', () => {
        try {
            gameState.wrongAnswers += 1;

            if (gameState.wrongAnswers >= 3) {
                io.emit('strike-limit-reached', { message: '3 wrong answers reached!' });
            }

            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error handling wrong answer:', error.message);
            socket.emit('error', { message: 'Failed to handle wrong answer' });
        }
    });

    socket.on('start-game', () => {
        try {
            gameState.gameStarted = true;
            gameState.questionRevealed = false;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error starting game:', error.message);
            socket.emit('error', { message: 'Failed to start game' });
        }
    });

    socket.on('reveal-question', () => {
        try {
            if (!gameState.gameStarted || gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
                throw new Error('Cannot reveal question: game not started or question already revealed');
            }
            gameState.revealedQuestions.push(gameState.currentQuestionIndex);
            gameState.questionRevealed = true;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error revealing question:', error.message);
            socket.emit('error', { message: 'Failed to reveal question' });
        }
    });

    socket.on('change-question', ({ direction }) => {
        try {
            if (!gameState.gameStarted || !gameState.revealedQuestions.includes(gameState.currentQuestionIndex)) {
                throw new Error('Cannot change question: game not started or current question not revealed');
            }
            if (direction === 'next' && gameState.currentQuestionIndex < gameState.questions.length - 1) {
                gameState.currentQuestionIndex++;
            } else if (direction === 'prev' && gameState.currentQuestionIndex > 0) {
                gameState.currentQuestionIndex--;
            } else {
                throw new Error('Invalid direction');
            }

            gameState.wrongAnswers = 0;
            gameState.assignedPoints = [false, false];
            gameState.questionRevealed = gameState.revealedQuestions.includes(gameState.currentQuestionIndex);

            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error changing question:', error.message);
            socket.emit('error', { message: 'Failed to change question' });
        }
    });

    socket.on('end-game', () => {
        try {
            if (!gameState.gameStarted || gameState.currentQuestionIndex !== gameState.questions.length - 1) {
                throw new Error('Cannot end game: game not started or not on the last question');
            }
            gameState.gameEnded = true;
            gameState.finishedEarly = false;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error ending game:', error.message);
            socket.emit('error', { message: 'Failed to end game' });
        }
    });

    socket.on('finish-game-early', () => {
        try {
            if (!gameState.gameStarted) {
                throw new Error('Cannot finish game early: game not started');
            }
            gameState.earlyFinishQuestionIndex = gameState.currentQuestionIndex;
            gameState.gameEnded = true;
            gameState.finishedEarly = true;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error finishing game early:', error.message);
            socket.emit('error', { message: 'Failed to finish game early' });
        }
    });

    socket.on('resume-game', () => {
        try {
            if (!gameState.gameEnded || gameState.earlyFinishQuestionIndex === null) {
                throw new Error('Cannot resume game: game not ended early');
            }
            gameState.currentQuestionIndex = gameState.earlyFinishQuestionIndex;
            gameState.gameEnded = false;
            gameState.earlyFinishQuestionIndex = null;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error resuming game:', error.message);
            socket.emit('error', { message: 'Failed to resume game' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('play-sound', (soundType) => {
        try {
            if (!['correct', 'wrong'].includes(soundType)) {
                throw new Error('Invalid sound type');
            }
            io.emit('play-sound', soundType);
        } catch (error) {
            console.error('Error playing sound:', error.message);
            socket.emit('error', { message: 'Failed to play sound' });
        }
    });

    socket.on('error', (error) => {
        console.error('Server error:', error.message);
        socket.emit('error', { message: 'An error occurred. Please try again.' });
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        socket.emit('error', { message: 'Failed to connect to the server. Please check your internet connection and try again.' });
    });
});

server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

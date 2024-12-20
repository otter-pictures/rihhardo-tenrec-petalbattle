const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    pingTimeout: 60000,
    pingInterval: 25000
});

// Set up file upload
const upload = multer({ dest: 'uploads/' });

// Connection tracking
const connections = new Map();
const GAME_STATE_FILE = path.join(__dirname, 'gameState.json');
const QUESTIONS_FILE = path.join(__dirname, '../questions.csv');

const initialGameState = {
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
    lastUpdateTime: Date.now()
};

let gameState = { ...initialGameState };

// Load saved game state if exists
const loadGameState = () => {
    try {
        if (fs.existsSync(GAME_STATE_FILE)) {
            const savedState = JSON.parse(fs.readFileSync(GAME_STATE_FILE, 'utf8'));
            
            // Deep merge the questions array to preserve revealed states
            if (savedState.questions && savedState.questions.length > 0) {
                gameState.questions = savedState.questions;
            }
            
            // Merge other state properties
            gameState = {
                ...gameState,
                ...savedState,
                questions: gameState.questions // Keep the questions we just merged
            };
            
            console.log('Loaded saved game state');
        }
    } catch (error) {
        console.error('Error loading saved game state:', error);
    }
};

// Save game state
const saveGameState = () => {
    try {
        fs.writeFileSync(GAME_STATE_FILE, JSON.stringify(gameState));
    } catch (error) {
        console.error('Error saving game state:', error);
    }
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
                questions[row.question].push({ 
                    answer: row.answer, 
                    points: parseInt(row.points), 
                    revealed: false // Default state for new questions
                });
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
        // First load the saved state to get any existing revealed states
        loadGameState();
        
        // Then load questions from CSV
        const data = await loadQuestions();
        const existingQuestions = gameState.questions || [];
        
        // Merge new questions with existing revealed states
        gameState.questions = Object.keys(data).map((key) => {
            const existingQuestion = existingQuestions.find(q => q.question === key);
            const newAnswers = data[key];
            
            if (existingQuestion) {
                // Preserve revealed states from existing answers
                const mergedAnswers = newAnswers.map((newAnswer) => {
                    const existingAnswer = existingQuestion.answers.find(
                        a => a.answer === newAnswer.answer && a.points === newAnswer.points
                    );
                    return existingAnswer || newAnswer;
                });
                
                return {
                    question: key,
                    answers: mergedAnswers
                };
            }
            
            return {
                question: key,
                answers: newAnswers
            };
        });
        
        console.log("Questions loaded and merged with existing state");
        saveGameState(); // Save merged state
    } catch (error) {
        console.error("Error loading questions:", error);
    }
})();

app.use(express.static(path.join(__dirname, '../public')));

// Add CSV upload endpoint
app.post('/upload-questions', upload.single('questions'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate CSV format
        const questions = {};
        let isValid = true;
        let errorMessage = '';

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    if (!row.question || !row.answer || !row.points) {
                        isValid = false;
                        errorMessage = 'Invalid CSV format. Required columns: question, answer, points';
                    }
                    if (!questions[row.question]) {
                        questions[row.question] = [];
                    }
                    questions[row.question].push({
                        answer: row.answer,
                        points: parseInt(row.points),
                        revealed: false
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        if (!isValid) {
            return res.status(400).json({ error: errorMessage });
        }

        // Backup existing questions file
        if (fs.existsSync(QUESTIONS_FILE)) {
            const backupPath = QUESTIONS_FILE + '.backup-' + Date.now();
            fs.copyFileSync(QUESTIONS_FILE, backupPath);
        }

        // Save new questions file
        fs.copyFileSync(req.file.path, QUESTIONS_FILE);

        // Reset game state
        await resetGame();

        res.json({ message: 'Questions uploaded successfully' });
    } catch (error) {
        console.error('Error uploading questions:', error);
        res.status(500).json({ error: 'Failed to upload questions' });
    }
});

// Reset game state
const resetGame = async () => {
    try {
        // Reset to initial state
        gameState = { ...initialGameState, lastUpdateTime: Date.now() };
        
        // Load fresh questions
        const data = await loadQuestions();
        gameState.questions = Object.keys(data).map((key) => ({
            question: key,
            answers: data[key]
        }));
        
        // Save new state
        saveGameState();
        
        // Notify all clients
        io.emit('game-update', gameState);
        
        return true;
    } catch (error) {
        console.error('Error resetting game:', error);
        return false;
    }
};

io.on('connection', (socket) => {
    console.log('New client connected with ID:', socket.id);
    
    // Track connection
    connections.set(socket.id, {
        connectionTime: Date.now(),
        lastActive: Date.now(),
        reconnectCount: 0
    });
    
    // Send initial state
    socket.emit('game-update', gameState);
    
    // Handle reconnection
    socket.on('request-state', (lastUpdateTime) => {
        const connection = connections.get(socket.id);
        if (connection) {
            connection.reconnectCount++;
            connection.lastActive = Date.now();
            
            // Only send state if it's newer than client's last update
            if (!lastUpdateTime || gameState.lastUpdateTime > lastUpdateTime) {
                socket.emit('game-update', gameState);
            }
        }
    });

    // Update connection status periodically
    const heartbeat = setInterval(() => {
        const connection = connections.get(socket.id);
        if (connection) {
            connection.lastActive = Date.now();
        }
    }, 30000);

    socket.on('disconnect', (reason) => {
        console.log(`Client ${socket.id} disconnected. Reason: ${reason}`);
        clearInterval(heartbeat);
        
        // Keep connection info for potential reconnection
        setTimeout(() => {
            if (!io.sockets.sockets.has(socket.id)) {
                connections.delete(socket.id);
                console.log(`Cleaned up connection for ${socket.id}`);
            }
        }, 300000); // Clean up after 5 minutes if no reconnection
    });

    // Wrap all state-changing events with persistence
    const withPersistence = (handler) => {
        return (...args) => {
            try {
                handler(...args);
                gameState.lastUpdateTime = Date.now();
                saveGameState();
            } catch (error) {
                console.error('Error in handler:', error);
                socket.emit('error', { message: error.message });
            }
        };
    };

    socket.on('update-team-name', withPersistence((data) => {
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
    }));

    socket.on('reveal-answer', withPersistence(({ questionIndex, answerIndex }) => {
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
    }));

    socket.on('assign-revealed-points', withPersistence(({ teamIndex }) => {
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
    }));

    socket.on('set-manual-points', withPersistence((data) => {
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
    }));

    socket.on('wrong-answer', withPersistence(() => {
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
    }));

    socket.on('start-game', withPersistence(() => {
        try {
            gameState.gameStarted = true;
            gameState.questionRevealed = false;
            io.emit('game-update', gameState);
        } catch (error) {
            console.error('Error starting game:', error.message);
            socket.emit('error', { message: 'Failed to start game' });
        }
    }));

    socket.on('reveal-question', withPersistence(() => {
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
    }));

    socket.on('change-question', withPersistence(({ direction }) => {
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
    }));

    socket.on('end-game', withPersistence(() => {
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
    }));

    socket.on('finish-game-early', withPersistence(() => {
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
    }));

    socket.on('resume-game', withPersistence(() => {
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
    }));

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

    // Add reset game handler
    socket.on('reset-game', withPersistence(async () => {
        try {
            const success = await resetGame();
            if (!success) {
                throw new Error('Failed to reset game');
            }
        } catch (error) {
            console.error('Error in reset-game:', error);
            socket.emit('error', { message: 'Failed to reset game' });
        }
    }));
});

// Load initial state
loadGameState();

server.listen(4000, () => {
    console.log('Server is running on port 4000');
});

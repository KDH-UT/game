const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function calculateScore(elapsedSeconds) {
  const maxSeconds = 120;
  if (elapsedSeconds >= maxSeconds) return 0;
  const ratio = 1 - (elapsedSeconds / maxSeconds);
  return Math.max(0, Math.floor(1000 * Math.pow(ratio, 2)));
}

function removePlayerFromTeams(gameState, playerId) {
  for (let i = 1; i <= gameState.teamsCount; i++) {
    const idx = gameState.teams[i].indexOf(playerId);
    if (idx !== -1) gameState.teams[i].splice(idx, 1);
  }
}

function broadcastState(roomCode) {
  if (rooms[roomCode]) {
    io.to(roomCode).emit('sync-state', rooms[roomCode]);
  }
}

io.on('connection', (socket) => {
  socket.on('create-room', (data, callback) => {
    const { roomCode, teamsCount } = data;
    if (rooms[roomCode]) {
      return callback({ success: false, message: '이미 존재하는 방 코드입니다.' });
    }

    const gameState = {
      teamsCount: teamsCount,
      teams: {},
      players: {},
      teamScores: {},
      teamHistories: {},
      masters: {},
      roundStartTime: null,
      startTime: null,
      currentWord: '',
      currentImage: '',
      allowTeamSwitch: false
    };

    for (let i = 1; i <= teamsCount; i++) {
      gameState.teams[i] = [];
      gameState.teamScores[i] = 0;
      gameState.teamHistories[i] = [];
    }

    rooms[roomCode] = gameState;
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isHost = true;

    callback({ success: true, gameState });
  });

  socket.on('join-master', (data, callback) => {
    const { roomCode } = data;
    if (!rooms[roomCode]) {
      return callback({ success: false, message: '존재하지 않는 방입니다.' });
    }

    rooms[roomCode].masters[socket.id] = { name: '마스터PC-' + Math.floor(Math.random() * 100) };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isMaster = true;

    callback({ success: true, gameState: rooms[roomCode] });
    broadcastState(roomCode);
  });

  socket.on('get-room-info', (data, callback) => {
    const { roomCode } = data;
    if (!rooms[roomCode]) {
      if (callback) callback({ success: false, message: '존재하지 않는 방입니다.' });
      return;
    }
    socket.join(roomCode);
    socket.roomCode = roomCode;

    const teamCounts = {};
    const gameState = rooms[roomCode];
    for (let i = 1; i <= gameState.teamsCount; i++) {
      teamCounts[i] = gameState.teams[i].length;
    }

    socket.emit('room-info', { teamsCount: gameState.teamsCount, teamCounts, allowSwitch: gameState.allowTeamSwitch });
    socket.emit('leaderboard-update', { teamsCount: gameState.teamsCount, teamScores: gameState.teamScores });
    if (callback) callback({ success: true });
  });

  socket.on('join-team', (data) => {
    const { roomCode, name, team } = data;
    const gameState = rooms[roomCode];
    if (!gameState) return;

    removePlayerFromTeams(gameState, socket.id);
    gameState.players[socket.id] = {
      id: socket.id,
      name,
      team,
      isGuesser: false,
      isSpy: false,
      targetTeamForSpy: null,
      hint: '',
      hintDuration: null,
      isApproved: false,
      answer: '',
      pendingScore: null,
      isCorrect: false
    };
    gameState.teams[team].push(socket.id);

    socket.emit('join-ack', { team, name });
    broadcastState(roomCode);
  });

  socket.on('host-command', (data) => {
    const { roomCode, action } = data;
    const gameState = rooms[roomCode];
    if (!gameState) return;

    if (action === 'TOGGLE_SWITCH') {
      gameState.allowTeamSwitch = !gameState.allowTeamSwitch;
    } else if (action === 'START_ROUND') {
      const { qKey, isSpyEnabled } = data;
      const questionsDatabase = {
        'example': { label: "예제", word: "김동환", image: "images/example.png" },
        1: { label: "1번", word: "사과", image: "images/q1.png" },
        2: { label: "2번", word: "CIS", image: "images/q2.png" }
      };
      const qData = questionsDatabase[qKey] || { word: "기본단어", image: "" };
      gameState.currentWord = qData.word;
      gameState.currentImage = qData.image;
      gameState.roundStartTime = Date.now();
      gameState.startTime = null;

      for (let t = 1; t <= gameState.teamsCount; t++) {
        const members = gameState.teams[t];
        if (members.length === 0) continue;
        const guesserIndex = Math.floor(Math.random() * members.length);
        let spyIndex = -1;
        if (isSpyEnabled && members.length > 1) {
          const candidateIndices = [];
          for (let i = 0; i < members.length; i++) { if (i !== guesserIndex) candidateIndices.push(i); }
          spyIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
        }

        members.forEach((id, idx) => {
          const isGuesser = (idx === guesserIndex);
          const isSpy = (idx === spyIndex);
          let spyTarget = null;
          if (isSpy) {
            const otherTeams = [];
            for (let ot = 1; ot <= gameState.teamsCount; ot++) { if (ot !== t) otherTeams.push(ot); }
            if (otherTeams.length > 0) spyTarget = otherTeams[Math.floor(Math.random() * otherTeams.length)];
          }

          gameState.players[id].isGuesser = isGuesser;
          gameState.players[id].isSpy = isSpy;
          gameState.players[id].targetTeamForSpy = spyTarget;
          gameState.players[id].hint = '';
          gameState.players[id].hintDuration = null;
          gameState.players[id].isApproved = false;
          gameState.players[id].answer = '';
          gameState.players[id].pendingScore = null;
          gameState.players[id].isCorrect = false;

          io.to(id).emit('round-start', {
            word: isGuesser ? '???' : qData.word,
            image: isGuesser ? null : qData.image,
            isGuesser,
            isSpy
          });
        });
      }
    } else if (action === 'REVEAL_HINTS') {
      const now = Date.now();
      gameState.startTime = now;

      Object.keys(gameState.players).forEach(id => {
        const p = gameState.players[id];
        if (p.hint && !p.isApproved) p.isApproved = true;
      });

      for (let targetTeam = 1; targetTeam <= gameState.teamsCount; targetTeam++) {
        const members = gameState.teams[targetTeam];
        const guesserId = members.find(id => gameState.players[id].isGuesser);
        if (!guesserId) continue;

        const hintsList = [];
        members.forEach(id => {
          const p = gameState.players[id];
          if (!p.isGuesser && !p.isSpy && p.hint && p.isApproved) hintsList.push(p.hint);
        });
        Object.keys(gameState.players).forEach(id => {
          const p = gameState.players[id];
          if (p.isSpy && p.targetTeamForSpy === targetTeam && p.hint && p.isApproved) hintsList.push(p.hint);
        });

        hintsList.sort(() => Math.random() - 0.5);
        io.to(guesserId).emit('hints-revealed', { hints: hintsList, startTime: now });
      }
    } else if (action === 'APPROVE_ANSWER') {
      const { playerId } = data;
      const player = gameState.players[playerId];
      if (player && !player.isCorrect) {
        player.isCorrect = true;
        const gainedScore = player.pendingScore || 0;
        gameState.teamScores[player.team] += gainedScore;
        io.to(playerId).emit('answer-approved', { score: gainedScore });
        io.to(roomCode).emit('leaderboard-update', { teamsCount: gameState.teamsCount, teamScores: gameState.teamScores });
      }
    } else if (action === 'REJECT_ANSWER') {
      const { playerId } = data;
      const player = gameState.players[playerId];
      if (player) {
        if (player.isCorrect) {
          const deductedScore = player.pendingScore || 0;
          gameState.teamScores[player.team] = Math.max(0, gameState.teamScores[player.team] - deductedScore);
        }
        player.isCorrect = false;
        io.to(playerId).emit('answer-rejected');
        io.to(roomCode).emit('leaderboard-update', { teamsCount: gameState.teamsCount, teamScores: gameState.teamScores });
      }
    }

    broadcastState(roomCode);
  });

  socket.on('hint-submit', (data) => {
    const { roomCode, hint } = data;
    const gameState = rooms[roomCode];
    if (!gameState) return;

    const p = gameState.players[socket.id];
    if (p) {
      p.hint = hint;
      p.isApproved = false;
    }
    broadcastState(roomCode);
  });

  socket.on('answer-submit', (data) => {
    const { roomCode, answer } = data;
    const gameState = rooms[roomCode];
    if (!gameState || !gameState.startTime) return;

    const player = gameState.players[socket.id];
    if (player) {
      const elapsed = (Date.now() - gameState.startTime) / 1000;
      const score = calculateScore(elapsed);
      player.answer = answer;
      player.pendingScore = score;
      const cleanSubmitted = answer.replace(/\s+/g, '').toLowerCase();
      const cleanTarget = gameState.currentWord.replace(/\s+/g, '').toLowerCase();
      const isMatched = (cleanTarget && cleanSubmitted === cleanTarget);

      if (isMatched) {
        player.isCorrect = true;
        gameState.teamScores[player.team] += score;
        socket.emit('answer-auto-correct', { score });
        io.to(roomCode).emit('leaderboard-update', { teamsCount: gameState.teamsCount, teamScores: gameState.teamScores });
      } else {
        socket.emit('answer-pending');
      }
    }
    broadcastState(roomCode);
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const gameState = rooms[roomCode];
      removePlayerFromTeams(gameState, socket.id);
      delete gameState.players[socket.id];
      broadcastState(roomCode);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

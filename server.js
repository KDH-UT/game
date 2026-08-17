const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// 방 상태 저장 구조
const rooms = new Map();

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ko">
<head> 
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>단어 힌트 조별 게임 (웹소켓 기반)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
    body { padding: 20px; background-color: #f4f7f6; text-align: center; color: #333; }
    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 1000px; margin: 0 auto 20px; }
    button { padding: 10px 18px; font-size: 15px; font-weight: bold; border: none; border-radius: 6px; background-color: #4A90E2; color: white; cursor: pointer; margin: 3px; }
    button:hover { background-color: #357ABD; }
    button:disabled { background-color: #ccc !important; cursor: not-allowed; }
    .btn-approve { background-color: #2ECC71; font-size: 12px; padding: 4px 8px; }
    .btn-danger { background-color: #d9534f; font-size: 12px; padding: 4px 8px; }
    .btn-action { background-color: #e67e22; font-size: 16px; padding: 12px 24px; }
    .btn-toggle { background-color: #95a5a6; font-size: 14px; padding: 8px 16px; }
    .btn-toggle.active { background-color: #27ae60; }
    input { padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 6px; margin: 5px; width: 80%; max-width: 300px; }
    
    .team-select-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin: 15px 0; }
    .btn-team-select { background-color: #f8f9fa; color: #333; border: 2px solid #4A90E2; padding: 12px; border-radius: 8px; font-size: 15px; cursor: pointer; }
    .btn-team-select.active { background-color: #4A90E2; color: white; }

    .question-grid { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .btn-question { background-color: #8e44ad; font-size: 15px; padding: 10px 16px; }
    .btn-question.selected { background-color: #27ae60; border: 2px solid #fff; }
    .btn-example { background-color: #16a085; }

    .leaderboard { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 15px 0; background: #2C3E50; padding: 12px; border-radius: 8px; color: white; }
    .leaderboard-item { background: #34495E; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 14px; }
    .leaderboard-item.clickable { cursor: pointer; }
    .leaderboard-item span { color: #2ECC71; }

    .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-top: 15px; }
    .team-card { border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background: #fafafa; text-align: left; }
    .team-card h4 { border-bottom: 2px solid #4A90E2; padding-bottom: 5px; margin-bottom: 8px; color: #4A90E2; display: flex; justify-content: space-between; }
    .player-item { padding: 6px; font-size: 14px; border-bottom: 1px dashed #eee; border-radius: 4px; margin-bottom: 2px; }
    
    .time-badge { font-size: 12px; color: #8e44ad; font-weight: bold; margin-left: 4px; }
    .player-item.spy-highlight { background-color: #fce4ec; border: 1.5px solid #e91e63; color: #c2185b; }
    .spy-badge { background: #e91e63; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px; }

    .option-box { margin-bottom: 12px; font-size: 16px; font-weight: bold; color: #2c3e50; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
    .option-box input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }

    .guesser { color: #d9534f; font-weight: bold; }
    .hint-badge { display: inline-block; background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-top: 3px; }
    .hint-badge.approved { background: #d4edda; color: #155724; }
    .word-display { font-size: 28px; font-weight: bold; color: #e67e22; margin: 15px 0; }
    
    .hint-image { max-width: 100%; max-height: 400px; border-radius: 8px; margin: 10px 0; border: 1px solid #ddd; }
    .live-score-box { background: #e74c3c; color: white; padding: 12px; border-radius: 8px; font-size: 20px; font-weight: bold; margin: 15px 0; }
    .live-score-box span { font-size: 32px; color: #f1c40f; }

    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal-content { background: white; padding: 20px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; text-align: left; position: relative; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4A90E2; padding-bottom: 10px; margin-bottom: 15px; }
    .history-item { background: #f8f9fa; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    
    .hidden { display: none !important; }
  </style>
</head>
<body>

  <!-- 1. 메인 선택 화면 -->
  <div id="view-select" class="card">
    <h1>실시간 단어 힌트 게임</h1>
    <p style="margin: 15px 0;">모드를 선택하세요</p>
    <button onclick="showHostSetup()">1. 스마트폰으로 방 만들기 (서버 오픈)</button><br>
    <button onclick="showMasterJoinSetup()" style="background-color: #8e44ad;">2. 컴퓨터로 마스터(호스트) 권한 접속</button><br>
    <button onclick="showPlayerSetup()" style="background-color: #2ECC71;">3. 일반 참가자 접속</button>
  </div>

  <!-- 스마트폰 방 생성 화면 -->
  <div id="view-host-setup" class="card hidden">
    <h2>[스마트폰] 방 개설하기</h2>
    <p style="margin: 10px 0; color:#666; font-size:14px;">방을 개설하면 고유 코드가 발급됩니다.</p>
    <input type="number" id="teams-count" value="4" min="1" max="15" placeholder="조 개수"><br>
    <button onclick="createRoomAsPhone()">방 생성 시작</button>
    <br><button onclick="location.reload()" style="background-color:#7f8c8d; margin-top:10px;">뒤로 가기</button>
  </div>

  <!-- 컴퓨터 마스터 로그인 화면 -->
  <div id="view-master-setup" class="card hidden">
    <h2>[컴퓨터] 마스터(호스트) 권한으로 들어가기</h2>
    <input type="text" id="master-room-code" placeholder="방 코드 (예: ROOM-1234)"><br>
    <button onclick="connectAsMaster()" style="background-color: #8e44ad;">마스터로 접속하기</button>
    <br><button onclick="location.reload()" style="background-color:#7f8c8d; margin-top:10px;">뒤로 가기</button>
  </div>

  <!-- 2. 호스트/마스터 대시보드 화면 -->
  <div id="view-host" class="card hidden">
    <h2>[마스터/호스트 제어판] 게임 관리 및 문제 선택</h2>
    <div id="host-dashboard">
      <h2 id="room-code-txt" style="color:#2C3E50; margin:10px 0;"></h2>
      
      <div id="master-manager-box" style="margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeeba;" class="hidden">
        <h4 style="color: #856404; margin-bottom: 5px;">💻 접속 중인 마스터 관리</h4>
        <div id="connected-masters-list" style="font-size: 14px; margin-bottom: 5px;">접속한 마스터가 없습니다.</div>
      </div>

      <div style="margin: 10px 0;">
        <button id="toggle-switch-btn" class="btn-toggle" onclick="toggleAllowTeamSwitch()">조 변경 허용: OFF</button>
      </div>

      <h3>🏆 조별 누적 점수판</h3>
      <div id="leaderboard" class="leaderboard"></div>

      <div style="margin: 20px 0; padding: 15px; background: #eef6ff; border-radius: 8px;">
        <label class="option-box">
          <input type="checkbox" id="enable-spy-opt" checked>
          <span>🕵️ 이번 라운드 스파이 포함 (타 조 교란)</span>
        </label>
        
        <p style="margin-bottom: 8px; font-weight: bold; color: #2c3e50;">출제할 문제 또는 예제를 선택하세요</p>
        <div class="question-grid">
          <button class="btn-question btn-example" id="q-btn-example" onclick="selectQuestion('example')">예제</button>
          <button class="btn-question" id="q-btn-1" onclick="selectQuestion(1)">1번</button>
          <button class="btn-question" id="q-btn-2" onclick="selectQuestion(2)">2번</button>
          <button class="btn-question" id="q-btn-3" onclick="selectQuestion(3)">3번</button>
          <button class="btn-question" id="q-btn-4" onclick="selectQuestion(4)">4번</button>
          <button class="btn-question" id="q-btn-5" onclick="selectQuestion(5)">5번</button>
        </div>

        <div id="selected-question-preview" style="margin: 10px 0; font-weight: bold; color: #e67e22;">선택된 문제 없음</div>

        <button class="btn-action" onclick="startRound()">1. 라운드 시작 (역할 자동배정)</button>
        <button class="btn-action" style="background-color: #27ae60;" onclick="revealHintsToGuessers()">2. 힌트 일괄 승인 및 공개 (타이머 시작!)</button>
        <div id="current-word-display" class="word-display"></div>
      </div>

      <h3>실시간 조별 현황 및 정답 검수</h3>
      <div id="teams-grid" class="teams-grid"></div>
    </div>
  </div>

  <!-- 이력 확인 모달 -->
  <div id="history-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modal-title">조 제출 이력 관리</h3>
        <button onclick="closeHistoryModal()" style="background-color:#7f8c8d; padding:4px 10px;">닫기</button>
      </div>
      <div id="modal-history-list"></div>
    </div>
  </div>

  <!-- 3. 참가자 화면 -->
  <div id="view-player" class="card hidden">
    <h2>[참가자] 게임 참가</h2>
    
    <div id="player-step1">
      <input type="text" id="room-code" placeholder="방 코드 (예: ROOM-1234)"><br>
      <input type="text" id="nickname" placeholder="이름(닉네임) 입력"><br>
      <button onclick="connectRoom()" style="background-color: #2ECC71;">다음 (조 선택)</button>
    </div>

    <div id="player-step2" class="hidden">
      <h3 style="color:#2C3E50;">참가할 조를 선택하세요</h3>
      <div id="team-select-buttons" class="team-select-grid"></div>
      <button id="btn-join-final" onclick="joinSelectedTeam()" style="background-color: #2ECC71; width:80%; max-width:300px;" disabled>선택한 조로 접속하기</button>
    </div>

    <div id="player-game" class="hidden">
      <div style="display:flex; justify-content:center; align-items:center; margin-bottom:10px;">
        <h3 id="my-info" style="color:#7F8C8D;"></h3>
        <button id="btn-team-change" class="btn-switch hidden" onclick="requestTeamChange()" style="margin-left:10px; font-size:12px; padding:4px 8px; background-color:#e67e22;">조 변경</button>
      </div>

      <h4 style="margin-top:10px; color:#2C3E50;">🏆 실시간 조별 누적 점수</h4>
      <div id="player-leaderboard" class="leaderboard"></div>

      <div id="spy-alert-box" class="spy-alert-box hidden" style="background:#8e44ad; color:white; padding:12px; border-radius:8px; font-weight:bold; margin:10px 0;">
        🕵️ 당신은 이번 라운드 스파이입니다!<br>
        <span style="font-size:13px; font-weight:normal;">당신이 작성한 힌트는 <b>다른 조</b>의 출제자에게 전송됩니다.</span>
      </div>

      <h2 id="role-badge" style="margin: 15px 0;"></h2>
      
      <div id="ui-giver" class="hidden">
        <p>호스트 제시어: <strong id="given-word" style="font-size: 24px; color:#e67e22;">-</strong></p>
        <div id="given-image-container"></div>
        <p style="font-size: 13px; color: #7f8c8d; margin: 10px 0;">1~2개 단어로 출제자에게 줄 힌트를 적으세요.</p>
        <input type="text" id="hint-input" placeholder="힌트 입력 (1~2 단어)"><br>
        <button id="hint-btn" onclick="sendHint()">힌트 전송</button>
        <p id="hint-msg" style="color: #2ECC71; font-weight: bold; margin-top: 10px;"></p>
      </div>

      <div id="ui-guesser" class="hidden">
        <p style="color: #d9534f; font-weight: bold;">당신은 문제를 맞추는 사람입니다!</p>
        <div id="live-score-box" class="live-score-box hidden">
          현재 제출 시 획득 점수: <br><span id="live-score-val">1000</span> 점
        </div>
        <p style="margin-top: 10px;">호스트가 공개한 힌트 목록 (익명):</p>
        <div id="hints-list" style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin: 10px 0; min-height: 50px;"></div>
        <input type="text" id="answer-input" placeholder="정답 입력"><br>
        <button id="ans-btn" onclick="sendAnswer()" style="background-color: #e67e22;" disabled>정답 제출</button>
        <h3 id="result-score-txt" style="color: #27ae60; margin-top: 15px;"></h3>
      </div>
    </div>
  </div>

  <script>
    const questionsDatabase = {
      'example': { label: "예제", word: "김동환", image: "" },
      1: { label: "1번", word: "사과", image: "" },
      2: { label: "2번", word: "CIS", image: "" },
      3: { label: "3번", word: "bias", image: "" },
      4: { label: "4번", word: "주석", image: "" },
      5: { label: "5번", word: "산란", image: "" }
    };

    let selectedQuestionKey = null;
    let ws = null;
    let currentRoomId = null;
    let role = null;
    let gameState = { 
      teamsCount: 4, 
      teams: {}, 
      players: {}, 
      teamScores: {}, 
      teamHistories: {}, 
      roundStartTime: null,
      startTime: null,
      currentWord: '',
      currentImage: '',
      allowTeamSwitch: false
    };

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${window.location.host}\`;

    function initWebSocket() {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      };
    }

    function calculateScore(elapsedSeconds) {
      const maxSeconds = 120;
      if (elapsedSeconds >= maxSeconds) return 0;
      const ratio = 1 - (elapsedSeconds / maxSeconds);
      return Math.max(0, Math.floor(1000 * Math.pow(ratio, 2)));
    }

    function showHostSetup() {
      document.getElementById('view-select').classList.add('hidden');
      document.getElementById('view-host-setup').classList.remove('hidden');
    }

    function showMasterJoinSetup() {
      document.getElementById('view-select').classList.add('hidden');
      document.getElementById('view-master-setup').classList.remove('hidden');
    }

    function showPlayerSetup() {
      document.getElementById('view-select').classList.add('hidden');
      document.getElementById('view-player').classList.remove('hidden');
    }

    function createRoomAsPhone() {
      role = 'phone-host';
      const count = parseInt(document.getElementById('teams-count').value);
      currentRoomId = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
      
      initWebSocket();
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'CREATE_ROOM', roomId: currentRoomId, teamsCount: count }));
      };
    }

    function connectAsMaster() {
      role = 'master';
      const code = document.getElementById('master-room-code').value.trim().toUpperCase();
      if (!code) return alert("방 코드를 입력하세요.");
      currentRoomId = code;

      initWebSocket();
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'MASTER_LOGIN', roomId: currentRoomId, masterName: '마스터PC-' + Math.floor(Math.random()*100) }));
      };
    }

    function connectRoom() {
      role = 'player';
      const code = document.getElementById('room-code').value.trim().toUpperCase();
      const name = document.getElementById('nickname').value.trim();
      if (!code || !name) return alert("방 코드와 이름을 모두 입력하세요.");
      currentRoomId = code;

      initWebSocket();
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'GET_ROOM_INFO', roomId: currentRoomId, name: name }));
      };
    }

    function sendCommand(action, payload = {}) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'CLIENT_ACTION', roomId: currentRoomId, action: action, ...payload }));
    }

    function handleServerMessage(data) {
      if (data.type === 'ROOM_CREATED') {
        gameState = data.gameState;
        document.getElementById('view-host-setup').classList.add('hidden');
        document.getElementById('view-host').classList.remove('hidden');
        document.getElementById('room-code-txt').innerText = \`방 코드: \${currentRoomId}\`;
        document.getElementById('master-manager-box').classList.remove('hidden');
        renderLeaderboard();
        renderHostGrid();
        renderMasterManagerList(data.masters);
      }
      else if (data.type === 'MASTER_LOGGED_IN') {
        gameState = data.gameState;
        document.getElementById('view-master-setup').classList.add('hidden');
        document.getElementById('view-host').classList.remove('hidden');
        document.getElementById('room-code-txt').innerText = \`[마스터 제어 모드] 방 코드: \${currentRoomId}\`;
        renderLeaderboard();
        renderHostGrid();
      }
      else if (data.type === 'STATE_SYNC') {
        gameState = data.gameState;
        if (data.masters) renderMasterManagerList(data.masters);
        renderLeaderboard();
        renderHostGrid();
        
        // 조 변경 허용 여부에 따라 버튼 표시 업데이트
        const teamChangeBtn = document.getElementById('btn-team-change');
        if (teamChangeBtn) {
          if (gameState.allowTeamSwitch) teamChangeBtn.classList.remove('hidden');
          else teamChangeBtn.classList.add('hidden');
        }
      }
      else if (data.type === 'ROOM_INFO_RESP') {
        document.getElementById('player-step1').classList.add('hidden');
        document.getElementById('player-step2').classList.remove('hidden');
        renderTeamSelectButtons(data.teamsCount, data.teamCounts);
      }
      else if (data.type === 'JOIN_ACK') {
        document.getElementById('player-step2').classList.add('hidden');
        document.getElementById('player-game').classList.remove('hidden');
        document.getElementById('my-info').innerText = \`\${data.name}님 (\${data.team}조)\`;
        document.getElementById('role-badge').innerText = "호스트가 라운드를 시작하길 기다리는 중...";
      }
      else if (data.type === 'LEADERBOARD_UPDATE') {
        renderPlayerLeaderboard(data.teamsCount, data.teamScores);
      }
      else if (data.type === 'ROUND_START') {
        isTimerStarted = false;
        stopLiveScoreTimer();
        document.getElementById('ui-giver').classList.add('hidden');
        document.getElementById('ui-guesser').classList.add('hidden');
        document.getElementById('live-score-box').classList.add('hidden');
        document.getElementById('hint-input').value = '';
        document.getElementById('answer-input').value = '';
        document.getElementById('hint-msg').innerText = '';
        document.getElementById('result-score-txt').innerText = '';
        document.getElementById('hint-btn').disabled = false;
        document.getElementById('ans-btn').disabled = true;

        if (data.isSpy) document.getElementById('spy-alert-box').classList.remove('hidden');
        else document.getElementById('spy-alert-box').classList.add('hidden');

        if (data.isGuesser) {
          document.getElementById('role-badge').innerText = "🎯 당신은 문제를 맞추는 사람입니다!";
          document.getElementById('ui-guesser').classList.remove('hidden');
          document.getElementById('hints-list').innerHTML = '<i>호스트가 익명 힌트를 일괄 공개하길 기다리는 중...</i>';
        } else {
          document.getElementById('role-badge').innerText = "💡 힌트를 작성해 주세요!";
          document.getElementById('given-word').innerText = data.word;
          const imgContainer = document.getElementById('given-image-container');
          if (data.image) imgContainer.innerHTML = \`<img src="\${data.image}" alt="문제 이미지" class="hint-image">\`;
          else imgContainer.innerHTML = '';
          document.getElementById('ui-giver').classList.remove('hidden');
        }
      }
      else if (data.type === 'HINTS_REVEALED') {
        isTimerStarted = true;
        timerStartTime = data.startTime || Date.now();
        const list = document.getElementById('hints-list');
        list.innerHTML = data.hints.map(h => \`<div style="padding: 4px 8px; margin: 3px 0; background: #fff; border: 1px solid #ddd; border-radius: 4px; font-weight:bold; color:#2980b9;">• \${h}</div>\`).join('') || '<i>제출된 힌트가 없습니다.</i>';
        document.getElementById('ans-btn').disabled = false;
        startLiveScoreTimer();
      }
      else if (data.type === 'HINT_REJECTED') {
        document.getElementById('hint-msg').style.color = '#d9534f';
        document.getElementById('hint-msg').innerText = "⚠️ 힌트가 반려되었습니다. 다시 입력해주세요!";
        document.getElementById('hint-input').value = '';
        document.getElementById('hint-btn').disabled = false;
      }
      else if (data.type === 'ANSWER_AUTO_CORRECT') {
        stopLiveScoreTimer();
        document.getElementById('result-score-txt').style.color = '#27ae60';
        document.getElementById('result-score-txt').innerText = \`🎉 정답입니다! (+\${data.score}점)\`;
      }
      else if (data.type === 'ANSWER_PENDING') {
        stopLiveScoreTimer();
        document.getElementById('result-score-txt').style.color = '#e67e22';
        document.getElementById('result-score-txt').innerText = "정답 제출 완료 (호스트 검수 대기 중)";
      }
      else if (data.type === 'ANSWER_APPROVED') {
        stopLiveScoreTimer();
        document.getElementById('result-score-txt').style.color = '#27ae60';
        document.getElementById('result-score-txt').innerText = \`🎉 정답 승인됨! (+\${data.score}점)\`;
      }
      else if (data.type === 'ANSWER_REJECTED') {
        document.getElementById('result-score-txt').style.color = '#d9534f';
        document.getElementById('result-score-txt').innerText = "⚠️ 오답 처리되었습니다.";
        if (isTimerStarted) { document.getElementById('ans-btn').disabled = false; startLiveScoreTimer(); }
      }
      else if (data.type === 'ERROR') {
        alert(data.message);
      }
    }

    function renderMasterManagerList(masters) {
      const container = document.getElementById('connected-masters-list');
      if (!masters || masters.length === 0) {
        container.innerHTML = '<span style="color:#7f8c8d;">접속한 마스터가 없습니다.</span>';
        return;
      }
      let html = '';
      masters.forEach(m => {
        html += \`<div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; border: 1px solid #ddd;">
          <span>💻 \${m.name}</span>
          <button class="btn-danger" style="padding: 2px 6px; font-size: 11px;" onclick="kickMaster('\${m.id}')">퇴출</button>
        </div>\`;
      });
      container.innerHTML = html;
    }

    function kickMaster(masterId) {
      sendCommand('KICK_MASTER', { masterId });
    }

    function selectQuestion(qKey) {
      selectedQuestionKey = qKey;
      ['example', 1, 2, 3, 4, 5].forEach(key => {
        const btn = document.getElementById(\`q-btn-\${key}\`);
        if(btn) {
          if (key === qKey) btn.classList.add('selected');
          else btn.classList.remove('selected');
        }
      });
      const qData = questionsDatabase[qKey];
      const preview = document.getElementById('selected-question-preview');
      if(preview) preview.innerText = \`선택된 항목 [\${qData.label}]: 정답("\${qData.word}")\`;
    }

    function toggleAllowTeamSwitch() {
      sendCommand('TOGGLE_SWITCH');
    }

    function startRound() {
      if (!selectedQuestionKey) return alert("문제를 먼저 선택하세요!");
      const isSpyEnabled = document.getElementById('enable-spy-opt').checked;
      sendCommand('START_ROUND', { qKey: selectedQuestionKey, isSpyEnabled });
    }

    function revealHintsToGuessers() {
      sendCommand('REVEAL_HINTS');
    }

    function approveAnswer(playerId) { sendCommand('APPROVE_ANSWER', { playerId }); }
    function rejectAnswer(playerId) { sendCommand('REJECT_ANSWER', { playerId }); }
    function approveHint(playerId) { sendCommand('APPROVE_HINT', { playerId }); }
    function rejectHint(playerId) { sendCommand('REJECT_HINT', { playerId }); }
    function toggleHistoryStatus(teamNum, historyId) { sendCommand('TOGGLE_HISTORY', { teamNum, historyId }); }

    function renderLeaderboard() {
      const board = document.getElementById('leaderboard');
      if(!board) return;
      board.innerHTML = '';
      for (let i = 1; i <= gameState.teamsCount; i++) {
        const score = gameState.teamScores[i] || 0;
        board.innerHTML += \`<div class="leaderboard-item clickable" onclick="openHistoryModal(\${i})">\${i}조: <span>\${score}점</span></div>\`;
      }
    }

    function openHistoryModal(teamNum) {
      document.getElementById('modal-title').innerText = \`📋 \${teamNum}조 정/오답 제출 이력\`;
      const listContainer = document.getElementById('modal-history-list');
      const histories = gameState.teamHistories[teamNum] || [];
      if (histories.length === 0) {
        listContainer.innerHTML = '<p style="color:#7f8c8d; padding:20px 0; text-align:center;">제출 이력이 없습니다.</p>';
      } else {
        let html = '';
        histories.slice().reverse().forEach(h => {
          const statusTxt = h.isCorrect ? \`<strong style="color:#2ECC71;">[정답] (+\${h.score}점)</strong>\` : '<strong style="color:#d9534f;">[오답/대기]</strong>';
          const btnTxt = h.isCorrect ? '오답으로 변경' : '정답으로 변경';
          const btnClass = h.isCorrect ? 'btn-danger' : 'btn-approve';
          html += \`
            <div class="history-item">
              <div>
                <small style="color:#7f8c8d;">\${h.timestamp} | \${h.playerName}</small><br>
                제시어: <strong>\${h.targetWord}</strong> / 제출: <strong>\${h.submittedAnswer}</strong><br>
                상태: \${statusTxt}
              </div>
              <div><button class="\${btnClass}" onclick="toggleHistoryStatus(\${teamNum}, '\${h.id}')">\${btnTxt}</button></div>
            </div>\`;
        });
        listContainer.innerHTML = html;
      }
      document.getElementById('history-modal').classList.remove('hidden');
    }

    function closeHistoryModal() { document.getElementById('history-modal').classList.add('hidden'); }

    function renderHostGrid() {
      const grid = document.getElementById('teams-grid');
      if(!grid) return;
      grid.innerHTML = '';
      for (let i = 1; i <= gameState.teamsCount; i++) {
        const members = gameState.teams[i] || [];
        const teamTotal = gameState.teamScores[i] || 0;
        let html = \`<div class="team-card"><h4><span>\${i}조 (\${members.length}명)</span><small style="color:#2ECC71;">총 \${teamTotal}점</small></h4>\`;
        members.forEach(m => {
          const p = m;
          const roleTxt = p.isGuesser ? ' <span class="guesser">[*]</span>' : '';
          const spyBadge = p.isSpy ? ' <span class="spy-badge">스파이🕵️</span>' : '';
          const spyClass = p.isSpy ? ' spy-highlight' : '';
          const timeTxt = p.hintDuration ? \`<span class="time-badge">(\${p.hintDuration}초)</span>\` : '';
          let hintTxt = '';
          if (p.hint) {
            const statusClass = p.isApproved ? 'hint-badge approved' : 'hint-badge';
            const statusLabel = p.isApproved ? '[승인됨]' : '[대기중]';
            let actionBtns = '';
            if (!p.isApproved) actionBtns = \`<button class="btn-approve" onclick="approveHint('\${p.id}')">승인</button>\`;
            actionBtns += \`<button class="btn-danger" onclick="rejectHint('\${p.id}')">반려</button>\`;
            hintTxt = \`<br><span class="\${statusClass}">\${statusLabel} \${p.hint}</span> \${actionBtns}\`;
          }
          let ansTxt = '';
          if (p.answer) {
            if (p.isCorrect) {
              ansTxt = \`<br><small style="color:#27ae60; font-weight:bold;">정답 승인됨: \${p.answer} (+\${p.pendingScore}점)</small> <button class="btn-danger" onclick="rejectAnswer('\${p.id}')">오답 처리</button>\`;
            } else {
              ansTxt = \`<br><small style="color:#e67e22; font-weight:bold;">제출 정답: \${p.answer} (대기점수: \${p.pendingScore}점)</small> <button class="btn-approve" onclick="approveAnswer('\${p.id}')">정답 처리</button> <button class="btn-danger" onclick="rejectAnswer('\${p.id}')">오답 처리</button>\`;
            }
          }
          html += \`<div class="player-item\${spyClass}">• \${p.name}\${timeTxt}\${roleTxt}\${spyBadge}\${hintTxt}\${ansTxt}</div>\`;
        });
        html += \`</div>\`;
        grid.innerHTML += html;
      }
      
      const switchBtn = document.getElementById('toggle-switch-btn');
      if (switchBtn) {
        if (gameState.allowTeamSwitch) {
          switchBtn.innerText = "조 변경 허용: ON"; switchBtn.classList.add('active');
        } else {
          switchBtn.innerText = "조 변경 허용: OFF"; switchBtn.classList.remove('active');
        }
      }
    }

    let selectedTeam = null;
    let isTimerStarted = false;
    let scoreTimerInterval = null;
    let timerStartTime = null;

    function startLiveScoreTimer() {
      stopLiveScoreTimer();
      const scoreBox = document.getElementById('live-score-box');
      const scoreVal = document.getElementById('live-score-val');
      scoreBox.classList.remove('hidden');
      scoreTimerInterval = setInterval(() => {
        if (!timerStartTime) return;
        const elapsed = (Date.now() - timerStartTime) / 1000;
        const currentScore = calculateScore(elapsed);
        scoreVal.innerText = currentScore;
        if (currentScore <= 0) stopLiveScoreTimer();
      }, 50);
    }

    function stopLiveScoreTimer() {
      if (scoreTimerInterval) { clearInterval(scoreTimerInterval); scoreTimerInterval = null; }
    }

    function renderPlayerLeaderboard(count, scores) {
      const board = document.getElementById('player-leaderboard');
      if (!board) return;
      board.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        board.innerHTML += \`<div class="leaderboard-item">\${i}조: <span>\${scores[i] || 0}점</span></div>\`;
      }
    }

    function renderTeamSelectButtons(count, teamCounts) {
      const container = document.getElementById('team-select-buttons');
      container.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-team-select';
        btn.innerText = \`\${i}조 (\${teamCounts[i] || 0}명)\`;
        btn.onclick = () => selectTeam(i, btn);
        container.append(btn);
      }
    }

    function selectTeam(teamNum, btnElement) {
      selectedTeam = teamNum;
      document.querySelectorAll('.btn-team-select').forEach(b => b.classList.remove('active'));
      btnElement.classList.add('active');
      document.getElementById('btn-join-final').disabled = false;
    }

    function joinSelectedTeam() {
      if (!selectedTeam) return alert("조를 선택하세요!");
      const name = document.getElementById('nickname').value.trim();
      ws.send(JSON.stringify({ type: 'JOIN_TEAM', roomId: currentRoomId, name: name, team: selectedTeam }));
    }

    function requestTeamChange() {
      ws.send(JSON.stringify({ type: 'GET_ROOM_INFO', roomId: currentRoomId, isChanging: true }));
    }

    function sendHint() {
      const hint = document.getElementById('hint-input').value.trim();
      if (!hint) return alert("힌트를 입력하세요.");
      if (hint.split(/\s+/).length > 2) return alert("힌트는 최대 2단어까지만 가능합니다!");
      ws.send(JSON.stringify({ type: 'HINT_SUBMIT', roomId: currentRoomId, hint: hint }));
      document.getElementById('hint-msg').style.color = '#2ECC71';
      document.getElementById('hint-msg').innerText = "힌트 전송 완료 (대기 중)";
    }

    function sendAnswer() {
      if (!isTimerStarted) return alert("타이머가 시작되지 않았습니다.");
      const ans = document.getElementById('answer-input').value.trim();
      if (!ans) return alert("정답을 입력하세요.");
      ws.send(JSON.stringify({ type: 'ANSWER_SUBMIT', roomId: currentRoomId, answer: ans }));
      document.getElementById('ans-btn').disabled = true;
      stopLiveScoreTimer();
    }
  </script>
</body>
</html>
    `);
});

// 웹소켓 서버 관리 로직
wss.on('connection', (wsClient) => {
    let currentRoom = null;
    let clientId = Math.random().toString(36).substring(2, 9);
    let clientType = null; 
    let assignedTeam = null;

    wsClient.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        const roomId = data.roomId;

        if (data.type === 'CREATE_ROOM') {
            currentRoomId = roomId;
            currentRoom = {
                hostWs: wsClient,
                masters: new Map(),
                players: new Map(),
                gameState: {
                    teamsCount: data.teamsCount || 4,
                    teams: {},
                    players: {},
                    teamScores: {},
                    teamHistories: {},
                    roundStartTime: null,
                    startTime: null,
                    currentWord: '',
                    currentImage: '',
                    allowTeamSwitch: false
                }
            };
            for (let i = 1; i <= data.teamsCount; i++) {
                currentRoom.gameState.teams[i] = [];
                currentRoom.gameState.teamScores[i] = 0;
                currentRoom.gameState.teamHistories[i] = [];
            }
            rooms.set(roomId, currentRoom);
            clientType = 'host';

            wsClient.send(JSON.stringify({
                type: 'ROOM_CREATED',
                gameState: currentRoom.gameState,
                masters: []
            }));
        }
        else if (data.type === 'MASTER_LOGIN') {
            currentRoom = rooms.get(roomId);
            if (!currentRoom) {
                wsClient.send(JSON.stringify({ type: 'ERROR', message: '존재하지 않는 방입니다.' }));
                return;
            }
            clientType = 'master';
            currentRoom.masters.set(clientId, { ws: wsClient, name: data.masterName || '마스터PC' });

            wsClient.send(JSON.stringify({
                type: 'MASTER_LOGGED_IN',
                gameState: currentRoom.gameState
            }));
            broadcastState(currentRoom);
        }
        else if (data.type === 'GET_ROOM_INFO') {
            currentRoom = rooms.get(roomId);
            if (!currentRoom) {
                wsClient.send(JSON.stringify({ type: 'ERROR', message: '존재하지 않는 방입니다.' }));
                return;
            }
            if (data.name && !data.isChanging) {
                clientType = 'player';
                currentRoom.players.set(clientId, {
                    ws: wsClient, id: clientId, name: data.name, team: null,
                    isGuesser: false, isSpy: false, targetTeamForSpy: null,
                    hint: '', hintDuration: null, isApproved: false, answer: '', pendingScore: null, isCorrect: false
                });
            } else if (data.isChanging && currentRoom.gameState.allowTeamSwitch) {
                // 조 변경 요청 시 처리
                clientType = 'player';
            } else if (data.isChanging && !currentRoom.gameState.allowTeamSwitch) {
                wsClient.send(JSON.stringify({ type: 'ERROR', message: '현재 호스트가 조 변경을 허용하지 않았습니다.' }));
                return;
            }
            const teamCounts = {};
            for (let i = 1; i <= currentRoom.gameState.teamsCount; i++) {
                teamCounts[i] = currentRoom.gameState.teams[i].length;
            }
            wsClient.send(JSON.stringify({
                type: 'ROOM_INFO_RESP',
                teamsCount: currentRoom.gameState.teamsCount,
                teamCounts: teamCounts
            }));
        }
        else if (data.type === 'JOIN_TEAM') {
            currentRoom = rooms.get(roomId);
            if (!currentRoom) return;
            const player = currentRoom.gameState.players[clientId] || currentRoom.players.get(clientId);
            if (player) {
                for (let i = 1; i <= currentRoom.gameState.teamsCount; i++) {
                    currentRoom.gameState.teams[i] = currentRoom.gameState.teams[i].filter(p => p.id !== clientId);
                }
                player.team = data.team;
                if (data.name) player.name = data.name;
                currentRoom.gameState.players[clientId] = player;
                currentRoom.gameState.teams[data.team].push(player);
                assignedTeam = data.team;

                wsClient.send(JSON.stringify({ type: 'JOIN_ACK', team: data.team, name: player.name }));
                broadcastState(currentRoom);
            }
        }
        else if (data.type === 'CLIENT_ACTION') {
            currentRoom = rooms.get(roomId);
            if (!currentRoom) return;
            handleGameAction(currentRoom, data, clientId);
        }
    });

    wsClient.on('close', () => {
        if (!currentRoom) return;
        if (clientType === 'host') {
            rooms.delete(currentRoomId);
        } else if (clientType === 'master') {
            currentRoom.masters.delete(clientId);
            broadcastState(currentRoom);
        } else if (clientType === 'player') {
            currentRoom.players.delete(clientId);
            delete currentRoom.gameState.players[clientId];
            for (let i = 1; i <= currentRoom.gameState.teamsCount; i++) {
                currentRoom.gameState.teams[i] = currentRoom.gameState.teams[i].filter(p => p.id !== clientId);
            }
            broadcastState(currentRoom);
        }
    });
});

function handleGameAction(room, data, clientId) {
    const gs = room.gameState;
    const action = data.action;

    if (action === 'TOGGLE_SWITCH') {
        gs.allowTeamSwitch = !gs.allowTeamSwitch;
    }
    else if (action === 'START_ROUND') {
        const qData = {
            'example': { word: "김동환", image: "" },
            1: { word: "사과", image: "" },
            2: { word: "CIS", image: "" },
            3: { word: "bias", image: "" },
            4: { word: "주석", image: "" },
            5: { word: "산란", image: "" }
        }[data.qKey];

        if (!qData) return;
        gs.currentWord = qData.word;
        gs.currentImage = qData.image;
        gs.roundStartTime = Date.now();
        gs.startTime = null;

        for (let t = 1; t <= gs.teamsCount; t++) {
            const members = gs.teams[t];
            if (!members || members.length === 0) continue;
            const guesserIndex = Math.floor(Math.random() * members.length);
            let spyIndex = -1;
            if (data.isSpyEnabled && members.length > 1) {
                const candidates = [];
                for (let i = 0; i < members.length; i++) { if (i !== guesserIndex) candidates.push(i); }
                spyIndex = candidates[Math.floor(Math.random() * candidates.length)];
            }

            members.forEach((p, idx) => {
                const isGuesser = (idx === guesserIndex);
                const isSpy = (idx === spyIndex);
                let spyTarget = null;
                if (isSpy) {
                    const otherTeams = [];
                    for (let ot = 1; ot <= gs.teamsCount; ot++) { if (ot !== t) otherTeams.push(ot); }
                    if (otherTeams.length > 0) spyTarget = otherTeams[Math.floor(Math.random() * otherTeams.length)];
                }

                p.isGuesser = isGuesser;
                p.isSpy = isSpy;
                p.targetTeamForSpy = spyTarget;
                p.hint = '';
                p.hintDuration = null;
                p.isApproved = false;
                p.answer = '';
                p.pendingScore = null;
                p.isCorrect = false;

                if (p.ws && p.ws.readyState === ws.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'ROUND_START',
                        word: isGuesser ? '???' : qData.word,
                        image: isGuesser ? null : qData.image,
                        isGuesser: isGuesser,
                        isSpy: isSpy
                    }));
                }
            });
        }
    }
    else if (action === 'REVEAL_HINTS') {
        const now = Date.now();
        gs.startTime = now;

        Object.values(gs.players).forEach(p => {
            if (p.hint && !p.isApproved) p.isApproved = true;
        });

        for (let targetTeam = 1; targetTeam <= gs.teamsCount; targetTeam++) {
            const members = gs.teams[targetTeam];
            const guesser = members.find(p => p.isGuesser);
            if (!guesser) continue;

            const hintsList = [];
            members.forEach(p => {
                if (!p.isGuesser && !p.isSpy && p.hint && p.isApproved) hintsList.push(p.hint);
            });
            Object.values(gs.players).forEach(p => {
                if (p.isSpy && p.targetTeamForSpy === targetTeam && p.hint && p.isApproved) hintsList.push(p.hint);
            });

            hintsList.sort(() => Math.random() - 0.5);

            if (guesser.ws && guesser.ws.readyState === ws.OPEN) {
                guesser.ws.send(JSON.stringify({ type: 'HINTS_REVEALED', hints: hintsList, startTime: now }));
            }
        }
    }
    else if (action === 'HINT_SUBMIT') {
        const p = gs.players[clientId];
        if (p) {
            p.hint = data.hint;
            p.isApproved = false;
            if (gs.roundStartTime) p.hintDuration = ((Date.now() - gs.roundStartTime) / 1000).toFixed(1);
        }
    }
    else if (action === 'ANSWER_SUBMIT') {
        const p = gs.players[clientId];
        if (!gs.startTime || !p) return;
        const elapsed = (Date.now() - gs.startTime) / 1000;
        const score = Math.max(0, Math.floor(1000 * Math.pow(1 - (elapsed / 120), 2)));
        p.answer = data.answer;
        p.pendingScore = score;
        const cleanSubmitted = data.answer.replace(/\s+/g, '').toLowerCase();
        const cleanTarget = gs.currentWord.replace(/\s+/g, '').toLowerCase();
        const isMatched = (cleanTarget && cleanSubmitted === cleanTarget);

        if (isMatched) {
            p.isCorrect = true;
            gs.teamScores[p.team] += score;
            if (p.ws && p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: 'ANSWER_AUTO_CORRECT', score }));
            }
            broadcastLeaderboard(room);
        } else {
            if (p.ws && p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: 'ANSWER_PENDING' }));
            }
        }
        gs.teamHistories[p.team].push({
            id: 'HIST-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            playerId: p.id, playerName: p.name, team: p.team,
            targetWord: gs.currentWord, submittedAnswer: data.answer, score, isCorrect: isMatched, timestamp: new Date().toLocaleTimeString()
        });
    }
    else if (action === 'APPROVE_ANSWER') {
        const p = gs.players[data.playerId];
        if (p && !p.isCorrect) {
            p.isCorrect = true;
            gs.teamScores[p.team] += p.pendingScore || 0;
            const history = gs.teamHistories[p.team].slice().reverse().find(h => h.playerId === data.playerId && h.submittedAnswer === p.answer);
            if (history) history.isCorrect = true;
            if (p.ws && p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: 'ANSWER_APPROVED', score: p.pendingScore || 0 }));
            }
            broadcastLeaderboard(room);
        }
    }
    else if (action === 'REJECT_ANSWER') {
        const p = gs.players[data.playerId];
        if (p) {
            if (p.isCorrect) {
                gs.teamScores[p.team] = Math.max(0, gs.teamScores[p.team] - (p.pendingScore || 0));
            }
            p.isCorrect = false;
            const history = gs.teamHistories[p.team].slice().reverse().find(h => h.playerId === data.playerId && h.submittedAnswer === p.answer);
            if (history) history.isCorrect = false;
            if (p.ws && p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: 'ANSWER_REJECTED' }));
            }
            broadcastLeaderboard(room);
        }
    }
    else if (action === 'APPROVE_HINT') {
        const p = gs.players[data.playerId];
        if (p) p.isApproved = true;
    }
    else if (action === 'REJECT_HINT') {
        const p = gs.players[data.playerId];
        if (p) {
            p.hint = '';
            p.hintDuration = null;
            p.isApproved = false;
            if (p.ws && p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({ type: 'HINT_REJECTED' }));
            }
        }
    }
    else if (action === 'TOGGLE_HISTORY') {
        const history = gs.teamHistories[data.teamNum].find(h => h.id === data.historyId);
        const p = gs.players[history?.playerId];
        if (history) {
            if (history.isCorrect) {
                history.isCorrect = false;
                gs.teamScores[data.teamNum] = Math.max(0, gs.teamScores[data.teamNum] - history.score);
                if (p && p.ws && p.ws.readyState === ws.OPEN) {
                    p.ws.send(JSON.stringify({ type: 'ANSWER_REJECTED' }));
                }
            } else {
                history.isCorrect = true;
                gs.teamScores[data.teamNum] += history.score;
                if (p && p.ws && p.ws.readyState === ws.OPEN) {
                    p.ws.send(JSON.stringify({ type: 'ANSWER_APPROVED', score: history.score }));
                }
            }
            broadcastLeaderboard(room);
        }
    }
    else if (action === 'KICK_MASTER') {
        const master = room.masters.get(data.masterId);
        if (master) {
            master.ws.send(JSON.stringify({ type: 'ERROR', message: '방장에 의해 퇴출되었습니다!' }));
            master.ws.close();
            room.masters.delete(data.masterId);
        }
    }

    broadcastState(room);
}

function broadcastState(room) {
    const mastersArr = Array.from(room.masters.entries()).map(([id, m]) => ({ id, name: m.name }));
    const statePayload = JSON.stringify({
        type: 'STATE_SYNC',
        gameState: room.gameState,
        masters: mastersArr
    });

    if (room.hostWs && room.hostWs.readyState === ws.OPEN) {
        room.hostWs.send(statePayload);
    }
    room.masters.forEach(m => {
        if (m.ws.readyState === ws.OPEN) m.ws.send(statePayload);
    });
}

function broadcastLeaderboard(room) {
    const lbPayload = JSON.stringify({
        type: 'LEADERBOARD_UPDATE',
        teamsCount: room.gameState.teamsCount,
        teamScores: room.gameState.teamScores
    });
    room.players.forEach(p => {
        if (p.ws.readyState === ws.OPEN) p.ws.send(lbPayload);
    });
}

server.listen(PORT, () => {
    console.log(`Word Hint Game Server running on port ${PORT}`);
});

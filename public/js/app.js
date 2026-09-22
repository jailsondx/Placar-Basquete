/**
 * Placar Eletrônico de Basquete - Lógica Principal (Client-Side JS)
 * Suporte a atalhos de teclado, cliques virtuais, shot clock 24s/14s, 
 * persistência em tempo real contra F5 (data/current_game.json) e salvamento em JSON.
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- ESTADO DO JOGO ---
  let state = {
    team1: { name: 'TIME 1', score: 0, fouls: 0 },
    team2: { name: 'TIME 2', score: 0, fouls: 0 },
    period: 1,
    gameTime: 600, // 10:00 em segundos
    shotClock: 24,
    shotClockDefault: 24,
    is14sOverride: false,
    isRunning: false,
    timerInterval: null,
    soundEnabled: true
  };

  // --- ELEMENTOS DO DOM ---
  const elMainClock = document.getElementById('main-clock-display');
  const elClockStatus = document.getElementById('clock-status-tag');
  const elShotClock = document.getElementById('shot-clock-display');
  const elShotModeTag = document.getElementById('shot-mode-tag');

  const elTeam1Name = document.getElementById('team1-name');
  const elTeam1Score = document.getElementById('team1-score-display');
  const elTeam1Fouls = document.getElementById('team1-fouls-display');
  const elTeam1Bonus = document.getElementById('team1-bonus-badge');

  const elTeam2Name = document.getElementById('team2-name');
  const elTeam2Score = document.getElementById('team2-score-display');
  const elTeam2Fouls = document.getElementById('team2-fouls-display');
  const elTeam2Bonus = document.getElementById('team2-bonus-badge');

  const elPeriodDisplay = document.getElementById('period-display');

  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnShot24 = document.getElementById('btn-shot-24');
  const btnShot14 = document.getElementById('btn-shot-14');
  const chkSound = document.getElementById('sound-enabled');
  const btnTestBuzzer = document.getElementById('btn-test-buzzer');

  // --- SINTETIZADOR DE ÁUDIO WEB (SIRENE ARENA BASQUETE) ---
  function playBuzzerSound() {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(350, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(700, ctx.currentTime);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(ctx.destination);
      gain2.connect(ctx.destination);

      gain1.gain.setValueAtTime(0.5, ctx.currentTime);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.warn('Erro ao tocar efeito sonoro:', e);
    }
  }

  // --- FORMATADORES ---
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');
    return `${mStr}:${sStr}`;
  }

  function formatNumber2(num) {
    return String(num).padStart(2, '0');
  }

  function getPeriodLabel(period) {
    if (period <= 4) return `${period}`;
    return `OT${period - 4}`;
  }

  // --- PERSISTÊNCIA EM TEMPO REAL (PROTEÇÃO CONTRA RECARREGAR / F5) ---
  let saveDebounceTimeout = null;

  function syncCurrentGameState() {
    const statePayload = {
      team1: { ...state.team1 },
      team2: { ...state.team2 },
      period: state.period,
      gameTime: state.gameTime,
      shotClock: state.shotClock,
      is14sOverride: state.is14sOverride,
      isRunning: false
    };

    localStorage.setItem('basket_current_game', JSON.stringify(statePayload));

    clearTimeout(saveDebounceTimeout);
    saveDebounceTimeout = setTimeout(async () => {
      try {
        await fetch('/api/current-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statePayload)
        });
      } catch (err) {
        console.warn('Erro ao sincronizar com current_game.json backend:', err);
      }
    }, 300);
  }

  async function loadCurrentGameFromBackend() {
    try {
      const res = await fetch('/api/current-game');
      const data = await res.json();
      if (data.success && data.state) {
        applyState(data.state);
        return;
      }
    } catch (e) {
      console.warn('Erro ao buscar estado do backend, verificando localStorage:', e);
    }

    const localSaved = localStorage.getItem('basket_current_game');
    if (localSaved) {
      try {
        applyState(JSON.parse(localSaved));
      } catch (e) {}
    }
  }

  function applyState(savedState) {
    if (savedState.team1) {
      state.team1.name = savedState.team1.name || 'TIME 1';
      state.team1.score = savedState.team1.score || 0;
      state.team1.fouls = savedState.team1.fouls || 0;
      elTeam1Name.value = state.team1.name;
    }
    if (savedState.team2) {
      state.team2.name = savedState.team2.name || 'TIME 2';
      state.team2.score = savedState.team2.score || 0;
      state.team2.fouls = savedState.team2.fouls || 0;
      elTeam2Name.value = state.team2.name;
    }
    if (savedState.period !== undefined) state.period = savedState.period;
    if (savedState.gameTime !== undefined) state.gameTime = savedState.gameTime;
    if (savedState.shotClock !== undefined) state.shotClock = savedState.shotClock;
    if (savedState.is14sOverride !== undefined) state.is14sOverride = savedState.is14sOverride;

    render();
  }

  function resetCurrentStateToDefaults() {
    state.team1 = { name: 'TIME 1', score: 0, fouls: 0 };
    state.team2 = { name: 'TIME 2', score: 0, fouls: 0 };
    state.period = 1;
    state.gameTime = 600;
    state.shotClock = 24;
    state.is14sOverride = false;
    state.isRunning = false;

    elTeam1Name.value = 'TIME 1';
    elTeam2Name.value = 'TIME 2';

    localStorage.removeItem('basket_current_game');
    fetch('/api/current-game', { method: 'DELETE' }).catch(() => {});
    render();
  }

  // --- RENDERIZAÇÃO DA INTERFACE ---
  function render() {
    // Relógios
    elMainClock.textContent = formatTime(state.gameTime);
    elShotClock.textContent = String(state.shotClock).padStart(2, '0');

    if (state.isRunning) {
      elClockStatus.textContent = 'EM ANDAMENTO (Espaço p/ Parar)';
      elClockStatus.style.color = '#22c55e';
      btnPlayPause.innerHTML = '⏸ PAUSAR (Espaço)';
      btnPlayPause.classList.add('running');
    } else {
      elClockStatus.textContent = 'PAUSADO (Espaço Inicia)';
      elClockStatus.style.color = '#fbbf24';
      btnPlayPause.innerHTML = '▶ INICIAR (Espaço)';
      btnPlayPause.classList.remove('running');
    }

    if (state.is14sOverride) {
      elShotModeTag.textContent = 'MODO 14s (UMA VEZ)';
      elShotModeTag.style.color = '#38bdf8';
    } else {
      elShotModeTag.textContent = 'PADRÃO 24s';
      elShotModeTag.style.color = '#94a3b8';
    }

    // Placares
    elTeam1Score.textContent = formatNumber2(state.team1.score);
    elTeam2Score.textContent = formatNumber2(state.team2.score);

    // Faltas
    elTeam1Fouls.textContent = state.team1.fouls;
    elTeam2Fouls.textContent = state.team2.fouls;

    // Bônus de Faltas
    if (state.team1.fouls >= 4) {
      elTeam1Bonus.classList.add('active');
    } else {
      elTeam1Bonus.classList.remove('active');
    }

    if (state.team2.fouls >= 4) {
      elTeam2Bonus.classList.add('active');
    } else {
      elTeam2Bonus.classList.remove('active');
    }

    // Período
    elPeriodDisplay.textContent = getPeriodLabel(state.period);
  }

  // --- LÓGICA DOS CRONÔMETROS ---
  function startClock() {
    if (state.isRunning) return;
    if (state.gameTime <= 0) return;

    state.isRunning = true;
    state.timerInterval = setInterval(() => {
      if (state.gameTime > 0) {
        state.gameTime--;
      }

      if (state.shotClock > 0) {
        state.shotClock--;
      }

      if (state.shotClock === 0) {
        playBuzzerSound();
        resetShotClock(24);
        pauseClock();
      }

      if (state.gameTime === 0) {
        playBuzzerSound();
        pauseClock();
      }

      render();
      syncCurrentGameState();
    }, 1000);

    render();
    syncCurrentGameState();
  }

  function pauseClock() {
    state.isRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    render();
    syncCurrentGameState();
  }

  function toggleClock() {
    if (state.isRunning) {
      pauseClock();
    } else {
      startClock();
    }
  }

  function resetShotClock(seconds = 24, isOverride14 = false) {
    state.shotClock = seconds;
    state.is14sOverride = isOverride14;
    render();
    syncCurrentGameState();
  }

  // --- MANIPULADORES DE PONTUAÇÃO & FALTAS ---
  function addPoints(teamNumber, points) {
    const team = teamNumber === 1 ? state.team1 : state.team2;
    team.score = Math.max(0, team.score + points);
    render();
    syncCurrentGameState();
  }

  function addFoul(teamNumber, delta) {
    const team = teamNumber === 1 ? state.team1 : state.team2;
    team.fouls = Math.max(0, team.fouls + delta);
    render();
    syncCurrentGameState();
  }

  function changePeriod(delta) {
    state.period = Math.max(1, state.period + delta);
    state.team1.fouls = 0;
    state.team2.fouls = 0;
    resetShotClock(24);
    render();
    syncCurrentGameState();
  }

  // --- EVENT LISTENERS DE BOTÕES DA INTERFACE ---

  // Botões de Pontuação em Tela (+1, +2, +3, -1)
  document.querySelectorAll('.btn-score').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = parseInt(btn.dataset.team, 10);
      const points = parseInt(btn.dataset.points, 10);
      addPoints(team, points);
    });
  });

  // Botões de Faltas em Tela (+1, -1)
  document.querySelectorAll('.btn-foul').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = parseInt(btn.dataset.team, 10);
      const delta = parseInt(btn.dataset.foul, 10);
      addFoul(team, delta);
    });
  });

  // Botões do Cronômetro
  btnPlayPause.addEventListener('click', toggleClock);
  btnShot24.addEventListener('click', () => resetShotClock(24, false));
  btnShot14.addEventListener('click', () => resetShotClock(14, true));

  // Botões de Período
  document.getElementById('btn-period-next').addEventListener('click', () => changePeriod(1));
  document.getElementById('btn-period-inc').addEventListener('click', () => changePeriod(1));
  document.getElementById('btn-period-prev').addEventListener('click', () => changePeriod(-1));

  // Nomes dos Times
  elTeam1Name.addEventListener('input', (e) => {
    state.team1.name = e.target.value || 'TIME 1';
    syncCurrentGameState();
  });

  elTeam2Name.addEventListener('input', (e) => {
    state.team2.name = e.target.value || 'TIME 2';
    syncCurrentGameState();
  });

  // Som Toggle
  chkSound.addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
  });

  btnTestBuzzer.addEventListener('click', playBuzzerSound);

  // --- EDIÇÃO MANUAL DE TEMPO DO QUARTO ---
  const modalEditTime = document.getElementById('modal-edit-time');
  const btnEditTime = document.getElementById('btn-edit-time');
  const inputMinutes = document.getElementById('input-minutes');
  const inputSeconds = document.getElementById('input-seconds');
  const btnSaveCustomTime = document.getElementById('btn-save-custom-time');
  const btnResetTime10 = document.getElementById('btn-reset-time');

  btnEditTime.addEventListener('click', openEditTimeModal);
  elMainClock.addEventListener('click', openEditTimeModal);

  function openEditTimeModal() {
    pauseClock();
    const mins = Math.floor(state.gameTime / 60);
    const secs = state.gameTime % 60;
    inputMinutes.value = mins;
    inputSeconds.value = secs;
    openModal('modal-edit-time');
  }

  btnSaveCustomTime.addEventListener('click', () => {
    const mins = Math.max(0, parseInt(inputMinutes.value, 10) || 0);
    const secs = Math.min(59, Math.max(0, parseInt(inputSeconds.value, 10) || 0));
    state.gameTime = (mins * 60) + secs;
    closeModal('modal-edit-time');
    render();
    syncCurrentGameState();
  });

  btnResetTime10.addEventListener('click', () => {
    pauseClock();
    state.gameTime = 600;
    resetShotClock(24);
    render();
    syncCurrentGameState();
  });

  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      inputMinutes.value = btn.dataset.min;
      inputSeconds.value = btn.dataset.sec;
    });
  });

  // --- GERENCIADOR DE MODAIS ---
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.close);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  document.getElementById('btn-shortcuts').addEventListener('click', () => openModal('modal-shortcuts'));

  // --- FINALIZAR E SALVAR PARTIDA NO JSON BACKEND ---
  const modalFinish = document.getElementById('modal-finish');
  const btnFinishGame = document.getElementById('btn-finish-game');
  const btnConfirmSaveJson = document.getElementById('btn-confirm-save-json');
  const finishNotes = document.getElementById('finish-notes');

  btnFinishGame.addEventListener('click', openFinishModal);

  function openFinishModal() {
    pauseClock();

    const t1Name = elTeam1Name.value || 'TIME 1';
    const t2Name = elTeam2Name.value || 'TIME 2';

    document.getElementById('summary-team1-name').textContent = t1Name;
    document.getElementById('summary-team1-score').textContent = formatNumber2(state.team1.score);
    document.getElementById('summary-team2-name').textContent = t2Name;
    document.getElementById('summary-team2-score').textContent = formatNumber2(state.team2.score);

    let winnerText = 'Empate';
    if (state.team1.score > state.team2.score) winnerText = t1Name;
    else if (state.team2.score > state.team1.score) winnerText = t2Name;

    document.getElementById('summary-winner').textContent = winnerText;
    document.getElementById('summary-fouls-info').textContent = `${t1Name}: ${state.team1.fouls} | ${t2Name}: ${state.team2.fouls}`;
    document.getElementById('summary-period').textContent = `Período ${getPeriodLabel(state.period)}`;

    openModal('modal-finish');
  }

  btnConfirmSaveJson.addEventListener('click', async () => {
    btnConfirmSaveJson.disabled = true;
    btnConfirmSaveJson.textContent = 'Salvando no JSON...';

    const payload = {
      team1: {
        name: elTeam1Name.value || 'TIME 1',
        score: state.team1.score,
        fouls: state.team1.fouls
      },
      team2: {
        name: elTeam2Name.value || 'TIME 2',
        score: state.team2.score,
        fouls: state.team2.fouls
      },
      period: getPeriodLabel(state.period),
      duration: formatTime(600 - state.gameTime),
      notes: finishNotes.value.trim()
    };

    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (resData.success) {
        alert('✅ Partida finalizada com sucesso! O histórico foi gravado no JSON e o placar foi reiniciado.');
        closeModal('modal-finish');
        finishNotes.value = '';

        resetCurrentStateToDefaults();
      } else {
        alert('❌ Erro ao salvar jogo: ' + resData.message);
      }
    } catch (err) {
      console.error('Erro na requisição POST /api/games:', err);
      alert('❌ Não foi possível conectar ao servidor Node.js.');
    } finally {
      btnConfirmSaveJson.disabled = false;
      btnConfirmSaveJson.textContent = '💾 Salvar Partida no JSON';
    }
  });

  // --- CARREGAR HISTÓRICO DE JOGOS SALVOS (JSON) ---
  const btnHistory = document.getElementById('btn-history');
  const btnRefreshHistory = document.getElementById('btn-refresh-history');
  const historyLoading = document.getElementById('history-loading');
  const historyEmpty = document.getElementById('history-empty');
  const historyTableContainer = document.getElementById('history-table-container');
  const historyTbody = document.getElementById('history-tbody');

  btnHistory.addEventListener('click', () => {
    openModal('modal-history');
    loadHistory();
  });

  btnRefreshHistory.addEventListener('click', loadHistory);

  async function loadHistory() {
    historyLoading.style.display = 'block';
    historyEmpty.style.display = 'none';
    historyTableContainer.style.display = 'none';

    try {
      const res = await fetch('/api/games');
      const data = await res.json();

      historyLoading.style.display = 'none';

      if (!data.games || data.games.length === 0) {
        historyEmpty.style.display = 'block';
        return;
      }

      historyTbody.innerHTML = '';
      data.games.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${g.formattedDate || g.date}</td>
          <td>${g.team1.name} x ${g.team2.name}</td>
          <td><strong>${g.team1.score} - ${g.team2.score}</strong></td>
          <td style="color: #22c55e; font-weight: bold;">${g.winner}</td>
          <td>${g.team1.fouls} / ${g.team2.fouls}</td>
          <td>
            <button class="btn btn-xs btn-sub btn-delete-game" data-id="${g.id}">Excluir</button>
          </td>
        `;
        historyTbody.appendChild(tr);
      });

      document.querySelectorAll('.btn-delete-game').forEach(b => {
        b.addEventListener('click', async () => {
          if (confirm('Deseja realmente remover esta partida do histórico JSON?')) {
            await fetch(`/api/games/${b.dataset.id}`, { method: 'DELETE' });
            loadHistory();
          }
        });
      });

      historyTableContainer.style.display = 'block';
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      historyLoading.textContent = 'Erro ao carregar os jogos do backend.';
    }
  }

  // --- CAPTURA DE TECLAS (TECLADO OPERACIONAL) ---
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    const key = e.key.toUpperCase();
    const code = e.code;

    // ESPAÇO: Play / Pause Cronômetro
    if (code === 'Space') {
      e.preventDefault();
      toggleClock();
      return;
    }

    // TECLA R: Reset 24s Shot Clock
    if (key === 'R' && !e.shiftKey) {
      e.preventDefault();
      resetShotClock(24, false);
      return;
    }

    // TECLA T ou Shift+R: Reset 14s Shot Clock
    if (key === 'T' || (key === 'R' && e.shiftKey)) {
      e.preventDefault();
      resetShotClock(14, true);
      return;
    }

    // CONTROLES TIME 1 (Esquerda)
    if (key === 'A') { addPoints(1, 1); return; }
    if (key === 'S') { addPoints(1, 2); return; }
    if (key === 'D') { addPoints(1, 3); return; }
    if (key === 'Z') { addPoints(1, -1); return; }
    if (key === 'F') { addFoul(1, 1); return; }
    if (key === 'V') { addFoul(1, -1); return; }

    // CONTROLES TIME 2 (Direita)
    if (key === 'J') { addPoints(2, 1); return; }
    if (key === 'K') { addPoints(2, 2); return; }
    if (key === 'L') { addPoints(2, 3); return; }
    if (key === 'M') { addPoints(2, -1); return; }
    if (key === 'H') { addFoul(2, 1); return; }
    if (key === 'N') { addFoul(2, -1); return; }

    // OUTROS CONTROLES
    if (key === 'P') { changePeriod(1); return; }

    if (code === 'F8') { e.preventDefault(); openFinishModal(); return; }
    if (key === '?' || (key === '/' && e.shiftKey)) { openModal('modal-shortcuts'); return; }
  });

  // --- CARREGAMENTO INICIAL: RESTAURA O JOGO SALVO CONTRA F5 ---
  loadCurrentGameFromBackend();
});

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DEFAULT_PORT = process.env.PORT || 3000;

// O diretório de dados é dinâmico (prioriza DATA_DIR definido pelo Electron ou ambiente)
function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, 'data');
}

function getGamesFile() {
  return path.join(getDataDir(), 'games.json');
}

function getCurrentGameFile() {
  return path.join(getDataDir(), 'current_game.json');
}

// Estado padrão de uma nova partida
const DEFAULT_CURRENT_GAME = {
  campeonato: '',
  team1: { name: 'TIME 1', score: 0, fouls: 0 },
  team2: { name: 'TIME 2', score: 0, fouls: 0 },
  period: 1,
  gameTime: 600, // 10:00
  shotClock: 24,
  is14sOverride: false,
  isRunning: false
};

// Garantir que o diretório data e os arquivos JSON existam
function ensureStorage() {
  const dir = getDataDir();
  const gamesFile = getGamesFile();
  const currentGameFile = getCurrentGameFile();

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(gamesFile)) {
    fs.writeFileSync(gamesFile, JSON.stringify([], null, 2), 'utf8');
  }

  if (!fs.existsSync(currentGameFile)) {
    fs.writeFileSync(currentGameFile, JSON.stringify(DEFAULT_CURRENT_GAME, null, 2), 'utf8');
  }
}

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers de Leitura e Escrita
function getSavedGames() {
  try {
    ensureStorage();
    const data = fs.readFileSync(getGamesFile(), 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Erro ao ler games.json:', err);
    return [];
  }
}

function saveGamesList(games) {
  ensureStorage();
  fs.writeFileSync(getGamesFile(), JSON.stringify(games, null, 2), 'utf8');
}

function getCurrentGame() {
  try {
    ensureStorage();
    const data = fs.readFileSync(getCurrentGameFile(), 'utf8');
    return JSON.parse(data || JSON.stringify(DEFAULT_CURRENT_GAME));
  } catch (err) {
    console.error('Erro ao ler current_game.json:', err);
    return DEFAULT_CURRENT_GAME;
  }
}

function saveCurrentGame(gameState) {
  ensureStorage();
  fs.writeFileSync(getCurrentGameFile(), JSON.stringify(gameState, null, 2), 'utf8');
}

// --- ROTAS DO JOGO ATUAL (PERSISTÊNCIA CONTRA RECARREGAMENTO F5) ---
app.get('/api/current-game', (req, res) => {
  const gameState = getCurrentGame();
  res.json({ success: true, state: gameState });
});

app.post('/api/current-game', (req, res) => {
  const gameState = req.body;
  if (gameState) {
    saveCurrentGame(gameState);
    return res.json({ success: true, message: 'Estado do jogo atualizado em current_game.json' });
  }
  res.status(400).json({ success: false, message: 'Estado inválido' });
});

app.delete('/api/current-game', (req, res) => {
  saveCurrentGame(DEFAULT_CURRENT_GAME);
  res.json({ success: true, message: 'Estado do jogo atual redefinido para o padrão', state: DEFAULT_CURRENT_GAME });
});

// --- ROTAS DE HISTÓRICO DE JOGOS ---
app.get('/api/games', (req, res) => {
  const games = getSavedGames();
  res.json({ success: true, count: games.length, games });
});

app.post('/api/games', (req, res) => {
  const { campeonato, team1, team2, period, duration, notes } = req.body;

  if (!team1 || !team2 || team1.score === undefined || team2.score === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Dados do jogo inválidos. É necessário informar team1 e team2 com seus placares.'
    });
  }

  const games = getSavedGames();

  const newGame = {
    id: 'game_' + Date.now(),
    date: new Date().toISOString(),
    formattedDate: new Date().toLocaleString('pt-BR'),
    campeonato: campeonato || '',
    team1: {
      name: team1.name || 'Time 1',
      score: Number(team1.score) || 0,
      fouls: Number(team1.fouls) || 0
    },
    team2: {
      name: team2.name || 'Time 2',
      score: Number(team2.score) || 0,
      fouls: Number(team2.fouls) || 0
    },
    winner: team1.score > team2.score 
      ? (team1.name || 'Time 1') 
      : (team2.score > team1.score ? (team2.name || 'Time 2') : 'Empate'),
    period: period || 'Finalizado',
    duration: duration || '10:00',
    notes: notes || ''
  };

  games.unshift(newGame);
  saveGamesList(games);

  // Ao salvar o jogo finalizado, reseta o estado do jogo em andamento em current_game.json
  saveCurrentGame(DEFAULT_CURRENT_GAME);

  console.log(`[Placar-Basquete] Jogo finalizado e salvo com sucesso: ${newGame.team1.name} ${newGame.team1.score} x ${newGame.team2.score} ${newGame.team2.name}`);

  res.status(201).json({
    success: true,
    message: 'Resultado da partida salvo com sucesso no arquivo JSON!',
    game: newGame
  });
});

app.delete('/api/games/:id', (req, res) => {
  const { id } = req.params;
  let games = getSavedGames();
  const initialLength = games.length;
  games = games.filter(g => g.id !== id);

  if (games.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Partida não encontrada.' });
  }

  saveGamesList(games);
  res.json({ success: true, message: 'Partida removida do histórico.' });
});

function startServer(port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    ensureStorage();
    const server = app.listen(port, () => {
      const activePort = server.address().port;
      console.log(`===================================================`);
      console.log(` 🏀 Placar de Basquete rodando em: http://localhost:${activePort}`);
      console.log(` 📁 Histórico de jogos em: ${getGamesFile()}`);
      console.log(` 💾 Estado em andamento em: ${getCurrentGameFile()}`);
      console.log(`===================================================`);
      resolve({ server, port: activePort });
    });
    server.on('error', (err) => {
      reject(err);
    });
  });
}

// Se executado diretamente pelo terminal (node server.js)
if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = { app, startServer, ensureStorage, getDataDir };

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Init DB tables
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name VARCHAR(30) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 0,
      lines INTEGER NOT NULL DEFAULT 0,
      played_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('DB ready');
}

// GET or create player by name
app.post('/api/players/login', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  const cleanName = name.trim().slice(0, 30);
  try {
    let result = await pool.query('SELECT * FROM players WHERE LOWER(name) = LOWER($1)', [cleanName]);
    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO players (name) VALUES ($1) RETURNING *',
        [cleanName]
      );
    }
    const player = result.rows[0];
    // Get player stats
    const stats = await pool.query(`
      SELECT COUNT(*) as total_games,
             COALESCE(MAX(score), 0) as best_score,
             COALESCE(SUM(lines), 0) as total_lines
      FROM games WHERE player_id = $1
    `, [player.id]);
    res.json({ player, stats: stats.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Save game result
app.post('/api/games', async (req, res) => {
  const { player_id, score, lines } = req.body;
  if (!player_id || score === undefined || lines === undefined) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }
  try {
    await pool.query(
      'INSERT INTO games (player_id, score, lines) VALUES ($1, $2, $3)',
      [player_id, score, lines]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando partida' });
  }
});

// Global ranking
app.get('/api/ranking', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.name,
             MAX(g.score) as best_score,
             SUM(g.lines) as total_lines,
             COUNT(g.id) as total_games
      FROM players p
      JOIN games g ON g.player_id = p.id
      GROUP BY p.id, p.name
      ORDER BY best_score DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo ranking' });
  }
});

// Player game history
app.get('/api/players/:id/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT score, lines, played_at
      FROM games
      WHERE player_id = $1
      ORDER BY played_at DESC
      LIMIT 10
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`Tetris server running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

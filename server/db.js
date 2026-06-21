// ============================================================
// DATABASE — SQLite nativo di Node.js (modulo node:sqlite, da Node 22.5+)
// Nessuna dipendenza esterna da compilare: massima portabilità sull'hosting
// ============================================================
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { PARTICIPANT_NAMES } = require("./data");

const DATA_DIR = path.join(__dirname, "..", "data");
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "tabellone.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

function init(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT DEFAULT '',
      access_code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS predictions_matches (
      participant_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      home INTEGER,
      away INTEGER,
      PRIMARY KEY (participant_id, match_id),
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );

    CREATE TABLE IF NOT EXISTS predictions_group_order (
      participant_id INTEGER NOT NULL,
      group_letter TEXT NOT NULL,
      pos INTEGER NOT NULL,
      team TEXT,
      PRIMARY KEY (participant_id, group_letter, pos),
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );

    CREATE TABLE IF NOT EXISTS predictions_awards (
      participant_id INTEGER PRIMARY KEY,
      winner TEXT DEFAULT '',
      top_scorer TEXT DEFAULT '',
      most_goals_team TEXT DEFAULT '',
      best_player TEXT DEFAULT '',
      best_goalkeeper TEXT DEFAULT '',
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );

    CREATE TABLE IF NOT EXISTS real_matches (
      match_id TEXT PRIMARY KEY,
      home INTEGER,
      away INTEGER,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS real_group_order (
      group_letter TEXT NOT NULL,
      pos INTEGER NOT NULL,
      team TEXT,
      PRIMARY KEY (group_letter, pos)
    );

    CREATE TABLE IF NOT EXISTS real_awards (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      winner TEXT DEFAULT '',
      top_scorer TEXT DEFAULT '',
      most_goals_team TEXT DEFAULT '',
      best_player TEXT DEFAULT '',
      best_goalkeeper TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL
    );
  `);

  // Migration sicura: aggiunge group_phase_locked se non esiste (compatibile con DB già esistenti)
  try { db.exec("ALTER TABLE admin_settings ADD COLUMN group_phase_locked INTEGER DEFAULT 0"); } catch(e) {}

  // Tabelle per la fase a eliminazione diretta
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions_knockout (
      participant_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      home INTEGER,
      away INTEGER,
      qualifier TEXT,
      PRIMARY KEY (participant_id, match_id),
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
    CREATE TABLE IF NOT EXISTS real_knockout (
      match_id TEXT PRIMARY KEY,
      home_team TEXT,
      away_team TEXT,
      home INTEGER,
      away INTEGER,
      qualifier TEXT,
      updated_at TEXT
    );
  `);

  // Seed: garantisce riga unica per real_awards
  const ra = db.prepare("SELECT id FROM real_awards WHERE id = 1").get();
  if(!ra) db.prepare("INSERT INTO real_awards (id) VALUES (1)").run();

  // Seed: partecipanti dal file Excel fornito, ognuno con un codice di accesso univoco
  const countRow = db.prepare("SELECT COUNT(*) as c FROM participants").get();
  if(countRow.c === 0){
    const insert = db.prepare("INSERT INTO participants (name, team, access_code) VALUES (?, '', ?)");
    const insertAwards = db.prepare("INSERT INTO predictions_awards (participant_id) VALUES (?)");
    db.exec("BEGIN");
    try{
      PARTICIPANT_NAMES.forEach(name => {
        const code = generateAccessCode();
        const info = insert.run(name, code);
        insertAwards.run(info.lastInsertRowid);
      });
      db.exec("COMMIT");
      console.log(`Seed completato: ${PARTICIPANT_NAMES.length} concorrenti inseriti.`);
    }catch(e){
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

function generateAccessCode(){
  // codice breve leggibile, es. "K3F7Q1" — usato come "password personale" del concorrente
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

module.exports = { db, init, generateAccessCode };

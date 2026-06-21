// ============================================================
// SERVER — node:http nativo + node:sqlite nativo
// Tabellone Mondiale 2026, backend condiviso multi-utente
// ZERO dipendenze npm esterne: gira con il solo Node.js installato
// ============================================================
const path = require("path");
const fs = require("fs");
const http = require("http");
const url = require("url");

const { Router, readJsonBody } = require("./router");
const { sessionMiddleware, applySessionCookie } = require("./sessions");
const { hashPassword, verifyPassword } = require("./auth");
const { db, init, generateAccessCode } = require("./db");
const { MATCHES, GROUPS, ALL_TEAMS, POINTS } = require("./data");
const { computeLeaderboard, getRealMatches, getRealGroupOrder, getRealAwards } = require("./scoring");

init();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD_DEFAULT = process.env.ADMIN_PASSWORD || "mondiale2026";
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function ensureAdminPassword(){
  const row = db.prepare("SELECT * FROM admin_settings WHERE id = 1").get();
  if(!row){
    const hash = hashPassword(ADMIN_PASSWORD_DEFAULT);
    db.prepare("INSERT INTO admin_settings (id, password_hash) VALUES (1, ?)").run(hash);
    console.log("Password admin inizializzata (variabile ADMIN_PASSWORD o default 'mondiale2026').");
  }
}
ensureAdminPassword();

// ============================================================
// HELPERS RISPOSTA JSON
// ============================================================
function sendJson(res, statusCode, payload){
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
function requireParticipant(req, res){
  if(!req.session.participantId){
    sendJson(res, 401, { error: "Accesso non autorizzato: effettua il login con il tuo codice" });
    return false;
  }
  return true;
}
function requireAdmin(req, res){
  if(!req.session.isAdmin){
    sendJson(res, 401, { error: "Accesso admin richiesto" });
    return false;
  }
  return true;
}

// Blocco temporale pronostici:
// Giornate 1+2 → bloccate dopo il 16/6/2026 ore 17:00 (2h prima della prima partita G2 del 16/6)
// Giornata 3   → bloccata dopo il 23/6/2026 ore 17:00 (2h prima della prima partita G3 del 23/6)
const LOCK_G1G2  = new Date("2026-06-16T17:00:00+02:00");
const LOCK_G3    = new Date("2026-06-23T17:00:00+02:00");
const LOCK_GROUPS = new Date("2026-06-11T19:00:00+02:00"); // 2h prima del calcio d'inizio del Mondiale
const LOCK_AWARDS = new Date("2026-06-11T19:00:00+02:00"); // stessa: inseriti prima dell'inizio

// Mappa match_id → giornata (1, 2 o 3)
const MATCH_ROUND = {};
const { MATCHES: _ALL_MATCHES } = require("./data");
_ALL_MATCHES.forEach(m => {
  // Le partite con id che finiscono in 1,2 = giornata 1; 3,4 = giornata 2; 5,6 = giornata 3
  const n = parseInt(m.id.slice(-1));
  MATCH_ROUND[m.id] = n <= 2 ? 1 : n <= 4 ? 2 : 3;
});

function isMatchLocked(matchId){
  const now = new Date();
  const round = MATCH_ROUND[matchId];
  if(round === 1 || round === 2) return now >= LOCK_G1G2;
  if(round === 3) return now >= LOCK_G3;
  return false;
}

// Restituisce lo stato di blocco per ogni partita (usato dal frontend per colorare in rosso)
function getMatchLockStatus(){
  const now = new Date();
  const status = {};
  _ALL_MATCHES.forEach(m => {
    const round = MATCH_ROUND[m.id];
    const lockTime = (round === 1 || round === 2) ? LOCK_G1G2 : LOCK_G3;
    status[m.id] = { locked: now >= lockTime, lockTime: lockTime.toISOString() };
  });
  return status;
}

// ============================================================
// ROUTER — definizione di tutte le rotte API
// ============================================================
const router = new Router();

// ---- AUTH CONCORRENTI ----
router.post("/api/auth/participant-login", async (req, res) => {
  const body = await readJsonBody(req);
  const code = (body.accessCode || "").trim().toUpperCase();
  if(!code) return sendJson(res, 400, { error: "Codice di accesso mancante" });
  const p = db.prepare("SELECT * FROM participants WHERE access_code = ?").get(code);
  if(!p) return sendJson(res, 401, { error: "Codice di accesso non valido" });
  req.session.participantId = p.id;
  req.session.isAdmin = false;
  sendJson(res, 200, { id: p.id, name: p.name, team: p.team });
});

router.post("/api/auth/logout", async (req, res) => {
  req.session.destroy();
  sendJson(res, 200, { ok: true });
});

router.get("/api/auth/me", async (req, res) => {
  if(req.session.participantId){
    const p = db.prepare("SELECT id, name, team FROM participants WHERE id = ?").get(req.session.participantId);
    if(p) return sendJson(res, 200, { type: "participant", ...p });
  }
  if(req.session.isAdmin) return sendJson(res, 200, { type: "admin" });
  sendJson(res, 200, { type: "guest" });
});

// ---- AUTH ADMIN ----
router.post("/api/auth/admin-login", async (req, res) => {
  const body = await readJsonBody(req);
  const row = db.prepare("SELECT * FROM admin_settings WHERE id = 1").get();
  if(!row || !verifyPassword(body.password || "", row.password_hash)){
    return sendJson(res, 401, { error: "Password errata" });
  }
  req.session.isAdmin = true;
  req.session.participantId = null;
  sendJson(res, 200, { ok: true });
});

router.post("/api/admin/change-password", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if(!body.newPassword || body.newPassword.length < 4){
    return sendJson(res, 400, { error: "Password troppo corta (minimo 4 caratteri)" });
  }
  const hash = hashPassword(body.newPassword);
  db.prepare("UPDATE admin_settings SET password_hash = ? WHERE id = 1").run(hash);
  sendJson(res, 200, { ok: true });
});

// ---- DATI TORNEO (pubblici) ----
router.get("/api/tournament", async (req, res) => {
  sendJson(res, 200, { groups: GROUPS, teams: ALL_TEAMS, matches: MATCHES, points: POINTS });
});

// ---- CONCORRENTI ----
router.get("/api/participants", async (req, res) => {
  const rows = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  sendJson(res, 200, rows);
});

router.get("/api/admin/participants", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const rows = db.prepare("SELECT id, name, team, access_code FROM participants ORDER BY id").all();
  sendJson(res, 200, rows);
});

router.post("/api/admin/participants/:id/regenerate-code", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const id = parseInt(params.id, 10);
  const newCode = generateAccessCode();
  db.prepare("UPDATE participants SET access_code = ? WHERE id = ?").run(newCode, id);
  sendJson(res, 200, { id, accessCode: newCode });
});

router.put("/api/admin/participants/:id", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const id = parseInt(params.id, 10);
  const body = await readJsonBody(req);
  db.prepare("UPDATE participants SET name = ?, team = ? WHERE id = ?").run(body.name, body.team || "", id);
  sendJson(res, 200, { ok: true });
});

// ---- PRONOSTICI: PARTITE ----
router.get("/api/predictions/matches", async (req, res) => {
  if(!requireParticipant(req, res)) return;
  const rows = db.prepare("SELECT match_id, home, away FROM predictions_matches WHERE participant_id = ?").all(req.session.participantId);
  const map = {};
  rows.forEach(r => map[r.match_id] = { home: r.home, away: r.away });
  sendJson(res, 200, map);
});

router.put("/api/predictions/matches/:matchId", async (req, res, params) => {
  if(!requireParticipant(req, res)) return;
  const { matchId } = params;
  const body = await readJsonBody(req);
  const valid = MATCHES.some(m => m.id === matchId);
  if(!valid) return sendJson(res, 400, { error: "Partita non valida" });
  if(isMatchLocked(matchId)) return sendJson(res, 403, { error: "Pronostico bloccato: il termine per questa partita è scaduto" });
  const h = body.home === "" || body.home === null || body.home === undefined ? null : Math.max(0, Math.min(20, parseInt(body.home, 10)));
  const a = body.away === "" || body.away === null || body.away === undefined ? null : Math.max(0, Math.min(20, parseInt(body.away, 10)));
  db.prepare(`
    INSERT INTO predictions_matches (participant_id, match_id, home, away)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(participant_id, match_id) DO UPDATE SET home = excluded.home, away = excluded.away
  `).run(req.session.participantId, matchId, h, a);
  sendJson(res, 200, { ok: true });
});

// ---- PRONOSTICI: ORDINE GIRONI ----
router.get("/api/predictions/group-order", async (req, res) => {
  if(!requireParticipant(req, res)) return;
  const rows = db.prepare("SELECT group_letter, pos, team FROM predictions_group_order WHERE participant_id = ?").all(req.session.participantId);
  const map = {};
  rows.forEach(r => {
    if(!map[r.group_letter]) map[r.group_letter] = [null, null, null, null];
    map[r.group_letter][r.pos] = r.team;
  });
  sendJson(res, 200, map);
});

router.put("/api/predictions/group-order/:group/:pos", async (req, res, params) => {
  if(!requireParticipant(req, res)) return;
  if(new Date() >= LOCK_GROUPS) return sendJson(res, 403, { error: "Pronostici gironi bloccati: il termine è scaduto" });
  const group = params.group.toUpperCase();
  const pos = parseInt(params.pos, 10);
  const body = await readJsonBody(req);
  if(!GROUPS[group] || pos < 0 || pos > 3) return sendJson(res, 400, { error: "Girone o posizione non validi" });
  if(body.team && !GROUPS[group].includes(body.team)) return sendJson(res, 400, { error: "Squadra non presente in questo girone" });
  db.prepare(`
    INSERT INTO predictions_group_order (participant_id, group_letter, pos, team)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(participant_id, group_letter, pos) DO UPDATE SET team = excluded.team
  `).run(req.session.participantId, group, pos, body.team || null);
  sendJson(res, 200, { ok: true });
});

// ---- PRONOSTICI: PREMI ----
router.get("/api/predictions/awards", async (req, res) => {
  if(!requireParticipant(req, res)) return;
  const row = db.prepare("SELECT * FROM predictions_awards WHERE participant_id = ?").get(req.session.participantId);
  sendJson(res, 200, row || {});
});

router.put("/api/predictions/awards", async (req, res) => {
  if(!requireParticipant(req, res)) return;
  if(new Date() >= LOCK_AWARDS) return sendJson(res, 403, { error: "Pronostici premi bloccati: il termine è scaduto" });
  const body = await readJsonBody(req);
  db.prepare(`
    INSERT INTO predictions_awards (participant_id, winner, top_scorer, most_goals_team, best_player, best_goalkeeper)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(participant_id) DO UPDATE SET
      winner = excluded.winner, top_scorer = excluded.top_scorer,
      most_goals_team = excluded.most_goals_team, best_player = excluded.best_player,
      best_goalkeeper = excluded.best_goalkeeper
  `).run(req.session.participantId, body.winner || "", body.top_scorer || "", body.most_goals_team || "", body.best_player || "", body.best_goalkeeper || "");
  sendJson(res, 200, { ok: true });
});

// ---- RISULTATI REALI (lettura pubblica, scrittura solo admin) ----
router.get("/api/real/matches", async (req, res) => sendJson(res, 200, getRealMatches()));

router.put("/api/admin/real/matches/:matchId", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const { matchId } = params;
  const body = await readJsonBody(req);
  const valid = MATCHES.some(m => m.id === matchId);
  if(!valid) return sendJson(res, 400, { error: "Partita non valida" });
  const h = body.home === "" || body.home === null || body.home === undefined ? null : Math.max(0, Math.min(20, parseInt(body.home, 10)));
  const a = body.away === "" || body.away === null || body.away === undefined ? null : Math.max(0, Math.min(20, parseInt(body.away, 10)));
  db.prepare(`
    INSERT INTO real_matches (match_id, home, away, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(match_id) DO UPDATE SET home = excluded.home, away = excluded.away, updated_at = excluded.updated_at
  `).run(matchId, h, a);
  sendJson(res, 200, { ok: true });
});

router.get("/api/real/group-order", async (req, res) => sendJson(res, 200, getRealGroupOrder()));

router.put("/api/admin/real/group-order/:group/:pos", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const group = params.group.toUpperCase();
  const pos = parseInt(params.pos, 10);
  const body = await readJsonBody(req);
  if(!GROUPS[group] || pos < 0 || pos > 3) return sendJson(res, 400, { error: "Girone o posizione non validi" });
  if(body.team && !GROUPS[group].includes(body.team)) return sendJson(res, 400, { error: "Squadra non presente in questo girone" });
  db.prepare(`
    INSERT INTO real_group_order (group_letter, pos, team)
    VALUES (?, ?, ?)
    ON CONFLICT(group_letter, pos) DO UPDATE SET team = excluded.team
  `).run(group, pos, body.team || null);
  sendJson(res, 200, { ok: true });
});

router.get("/api/real/awards", async (req, res) => sendJson(res, 200, getRealAwards()));

router.put("/api/admin/real/awards", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  db.prepare(`
    UPDATE real_awards SET winner=?, top_scorer=?, most_goals_team=?, best_player=?, best_goalkeeper=? WHERE id = 1
  `).run(body.winner || "", body.top_scorer || "", body.most_goals_team || "", body.best_player || "", body.best_goalkeeper || "");
  sendJson(res, 200, { ok: true });
});

// Calcolo automatico ordine girone dai risultati reali già inseriti (punti, diff reti, reti fatte)
router.post("/api/admin/auto-group-order/:group", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const group = params.group.toUpperCase();
  if(!GROUPS[group]) return sendJson(res, 400, { error: "Girone non valido" });
  const teams = GROUPS[group];
  const stats = {};
  teams.forEach(t => stats[t] = { pts: 0, gf: 0, gs: 0, dr: 0 });

  const groupMatches = MATCHES.filter(m => m.group === group);
  const real = getRealMatches();
  groupMatches.forEach(m => {
    const r = real[m.id];
    if(!r || r.home === null || r.away === null || r.home === undefined || r.away === undefined) return;
    stats[m.home].gf += r.home; stats[m.home].gs += r.away;
    stats[m.away].gf += r.away; stats[m.away].gs += r.home;
    if(r.home > r.away) stats[m.home].pts += 3;
    else if(r.home < r.away) stats[m.away].pts += 3;
    else { stats[m.home].pts += 1; stats[m.away].pts += 1; }
  });
  teams.forEach(t => stats[t].dr = stats[t].gf - stats[t].gs);

  const ordered = teams.slice().sort((a, b) => {
    if(stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
    if(stats[b].dr !== stats[a].dr) return stats[b].dr - stats[a].dr;
    return stats[b].gf - stats[a].gf;
  });

  const stmt = db.prepare(`
    INSERT INTO real_group_order (group_letter, pos, team) VALUES (?, ?, ?)
    ON CONFLICT(group_letter, pos) DO UPDATE SET team = excluded.team
  `);
  ordered.forEach((team, pos) => stmt.run(group, pos, team));

  sendJson(res, 200, { group, order: ordered, stats });
});

// ---- BLOCCO/SBLOCCO FASE A GIRONI ----
router.get("/api/admin/group-phase-status", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const row = db.prepare("SELECT group_phase_locked FROM admin_settings WHERE id = 1").get();
  sendJson(res, 200, { locked: row ? (row.group_phase_locked === 1) : false });
});

router.post("/api/admin/group-phase-lock", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  db.prepare("UPDATE admin_settings SET group_phase_locked = 1 WHERE id = 1").run();
  sendJson(res, 200, { locked: true });
});

router.post("/api/admin/group-phase-unlock", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  db.prepare("UPDATE admin_settings SET group_phase_locked = 0 WHERE id = 1").run();
  sendJson(res, 200, { locked: false });
});

// ---- STATO BLOCCO (pubblico, usato dal frontend) ----
router.get("/api/predictions/lock-status", async (req, res) => {
  const now = new Date();
  sendJson(res, 200, {
    matches: getMatchLockStatus(),
    groups: { locked: now >= LOCK_GROUPS, lockTime: LOCK_GROUPS.toISOString() },
    awards: { locked: now >= LOCK_AWARDS, lockTime: LOCK_AWARDS.toISOString() }
  });
});

// ---- PRONOSTICI DI TUTTI I CONCORRENTI (pubbliche, visibili a tutti i loggati) ----
router.get("/api/public/all-predictions/matches", async (req, res) => {
  if(!req.session.participantId && !req.session.isAdmin)
    return sendJson(res, 401, { error: "Accesso non autorizzato" });
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allMatches = db.prepare("SELECT * FROM predictions_matches").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, matches: {} }; });
  allMatches.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].matches[r.match_id] = { home: r.home, away: r.away };
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

router.get("/api/public/all-predictions/groups", async (req, res) => {
  if(!req.session.participantId && !req.session.isAdmin)
    return sendJson(res, 401, { error: "Accesso non autorizzato" });
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allGroups = db.prepare("SELECT * FROM predictions_group_order").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, groups: {} }; });
  allGroups.forEach(r => {
    if(!byParticipant[r.participant_id]) return;
    if(!byParticipant[r.participant_id].groups[r.group_letter])
      byParticipant[r.participant_id].groups[r.group_letter] = [null,null,null,null];
    byParticipant[r.participant_id].groups[r.group_letter][r.pos] = r.team;
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

router.get("/api/public/all-predictions/awards", async (req, res) => {
  if(!req.session.participantId && !req.session.isAdmin)
    return sendJson(res, 401, { error: "Accesso non autorizzato" });
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allAwards = db.prepare("SELECT * FROM predictions_awards").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, awards: {} }; });
  allAwards.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].awards = r;
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

// ---- PRONOSTICI DI TUTTI I CONCORRENTI (solo admin) ----
router.get("/api/admin/all-predictions/matches", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allMatches = db.prepare("SELECT * FROM predictions_matches").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, matches: {} }; });
  allMatches.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].matches[r.match_id] = { home: r.home, away: r.away };
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

router.get("/api/admin/all-predictions/groups", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allGroups = db.prepare("SELECT * FROM predictions_group_order").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, groups: {} }; });
  allGroups.forEach(r => {
    if(!byParticipant[r.participant_id]) return;
    if(!byParticipant[r.participant_id].groups[r.group_letter])
      byParticipant[r.participant_id].groups[r.group_letter] = [null,null,null,null];
    byParticipant[r.participant_id].groups[r.group_letter][r.pos] = r.team;
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

router.get("/api/admin/all-predictions/awards", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allAwards = db.prepare("SELECT * FROM predictions_awards").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, awards: {} }; });
  allAwards.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].awards = r;
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

// ============================================================
// FASE KNOCKOUT — slot, pronostici e risultati
// ============================================================

// Risolve le squadre degli slot dai risultati reali dei gironi e dai knockout precedenti
function resolveKnockoutSlots(){
  const { KNOCKOUT_MATCHES } = require("./data");
  const groupOrder = getRealGroupOrder(); // {A:[team0,team1,team2,team3], ...}

  // Recupera i risultati reali dei knockout già inseriti
  const realKO = db.prepare("SELECT * FROM real_knockout").all();
  const realKOMap = {};
  realKO.forEach(r => realKOMap[r.match_id] = r);

  // Per ogni slot, risolve la squadra in base alla descrizione
  function resolveSlot(slot) {
    if(!slot) return null;
    // "1ª Girone A" → prima classificata del girone A
    const groupMatch = slot.match(/^(\d)ª Girone ([A-L])$/);
    if(groupMatch) {
      const pos = parseInt(groupMatch[1]) - 1;
      const g = groupMatch[2];
      return groupOrder[g] && groupOrder[g][pos] || null;
    }
    // "3ª Girone A/B/C/D/F" → terza classificata (l'admin la inserisce manualmente)
    if(slot.startsWith("3ª Girone ")) return null; // da inserire manualmente
    // "Vincente R32-1" → vincente del match R32-1
    const vincMatch = slot.match(/^Vincente (.+)$/);
    if(vincMatch) {
      const r = realKOMap[vincMatch[1]];
      return r ? r.qualifier : null;
    }
    // "Perdente SF-1" → perdente della semifinale
    const perdMatch = slot.match(/^Perdente (.+)$/);
    if(perdMatch) {
      const r = realKOMap[perdMatch[1]];
      if(!r || !r.qualifier) return null;
      // Il perdente è la squadra che NON ha vinto
      if(r.home_team === r.qualifier) return r.away_team;
      if(r.away_team === r.qualifier) return r.home_team;
      return null;
    }
    return null;
  }

  return KNOCKOUT_MATCHES.map(m => ({
    ...m,
    homeTeam: realKOMap[m.id]?.home_team || resolveSlot(m.homeSlot),
    awayTeam: realKOMap[m.id]?.away_team || resolveSlot(m.awaySlot),
    result: realKOMap[m.id] ? {
      home: realKOMap[m.id].home,
      away: realKOMap[m.id].away,
      qualifier: realKOMap[m.id].qualifier
    } : null
  }));
}

// GET: stato completo del tabellone knockout (pubblico)
router.get("/api/knockout/matches", async (req, res) => {
  const { KNOCKOUT_PHASES } = require("./data");
  sendJson(res, 200, {
    phases: KNOCKOUT_PHASES,
    matches: resolveKnockoutSlots()
  });
});

// GET: pronostici knockout del concorrente loggato
router.get("/api/predictions/knockout", async (req, res) => {
  if(!requireParticipant(req, res)) return;
  const rows = db.prepare("SELECT * FROM predictions_knockout WHERE participant_id = ?").all(req.session.participantId);
  const map = {};
  rows.forEach(r => map[r.match_id] = { home: r.home, away: r.away, qualifier: r.qualifier });
  sendJson(res, 200, map);
});

// PUT: salva pronostico knockout (solo se la partita ha le squadre assegnate)
router.put("/api/predictions/knockout/:matchId", async (req, res, params) => {
  if(!requireParticipant(req, res)) return;
  const { matchId } = params;
  const { KNOCKOUT_MATCHES, KNOCKOUT_PHASES } = require("./data");
  const match = KNOCKOUT_MATCHES.find(m => m.id === matchId);
  if(!match) return sendJson(res, 400, { error: "Partita knockout non valida" });

  // Blocco temporale: 2h prima del kickoff della fase
  const phase = KNOCKOUT_PHASES.find(p => p.id === match.phase);
  if(phase) {
    const lockTime = new Date(new Date(phase.firstKickoff).getTime() - 2*60*60*1000);
    if(new Date() >= lockTime) return sendJson(res, 403, { error: "Pronostico bloccato: il termine per questa fase è scaduto" });
  }

  const body = await readJsonBody(req);
  const h = body.home === "" || body.home === null || body.home === undefined ? null : Math.max(0, Math.min(20, parseInt(body.home, 10)));
  const a = body.away === "" || body.away === null || body.away === undefined ? null : Math.max(0, Math.min(20, parseInt(body.away, 10)));
  const q = body.qualifier || null;

  db.prepare(`
    INSERT INTO predictions_knockout (participant_id, match_id, home, away, qualifier)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(participant_id, match_id) DO UPDATE SET home=excluded.home, away=excluded.away, qualifier=excluded.qualifier
  `).run(req.session.participantId, matchId, h, a, q);
  sendJson(res, 200, { ok: true });
});

// Admin: inserisce risultato reale knockout + squadre + vincitore
router.put("/api/admin/real/knockout/:matchId", async (req, res, params) => {
  if(!requireAdmin(req, res)) return;
  const { matchId } = params;
  const { KNOCKOUT_MATCHES } = require("./data");
  if(!KNOCKOUT_MATCHES.find(m => m.id === matchId))
    return sendJson(res, 400, { error: "Partita knockout non valida" });
  const body = await readJsonBody(req);
  const h = body.home === "" || body.home === null ? null : parseInt(body.home, 10);
  const a = body.away === "" || body.away === null ? null : parseInt(body.away, 10);
  db.prepare(`
    INSERT INTO real_knockout (match_id, home_team, away_team, home, away, qualifier, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(match_id) DO UPDATE SET
      home_team=excluded.home_team, away_team=excluded.away_team,
      home=excluded.home, away=excluded.away,
      qualifier=excluded.qualifier, updated_at=excluded.updated_at
  `).run(matchId, body.homeTeam || null, body.awayTeam || null, h, a, body.qualifier || null);
  sendJson(res, 200, { ok: true });
});

// Tutti i pronostici knockout (pubblico per concorrenti loggati, usato dal listone)
router.get("/api/public/all-predictions/knockout", async (req, res) => {
  if(!req.session.participantId && !req.session.isAdmin)
    return sendJson(res, 401, { error: "Accesso non autorizzato" });
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allKO = db.prepare("SELECT * FROM predictions_knockout").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, knockout: {} }; });
  allKO.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].knockout[r.match_id] = { home: r.home, away: r.away, qualifier: r.qualifier };
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

router.get("/api/admin/all-predictions/knockout", async (req, res) => {
  if(!requireAdmin(req, res)) return;
  const participants = db.prepare("SELECT id, name, team FROM participants ORDER BY id").all();
  const allKO = db.prepare("SELECT * FROM predictions_knockout").all();
  const byParticipant = {};
  participants.forEach(p => { byParticipant[p.id] = { participant: p, knockout: {} }; });
  allKO.forEach(r => {
    if(byParticipant[r.participant_id])
      byParticipant[r.participant_id].knockout[r.match_id] = { home: r.home, away: r.away, qualifier: r.qualifier };
  });
  sendJson(res, 200, { participants, predictions: byParticipant });
});

// ---- CLASSIFICA GENERALE ----
router.get("/api/leaderboard", async (req, res) => sendJson(res, 200, computeLeaderboard()));

// ============================================================
// FILE STATICI
// ============================================================
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function tryServeStatic(req, res, pathname){
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(pathname));
  if(pathname === "/") filePath = path.join(PUBLIC_DIR, "index.html");
  if(!filePath.startsWith(PUBLIC_DIR)) return false; // path traversal guard
  if(!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ============================================================
// SERVER HTTP
// ============================================================
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  sessionMiddleware(req, res);
  applySessionCookie(req, res);

  if(pathname.startsWith("/api/")){
    const match = router.match(req.method, pathname);
    if(!match){
      sendJson(res, 404, { error: "Rotta API non trovata" });
      return;
    }
    try{
      await match.handler(req, res, match.params);
    }catch(err){
      console.error("Errore interno:", err);
      sendJson(res, 500, { error: "Errore interno del server" });
    }
    return;
  }

  if(tryServeStatic(req, res, pathname)) return;
  tryServeStatic(req, res, "/index.html");
});

server.listen(PORT, () => {
  console.log(`Tabellone Mondiale 2026 in ascolto su http://localhost:${PORT}`);
  console.log(`Password admin di default: ${ADMIN_PASSWORD_DEFAULT} (cambiala con la variabile d'ambiente ADMIN_PASSWORD)`);
});

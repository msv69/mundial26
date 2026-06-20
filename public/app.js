// ============================================================
// APP.JS — Tabellone Mondiale 2026 — Frontend collegato al backend
// Tutte le scritture/letture passano dalle API REST del server
// ============================================================

const API = "/api";

async function apiCall(method, path, body){
  const opts = { method, headers: {}, credentials: "include" };
  if(body !== undefined){
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  let data = null;
  try{ data = await res.json(); }catch(e){ /* risposta vuota */ }
  if(!res.ok){
    const err = new Error((data && data.error) || ("Errore HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
const apiGet = (path) => apiCall("GET", path);
const apiPost = (path, body) => apiCall("POST", path, body);
const apiPut = (path, body) => apiCall("PUT", path, body);

// ============================================================
// STATO GLOBALE LATO CLIENT (cache dei dati torneo + sessione)
// ============================================================
let SESSION = { type: "guest" }; // {type:'guest'|'participant'|'admin', id, name, team}
let TOURNAMENT = null; // {groups, teams, matches, points}
let PARTICIPANTS_CACHE = [];

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function showToast(msg, isError){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.background = isError ? "var(--red-card)" : "var(--gold)";
  t.style.color = isError ? "var(--chalk)" : "#1b1304";
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=> t.classList.remove("show"), 2400);
}

function teamOptionsHtml(selected, includeEmpty=true){
  let html = includeEmpty ? `<option value="">— seleziona —</option>` : "";
  TOURNAMENT.teams.slice().sort((a,b)=>a.localeCompare(b,'it')).forEach(t=>{
    html += `<option value="${t}" ${t===selected?'selected':''}>${t}</option>`;
  });
  return html;
}
function groupTeamOptionsHtml(groupLetter, selected){
  let html = `<option value="">— seleziona —</option>`;
  TOURNAMENT.groups[groupLetter].forEach(t=>{
    html += `<option value="${t}" ${t===selected?'selected':''}>${t}</option>`;
  });
  return html;
}

// ============================================================
// LOGIN SCREENS
// ============================================================
let loginMode = "participant"; // 'participant' | 'admin'

function renderLoginScreen(){
  const el = document.getElementById("login-screen");
  el.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        ${loginMode === "participant" ? `
          <span class="icon">🔑</span>
          <h2>Accedi con il tuo codice</h2>
          <p>Hai ricevuto un codice personale a 6 caratteri dall'organizzatore della lega. Inseriscilo per accedere ai tuoi pronostici.</p>
          <input type="text" id="login-code" maxlength="6" placeholder="ES. K3F7Q1" autocomplete="off">
          <div style="margin-top:16px;"><button class="btn-primary" id="login-participant-btn" style="width:100%;">Entra</button></div>
          <div class="error-msg" id="login-error"></div>
          <div class="login-switch">Sei l'organizzatore? <a id="switch-to-admin">Accedi come admin</a></div>
        ` : `
          <span class="icon">🛠️</span>
          <h2>Accesso amministratore</h2>
          <p>Area riservata all'organizzatore della lega: inserimento risultati reali, gestione concorrenti.</p>
          <input type="password" id="login-password" placeholder="Password admin" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <div style="margin-top:16px;"><button class="btn-primary" id="login-admin-btn" style="width:100%;">Entra come admin</button></div>
          <div class="error-msg" id="login-error"></div>
          <div class="login-switch">Sei un concorrente? <a id="switch-to-participant">Accedi con codice</a></div>
        `}
      </div>
    </div>
  `;

  if(loginMode === "participant"){
    const input = document.getElementById("login-code");
    const btn = document.getElementById("login-participant-btn");
    const doLogin = async () => {
      const code = input.value.trim();
      if(!code) return;
      try{
        const data = await apiPost("/auth/participant-login", { accessCode: code });
        SESSION = { type: "participant", ...data };
        showToast("Benvenuto, " + data.name + "!");
        await boot();
      }catch(e){
        document.getElementById("login-error").textContent = e.message;
      }
    };
    btn.addEventListener("click", doLogin);
    input.addEventListener("keydown", (e)=>{ if(e.key === "Enter") doLogin(); });
    input.focus();
    document.getElementById("switch-to-admin").addEventListener("click", ()=>{ loginMode = "admin"; renderLoginScreen(); });
  } else {
    const input = document.getElementById("login-password");
    const btn = document.getElementById("login-admin-btn");
    const doLogin = async () => {
      const password = input.value;
      if(!password) return;
      try{
        await apiPost("/auth/admin-login", { password });
        SESSION = { type: "admin" };
        showToast("Accesso amministratore riuscito");
        await boot();
      }catch(e){
        document.getElementById("login-error").textContent = e.message;
      }
    };
    btn.addEventListener("click", doLogin);
    input.addEventListener("keydown", (e)=>{ if(e.key === "Enter") doLogin(); });
    input.focus();
    document.getElementById("switch-to-participant").addEventListener("click", ()=>{ loginMode = "participant"; renderLoginScreen(); });
  }
}

function renderAccountBar(){
  const bar = document.getElementById("top-account-bar");
  if(SESSION.type === "participant"){
    bar.innerHTML = `
      <span class="sync-pill" id="sync-pill"><span class="dot"></span> sincronizzato</span>
      <span>Stai giocando come <b>${escapeHtml(SESSION.name)}</b></span>
      <button class="btn-ghost" id="logout-btn">Esci</button>
    `;
  } else if(SESSION.type === "admin"){
    bar.innerHTML = `
      <span class="sync-pill" id="sync-pill"><span class="dot"></span> sincronizzato</span>
      <span class="admin-badge">ADMIN</span>
      <button class="btn-ghost" id="logout-btn">Esci</button>
    `;
  }
  const logoutBtn = document.getElementById("logout-btn");
  if(logoutBtn) logoutBtn.addEventListener("click", async ()=>{
    await apiPost("/auth/logout", {});
    SESSION = { type: "guest" };
    location.reload();
  });
}

function pulseSync(state){
  const pill = document.getElementById("sync-pill");
  if(!pill) return;
  pill.classList.remove("saving","error");
  if(state === "saving"){ pill.classList.add("saving"); pill.innerHTML = '<span class="dot"></span> salvataggio...'; }
  else if(state === "error"){ pill.classList.add("error"); pill.innerHTML = '<span class="dot"></span> errore salvataggio'; }
  else { pill.innerHTML = '<span class="dot"></span> sincronizzato'; }
}

// ============================================================
// NAVIGAZIONE / TABS — diverse per concorrente e admin
// ============================================================
const PARTICIPANT_TABS = [
  {id:"pronostici", label:"Pronostici partite"},
  {id:"gironi", label:"Classifica gironi"},
  {id:"premi", label:"Premi finali"},
  {id:"classifica", label:"Classifica generale"},
  {id:"listone", label:"Listone"},
  {id:"regolamento", label:"Regolamento"}
];
const ADMIN_TABS = [
  {id:"admin-concorrenti", label:"Concorrenti & codici"},
  {id:"admin-risultati", label:"Risultati reali"},
  {id:"admin-tabellone", label:"Tabellone pronostici"},
  {id:"classifica", label:"Classifica generale"},
  {id:"listone", label:"Listone"},
  {id:"regolamento", label:"Regolamento"}
];

let activeTab = null;

function currentTabs(){
  return SESSION.type === "admin" ? ADMIN_TABS : PARTICIPANT_TABS;
}

function renderTabs(){
  if(!activeTab) activeTab = currentTabs()[0].id;
  const wrap = document.getElementById("tabs");
  wrap.innerHTML = currentTabs().map(t=>
    `<button class="tab-btn ${t.id===activeTab?'active':''}" data-tab="${t.id}">${t.label}</button>`
  ).join("");
  wrap.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      activeTab = btn.dataset.tab;
      renderTabs();
      renderPanels();
    });
  });
}

function renderPanels(){
  const wrap = document.getElementById("panels");
  wrap.innerHTML = `<div class="panel active" id="panel-${activeTab}"></div>`;
  const el = document.getElementById("panel-"+activeTab);
  if(activeTab==="pronostici") renderPronostici(el);
  else if(activeTab==="gironi") renderGironi(el);
  else if(activeTab==="premi") renderPremi(el);
  else if(activeTab==="classifica") renderClassificaGenerale(el);
  else if(activeTab==="regolamento") renderRegolamento(el);
  else if(activeTab==="admin-concorrenti") renderAdminConcorrenti(el);
  else if(activeTab==="admin-risultati") renderRisultatiAdmin(el);
  else if(activeTab==="admin-tabellone") renderAdminTabellone(el);
  else if(activeTab==="listone") renderListone(el);
}

// ============================================================
// TAB: PRONOSTICI PARTITE
// ============================================================
async function renderPronostici(el){
  el.innerHTML = `<div class="loading-msg">Carico i tuoi pronostici…</div>`;
  let saved, lockStatus;
  try{
    [saved, lockStatus] = await Promise.all([
      apiGet("/predictions/matches"),
      apiGet("/predictions/lock-status")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">Pronostici sulle singole partite <span class="tag">72 partite</span></div>
    <p class="section-desc">Inserisci il risultato esatto che pronostichi per ogni partita. I campi in <span style="color:#ff8a7a">rosso</span> sono bloccati perché il termine è scaduto.</p>
  `;

  const matchesByGroup = {};
  TOURNAMENT.matches.forEach(m=>{
    if(!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });

  const container = document.createElement("div");
  container.className = "card";

  Object.keys(matchesByGroup).sort().forEach(g=>{
    const groupWrap = document.createElement("div");
    groupWrap.className = "matchday-group";
    groupWrap.innerHTML = `<div class="matchday-label">Girone ${g} — ${TOURNAMENT.groups[g].join(" · ")}</div>`;
    matchesByGroup[g].forEach(m=>{
      const s = saved[m.id] || {};
      const matchLocks = lockStatus.matches || lockStatus; // compatibilità
      const locked = matchLocks[m.id] && matchLocks[m.id].locked;
      const row = document.createElement("div");
      row.className = "match-row" + (locked ? " match-locked" : "");
      row.innerHTML = `
        <div class="match-meta">${m.date}${locked ? ' <span class="lock-badge">🔒</span>' : ''}</div>
        <div class="match-team">${m.home}</div>
        <div class="score-inputs">
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="home"
            value="${s.home ?? ''}" ${locked ? "disabled" : ""} class="${locked ? 'input-locked' : ''}">
          <span class="score-sep">–</span>
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="away"
            value="${s.away ?? ''}" ${locked ? "disabled" : ""} class="${locked ? 'input-locked' : ''}">
        </div>
        <div class="match-team right">${m.away}</div>
        <div></div>
      `;
      groupWrap.appendChild(row);
    });
    container.appendChild(groupWrap);
  });

  el.appendChild(container);

  container.querySelectorAll("input[type=number]:not([disabled])").forEach(inp=>{
    inp.addEventListener("change", async ()=>{
      const matchId = inp.dataset.match;
      // Ricontrolla lato client (il server blocca comunque lato server)
      const _matchLocks = lockStatus.matches || lockStatus;
      if(_matchLocks[matchId] && _matchLocks[matchId].locked){
        showToast("Pronostico bloccato: il termine è scaduto", true);
        return;
      }
      const homeInp = container.querySelector(`input[data-match="${matchId}"][data-side="home"]`);
      const awayInp = container.querySelector(`input[data-match="${matchId}"][data-side="away"]`);
      pulseSync("saving");
      try{
        await apiPut(`/predictions/matches/${matchId}`, {
          home: homeInp.value === "" ? null : parseInt(homeInp.value, 10),
          away: awayInp.value === "" ? null : parseInt(awayInp.value, 10)
        });
        pulseSync("ok");
      }catch(e){
        pulseSync("error");
        showToast("Errore: " + e.message, true);
      }
    });
  });
}

// ============================================================
// TAB: CLASSIFICA GIRONI (pronostico ordine finale 1-4 per girone)
// ============================================================
async function renderGironi(el){
  el.innerHTML = `<div class="loading-msg">Carico i tuoi pronostici sui gironi…</div>`;
  let saved, lockStatus;
  try{
    [saved, lockStatus] = await Promise.all([
      apiGet("/predictions/group-order"),
      apiGet("/predictions/lock-status")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const locked = lockStatus.groups && lockStatus.groups.locked;

  el.innerHTML = `
    <div class="section-title">Pronostico classifica finale dei gironi <span class="tag">12 gironi</span></div>
    ${locked
      ? `<p class="section-desc" style="color:#ff8a7a">🔒 Pronostici gironi bloccati — il termine è scaduto l'11 giugno alle 19:00.</p>`
      : `<p class="section-desc">Per ogni girone, indica la squadra che pensi arriverà 1ª, 2ª, 3ª e 4ª. Ogni posizione corretta vale punti (vedi Regolamento).</p>`
    }
  `;

  const grid = document.createElement("div");
  grid.className = "groups-grid";

  Object.keys(TOURNAMENT.groups).sort().forEach(g=>{
    const order = saved[g] || [null,null,null,null];
    const block = document.createElement("div");
    block.className = "group-block" + (locked ? " group-block-locked" : "");
    block.innerHTML = `<h4>Girone ${g} <span class="badge">4 squadre</span>${locked ? ' 🔒' : ''}</h4>`;
    for(let pos=0; pos<4; pos++){
      const row = document.createElement("div");
      row.className = "pos-row";
      row.innerHTML = `
        <span class="pos-num">${pos+1}°</span>
        <select data-group="${g}" data-pos="${pos}" ${locked ? "disabled" : ""}
          class="${locked ? 'input-locked' : ''}">${groupTeamOptionsHtml(g, order[pos])}</select>
      `;
      block.appendChild(row);
    }
    grid.appendChild(block);
  });

  el.appendChild(grid);

  if(!locked){
    grid.querySelectorAll("select").forEach(sel=>{
      sel.addEventListener("change", async ()=>{
        const g = sel.dataset.group;
        const pos = sel.dataset.pos;
        pulseSync("saving");
        try{
          await apiPut(`/predictions/group-order/${g}/${pos}`, { team: sel.value });
          pulseSync("ok");
          showToast(`Pronostico girone ${g} salvato`);
        }catch(e){
          pulseSync("error");
          showToast("Errore: " + e.message, true);
        }
      });
    });
  }
}

// ============================================================
// TAB: PREMI FINALI (pronostici individuali)
// ============================================================
const AWARD_DEFS = [
  {key:"winner", field:"winner", icon:"🏆", title:"Squadra vincente Mondiale", points:20, type:"team"},
  {key:"topScorer", field:"top_scorer", icon:"⚽", title:"Capocannoniere", points:10, type:"text"},
  {key:"mostGoalsTeam", field:"most_goals_team", icon:"🥅", title:"Squadra con più reti nei gironi", points:5, type:"team"},
  {key:"bestPlayer", field:"best_player", icon:"⭐", title:"Miglior giocatore del Mondiale", points:5, type:"text"},
  {key:"bestGoalkeeper", field:"best_goalkeeper", icon:"🧤", title:"Miglior portiere del Mondiale", points:5, type:"text"}
];

async function renderPremi(el){
  el.innerHTML = `<div class="loading-msg">Carico i tuoi pronostici sui premi…</div>`;
  let saved, lockStatus;
  try{
    [saved, lockStatus] = await Promise.all([
      apiGet("/predictions/awards"),
      apiGet("/predictions/lock-status")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const locked = lockStatus.awards && lockStatus.awards.locked;

  el.innerHTML = `
    <div class="section-title">Pronostici sui premi finali</div>
    ${locked
      ? `<p class="section-desc" style="color:#ff8a7a">🔒 Pronostici premi bloccati — il termine è scaduto l'11 giugno alle 19:00.</p>`
      : `<p class="section-desc">Indica chi vincerà ciascun riconoscimento individuale e di squadra. Per capocannoniere, miglior giocatore e miglior portiere scrivi nome e cognome del calciatore.</p>`
    }
  `;

  const grid = document.createElement("div");
  grid.className = "grid-3";
  AWARD_DEFS.forEach(def=>{
    const val = saved[def.field] || "";
    const card = document.createElement("div");
    card.className = "award-card" + (locked ? " award-card-locked" : "");
    card.innerHTML = `
      <span class="icon">${def.icon}</span>
      <div class="award-title">${def.title}${locked ? ' 🔒' : ''}</div>
      <div class="points">${def.points} punti se esatto</div>
      ${def.type==="team"
        ? `<select data-award="${def.field}" ${locked ? "disabled" : ""} class="${locked ? 'input-locked' : ''}">${teamOptionsHtml(val)}</select>`
        : `<input type="text" data-award="${def.field}" value="${escapeHtml(val)}" placeholder="Nome e cognome" ${locked ? "disabled" : ""} class="${locked ? 'input-locked' : ''}">`
      }
    `;
    grid.appendChild(card);
  });
  el.appendChild(grid);

  if(!locked){
    async function saveAwards(){
      const payload = {};
      AWARD_DEFS.forEach(def=>{
        const input = grid.querySelector(`[data-award="${def.field}"]`);
        payload[def.field] = input.value;
      });
      pulseSync("saving");
      try{
        await apiPut("/predictions/awards", payload);
        pulseSync("ok");
        showToast("Premio aggiornato");
      }catch(e){
        pulseSync("error");
        showToast("Errore: " + e.message, true);
      }
    }
    grid.querySelectorAll("[data-award]").forEach(input=>{
      const ev = input.tagName === "SELECT" ? "change" : "blur";
      input.addEventListener(ev, saveAwards);
    });
  }
}

// ============================================================
// TAB ADMIN: CONCORRENTI & CODICI DI ACCESSO
// ============================================================
async function renderAdminConcorrenti(el){
  el.innerHTML = `<div class="loading-msg">Carico la lista dei concorrenti…</div>`;
  let rows;
  try{
    rows = await apiGet("/admin/participants");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">Concorrenti e codici di accesso <span class="tag">${rows.length}/36</span></div>
    <p class="section-desc">Ogni concorrente accede al proprio profilo con il codice personale qui sotto. Condividi il codice corrispondente con ciascun concorrente (es. via chat privata). Puoi rigenerare un codice se qualcuno lo perde.</p>
    <div class="card">
      <table class="responsive-table">
        <thead><tr><th style="width:40px">#</th><th>Nome concorrente</th><th>Nome squadra</th><th>Codice di accesso</th><th></th></tr></thead>
        <tbody id="admin-participants-tbody"></tbody>
      </table>
    </div>
  `;

  const tbody = el.querySelector("#admin-participants-tbody");
  rows.forEach((p, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num-mono" data-label="#">${idx+1}</td>
      <td data-label="Nome concorrente"><input type="text" value="${escapeHtml(p.name)}" data-field="name" data-id="${p.id}"></td>
      <td data-label="Nome squadra"><input type="text" value="${escapeHtml(p.team||'')}" data-field="team" data-id="${p.id}" placeholder="opzionale"></td>
      <td data-label="Codice di accesso"><span class="access-code-cell" id="code-${p.id}">${p.access_code}</span></td>
      <td data-label=""><button class="btn-ghost" data-regen="${p.id}">Rigenera codice</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input").forEach(inp=>{
    inp.addEventListener("blur", async ()=>{
      const id = inp.dataset.id;
      const nameInp = tbody.querySelector(`input[data-field="name"][data-id="${id}"]`);
      const teamInp = tbody.querySelector(`input[data-field="team"][data-id="${id}"]`);
      try{
        await apiPut(`/admin/participants/${id}`, { name: nameInp.value, team: teamInp.value });
        showToast("Concorrente aggiornato");
      }catch(e){
        showToast("Errore: " + e.message, true);
      }
    });
  });

  tbody.querySelectorAll("[data-regen]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.regen;
      if(!confirm("Rigenerare il codice? Il vecchio codice non funzionerà più.")) return;
      try{
        const data = await apiPost(`/admin/participants/${id}/regenerate-code`, {});
        document.getElementById(`code-${id}`).textContent = data.accessCode;
        showToast("Nuovo codice generato");
      }catch(e){
        showToast("Errore: " + e.message, true);
      }
    });
  });
}

// ============================================================
// TAB ADMIN: RISULTATI REALI (partite, gironi, premi)
// ============================================================
let adminResultsSubTab = "partite"; // 'partite' | 'gironi' | 'premi'

async function renderRisultatiAdmin(el){
  // Recupera stato gironi
  let groupStatus = { locked: false };
  try{ groupStatus = await apiGet("/admin/group-phase-status"); }catch(e){}

  const lockBtn = groupStatus.locked
    ? `<button class="btn-ghost" id="unlock-groups-btn" style="border-color:var(--gold);color:var(--gold)">🔓 Riapri fase a gironi</button>`
    : `<button class="btn-primary" id="lock-groups-btn">🔒 Chiudi fase a gironi (rendi definitivi i punti gironi)</button>`;

  el.innerHTML = `
    <div class="section-title">Inserimento risultati reali</div>
    <p class="section-desc">Inserisci qui i risultati ufficiali non appena disponibili. Non esiste un collegamento automatico al sito FIFA (nessuna API gratuita disponibile), ma per i gironi puoi calcolare l'ordine automaticamente dai risultati delle partite invece di inserirlo a mano.</p>

    <div class="card" style="margin-bottom:18px;padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div>
        <b style="font-family:'Oswald',sans-serif;letter-spacing:0.5px">FASE A GIRONI</b>
        <span style="margin-left:10px;font-size:12px;color:var(--chalk-dim)">
          ${groupStatus.locked
            ? '✅ Chiusa — punti gironi definitivi'
            : '⏳ Aperta — punti gironi provvisori'}
        </span>
      </div>
      ${lockBtn}
    </div>

    <div class="subtabs">
      <button class="subtab-btn ${adminResultsSubTab==='partite'?'active':''}" data-sub="partite">Risultati partite</button>
      <button class="subtab-btn ${adminResultsSubTab==='gironi'?'active':''}" data-sub="gironi">Classifica gironi</button>
      <button class="subtab-btn ${adminResultsSubTab==='premi'?'active':''}" data-sub="premi">Premi finali</button>
    </div>
    <div id="admin-results-content"></div>
  `;

  // Handler pulsante blocco/sblocco
  const lockBtnEl = el.querySelector("#lock-groups-btn");
  const unlockBtnEl = el.querySelector("#unlock-groups-btn");
  if(lockBtnEl) lockBtnEl.addEventListener("click", async () => {
    if(!confirm("Chiudere la fase a gironi? I punti gironi diventeranno definitivi per tutti i concorrenti. Potrai riaprirla se necessario.")) return;
    try{
      await apiPost("/admin/group-phase-lock", {});
      showToast("Fase a gironi chiusa — punti gironi ora definitivi");
      renderRisultatiAdmin(el);
    }catch(e){ showToast("Errore: " + e.message, true); }
  });
  if(unlockBtnEl) unlockBtnEl.addEventListener("click", async () => {
    if(!confirm("Riaprire la fase a gironi? I punti gironi torneranno provvisori.")) return;
    try{
      await apiPost("/admin/group-phase-unlock", {});
      showToast("Fase a gironi riaperta — punti gironi di nuovo provvisori");
      renderRisultatiAdmin(el);
    }catch(e){ showToast("Errore: " + e.message, true); }
  });
  el.querySelectorAll(".subtab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      adminResultsSubTab = btn.dataset.sub;
      renderRisultatiAdmin(el);
    });
  });

  const content = el.querySelector("#admin-results-content");
  if(adminResultsSubTab === "partite") await renderAdminRisultatiPartite(content);
  else if(adminResultsSubTab === "gironi") await renderAdminRisultatiGironi(content);
  else await renderAdminRisultatiPremi(content);
}

async function renderAdminRisultatiPartite(el){
  el.innerHTML = `<div class="loading-msg">Carico i risultati reali…</div>`;
  let real;
  try{
    real = await apiGet("/real/matches");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const matchesByGroup = {};
  TOURNAMENT.matches.forEach(m=>{
    if(!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });

  const container = document.createElement("div");
  container.className = "card";
  Object.keys(matchesByGroup).sort().forEach(g=>{
    const groupWrap = document.createElement("div");
    groupWrap.className = "matchday-group";
    groupWrap.innerHTML = `<div class="matchday-label">Girone ${g}</div>`;
    matchesByGroup[g].forEach(m=>{
      const r = real[m.id] || {};
      const row = document.createElement("div");
      row.className = "match-row";
      row.innerHTML = `
        <div class="match-meta">${m.date}</div>
        <div class="match-team">${m.home}</div>
        <div class="score-inputs">
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="home" value="${r.home ?? ''}">
          <span class="score-sep">–</span>
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="away" value="${r.away ?? ''}">
        </div>
        <div class="match-team right">${m.away}</div>
        <div></div>
      `;
      groupWrap.appendChild(row);
    });
    container.appendChild(groupWrap);
  });
  el.innerHTML = "";
  el.appendChild(container);

  container.querySelectorAll("input[type=number]").forEach(inp=>{
    inp.addEventListener("change", async ()=>{
      const matchId = inp.dataset.match;
      const homeInp = container.querySelector(`input[data-match="${matchId}"][data-side="home"]`);
      const awayInp = container.querySelector(`input[data-match="${matchId}"][data-side="away"]`);
      try{
        await apiPut(`/admin/real/matches/${matchId}`, {
          home: homeInp.value === "" ? null : parseInt(homeInp.value, 10),
          away: awayInp.value === "" ? null : parseInt(awayInp.value, 10)
        });
        showToast("Risultato " + matchId + " salvato");
      }catch(e){
        showToast("Errore: " + e.message, true);
      }
    });
  });
}

async function renderAdminRisultatiGironi(el){
  el.innerHTML = `<div class="loading-msg">Carico la classifica reale dei gironi…</div>`;
  let real;
  try{
    real = await apiGet("/real/group-order");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `<p class="section-desc" style="margin-bottom:18px;">Puoi impostare l'ordine manualmente oppure usare "Calcola automaticamente" per derivarlo dai risultati delle partite già inseriti (punti, differenza reti, reti fatte).</p>`;

  const grid = document.createElement("div");
  grid.className = "groups-grid";
  Object.keys(TOURNAMENT.groups).sort().forEach(g=>{
    const order = real[g] || [null,null,null,null];
    const block = document.createElement("div");
    block.className = "group-block";
    block.innerHTML = `<h4>Girone ${g} <button class="btn-ghost" data-autocalc="${g}" style="margin-left:8px;font-size:10.5px;">⚡ Calcola automaticamente</button></h4>`;
    for(let pos=0; pos<4; pos++){
      const row = document.createElement("div");
      row.className = "pos-row";
      row.innerHTML = `
        <span class="pos-num">${pos+1}°</span>
        <select data-group="${g}" data-pos="${pos}">${groupTeamOptionsHtml(g, order[pos])}</select>
      `;
      block.appendChild(row);
    }
    grid.appendChild(block);
  });
  el.appendChild(grid);

  grid.querySelectorAll("select").forEach(sel=>{
    sel.addEventListener("change", async ()=>{
      const g = sel.dataset.group;
      const pos = sel.dataset.pos;
      try{
        await apiPut(`/admin/real/group-order/${g}/${pos}`, { team: sel.value });
        showToast(`Girone ${g}: posizione ${parseInt(pos)+1} salvata`);
      }catch(e){
        showToast("Errore: " + e.message, true);
      }
    });
  });

  grid.querySelectorAll("[data-autocalc]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const g = btn.dataset.autocalc;
      try{
        const data = await apiPost(`/admin/auto-group-order/${g}`, {});
        showToast(`Girone ${g} calcolato: ${data.order.join(" → ")}`);
        await renderAdminRisultatiGironi(el);
      }catch(e){
        showToast("Errore: " + e.message, true);
      }
    });
  });
}

async function renderAdminRisultatiPremi(el){
  el.innerHTML = `<div class="loading-msg">Carico i premi reali…</div>`;
  let real;
  try{
    real = await apiGet("/real/awards");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "grid-3";
  AWARD_DEFS.forEach(def=>{
    const val = real[def.field] || "";
    const card = document.createElement("div");
    card.className = "award-card";
    card.innerHTML = `
      <span class="icon">${def.icon}</span>
      <div class="award-title">${def.title}</div>
      ${def.type==="team"
        ? `<select data-realaward="${def.field}">${teamOptionsHtml(val)}</select>`
        : `<input type="text" data-realaward="${def.field}" value="${escapeHtml(val)}" placeholder="Nome e cognome">`
      }
    `;
    grid.appendChild(card);
  });
  el.appendChild(grid);

  async function saveRealAwards(){
    const payload = {};
    AWARD_DEFS.forEach(def=>{
      const input = grid.querySelector(`[data-realaward="${def.field}"]`);
      payload[def.field] = input.value;
    });
    try{
      await apiPut("/admin/real/awards", payload);
      showToast("Premio reale aggiornato");
    }catch(e){
      showToast("Errore: " + e.message, true);
    }
  }
  grid.querySelectorAll("[data-realaward]").forEach(input=>{
    const ev = input.tagName === "SELECT" ? "change" : "blur";
    input.addEventListener(ev, saveRealAwards);
  });
}

// ============================================================
// TAB: CLASSIFICA GENERALE
// ============================================================
async function renderClassificaGenerale(el){
  el.innerHTML = `<div class="loading-msg">Calcolo la classifica…</div>`;
  let data;
  try{
    data = await apiGet("/leaderboard");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const board = data.board;
  const groupsLocked = data.groupsLocked;

  const gironiLabel = groupsLocked ? "Gironi ✅" : "Gironi ⏳";
  const totDefLabel = groupsLocked ? "Totale definitivo" : "Totale definitivo *";

  el.innerHTML = `
    <div class="section-title">Classifica generale <span class="tag">${board.length} concorrenti</span></div>
    ${!groupsLocked
      ? `<p class="section-desc" style="margin-bottom:12px;">⏳ Punti gironi <b>provvisori</b> — diventeranno definitivi a fine fase a gironi.</p>`
      : `<p class="section-desc" style="margin-bottom:12px;">✅ Fase a gironi chiusa — punti gironi <b>definitivi</b>.</p>`}
  `;

  const card = document.createElement("div");
  card.className = "card";
  const table = document.createElement("table");
  table.className = "responsive-table leaderboard-table";
  table.innerHTML = `
    <thead><tr>
      <th style="width:44px">Pos.</th>
      <th>Concorrente</th>
      <th class="num">Esatti</th>
      <th class="num">1X2</th>
      <th class="num partite-col">Tot. partite</th>
      <th class="num provvisorio-col">Provvisorio</th>
      <th class="num gironi-col">${gironiLabel}</th>
      <th class="num total-col">${totDefLabel}</th>
    </tr></thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  board.forEach((p, idx)=>{
    const tr = document.createElement("tr");
    if(p.id === SESSION.id) tr.classList.add("me-row");
    const gironiCell = groupsLocked
      ? `<b>${p.punteggioGironi}</b>`
      : `<span style="color:var(--chalk-dim)">${p.punteggioGironi}</span>`;
    tr.innerHTML = `
      <td data-label="Pos." class="num-mono">${idx+1}°</td>
      <td data-label="Concorrente"><b>${escapeHtml(p.name)}</b>${p.team ? ` <span style="color:var(--chalk-dim);font-size:11px"> ${escapeHtml(p.team)}</span>` : ""}</td>
      <td data-label="Esatti" class="num">${p.breakdown.risultatoEsatto}</td>
      <td data-label="1X2" class="num">${p.breakdown.segno1x2}</td>
      <td data-label="Tot. partite" class="num partite-col"><b>${p.totalePartite}</b></td>
      <td data-label="Provvisorio" class="num provvisorio-col"><b>${p.totaleProvvisorio}</b></td>
      <td data-label="${gironiLabel}" class="num gironi-col">${gironiCell}</td>
      <td data-label="${totDefLabel}" class="num total-col"><b>${p.totaleDefinitivo}</b></td>
    `;
    tbody.appendChild(tr);
  });
  card.appendChild(table);
  el.appendChild(card);

  if(!groupsLocked){
    const note = document.createElement("p");
    note.style.cssText = "font-size:11px;color:var(--chalk-dim);margin-top:8px;font-family:'Space Mono',monospace";
    note.textContent = "* Totale definitivo esclude i gironi finché non vengono chiusi dall'admin.";
    el.appendChild(note);
  }
}

// ============================================================
// TAB: REGOLAMENTO
// ============================================================
function renderRegolamento(el){
  const P = TOURNAMENT.points;
  el.innerHTML = `
    <div class="section-title">Regolamento della lega</div>
    <div class="card rules-card">
      <h4>Chi partecipa</h4>
      <p>36 concorrenti, ciascuno con un proprio profilo protetto da un codice di accesso personale. Ogni concorrente pronostica in autonomia; le previsioni si possono modificare liberamente fino all'inizio della partita corrispondente.</p>

      <h4>Punteggi partite della fase a gironi</h4>
      <ul>
        <li><b>${P.exactScore} punti</b> per ogni risultato esatto pronosticato (es. 2-1 e finisce 2-1).</li>
        <li><b>${P.result1x2} punti</b> se non indovini il risultato esatto ma indovini l'esito (1, X o 2). I punti per risultato esatto e per esito 1X2 non si somm­ano tra loro: vale il punteggio più alto ottenuto per quella partita.</li>
      </ul>

      <h4>Classifica gironi</h4>
      <p>Per ogni girone pronostichi l'ordine finale delle 4 squadre (1ª, 2ª, 3ª, 4ª posizione). Ogni posizione esatta vale punti in base al numero di concorrenti iscritti alla lega — con 36 concorrenti, ogni posizione corretta vale <b>12 punti</b>.</p>

      <h4>Premi finali</h4>
      <ul>
        <li><b>${P.winner} punti</b> — Squadra vincente del Mondiale</li>
        <li><b>${P.topScorer} punti</b> — Capocannoniere del torneo</li>
        <li><b>${P.mostGoalsTeamGroups} punti</b> — Squadra con più reti segnate nella fase a gironi</li>
        <li><b>${P.bestPlayer} punti</b> — Miglior giocatore del torneo</li>
        <li><b>${P.bestGoalkeeper} punti</b> — Miglior portiere del torneo</li>
      </ul>

      <h4>Aggiornamento risultati</h4>
      <p>I risultati ufficiali vengono inseriti manualmente dall'amministratore della lega non appena disponibili (non esiste un collegamento automatico al sito ufficiale FIFA). La classifica generale si aggiorna automaticamente non appena un risultato viene inserito.</p>
    </div>
  `;
}

// ============================================================
// BOOT — punto di ingresso dell'applicazione
// ============================================================
async function boot(){
  try{
    const me = await apiGet("/auth/me");
    SESSION = me;
  }catch(e){
    SESSION = { type: "guest" };
  }

  if(!TOURNAMENT){
    try{
      TOURNAMENT = await apiGet("/tournament");
    }catch(e){
      document.getElementById("app").innerHTML = `<div class="empty-state">Impossibile contattare il server: ${escapeHtml(e.message)}</div>`;
      return;
    }
  }

  const loginScreen = document.getElementById("login-screen");
  const mainScreen = document.getElementById("main-screen");

  if(SESSION.type === "guest"){
    loginScreen.style.display = "block";
    mainScreen.style.display = "none";
    renderLoginScreen();
  } else {
    loginScreen.style.display = "none";
    mainScreen.style.display = "block";
    renderAccountBar();
    renderTabs();
    renderPanels();
  }
}

document.addEventListener("DOMContentLoaded", boot);

// ============================================================
// TAB ADMIN: TABELLONE PRONOSTICI — tutti i concorrenti affiancati
// ============================================================
let tabelloneSubTab = "partite"; // 'partite' | 'gironi' | 'premi'

async function renderAdminTabellone(el){
  el.innerHTML = `
    <div class="section-title">Tabellone pronostici — tutti i concorrenti</div>
    <div class="subtabs">
      <button class="subtab-btn ${tabelloneSubTab==='partite'?'active':''}" data-sub="partite">Partite</button>
      <button class="subtab-btn ${tabelloneSubTab==='gironi'?'active':''}" data-sub="gironi">Classifiche gironi</button>
      <button class="subtab-btn ${tabelloneSubTab==='premi'?'active':''}" data-sub="premi">Premi finali</button>
    </div>
    <div id="tabellone-content"><div class="loading-msg">Carico…</div></div>
  `;
  el.querySelectorAll(".subtab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabelloneSubTab = btn.dataset.sub;
      renderAdminTabellone(el);
    });
  });
  const content = el.querySelector("#tabellone-content");
  if(tabelloneSubTab === "partite") await renderTabellonePartite(content);
  else if(tabelloneSubTab === "gironi") await renderTabelloneGironi(content);
  else await renderTabellonePremi(content);
}

async function renderTabellonePartite(el){
  let data, realData, lockStatus;
  try{
    [data, realData, lockStatus] = await Promise.all([
      apiGet("/admin/all-predictions/matches"),
      apiGet("/real/matches"),
      apiGet("/predictions/lock-status")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  // Raggruppa partite per girone
  const matchesByGroup = {};
  TOURNAMENT.matches.forEach(m=>{
    if(!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });

  let html = `<div class="tabellone-scroll">`;
  // Header concorrenti
  html += `<table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Partita</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  Object.keys(matchesByGroup).sort().forEach(g=>{
    // Riga intestazione girone
    html += `<tr class="tabellone-group-row"><td colspan="${participants.length+2}">Girone ${g} — ${TOURNAMENT.groups[g].join(' · ')}</td></tr>`;
    matchesByGroup[g].forEach(m=>{
      const real = realData[m.id];
      const realStr = (real && real.home !== null && real.away !== null)
        ? `<span class="real-score">${real.home}-${real.away}</span>` : `<span class="no-data">—</span>`;
      const _tLocks = lockStatus.matches || lockStatus;
      const locked = _tLocks[m.id] && _tLocks[m.id].locked;
      html += `<tr class="${locked ? 'row-locked' : ''}">
        <td class="tabellone-match-col"><span class="match-label">${m.home} vs ${m.away}</span><span class="match-date-small">${m.date}</span></td>
        <td class="tabellone-real-col">${realStr}</td>`;
      participants.forEach(p=>{
        const pred = predictions[p.id] && predictions[p.id].matches[m.id];
        let cell = `<span class="no-data">—</span>`;
        if(pred && pred.home !== null && pred.away !== null){
          const isExact = real && real.home !== null && Number(pred.home)===Number(real.home) && Number(pred.away)===Number(real.away);
          const real1x2 = real ? (real.home>real.away?'1':real.home<real.away?'2':'X') : null;
          const pred1x2 = pred.home>pred.away?'1':pred.home<pred.away?'2':'X';
          const isSign = real && !isExact && real1x2 && real1x2===pred1x2;
          const cls = isExact ? 'pred-exact' : isSign ? 'pred-sign' : '';
          cell = `<span class="pred-score ${cls}">${pred.home}-${pred.away}</span>`;
        }
        html += `<td class="tabellone-p-col">${cell}</td>`;
      });
      html += `</tr>`;
    });
  });

  html += `</tbody></table></div>`;
  html += `<p style="font-size:11px;color:var(--chalk-dim);margin-top:8px;font-family:'Space Mono',monospace">
    <span class="pred-score pred-exact">2-1</span> = risultato esatto (+5pt) &nbsp;
    <span class="pred-score pred-sign">2-1</span> = esito 1X2 corretto (+2pt)
  </p>`;
  el.innerHTML = html;
}

async function renderTabelloneGironi(el){
  let data, realData;
  try{
    [data, realData] = await Promise.all([
      apiGet("/admin/all-predictions/groups"),
      apiGet("/real/group-order")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  let html = `<div class="tabellone-scroll"><table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Girone / Pos.</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  Object.keys(TOURNAMENT.groups).sort().forEach(g=>{
    html += `<tr class="tabellone-group-row"><td colspan="${participants.length+2}">Girone ${g}</td></tr>`;
    for(let pos=0; pos<4; pos++){
      const realTeam = realData[g] && realData[g][pos];
      const realCell = realTeam ? `<span class="real-score" style="font-size:11px">${realTeam}</span>` : `<span class="no-data">—</span>`;
      html += `<tr><td class="tabellone-match-col">${pos+1}° posto</td><td class="tabellone-real-col">${realCell}</td>`;
      participants.forEach(p=>{
        const pGroups = predictions[p.id] && predictions[p.id].groups[g];
        const predTeam = pGroups && pGroups[pos];
        let cell = `<span class="no-data">—</span>`;
        if(predTeam){
          const isCorrect = realTeam && realTeam === predTeam;
          cell = `<span class="pred-score ${isCorrect?'pred-exact':''}" style="font-size:10px">${predTeam}</span>`;
        }
        html += `<td class="tabellone-p-col">${cell}</td>`;
      });
      html += `</tr>`;
    }
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

async function renderTabellonePremi(el){
  let data, realData;
  try{
    [data, realData] = await Promise.all([
      apiGet("/admin/all-predictions/awards"),
      apiGet("/real/awards")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  const awardFields = [
    {field:"winner", label:"🏆 Vincitore"},
    {field:"top_scorer", label:"⚽ Capocannoniere"},
    {field:"most_goals_team", label:"🥅 Squadra più gol"},
    {field:"best_player", label:"⭐ Miglior giocatore"},
    {field:"best_goalkeeper", label:"🧤 Miglior portiere"}
  ];

  let html = `<div class="tabellone-scroll"><table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Premio</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  awardFields.forEach(({field, label})=>{
    const realVal = realData[field] || "";
    const realCell = realVal ? `<span class="real-score" style="font-size:10px">${escapeHtml(realVal)}</span>` : `<span class="no-data">—</span>`;
    html += `<tr><td class="tabellone-match-col">${label}</td><td class="tabellone-real-col">${realCell}</td>`;
    participants.forEach(p=>{
      const awards = predictions[p.id] && predictions[p.id].awards;
      const predVal = awards && awards[field] ? awards[field] : null;
      let cell = `<span class="no-data">—</span>`;
      if(predVal){
        const isCorrect = realVal && realVal.trim().toLowerCase() === predVal.trim().toLowerCase();
        cell = `<span class="pred-score ${isCorrect?'pred-exact':''}" style="font-size:10px">${escapeHtml(predVal)}</span>`;
      }
      html += `<td class="tabellone-p-col">${cell}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

// ============================================================
// TAB LISTONE — pronostici di tutti i concorrenti (visibile a tutti)
// Usa le stesse rotte pubbliche, non quelle admin
// ============================================================
let listoneSubTab = "partite";

async function renderListone(el){
  el.innerHTML = `
    <div class="section-title">Listone — pronostici di tutti i concorrenti</div>
    <div class="subtabs">
      <button class="subtab-btn ${listoneSubTab==='partite'?'active':''}" data-sub="partite">Partite</button>
      <button class="subtab-btn ${listoneSubTab==='gironi'?'active':''}" data-sub="gironi">Classifiche gironi</button>
      <button class="subtab-btn ${listoneSubTab==='premi'?'active':''}" data-sub="premi">Premi finali</button>
    </div>
    <div id="listone-content"><div class="loading-msg">Carico…</div></div>
  `;
  el.querySelectorAll(".subtab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      listoneSubTab = btn.dataset.sub;
      renderListone(el);
    });
  });
  const content = el.querySelector("#listone-content");
  if(listoneSubTab === "partite") await renderListonePartite(content);
  else if(listoneSubTab === "gironi") await renderListoneGironi(content);
  else await renderListonePremi(content);
}

async function renderListonePartite(el){
  el.innerHTML = `<div class="loading-msg">Carico…</div>`;
  // Usa rotte admin se admin, altrimenti rotte pubbliche
  const isAdmin = SESSION.type === "admin";
  let data, realData, lockStatus;
  try{
    const predsEndpoint = isAdmin ? "/admin/all-predictions/matches" : "/public/all-predictions/matches";
    [data, realData, lockStatus] = await Promise.all([
      apiGet(predsEndpoint),
      apiGet("/real/matches"),
      apiGet("/predictions/lock-status")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  const matchesByGroup = {};
  TOURNAMENT.matches.forEach(m=>{
    if(!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });

  let html = `<div class="tabellone-scroll"><table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Partita</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col ${p.id===SESSION.id?'me-col':''}">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  Object.keys(matchesByGroup).sort().forEach(g=>{
    html += `<tr class="tabellone-group-row"><td colspan="${participants.length+2}">Girone ${g} — ${TOURNAMENT.groups[g].join(' · ')}</td></tr>`;
    matchesByGroup[g].forEach(m=>{
      const real = realData[m.id];
      const realStr = (real && real.home !== null && real.away !== null)
        ? `<span class="real-score">${real.home}-${real.away}</span>` : `<span class="no-data">—</span>`;
      const matchLocks = lockStatus.matches || lockStatus;
      const locked = matchLocks[m.id] && matchLocks[m.id].locked;
      html += `<tr class="${locked?'row-locked':''}">
        <td class="tabellone-match-col"><span class="match-label">${m.home} vs ${m.away}</span><span class="match-date-small">${m.date}</span></td>
        <td class="tabellone-real-col">${realStr}</td>`;
      participants.forEach(p=>{
        const pred = predictions[p.id] && predictions[p.id].matches[m.id];
        let cell = `<span class="no-data">—</span>`;
        if(pred && pred.home !== null && pred.away !== null){
          const isExact = real && real.home !== null && Number(pred.home)===Number(real.home) && Number(pred.away)===Number(real.away);
          const real1x2 = real ? (Number(real.home)>Number(real.away)?'1':Number(real.home)<Number(real.away)?'2':'X') : null;
          const pred1x2 = Number(pred.home)>Number(pred.away)?'1':Number(pred.home)<Number(pred.away)?'2':'X';
          const isSign = real && !isExact && real1x2 && real1x2===pred1x2;
          const cls = isExact ? 'pred-exact' : isSign ? 'pred-sign' : '';
          cell = `<span class="pred-score ${cls}">${pred.home}-${pred.away}</span>`;
        }
        const isMine = p.id === SESSION.id;
        html += `<td class="tabellone-p-col${isMine?' me-col':''}">${cell}</td>`;
      });
      html += `</tr>`;
    });
  });

  html += `</tbody></table></div>`;
  html += `<p style="font-size:11px;color:var(--chalk-dim);margin-top:8px;font-family:'Space Mono',monospace">
    <span class="pred-score pred-exact">2-1</span> = esatto (+5pt) &nbsp;
    <span class="pred-score pred-sign">2-1</span> = 1X2 corretto (+2pt)
  </p>`;
  el.innerHTML = html;
}

async function renderListoneGironi(el){
  el.innerHTML = `<div class="loading-msg">Carico…</div>`;
  const isAdmin = SESSION.type === "admin";
  let data, realData;
  try{
    const predsEndpoint = isAdmin ? "/admin/all-predictions/groups" : "/public/all-predictions/groups";
    [data, realData] = await Promise.all([
      apiGet(predsEndpoint),
      apiGet("/real/group-order")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  let html = `<div class="tabellone-scroll"><table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Girone / Pos.</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col ${p.id===SESSION.id?'me-col':''}">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  Object.keys(TOURNAMENT.groups).sort().forEach(g=>{
    html += `<tr class="tabellone-group-row"><td colspan="${participants.length+2}">Girone ${g}</td></tr>`;
    for(let pos=0; pos<4; pos++){
      const realTeam = realData[g] && realData[g][pos];
      const realCell = realTeam ? `<span class="real-score" style="font-size:11px">${realTeam}</span>` : `<span class="no-data">—</span>`;
      html += `<tr><td class="tabellone-match-col">${pos+1}° posto</td><td class="tabellone-real-col">${realCell}</td>`;
      participants.forEach(p=>{
        const pg = predictions[p.id] && predictions[p.id].groups[g];
        const predTeam = pg && pg[pos];
        let cell = `<span class="no-data">—</span>`;
        if(predTeam){
          const isCorrect = realTeam && realTeam === predTeam;
          cell = `<span class="pred-score ${isCorrect?'pred-exact':''}" style="font-size:10px">${predTeam}</span>`;
        }
        const isMine = p.id === SESSION.id;
        html += `<td class="tabellone-p-col${isMine?' me-col':''}">${cell}</td>`;
      });
      html += `</tr>`;
    }
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

async function renderListonePremi(el){
  el.innerHTML = `<div class="loading-msg">Carico…</div>`;
  const isAdmin = SESSION.type === "admin";
  let data, realData;
  try{
    const predsEndpoint = isAdmin ? "/admin/all-predictions/awards" : "/public/all-predictions/awards";
    [data, realData] = await Promise.all([
      apiGet(predsEndpoint),
      apiGet("/real/awards")
    ]);
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const { participants, predictions } = data;

  const awardFields = [
    {field:"winner",          label:"🏆 Vincitore"},
    {field:"top_scorer",      label:"⚽ Capocannoniere"},
    {field:"most_goals_team", label:"🥅 Squadra più gol"},
    {field:"best_player",     label:"⭐ Miglior giocatore"},
    {field:"best_goalkeeper", label:"🧤 Miglior portiere"}
  ];

  let html = `<div class="tabellone-scroll"><table class="tabellone-table"><thead><tr>
    <th class="tabellone-match-col">Premio</th>
    <th class="tabellone-real-col">Reale</th>
    ${participants.map(p=>`<th class="tabellone-p-col ${p.id===SESSION.id?'me-col':''}">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead><tbody>`;

  awardFields.forEach(({field, label})=>{
    const realVal = realData[field] || "";
    const realCell = realVal ? `<span class="real-score" style="font-size:10px">${escapeHtml(realVal)}</span>` : `<span class="no-data">—</span>`;
    html += `<tr><td class="tabellone-match-col">${label}</td><td class="tabellone-real-col">${realCell}</td>`;
    participants.forEach(p=>{
      const awards = predictions[p.id] && predictions[p.id].awards;
      const predVal = awards && awards[field] ? awards[field] : null;
      let cell = `<span class="no-data">—</span>`;
      if(predVal){
        const isCorrect = realVal && realVal.trim().toLowerCase() === predVal.trim().toLowerCase();
        cell = `<span class="pred-score ${isCorrect?'pred-exact':''}" style="font-size:10px">${escapeHtml(predVal)}</span>`;
      }
      const isMine = p.id === SESSION.id;
      html += `<td class="tabellone-p-col${isMine?' me-col':''}">${cell}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

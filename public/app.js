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
          <input type="password" id="login-password" placeholder="Password admin" autocomplete="off">
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
  {id:"regolamento", label:"Regolamento"}
];
const ADMIN_TABS = [
  {id:"admin-concorrenti", label:"Concorrenti & codici"},
  {id:"admin-risultati", label:"Risultati reali"},
  {id:"classifica", label:"Classifica generale"},
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
}

// ============================================================
// TAB: PRONOSTICI PARTITE
// ============================================================
async function renderPronostici(el){
  el.innerHTML = `<div class="loading-msg">Carico i tuoi pronostici…</div>`;
  let saved;
  try{
    saved = await apiGet("/predictions/matches");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">Pronostici sulle singole partite <span class="tag">72 partite</span></div>
    <p class="section-desc">Inserisci il risultato esatto che pronostichi per ogni partita della fase a gironi. Dal risultato verrà ricavato anche l'esito 1X2 per il punteggio. Si salva automaticamente a ogni modifica.</p>
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
      const row = document.createElement("div");
      row.className = "match-row";
      row.innerHTML = `
        <div class="match-meta">${m.date}</div>
        <div class="match-team">${m.home}</div>
        <div class="score-inputs">
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="home" value="${s.home ?? ''}">
          <span class="score-sep">–</span>
          <input type="number" min="0" max="20" data-match="${m.id}" data-side="away" value="${s.away ?? ''}">
        </div>
        <div class="match-team right">${m.away}</div>
        <div></div>
      `;
      groupWrap.appendChild(row);
    });
    container.appendChild(groupWrap);
  });

  el.appendChild(container);

  container.querySelectorAll("input[type=number]").forEach(inp=>{
    inp.addEventListener("change", async ()=>{
      const matchId = inp.dataset.match;
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
        showToast("Errore salvataggio: " + e.message, true);
      }
    });
  });
}

// ============================================================
// TAB: CLASSIFICA GIRONI (pronostico ordine finale 1-4 per girone)
// ============================================================
async function renderGironi(el){
  el.innerHTML = `<div class="loading-msg">Carico i tuoi pronostici sui gironi…</div>`;
  let saved;
  try{
    saved = await apiGet("/predictions/group-order");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">Pronostico classifica finale dei gironi <span class="tag">12 gironi</span></div>
    <p class="section-desc">Per ogni girone, indica la squadra che pensi arriverà 1ª, 2ª, 3ª e 4ª. Ogni posizione corretta vale punti (vedi Regolamento).</p>
  `;

  const grid = document.createElement("div");
  grid.className = "groups-grid";

  Object.keys(TOURNAMENT.groups).sort().forEach(g=>{
    const order = saved[g] || [null,null,null,null];
    const block = document.createElement("div");
    block.className = "group-block";
    block.innerHTML = `<h4>Girone ${g} <span class="badge">4 squadre</span></h4>`;
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
  let saved;
  try{
    saved = await apiGet("/predictions/awards");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore nel caricamento: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">Pronostici sui premi finali</div>
    <p class="section-desc">Indica chi vincerà ciascun riconoscimento individuale e di squadra. Per capocannoniere, miglior giocatore e miglior portiere scrivi nome e cognome del calciatore.</p>
  `;

  const grid = document.createElement("div");
  grid.className = "grid-3";
  AWARD_DEFS.forEach(def=>{
    const val = saved[def.field] || "";
    const card = document.createElement("div");
    card.className = "award-card";
    card.innerHTML = `
      <span class="icon">${def.icon}</span>
      <div class="award-title">${def.title}</div>
      <div class="points">${def.points} punti se esatto</div>
      ${def.type==="team"
        ? `<select data-award="${def.field}">${teamOptionsHtml(val)}</select>`
        : `<input type="text" data-award="${def.field}" value="${escapeHtml(val)}" placeholder="Nome e cognome">`
      }
    `;
    grid.appendChild(card);
  });
  el.appendChild(grid);

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
  el.innerHTML = `
    <div class="section-title">Inserimento risultati reali</div>
    <p class="section-desc">Inserisci qui i risultati ufficiali non appena disponibili. Non esiste un collegamento automatico al sito FIFA (nessuna API gratuita disponibile), ma per i gironi puoi calcolare l'ordine automaticamente dai risultati delle partite invece di inserirlo a mano.</p>
    <div class="subtabs">
      <button class="subtab-btn ${adminResultsSubTab==='partite'?'active':''}" data-sub="partite">Risultati partite</button>
      <button class="subtab-btn ${adminResultsSubTab==='gironi'?'active':''}" data-sub="gironi">Classifica gironi</button>
      <button class="subtab-btn ${adminResultsSubTab==='premi'?'active':''}" data-sub="premi">Premi finali</button>
    </div>
    <div id="admin-results-content"></div>
  `;
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
  let board;
  try{
    board = await apiGet("/leaderboard");
  }catch(e){
    el.innerHTML = `<div class="empty-state">Errore: ${escapeHtml(e.message)}</div>`;
    return;
  }

  el.innerHTML = `<div class="section-title">Classifica generale <span class="tag">${board.length} concorrenti</span></div>`;

  const card = document.createElement("div");
  card.className = "card";
  const table = document.createElement("table");
  table.className = "responsive-table leaderboard-table";
  table.innerHTML = `
    <thead><tr>
      <th style="width:50px">Pos.</th><th>Concorrente</th><th>Squadra</th>
      <th class="num">Risultati esatti</th><th class="num">Esiti 1X2</th><th class="num">Gironi</th>
      <th class="num">Premi</th><th class="num total-col">Totale</th>
    </tr></thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  board.forEach((p, idx)=>{
    const premiTotal = p.breakdown.vincitoreMondiale + p.breakdown.capocannoniere + p.breakdown.squadraPiuReti + p.breakdown.migliorGiocatore + p.breakdown.miglierPortiere;
    const tr = document.createElement("tr");
    if(SESSION.type==="participant" && p.id === SESSION.id) tr.classList.add("me-row");
    tr.innerHTML = `
      <td data-label="Pos." class="num-mono">${idx+1}°</td>
      <td data-label="Concorrente"><b>${escapeHtml(p.name)}</b></td>
      <td data-label="Squadra">${escapeHtml(p.team || "—")}</td>
      <td data-label="Risultati esatti" class="num">${p.breakdown.risultatoEsatto}</td>
      <td data-label="Esiti 1X2" class="num">${p.breakdown.segno1x2}</td>
      <td data-label="Gironi" class="num">${p.breakdown.posizioniGironi}</td>
      <td data-label="Premi" class="num">${premiTotal}</td>
      <td data-label="Totale" class="num total-col"><b>${p.total}</b></td>
    `;
    tbody.appendChild(tr);
  });
  card.appendChild(table);
  el.appendChild(card);
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

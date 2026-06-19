# Tabellone Mondiale 2026 — Lega Pronostici (backend condiviso)

Portale web per gestire i pronostici di **36 concorrenti** sul Mondiale 2026,
con un database condiviso: tutti vedono la stessa classifica, da qualsiasi
dispositivo, senza bisogno di esportare/importare nulla.

## Caratteristiche

- **Zero dipendenze npm esterne**: usa solo i moduli nativi di Node.js
  (`node:http`, `node:sqlite`, `node:crypto`). Non serve `npm install`,
  non ci sono pacchetti da compilare: massima compatibilità con qualsiasi
  hosting.
- **Database SQLite** in un singolo file (`data/tabellone.db`), creato e
  popolato automaticamente al primo avvio con i 36 concorrenti reali.
- **Accesso concorrenti tramite codice personale**: ogni concorrente ha un
  codice a 6 caratteri generato automaticamente (niente username/password da
  gestire). L'admin vede tutti i codici e può rigenerarli.
- **Area amministratore protetta da password**, separata dall'accesso dei
  concorrenti, per inserire i risultati ufficiali.
- **Calcolo automatico della classifica gironi**: l'admin inserisce solo i
  risultati delle singole partite; un pulsante calcola da solo l'ordine del
  girone (punti, differenza reti, reti fatte) invece di doverlo inserire a
  mano.
- **Classifica generale calcolata automaticamente** lato server ogni volta
  che viene letta: nessun rischio di disallineamento tra i punteggi mostrati
  ai diversi concorrenti.

## Requisiti

- **Node.js versione 22.5 o superiore** (richiesto per `node:sqlite`, ancora
  sperimentale ma stabile per questo utilizzo). Verifica con `node -v`.

## Avvio in locale

```bash
cd wc2026-backend
node server/index.js
```

Il server parte sulla porta 3000 di default: apri `http://localhost:3000`.

Al primo avvio vedrai in console qualcosa come:

```
Seed completato: 36 concorrenti inseriti.
Password admin inizializzata (variabile ADMIN_PASSWORD o default 'mondiale2026').
Tabellone Mondiale 2026 in ascolto su http://localhost:3000
```

### Cambiare la password admin o la porta

```bash
ADMIN_PASSWORD="una-password-tua" PORT=8080 node server/index.js
```

Se non imposti `ADMIN_PASSWORD`, quella di default è **`mondiale2026`** — ti
consiglio di cambiarla subito (puoi farlo anche dal pannello admin dopo il
primo accesso, oppure relanciando il server con la variabile d'ambiente).

## Come funziona l'accesso dei concorrenti

1. Accedi come admin (password sopra) e vai sul tab **"Concorrenti & codici"**.
2. Lì trovi tutti i 36 nomi (presi dal file Excel che mi hai fornito) con un
   codice di accesso a 6 caratteri generato automaticamente per ciascuno.
3. Condividi il codice corrispondente con ogni concorrente (es. messaggio
   privato in chat). Il concorrente lo inserisce nella schermata di login
   e accede al proprio profilo, dove inserisce i suoi pronostici.
4. Se un concorrente perde il codice, dal pannello admin puoi rigenerarlo
   con un clic (il vecchio smette di funzionare).
5. Puoi anche modificare nome e nome-squadra di ogni concorrente in qualsiasi
   momento dallo stesso pannello.

## Come inserire i risultati reali (admin)

Vai sul tab **"Risultati reali"**:

- **Risultati partite**: inserisci il punteggio reale di ogni partita non
  appena la conosci. La classifica generale si aggiorna da sola.
- **Classifica gironi**: puoi impostarla a mano oppure premere
  **"⚡ Calcola automaticamente"** per ogni girone — il sistema deriva
  l'ordine dai risultati delle partite già inseriti (punti, differenza
  reti, reti fatte), evitandoti di farlo a mano.
- **Premi finali**: vincitore Mondiale, capocannoniere, squadra con più reti
  nei gironi, miglior giocatore, miglior portiere.

### Nota importante sull'aggiornamento dei risultati

**Non esiste un collegamento automatico al sito ufficiale FIFA**: non c'è
una API gratuita pubblica per i risultati in tempo reale, e fare scraping
del sito violerebbe i suoi termini d'uso. L'inserimento dei risultati delle
singole partite resta quindi manuale da parte tua, ma è stato reso il più
rapido possibile (un campo per il punteggio, niente altro) e la classifica
dei gironi si calcola da sola.

Se in futuro vuoi vera automazione in tempo reale, l'opzione realistica è
abbonarsi a una API sportiva a pagamento (es. API-Football, SportRadar) e
far chiamare quella API dal server invece dell'inserimento manuale: è una
modifica contenuta che posso fare se decidi di procedere in questa
direzione.

## Deploy online (per renderlo accessibile a tutti i 36 concorrenti)

Il codice è pronto per essere eseguito su qualsiasi servizio che supporti
Node.js. Alcuni esempi comuni, dal più semplice:

- **Render.com** (piano gratuito disponibile): crea un "Web Service",
  collega questo codice (anche da zip, senza bisogno di GitHub), comando di
  start `node server/index.js`, imposta la variabile d'ambiente
  `ADMIN_PASSWORD`. Render assegna un URL pubblico tipo
  `https://tuonome.onrender.com`.
- **Railway.app**: simile a Render, anche con piano gratuito limitato.
- **Fly.io**: leggermente più tecnico ma molto economico, supporta bene
  SQLite con volumi persistenti.

In tutti i casi, due cose fondamentali da impostare:

1. **Variabile d'ambiente `ADMIN_PASSWORD`** con una password a tua scelta
   (altrimenti resta quella di default, che è pubblica in questo file).
2. **Storage persistente per la cartella `data/`**: molti hosting gratuiti
   "resettano" il filesystem ad ogni riavvio del servizio. Se il tuo piano
   lo prevede, assicurati di montare un volume/disco persistente sul
   percorso della cartella `data/`, altrimenti rischi di perdere pronostici
   e risultati ad ogni riavvio. Questo è l'unico punto che varia da
   servizio a servizio: se mi dici quale hosting scegli, ti preparo le
   istruzioni precise passo-passo.

## Limitazioni da conoscere

- **Le sessioni di login sono in memoria**: se il server si riavvia (per un
  deploy, un crash, o un riavvio automatico dell'hosting), tutti i
  concorrenti e l'admin dovranno rifare il login (i pronostici salvati nel
  database NON si perdono, solo lo stato "sono loggato" nel browser). Se il
  tuo hosting riavvia il processo molto spesso e questo dà fastidio, si può
  passare a sessioni persistenti su file — fammi sapere se ti serve.
- **SQLite è pensato per un singolo processo**: per 36 utenti che inseriscono
  pronostici occasionalmente è più che sufficiente, non è un collo di
  bottiglia in questo scenario.
- `node:sqlite` è ufficialmente "sperimentale" in Node.js (introdotto in
  Node 22), ma è già stabile per un caso d'uso come questo: letture/scritture
  semplici, basso volume. Se preferisci una libreria SQLite "matura" e non
  sperimentale, si può passare a `better-sqlite3` in qualsiasi momento (avrai
  solo bisogno di una connessione internet funzionante per `npm install`,
  cosa che sul tuo computer o sull'hosting non sarà un problema).

## Struttura del progetto

```
wc2026-backend/
├── package.json
├── server/
│   ├── index.js       → server HTTP e tutte le rotte API
│   ├── router.js       → micro-router con supporto a parametri di percorso
│   ├── sessions.js      → gestione sessioni via cookie firmato
│   ├── auth.js        → hashing password (scrypt nativo)
│   ├── db.js          → schema SQLite e inizializzazione/seed
│   ├── scoring.js     → motore di calcolo punteggi e classifica
│   └── data.js        → squadre, gironi, calendario partite, regole punti
├── public/
│   ├── index.html        → frontend (HTML + CSS)
│   └── app.js           → frontend (logica, chiamate API)
└── data/
    └── tabellone.db      → creato automaticamente al primo avvio
```

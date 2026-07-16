# Patrimonio

Web app leggera per patrimonio personale, movimenti e PAC. Frontend statico Preact/Vite su GitHub Pages; login Google e dati privati su Firebase.

## Avvio locale

1. Copia `.env.example` in `.env` e inserisci la configurazione Firebase.
2. Esegui `npm install` e poi `npm run dev`.
3. Senza `.env` l'app parte in modalità demo con dati di esempio e senza salvataggio.

## Configurazione Firebase gratuita

1. Crea un progetto nella [Firebase Console](https://console.firebase.google.com/), senza abilitare Google Analytics se non serve.
2. In **Authentication → Sign-in method**, abilita Google.
3. In **Authentication → Settings → Authorized domains**, aggiungi `TUO-USERNAME.github.io`.
4. Crea un database **Cloud Firestore** in modalità produzione, preferibilmente in una regione UE.
5. Installa Firebase CLI (`npm i -g firebase-tools`), accedi e pubblica le regole con `firebase deploy --only firestore:rules`.
6. Registra una Web App in Firebase e copia i valori mostrati nelle variabili `VITE_FIREBASE_*`.

La chiave API Firebase nel frontend identifica il progetto e non è un segreto. La sicurezza effettiva dipende da Authentication e dalle regole in `firestore.rules`. Non usare mai credenziali amministrative o service-account nel frontend.

## GitHub Pages

1. Pubblica il repository su GitHub. Se il repository non si chiama `FinanceViewer`, cambia `base` in `vite.config.ts`.
2. Prima del primo deploy apri **Settings → Pages**, in **Build and deployment → Source** scegli **GitHub Actions** e salva. Questo passaggio crea il sito Pages: il normale `GITHUB_TOKEN` del workflow non è autorizzato a farlo automaticamente.
3. In **Settings → Secrets and variables → Actions**, aggiungi `VITE_FIREBASE_API_KEY` come secret e le altre variabili indicate in `.env.example` come repository variables.
4. Un push su `main` avvierà il deploy.

## PAC

L'app non dispone di un server sempre attivo. Quando l'utente accede, genera in modo idempotente i movimenti mensili mancanti (massimo 120 per sessione), usando un ID deterministico: non crea duplicati. Ogni movimento generato può essere cancellato o corretto. Il PAC registra un versamento, ma non modifica automaticamente il valore di mercato dell'asset: sono due concetti diversi e questo evita rendimenti falsati.

## Dati e sicurezza

- ogni documento è sotto `/users/{uid}/...`;
- Firestore rifiuta richieste anonime o provenienti da un altro UID;
- nessun dato finanziario finisce nel repository o nel browser storage;
- tema e preferenze non sensibili restano in `localStorage`;
- per dati finanziari reali, aggiungere informativa privacy, gestione cancellazione/esportazione e test delle regole prima della pubblicazione.

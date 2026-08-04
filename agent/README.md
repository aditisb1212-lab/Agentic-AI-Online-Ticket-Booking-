# Agentic AI Ticket Booking

## Folder structure

```
.
├── frontend/              # React + Vite client
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── main.jsx
│       └── components/
│           ├── AiAgentPanel.jsx   ← scroll-during-booking bug fixed here
│           ├── AuthModal.jsx
│           ├── EventCard.jsx
│           └── SeatingChart.jsx
│
├── backend/                # Express + SQLite/MySQL API + Gemini agent service
│   ├── server.js
│   ├── config.js
│   ├── database.js
│   ├── services/
│   │   └── aiService.js
│   └── .env.example
│
├── package.json             # root manifest (kept for existing Render/Vercel deploy configs)
├── railpack.json
└── .gitignore
```

The `frontend/` and `backend/` folders are a readability split of the same
code that already lives at the project root (root copies of `package.json`,
etc. are kept so your existing Render/Vercel deployment settings — which
point at the repo root — keep working without reconfiguration).

## What was fixed

Both fixes are in `frontend/src/components/AiAgentPanel.jsx`.

**Fix 1 — scroll freezes then jumps during booking**

The auto-scroll `useEffect` only re-ran when the `messages` array changed.
But during a booking, the UI streams intermediate reasoning steps into a
separate `activeStep` state (updated every ~800ms) *before* `messages` is
touched — so the effect never fired during that window, then jumped once
at the end.

Fix: added `activeStep` and `loading` to the effect's dependency array and
made it scroll while `loading` is true, so the trace log now follows
smoothly in real time instead of freezing and jumping.

**Fix 2 — the whole page snaps to the top when a new message arrives**

`chatEndRef.current.scrollIntoView()` doesn't just scroll the chat panel —
by spec it scrolls *every* scrollable ancestor into view, and the page
itself is scrollable (`body { overflow: auto }`) on top of the chat
panel's own internal scroll (`.chat-history { overflow-y: auto }`). So any
time a new agent message arrived while you'd scrolled down to use the seat
chart on the left, the entire page yanked back to the top before the chat
panel scrolled — very jarring.

Fix: replaced `scrollIntoView()` with `container.scrollTo({ top:
container.scrollHeight, behavior: "smooth" })`, which only ever touches
the chat panel's own scrollbar, never the page. The now-unused
`chatEndRef` and its placeholder `<div>` were removed.

## Setup

**Backend**
```bash
cd backend
cp .env.example .env   # fill in real PORT / DB_TYPE / JWT_SECRET / GEMINI_API_KEY
npm install
npm start
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## ⚠️ Security note

Your GitHub repo currently has a real `.env` file **committed and tracked**
(with a live `JWT_SECRET` and `GEMINI_API_KEY`), even though your commit
history shows this was flagged and "resolved" once before. It's exposed
again right now. This zip does **not** include that file — only a safe
`.env.example` placeholder.

You should, as soon as possible:
1. Rotate the `JWT_SECRET` and `GEMINI_API_KEY` (generate new ones — treat
   the current ones as compromised).
2. Remove `.env` from git tracking: `git rm --cached .env`
3. Confirm `.env` is listed in `.gitignore` (it already is, but it's still
   tracked from before that line was added — removing from the index in
   step 2 fixes that going forward).
4. If you want it gone from history entirely (not just future commits),
   that needs a history rewrite (`git filter-repo` or BFG) — let me know
   if you'd like help with that.

# Plan — Case Documents: AI document processing for a personal injury case

Demo feature for the legal AI hackathon: upload documents for one hardcoded
case, extract text + structured medical/case events with Gemini
(`gemini-2.5-flash`), review the results in an editable table. No auth, no
database — in-memory client state only.

## ⚠️ Stack reality check (deviation from the original brief)

The brief says "Create the Next.js app with Tailwind". **This repo is not
Next.js and we should not scaffold one.** The existing stack is:

| Layer | What's here |
| --- | --- |
| Runtime | Cloudflare Worker (`src/server/index.ts`), `nodejs_compat` on |
| Frontend | React 19 + Vite 8 (`@cloudflare/vite-plugin`), SPA served from `public/` |
| Routing | `react-router` 7 (`BrowserRouter` in `src/client/app.tsx`) |
| Styling | Tailwind v4 + `@cloudflare/kumo` component kit (`Button`, `Input`, `LayerCard`, `Badge`, `Text`, `Loader`, `Toasty`) + Phosphor icons |
| Validation | `zod` v4 already installed |
| Existing AI | Workers AI chat agent (Durable Object) — untouched by this feature |
| Direct Actions | Catalog in `src/shared/actions.ts`, grid in `src/client/components/action-grid.tsx`, runner page `src/client/pages/action.tsx` |

Everything in the brief maps cleanly:

- **Next.js API route `/api/process`** → a `fetch` route in the Worker
  (`src/server/index.ts`), plus `"/api/*"` added to
  `assets.run_worker_first` in `wrangler.jsonc` (already flagged as the plan
  in `src/client/lib/run-action.ts`'s comments).
- **Next.js page** → a new SPA route `/case` registered in
  `src/client/app.tsx`.
- **"Legal software feel"** → we get it for free by reusing Kumo components
  and the existing `kumo-*` neutral token palette (also keeps dark mode
  working via the existing `ThemeToggle`).
- **`GEMINI_API_KEY` in `.env.local`** → Wrangler v4 reads `.env.local` in
  local dev (both are already gitignored). If the var doesn't show up on
  `env`, mirror it into `.dev.vars` (also gitignored). For deploy:
  `npx wrangler secret put GEMINI_API_KEY`.

One repo convention to respect: **`src/shared` must stay free of runtime
dependencies** (it's imported by both Worker and browser). So shared event
*types* go in `src/shared`, but the zod *schema* lives server-side.

## Direct Actions integration (requested addition)

The upload-documents feature becomes a live entry in the Direct Actions
catalog:

1. `src/shared/actions.ts` — add to `ACTIONS`:
   ```ts
   {
     type: "case-documents",
     title: "Process case documents",
     description:
       "Upload medical records and bills for a case; Gemini extracts every event, date and cost into a review table.",
     status: "live",
     href: "/case"   // new optional field, see below
   }
   ```
   Add `href?: string` to `ActionDefinition`: this action needs a full page
   (upload zone + table), not the generic `?type=` runner. `ActionCard` links
   to `action.href ?? \`/action?type=${type}\``. The generic action page never
   sees the type, so its joke-specific `Runner` stays untouched.
2. `src/client/components/action-grid.tsx` — add an icon:
   `"case-documents": FilesIcon` (Phosphor).
3. `src/client/app.tsx` — register `<Route path="/case" element={<CasePage />} />`
   (lazy, like the others).

## New files

```
src/shared/case.ts                        # CaseEvent / ProcessResponse types (plain TS only)
src/client/pages/case.tsx                 # page shell: header + upload + list + table
src/client/components/case/case-header.tsx
src/client/components/case/upload-zone.tsx
src/client/components/case/file-list.tsx
src/client/components/case/review-table.tsx
src/client/lib/use-case-documents.ts      # all client state + processing calls
src/server/routes/process.ts              # POST /api/process handler
src/server/lib/gemini.ts                  # Gemini REST helpers (text + JSON mode)
src/server/lib/extract-events.ts          # zod schema, validate, one-retry logic
```

Edited files: `src/shared/actions.ts`, `src/client/components/action-grid.tsx`,
`src/client/app.tsx`, `src/server/index.ts`, `wrangler.jsonc` (+ regenerated
`worker-configuration.d.ts`).

Components stay small and independent (UploadZone / FileList / ReviewTable)
so they're easy to restyle tomorrow. All state lives in one hook
(`useCaseDocuments`) passed down as props — no context, no store.

---

## Phase 1 — Scaffold (case page + Direct Action entry)

**Work**

1. Catalog entry + `href` field + icon + `/case` route (see above).
2. `case.tsx`: `AppHeader` (badge: "Case workspace"), then `CaseHeader`,
   then a placeholder main area.
3. `CaseHeader`: hardcoded **"Case #2024-183 — Maria Santos · Car accident ·
   {N} documents"** — `N` comes in as a prop (0 for now). Kumo `LayerCard`,
   scale-of-justice/briefcase Phosphor icon, neutral tones.

**Test**

- `npm start` → open the printed URL (Vite, usually `http://localhost:5173`).
- Homepage → "Direct Actions" section shows the new **Process case
  documents** card as live (not "Soon"); clicking it lands on `/case`.
- `/case` shows the case header with "0 documents". Dark mode toggle still
  looks right. `npm run check` passes.

## Phase 2 — Upload feature

**Work**

1. `use-case-documents.ts` — the single source of truth:
   ```ts
   type DocStatus = "uploaded" | "processing" | "done" | "error";
   interface CaseDocument {
     id: string;          // crypto.randomUUID()
     file: File;          // kept for re-processing + "open PDF" links later
     status: DocStatus;
     error?: string;
     rawText?: string;    // phase 3
     events?: CaseEvent[]; // phase 4
   }
   ```
   Exposes `documents`, `addFiles(FileList)`, `removeDocument(id)`, and (from
   phase 3 on) auto-processing. Validation on add: max 20 MB, allowed types
   `application/pdf`, `text/plain`, `image/png`, `image/jpeg` (check
   extension as a fallback — browsers sometimes send empty MIME types).
   Rejected files never enter the list; they surface as a dismissible inline
   error line under the drop zone ("report.docx: only PDF, TXT, PNG or JPG"
   / "scan.pdf: larger than 20 MB").
2. `UploadZone` — drag-and-drop (dragover highlight ring) + hidden
   `<input type="file" multiple accept=".pdf,.txt,.png,.jpg,.jpeg">` behind a
   "browse files" Kumo `Button`.
3. `FileList` — one row per document: type icon (`FilePdfIcon` /
   `FileTextIcon` / `ImageIcon`), filename, human size (KB/MB), status
   `Badge` (uploaded=secondary, processing=secondary+`Loader`, done=success
   tone, error=danger tone), and a remove `X` button.
4. Header count wired to `documents.length`.
5. Server plumbing now, so phase 3 is pure logic:
   - `wrangler.jsonc`: `run_worker_first: ["/agents/*", "/oauth/*", "/api/*"]`
     → then `npm run types` and commit `worker-configuration.d.ts` (CI checks
     staleness).
   - `src/server/index.ts`: `POST /api/process` → `handleProcess(request, env)`
     from `src/server/routes/process.ts`. Stub for now: read the `FormData`,
     echo `{ filename, size }`.
   - Client: on add, each valid file is POSTed **individually** (`FormData`,
     field `file`) — per-file requests keep the 20 MB limit per call, give
     per-file status, and let one bad file fail alone. Status walks
     `uploaded → processing → done/error`.

**Test**

- Drag 2–3 mixed files in → rows appear with correct icons/sizes, count in
  the header updates, statuses reach "done" (stub echo).
- Try a 25 MB file and a `.docx` → friendly inline errors, nothing added.
- Remove a row → count decrements. Network tab shows one `POST /api/process`
  per file returning JSON (proving `run_worker_first` works).

## Phase 3 — Text extraction (Gemini inline data)

**Work**

1. Env: `GEMINI_API_KEY=...` in `.env.local` (mirror to `.dev.vars` if it
   doesn't appear). Declare it for types: `npm run types` regenerates `Env`.
2. `src/server/lib/gemini.ts` — **plain `fetch` against the REST API, no SDK**
   (one less dependency; the API is two small POST bodies):
   `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
   with header `x-goog-api-key`. Helper
   `generateContent(env, parts, config?)` returning the first candidate's
   text, with non-2xx → thrown error carrying Google's error message.
3. `process.ts` per file:
   - `text/plain` → `await file.text()`.
   - PDF/PNG/JPG → `Buffer.from(await file.arrayBuffer()).toString("base64")`
     (`nodejs_compat` is on) → one part
     `{ inlineData: { mimeType, data } }` + a prompt part: "Transcribe the
     full text content of this document. Preserve reading order. Output plain
     text only." Gemini reads PDFs/images natively — no OCR library.
   - Response: `{ filename, rawText }` or `{ filename, error }` with an
     appropriate 4xx/5xx. Never throw across the whole request.
4. Client: store `rawText` on the document; `FileList` rows get a
   collapsible **"raw text"** `<details>`-style preview (monospace,
   `max-h-64 overflow-auto`).

**Test**

- Upload a `.txt` → done almost instantly, preview shows exact contents.
- Upload a real PDF (medical bill) and a photo/screenshot of text → status
  sits at "processing" a few seconds, then preview shows a faithful
  transcription.
- Kill the API key → rows go to "error" with a readable message, app doesn't
  crash. Restore key.

## Phase 4 — Structured extraction (JSON mode + zod + retry)

**Work**

1. `src/shared/case.ts` (types only, no zod):
   ```ts
   interface CaseEvent {
     date: string;                 // "YYYY-MM-DD" | "unknown"
     description: string;
     provider: string;
     cost: number | null;
     source_file: string;
     source_page: number | null;
     confidence: "high" | "low";
   }
   ```
2. `src/server/lib/extract-events.ts`:
   - zod schema mirroring the above (`date` regex `\d{4}-\d{2}-\d{2}` or
     literal `"unknown"`), wrapped in `{ events: [...] }`.
   - Gemini call #2 (input: the raw text from phase 3 + filename — cheaper
     and more debuggable than re-sending the binary; revisit to a single
     combined call later if demo latency matters) with JSON mode:
     `responseMimeType: "application/json"` + a hand-written `responseSchema`
     (Gemini's OpenAPI-subset format — written manually, not derived from
     zod, since zod v4's JSON Schema output isn't Gemini's dialect).
   - Prompt includes verbatim: *"Only extract facts explicitly present in the
     document. If a value is uncertain or partially legible, set confidence
     to 'low'. Never guess dates or amounts."* Plus: use the provided
     filename as `source_file`; `source_page` only if the page is known,
     else null.
   - Validation: `JSON.parse` → `schema.safeParse`. On failure, **one retry**:
     re-send with the invalid output + zod's issues appended ("Your previous
     response was invalid JSON for the schema: {issues}. Return a corrected
     response."). Still invalid → that file returns
     `{ filename, rawText, error: "extraction failed" }`; the request never
     crashes.
3. `process.ts` response becomes `{ filename, rawText, events }`.
4. Client: `use-case-documents.ts` stores `events` per document and derives
   `allEvents` — flattened across done documents, sorted by date ascending
   with `"unknown"` dates last.
5. `case.tsx`: render `allEvents` in a `<pre>` block (temporary).

**Test**

- Upload a medical bill PDF → `<pre>` shows valid events: real dates, real
  amounts, `source_file` matches, plausible confidence values.
- Upload a TXT with vague content ("sometime in March, roughly $500") →
  events come back `confidence: "low"` and/or `date: "unknown"`, not
  invented precision.
- Upload 2+ files → merged array is date-sorted across files.
- Row with a failed extraction shows "error" but other files' events render.

## Phase 5 — Review table

**Work** — `ReviewTable` replaces the `<pre>`:

1. Row model in the hook: each event gets
   `{ id, ...event, edited: boolean, confirmed: boolean }`; hook gains
   `updateEvent(id, patch)` (sets `edited`), `deleteEvent(id)`,
   `confirmEvent(id)`. A "needs review" row = `confidence === "low" &&
   !edited && !confirmed`.
2. Columns: **Date | Event | Provider | Cost | Source | Confidence | Actions**
   - Source: `"bill.pdf, p.2"` (page omitted when null), a link built from
     `URL.createObjectURL(doc.file)` opening in a new tab (revoked on
     unmount/remove) — works for PDFs and images; TXT opens as plain text.
   - Confidence: green `CheckCircleIcon` (high) / amber `WarningIcon` (low);
     low rows also get a subtle amber row background (`bg-amber-500/8`-style,
     works in dark mode) that clears once edited/confirmed.
   - Cost right-aligned, formatted `$1,250.00`, em-dash when null.
   - Actions: pencil → the row's cells become inputs (date, text, text,
     number) with save/cancel; trash → delete row. On a low row, clicking the
     amber warning icon confirms it (turns into a neutral check).
3. Table header bar: **"X facts extracted · Y need review"** + **"Approve all
   reviewed"** Kumo `Button`, disabled while `Y > 0`, tooltip/hint explaining
   why. Clicking it (demo endpoint of the flow) marks everything confirmed
   and shows a success toast via the existing `Toasty`.

**Test**

- Full flow: upload bill PDF + doctor-note TXT → table populates sorted;
  low-confidence rows amber with warning icons; header counts correct.
- Edit a low row's date → amber clears, "need review" count drops.
- Confirm another low row via its icon → same.
- When Y hits 0 → "Approve all reviewed" enables; click → toast.
- Delete a row → counts update. Source link opens the original file in a new
  tab. `npm run check` still passes.

---

## Sequencing & risk notes

- **Do phase 2's server plumbing early** (`run_worker_first`, `npm run
  types`) — it's the only config-level risk; everything after is plain code.
- **Per-file requests** (not one batch) — keeps each request under Gemini's
  ~20 MB inline-data budget and gives honest per-file status/errors.
- **Two Gemini calls per file** (transcribe → extract) — matches the phase
  structure and is easier to debug; can be collapsed into one call with a
  combined `{ rawText, events }` responseSchema if demo latency needs it.
- **Untouched:** chat agent, Durable Object, joke action, home/chat pages —
  only additive changes plus the tiny `href` extension to `ActionDefinition`.
- Run `npm run check` (types + prettier + eslint + tsc) at each phase
  boundary; husky enforces it on commit.

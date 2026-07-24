# Plan — Case Documents: AI document processing for a personal injury case

Demo feature for the legal AI hackathon: upload documents for one hardcoded
case (PDF, Excel/Office, CSV, TXT and images), extract text + structured
case-relevant events with **Cloudflare
Workers AI** (free, no API key — the `AI` binding already in
`wrangler.jsonc`), review the results in an editable table. No auth, no
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
| Existing AI | Workers AI binding `env.AI` (`remote: true` — real inference even in local dev) + chat agent Durable Object (untouched) |
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
- **Gemini + `GEMINI_API_KEY`** → dropped entirely in favour of **Workers AI
  via the existing `env.AI` binding**. No key, no `.env.local`, no secrets:
  the binding is already configured with `"remote": true`, so `npm start`
  runs real inference, and the free tier (10,000 neurons/day) covers a demo.

## Model choice (Workers AI)

The task needs three capabilities; no single free model covers all of them
well, so each step uses the best free tool for it (all verified against the
current Workers AI docs):

| Step | Choice | Why |
| --- | --- | --- |
| PDF / Excel / Word → text | **`env.AI.toMarkdown()`** (Markdown Conversion) | Purpose-built binding; PDF **and Microsoft Office formats (`.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.docx`), CSV and OpenDocument are all supported inputs** — no LLM involved, fast and effectively free. Markdown output preserves table structure, which is exactly what a spreadsheet of bills or an expense ledger needs. |
| Image → text | **`@cf/meta/llama-3.2-11b-vision-instruct`** | The only *vision* model on the official JSON Mode support list, so one model id covers image transcription now and keeps the option of direct image→events later. (`toMarkdown()` on images only captions them via object detection — useless for reading a scanned bill.) |
| Text → structured events | **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`** | The strongest model on the JSON Mode support list (`response_format: { type: "json_schema" }` — OpenAI-compatible). 70B-class extraction quality matters for dates/amounts/confidence; the fp8-fast variant keeps demo latency down. |

Rejected alternatives: `@cf/moonshotai/kimi-k2.6` (the chat agent's model)
and `@cf/meta/llama-4-scout-17b-16e-instruct` are not on the JSON Mode
support list; `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` is (and is
smart) but burns time on reasoning tokens — wrong trade-off for a live demo.
Model ids live as constants in `src/server/lib/ai.ts`, swappable in one
place. Caveat from the docs: even in JSON Mode the platform may return a
`JSON Mode couldn't be met` error — the phase 4 zod/retry layer handles that
path anyway.

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
       "Upload medical records and bills for a case; AI extracts every event, date and cost into a review table.",
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
src/server/lib/ai.ts                      # model ids + env.AI.run()/toMarkdown() helpers
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
   **Phase 6 widens this allowlist to Excel/Office — see below.**
   Rejected files never enter the list; they surface as a dismissible inline
   error line under the drop zone ("scan.gif: unsupported file type"
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

## Phase 3 — Text extraction (Workers AI)

Replace the stub in `process.ts` with real text extraction — `env.AI.toMarkdown()`
for PDFs, the vision model for images, `file.text()` for TXT — and surface a
`rawText` preview per row.

**Work**

1. No env setup at all — the `AI` binding already exists and `remote: true`
   makes local dev hit real inference.
2. `src/server/lib/ai.ts` — model id constants (see "Model choice") plus two
   thin helpers around the binding: `pdfToText(env, file)` and
   `imageToText(env, file)`. Errors thrown with the binding's message
   attached; no SDK, no HTTP client, no key handling.
3. `process.ts` per file:
   - `text/plain` → `await file.text()`.
   - PDF → `env.AI.toMarkdown({ name, blob })` → markdown string. (Note:
     this extracts *embedded* text; a pure image-scan PDF may come back
     near-empty — acceptable demo caveat, surfaced as a "no text found"
     error rather than silence.)
   - PNG/JPG → `env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", ... )`
     with the image bytes and prompt: "Transcribe the full text content of
     this document image. Preserve reading order. Output plain text only."
   - Response: `{ filename, rawText }` or `{ filename, error }` with an
     appropriate 4xx/5xx. Never throw across the whole request.
4. Client: store `rawText` on the document; `FileList` rows get a
   collapsible **"raw text"** `<details>`-style preview (monospace,
   `max-h-64 overflow-auto`).

**Test**

- Upload a `.txt` → done almost instantly, preview shows exact contents.
- Upload a real PDF (medical bill) → preview shows the text as markdown,
  tables included. Upload a photo/screenshot of text → status sits at
  "processing" a few seconds, then preview shows a faithful transcription.
- Break a model id constant temporarily → rows go to "error" with a readable
  message, app doesn't crash. Restore it.

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
   - Extraction call (input: the raw text from phase 3 + filename — cheaper
     and more debuggable than re-sending the binary):
     `env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages,
     response_format: { type: "json_schema", json_schema } })` — Workers AI
     JSON Mode, OpenAI-compatible. The `json_schema` is standard JSON
     Schema, generated straight from the zod schema via zod v4's built-in
     `z.toJSONSchema()` — one source of truth for schema and validation.
   - Prompt includes verbatim: *"Only extract facts explicitly present in the
     document. If a value is uncertain or partially legible, set confidence
     to 'low'. Never guess dates or amounts."* Plus: use the provided
     filename as `source_file`; `source_page` only if the page is known,
     else null.
   - Validation: `JSON.parse` → `schema.safeParse`. On failure — including
     the platform's own `JSON Mode couldn't be met` error — **one retry**:
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

## Phase 6 — Excel & Office documents (widen ingestion + generalize extraction)

**Goal:** accept spreadsheets (`.xlsx`, `.xls`, `.xlsm`, `.xlsb`), Word
(`.docx`) and CSV, and pull *any* case-relevant data out of them — not just
medical bills. This is a small, contained change because
`env.AI.toMarkdown()` already handles every one of these formats (verified in
the Workers AI Markdown-Conversion supported-formats table), and the existing
`pdfToText` helper is just a thin wrapper over it. A binary spreadsheet
becomes a markdown table, which is *better* structured-extraction input than a
scanned bill.

Why not `file.text()` for spreadsheets: `.xlsx`/`.xls` are zipped/binary —
reading them as text yields garbage. They must go through `toMarkdown()`, the
same path PDFs already take. (CSV is plain text and would work either way; we
route it through `toMarkdown()` too so its table renders consistently.)

**Work**

1. `src/shared/case.ts` — the single source of truth. Rename the `"pdf"`
   `DocumentKind` to **`"document"`** (it now means "anything `toMarkdown()`
   converts", not just PDF) and widen `classifyDocument`:
   ```ts
   export type DocumentKind = "document" | "image" | "text";

   const DOC_EXTENSIONS = /\.(pdf|xlsx|xlsm|xlsb|xls|docx|csv|ods|odt)$/;
   const DOC_TYPES = new Set([
     "application/pdf",
     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
     "application/vnd.ms-excel",                                          // .xls
     "application/vnd.ms-excel.sheet.macroenabled.12",                    // .xlsm
     "application/vnd.ms-excel.sheet.binary.macroenabled.12",             // .xlsb
     "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
     "text/csv"
   ]);
   ```
   Image check stays; `.txt` and empty-type unknowns still fall through to
   `"text"`. Keep the extension fallback first-class — browsers frequently
   send an empty or wrong `type` for Office files.
2. `src/server/lib/ai.ts` — rename `pdfToText` → **`documentToText`** (body is
   unchanged; it already calls `env.AI.toMarkdown`). Generalize the error
   string from `"PDF conversion failed"` to `"Document conversion failed"`.
   No new model, no new constant. `MAX_IMAGE_BYTES` does **not** apply here —
   `toMarkdown` streams the blob and never materializes a giant JS number
   array, so spreadsheets up to the 20 MB `MAX_UPLOAD_BYTES` are safe.
3. `src/server/routes/process.ts` — update the `extractText` switch: the
   `"document"` case calls `documentToText`. The existing "no readable text
   found" 422 guard now also covers a spreadsheet that converts to nothing.
4. `src/client/lib/use-case-documents.ts` — extend `ALLOWED_TYPES` (the 7
   MIME types above) and `ALLOWED_EXTENSIONS`
   (`.pdf .txt .png .jpg .jpeg .xlsx .xls .xlsm .xlsb .docx .csv`), and reword
   the rejection message to e.g. `"${file.name}: unsupported file type"`
   (the exhaustive list is too long to inline).
5. `src/client/components/case/upload-zone.tsx` — update the `ACCEPT` constant
   to the widened extension list and the helper text to
   `"PDF, Excel, Word, CSV, TXT, PNG or JPG · up to 20 MB each"`.
6. `src/client/components/case/file-list.tsx` — `iconFor` now needs finer
   granularity than `DocumentKind` (Excel vs PDF vs Word share the
   `"document"` kind). Switch it to pick by extension: `FileXlsIcon` for
   spreadsheets, `FileDocIcon` for `.docx`, `FileCsvIcon` for `.csv`,
   `FilePdfIcon` for `.pdf`, `ImageIcon` / `FileTextIcon` otherwise (all from
   `@phosphor-icons/react`).
7. `src/server/lib/extract-events.ts` — generalize `SYSTEM_PROMPT` so it isn't
   medical-only. Broaden the first sentence to *"extract every case-relevant
   fact — medical visits, procedures, diagnoses, bill and expense line items,
   payments, wage-loss entries, mileage"* and add a rule: *"When a row has no
   provider (e.g. an expense line), use an empty string for `provider`."* The
   `CaseEvent` schema is unchanged — date/description/provider/cost already
   model a spreadsheet row cleanly, so this stays a prompt-only change.

**No changes** to the JSON schema, the zod validator, the review table, or the
merge/sort logic — Excel events flow through the exact same `ProcessResponse`
→ `EventRow` → `ReviewTable` path as PDF events.

**Test**

- Upload an `.xlsx` of medical bills (date / provider / amount columns) → each
  row becomes an event with the right date and cost, `source_file` is the
  spreadsheet name, sorted into the merged timeline with the PDF/TXT events.
- Upload a `.csv` expense ledger with no provider column → events come back
  with empty `provider`, costs populated, `confidence` reasonable.
- Upload a `.docx` narrative → prose events extracted like a TXT.
- Upload a `.gif` or `.zip` → still rejected inline (allowlist unchanged for
  those). A 25 MB `.xlsx` → rejected as "larger than 20 MB".
- Type icons render per format (Excel/Word/CSV/PDF distinct). `npm run check`
  passes.

---

## Sequencing & risk notes

- **Do phase 2's server plumbing early** (`run_worker_first`, `npm run
  types`) — it's the only config-level risk; everything after is plain code.
- **Per-file requests** (not one batch) — honest per-file status/errors, and
  each request stays small (≤ 20 MB, our own validation limit).
- **Two AI steps per file** (get text → extract events) — matches the phase
  structure, is easier to debug, and is forced anyway for PDFs
  (`toMarkdown()` produces text; only the extraction step is an LLM call).
- **Free-tier budget** — Workers AI gives 10,000 neurons/day free; the
  70B extraction call is the main consumer. Fine for a demo day; if the
  quota trips mid-demo, the error path already renders per-file.
- **Untouched:** chat agent, Durable Object, joke action, home/chat pages —
  only additive changes plus the tiny `href` extension to `ActionDefinition`.
- Run `npm run check` (types + prettier + eslint + tsc) at each phase
  boundary; husky enforces it on commit.

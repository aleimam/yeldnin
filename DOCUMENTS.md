# Documents module — design

Company document library (policies, SOPs, HR, etc.). Source spec:
`YeldnIN-Documents.docx`. Lives under the **Administration** section and is
**visible to every signed-in user**; per-document **team** ACLs decide what each
person actually sees.

## Concepts

- **Document** = one item, one of two `kind`s:
  - **PDF** — an uploaded file (≤ 32 MB). Content is fixed; Manage edits only
    title / description / category / status / permissions / review-by.
  - **DOC** — rich-text content authored online (Tiptap → sanitized HTML). Operate
    edits the body; Manage edits body + metadata.
- **status**: `DRAFT` (hidden from View-only users) → `PUBLISHED` (visible to View).
- **Single language**: content + category names are stored once and shown to
  everyone as-is (no `*Ar` content fields). Module chrome stays bilingual via i18n.

## Permissions (per document, granted to teams)

Levels: **VIEW** (read + download) · **OPERATE** (edit content) · **MANAGE**
(edit metadata/status/permissions, rename, delete). Resolution for a user on a doc:

1. admin → MANAGE; owner → MANAGE.
2. else the **highest** level among `DocumentPermission` rows whose `teamKey` is in
   the user's team keys.
3. A DRAFT is only visible to OPERATE/MANAGE (incl. owner/admin).

**Creation**: any signed-in user may create a document and becomes its **owner**
(MANAGE). New docs start **DRAFT**, visible to owner + admins only until granted.

## Data model (Phase A)

- `Document` — id, uid (`DOC<YY><MM><seq3>`), kind, title, description?, categoryId?,
  status, ownerId, reviewBy?, assetId? (PDF file), contentHtml? (DOC), created/updated
  by+at, archivedAt?. Indexes: categoryId, status, ownerId.
- `DocumentCategory` — id, name, sortOrder, archivedAt?, timestamps. Seeds: Policies,
  SOP, Human Resources, KPIs, Information, Report, Release.
- `DocumentPermission` — id, documentId (cascade), teamKey, level. Unique(documentId, teamKey).

## Phases

- **A — Core**: schema/migration/seed · pure logic + tests · service · always-visible
  nav · categories admin · list (search + category/status filter + pagination) · view
  (read/download) · create/edit (PDF upload + DOC Tiptap editor) · per-team permissions
  editor · Draft/Published · soft-delete · audit · i18n. *(usable end-to-end)*
- **B — Versions · Acknowledgements · Review-by**: edit snapshots + Manage restore;
  "Read & acknowledge" + admin who-has/hasn't; review-by date + due flag.
- **C — Generated PDF + letterhead**: pdf-lib renderer (clean layout) stamped onto an
  uploaded global letterhead PDF + admin margins. (Arabic generated-PDF = out of scope;
  Arabic docs are uploaded as PDFs.)
- **D — later/optional**: DOCX → editable import (mammoth).

Deps: Tiptap (editor, Phase A); pdf-lib (Phase C); mammoth (Phase D). All pure-JS.
Deploys that add deps need `npm ci` (not just `git pull`).

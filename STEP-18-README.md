# HauntLog — Step 18: Photo upload on log entries

The biggest content gap is now filled. Investigators can attach up to
6 photos per log entry, viewable inline on the case page (and
embedded in the PDF export). This is the first time we're touching
**Supabase Storage** — a separate system from the database with its
own bucket and permissions model. There's one manual setup step
required before running the SQL.

---

## REQUIRED STEPS

### Step 1 — Create the Storage bucket (manual, one-time, ~30 seconds)

1. Open your Supabase project dashboard
2. Sidebar → **Storage**
3. Click **New bucket**
4. Configure:
   - **Name:** `log-photos` (exactly this — case-sensitive)
   - **Public bucket:** **OFF** (leave unchecked)
   - **File size limit:** `4` MB
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
5. Click **Create bucket**

That's it. The SQL handles all the policy setup.

### Step 2 — Run the migration

Open Supabase SQL Editor and run `supabase/24-photos.sql`.

It creates:
- `log_entry_photos` table with cascade deletes from cases/logs
- RLS that mirrors case visibility for reads, owner-only for writes
- Storage policies on the `log-photos` bucket (read via case visibility, write to your own `{user_id}/` prefix only)
- Helper RPC `list_case_photos(case_id)` for one-query case-page rendering
- Updates `seal_case_with_logs` to honor client-supplied log entry uuids (we need the log id to be stable so the photo upload knows where to put files)

Idempotent — safe to re-run.

### Step 3 — Install + run

No new npm deps. Stop dev server, unzip into `hauntlog`, `npm run dev`.

---

## What's new

### Adding photos during a hunt

In the **log entry sheet** (the modal that opens when you tap ADD LOG during an active hunt), a new **PHOTOS** section appears between the observation field and the timestamp:

```
PHOTOS — optional
[📷 +]  [thumb] [thumb]
```

- Drag-and-drop OR click to add files
- JPEG, PNG, or WebP only (HEIC unsupported in v1 — Safari converts to JPEG on copy/share but direct camera photos may fail; tell users to share-to-Files first)
- Max 4 MB per photo (validated client-side, enforced by storage)
- Max 6 photos per log entry
- Each pending photo shows as a 20×20 thumbnail with a × button to remove
- Validation errors (oversized, wrong type) show in an inline red banner

The photos **don't upload immediately**. They live in browser memory attached to the pending log entry, with thumbnail previews via `URL.createObjectURL`.

### Upload at seal time

When you SEAL the case (the existing flow at the end of a hunt), the photos upload as part of the sealing process:

1. The case + log entries are sealed atomically via `seal_case_with_logs` (as before)
2. After sealing succeeds, photos for each log entry upload in series to Storage at path `{user_id}/{case_id}/{log_id}/{photo_uuid}.jpg`
3. Each upload also gets a metadata row in `log_entry_photos`
4. Failures are non-fatal — the case still seals successfully; failed photos just don't appear

Why upload at seal rather than during the hunt? **Network is unreliable during a hunt** — you might be in a basement with no signal. The whole HauntLog flow is built around capturing now, syncing later. Photos follow the same rule. They live in browser memory (NOT persisted to local storage because Files don't survive JSON serialization), then upload at the end when you're back to a reliable connection.

### Client-side resize

Before upload, each photo is resized via Canvas to a max long edge of 2000px and re-encoded as JPEG at quality 0.85. Typical results:

- 12MP iPhone photo (~4MB JPEG) → ~600KB resized
- 4K photo (~8MB) → ~700KB
- Already-small photo (<2000px) → pass-through with re-encode

This shrinks storage costs **and** drops most EXIF metadata as a side effect (including GPS coordinates — a privacy win).

### Viewing photos on the case page

On `/case/:id`, photos render as a 4-column grid below each log entry's text:

```
22:17  Knock from west wall.
       [📷] [📷] [📷]
```

Each thumbnail is a square (object-cover). Click any photo → **lightbox** opens fullscreen:

- Click backdrop / press Esc / press × → close
- Press ← / → → navigate between photos in that log entry
- Caption displays below image if present (no caption editing UI yet — admin SQL only)
- Position indicator: "2 / 5"

If the viewer is the photo owner, hovering a thumbnail reveals a 🗑️ icon in the corner → delete (with confirm prompt). Deletes the storage object first, then the metadata row.

### PDF embedding

The PDF export now includes a **PHOTOS** appendix page (new page after the logs table and starred highlights):

- Section per log entry that has photos
- Heading: timestamp + first 100 chars of the observation
- Up to 4 photos per log entry, ~110pt squares (about 1.5") arranged in a row
- "+N more in app" hint if a log has more than 4 photos
- Page breaks gracefully (won't split a log section across pages)
- Failed image embeds show as `[image error]` placeholders

The PDF chunk grows slightly with this code (now ~434KB vs 432KB before — negligible) but loading individual photo blobs adds real time at export. Expect 1-3 seconds extra per case being exported, depending on photo count and network.

### Lazy signed URLs

The `log-photos` bucket is **private**. The frontend never gets public URLs. Instead, when CaseView loads:

1. Fetch all photo metadata rows for the case (one RPC call)
2. Generate signed URLs for all paths in batch (one Storage API call, expires in 1 hour)
3. Render thumbnails directly from signed URLs

If the user navigates away and comes back, the URLs regenerate fresh. No URL leaks past 1 hour even if someone screenshots the network tab.

---

## Files changed

```
supabase/24-photos.sql                       NEW — run this AFTER creating the bucket

src/lib/imageProcess.ts                      NEW — Canvas resize + validation
src/lib/dataLayer.ts                         (photo data functions: upload, delete, fetch, signed URLs, getCurrentUserId helper)
src/lib/database.types.ts                    (LogEntryPhotoRow type + table reg + list_case_photos RPC)
src/lib/pdfExport.ts                         (async + photo gallery section)

src/components/PhotoUploadField.tsx          NEW — upload UI for the log sheet
src/components/PhotoLightbox.tsx             NEW — fullscreen viewer
src/components/LogSheet.tsx                  (PhotoUploadField wired in)

src/store/useHauntStore.ts                   (LogEntry.pendingPhotoFiles, photo upload in sealCase)
src/pages/CaseView.tsx                       (PhotoGrid below each log, lightbox state)
```

---

## How to test

### Setup
1. Sign in as @raycrobins (or any user)
2. Start a hunt at any venue (Atlas → pick venue → BEGIN HUNT, or HuntStart → custom location)

### Add a log with photos
3. Tap ADD LOG to open the log sheet
4. Fill in the OBSERVATION field
5. In the new PHOTOS section, click the dashed drop zone OR drag files in
6. Try invalid cases first: a 10MB image (should show "too large" error), a `.heic` file (should show "unsupported type")
7. Add 2-3 valid JPEG/PNG files — thumbnails should appear with × buttons
8. Save the log
9. Repeat for another log entry with different photos
10. End the hunt

### Seal and view
11. On the SealCase page, set visibility, hit SEAL CASE
12. Watch the console — you should see upload activity (the photos are uploading in series after the seal RPC succeeds)
13. After redirect to the case page, scroll to the log entries
14. Each log entry should show its photos as a 4-column grid below the observation text
15. Click any photo → lightbox opens
16. Press ← → arrows to navigate, Esc to close

### Delete a photo
17. Hover (or tap-and-hold on mobile) a photo you uploaded
18. Trash icon appears in the corner
19. Click → confirm → photo disappears immediately

### Export PDF
20. From the case view, click EXPORT PDF
21. Wait for download (~2-5 seconds, longer with more photos)
22. Open the PDF — should have a final PHOTOS page with thumbnails grouped by log entry

### Test access control
23. Sign out, view the same case (assuming it's public/anonymous)
24. Photos should still load (signed URLs work for non-owners)
25. The trash icons should NOT appear (only owner sees them)
26. Make a private case with photos — sign out — try to view → photos shouldn't load (signed URL generation fails for non-readers)

### Test the cap
27. Try to add 7 photos to one log → the 7th rejected with "Max 6 photos per log entry"

---

## Design decisions locked

- **Bucket is private, signed URLs only.** Even public case photos go through 1-hour signed URLs. Prevents URL hoarding and makes content removal cleaner (revoke = future signs fail).
- **Path layout `{user_id}/{case_id}/{log_id}/{photo_id}.jpg`.** The user_id prefix is what the storage write policy gates on. The case_id is what the read policy uses (via the `can_read_log_photo` security-definer helper that joins back to `cases`).
- **Upload at seal time, not at log-add.** Network unreliability during hunts. Photos live in browser memory keyed to pending log entries; uploaded only when the case seals.
- **Photos NOT persisted across browser sessions.** The Zustand store persists everything except `pendingPhotoFiles` (Files don't survive JSON serialization anyway). If a user starts a hunt, adds photos, closes the browser, and comes back — they lose the photos but keep the logs. Acceptable for v1; will revisit if it bites.
- **Client-side resize to 2000px / JPEG 0.85.** Aggressive but not destructive at typical viewing sizes. Drops EXIF as a side effect — which is actually a privacy WIN since phone photos contain GPS coords.
- **4MB / 6 photos limits.** Conservative. Storage egress is the real cost; thumbnails are reused across CaseView renders thanks to browser caching of the signed URL responses.
- **HEIC unsupported.** Apple's format needs server-side conversion (libheif). Out of scope for v1. Most Safari share sheets convert to JPEG automatically, so this mostly affects "share from Files app" which is rare.
- **PDF photos go in an appendix.** Inline photos under each log entry text would have meant ditching jspdf-autotable for the logs section. Appendix is good enough for a printed archive; the on-screen experience is where photos really shine.
- **Photo deletion is hard-delete.** No "Recently Deleted Photos" — too edge-case for v1. The case-level soft-delete cascade-deletes photos.
- **Inheriting case visibility.** No per-photo visibility override. If you make your case public, all its photos are public. Keeps the mental model simple.

---

## Known limitations / what's NOT yet wired

1. **HEIC unsupported.** iPhone users have to share photos as JPEG first.
2. **No EXIF preservation.** Side effect of Canvas re-encoding. Future enhancement could pass through orientation specifically.
3. **No in-place photo editing.** No rotate, crop, brightness adjustments. Take the photo right, or use external tools first.
4. **No post-seal photo addition.** Once a case is sealed, you can't add more photos via the UI. (You can delete photos you uploaded — but not add new ones.) The data layer supports it; just no UI surface.
5. **No caption editing UI.** Captions exist in the schema but there's no place to edit them yet. Lightbox displays a caption if present (set via admin SQL only).
6. **Fire-and-forget after seal.** If a photo upload fails after the case seals, the only feedback is a console warning. No retry UI. The case + logs are saved correctly; only the failed photos vanish.
7. **No bulk operations.** No "select all and delete." Each photo is deleted individually.
8. **No moderation/reporting.** Public photos are public. Trust + admin manual removal only.
9. **Storage costs are real.** At 600KB average × 10 photos/active user/month, that's 6MB/user/month. Supabase free tier is 1GB. ~150 active users before paid tier needed.

---

## Troubleshooting

**"Bucket not found" error on upload**
→ The Storage bucket wasn't created. Go to Supabase Storage and create `log-photos` (see Step 1 above). The migration alone doesn't create the bucket — that has to be done in the dashboard.

**"Permission denied" on upload**
→ Storage policies didn't install. Run the migration again. Verify in Supabase: SQL Editor → `select * from storage.policies where bucket_id = 'log-photos';` should show 3 rows (read, insert, delete).

**Photos upload but don't show on the case page**
→ Check the browser console for "fetchPhotosForCase failed" errors. Could be RLS rejecting the read. Verify the case is readable to you: it should be public/anonymous OR you should be the owner.

**Lightbox shows broken images**
→ Signed URLs expire after 1 hour. Reload the page. If it still fails, check the storage object actually exists at the path in `log_entry_photos.storage_path`.

**PDF photos missing**
→ Photo fetch during PDF export is fire-and-forget. If signed URL generation or blob download fails, the photo is silently skipped. Open the case page first to confirm photos load there; if they do, the PDF should embed them on next export.

**HEIC upload fails silently**
→ Safari accepts the file in the dropzone but the Canvas decode fails. Future enhancement could surface a clearer error message; for now the photo just doesn't appear in the thumbnail row. Workaround: share-to-Files on iOS (auto-converts to JPEG).

---

## What's next

Photo upload was the single biggest content gap. With it shipped, HauntLog now has the full investigator workflow: capture observations + equipment data + **photos** during the hunt, seal into a case, share or keep private, export to PDF for archive.

The marketplace side is also solid: Atlas → verified profiles → follows → claims → managed venues → notifications.

**Highest-leverage deferred items:**

- **Post-seal photo addition** — edit case to add more photos after sealing (~30 min)
- **Photo caption editing UI** — let users add/edit captions in the lightbox (~30 min)
- **Manager invite UI** — owners adding co-managers without SQL (~30 min)
- **Equipment loadouts** — saved kit presets (~45 min)
- **Onboarding flow** — first-run experience (~1 session)
- **Email notifications** — supplements the in-app bell (~1 session)
- **Realtime notifications** — Supabase subscriptions (~45 min)
- **Notification preferences** — opt-out per kind (~45 min)
- **HEIC support** — server-side conversion edge function (~1 session)

After 18 steps, the product is **shippable**. Not "polished to perfection," but a real-world investigator could use it to document hunts and share them, and a real-world venue owner could claim their location and manage its profile. The remaining items are quality-of-life polish, not foundation.

Test step 18 first. Then we can decide what's next based on what you actually feel friction with in daily use.

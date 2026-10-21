-- BachelorsNest migration: enforce upload type + size limits at the bucket
-- Run this in the Supabase SQL editor.
--
-- Until now the 5 MB / image-only rules lived only in the browser picker,
-- so a crafted request could upload anything to the buckets. These bucket
-- settings make Supabase Storage itself reject oversized or wrong-type
-- files, whichever client sends them. Owner documents allow PDF as well
-- (government IDs are often scanned PDFs) with a 10 MB cap.

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'listing-photos';

update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'owner-docs';

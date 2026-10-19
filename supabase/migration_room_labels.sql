-- BachelorNest migration: named spaces for flats/rooms
-- Run this in the Supabase SQL editor after schema.sql.
--
-- Lets owners of flats label each space ("Master bedroom", "Hall") instead
-- of being forced into the PG-style single/double/triple sharing model.

alter table rooms add column if not exists label text;

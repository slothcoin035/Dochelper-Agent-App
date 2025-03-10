/*
  # Fix document content index size issue

  1. Changes
    - Drop the foreign key constraint and index for content
    - Add GIN index for efficient text search
    - Enable pg_trgm extension for text search support

  2. Notes
    - Removes problematic btree index causing size issues
    - Adds GIN index for better text search performance
    - Ensures content can still be searched efficiently
*/

-- First, drop the foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'documents_content_fkey'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_content_fkey CASCADE;
  END IF;
END $$;

-- Drop the problematic index if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE indexname = 'documents_content_key'
  ) THEN
    DROP INDEX documents_content_key CASCADE;
  END IF;
END $$;

-- Enable the pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a GIN index for text search on the content
CREATE INDEX IF NOT EXISTS documents_content_search_idx 
ON documents USING GIN ((content->>'text') gin_trgm_ops);
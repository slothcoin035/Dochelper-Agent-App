/*
  # Fix document content index size issue

  1. Changes
    - Remove unique constraint on content column if it exists
    - Add text search capabilities for document content
    - Create a more efficient index for content searching

  2. Notes
    - Removes the problematic btree index that was causing size issues
    - Adds GIN index for better text search performance
    - Ensures content can still be searched efficiently
*/

-- First, drop the problematic unique constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'documents_content_key'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_content_key;
  END IF;
END $$;

-- Add a GIN index for text search on the content
CREATE INDEX IF NOT EXISTS documents_content_search_idx 
ON documents USING GIN ((content->>'text') gin_trgm_ops);

-- Enable the pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;
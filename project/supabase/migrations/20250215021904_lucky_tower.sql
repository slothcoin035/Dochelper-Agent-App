/*
  # Fix document content index and constraints

  1. Changes
    - Drop foreign key and unique constraints for content
    - Add GIN index for efficient text search
    - Enable pg_trgm extension for text search support

  2. Notes
    - Removes problematic constraints causing errors
    - Adds GIN index for better text search performance
    - Ensures content can still be searched efficiently
*/

-- Drop constraints in the correct order
DO $$ 
BEGIN
  -- First, drop the foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'documents_content_fkey'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_content_fkey CASCADE;
  END IF;

  -- Then drop the unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'documents_content_key'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_content_key CASCADE;
  END IF;
END $$;

-- Enable the pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a GIN index for text search on the content
CREATE INDEX IF NOT EXISTS documents_content_search_idx 
ON documents USING GIN ((content->>'text') gin_trgm_ops);
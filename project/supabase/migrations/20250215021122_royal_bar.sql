/*
  # Fix document status constraint

  1. Changes
    - Remove unique constraint on status column
    - Add check constraint to ensure valid status values
    - Set default status to 'draft'

  2. Security
    - Maintains existing RLS policies
*/

-- Remove unique constraint if it exists
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_status_key;

-- Add check constraint for valid status values
ALTER TABLE documents 
ADD CONSTRAINT documents_status_check 
CHECK (status IN ('draft', 'published', 'archived'));

-- Set default value for status
ALTER TABLE documents 
ALTER COLUMN status SET DEFAULT 'draft';
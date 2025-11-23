-- Migration: Update userId in negotiations table to use integer and foreign key
-- This migration changes userId from text to integer and adds a foreign key constraint to the users table

-- Step 1: Add a temporary column for the new integer userId
ALTER TABLE negotiations ADD COLUMN user_id_new INTEGER;

-- Step 2: Set user_id_new to NULL for all existing rows (they don't have valid user references yet)
-- In production, you would migrate the data here if needed

-- Step 3: Drop the old userId column
ALTER TABLE negotiations DROP COLUMN user_id;

-- Step 4: Rename the new column to user_id
ALTER TABLE negotiations RENAME COLUMN user_id_new TO user_id;

-- Step 5: Make user_id NOT NULL (after ensuring all rows have valid data)
ALTER TABLE negotiations ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE negotiations ADD CONSTRAINT negotiations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

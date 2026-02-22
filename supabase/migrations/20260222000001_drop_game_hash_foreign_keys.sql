-- Drop foreign key constraints on game_hash columns.
-- ROM hashes are user-generated (users can load any ROM, including
-- hacks and different regional dumps) so they shouldn't require
-- pre-registration in the games table.

ALTER TABLE saves DROP CONSTRAINT IF EXISTS saves_game_hash_fkey;
ALTER TABLE user_games DROP CONSTRAINT IF EXISTS user_games_game_hash_fkey;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_hash_fkey;

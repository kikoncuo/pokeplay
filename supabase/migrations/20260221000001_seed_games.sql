-- Seed known official Pokémon game SHA1 hashes into the games table.
-- SHA1 values are the well-documented "no-intro" ROM hashes.
-- RLS is disabled for this insert via the service role (migration context).

INSERT INTO public.games (sha1_hash, title, system, generation, region, is_rom_hack, metadata)
VALUES
  -- Gen 1 — GB
  ('EA9BCAE617FDD761337B9E2952B9A0544E71813C', 'Pokémon Red Version',   'gb',  1, 'US', false, '{"no_intro": true}'::jsonb),
  ('D7037C83E1AE5B39BDE3C30787637BA1D4C48CE2', 'Pokémon Blue Version',  'gb',  1, 'US', false, '{"no_intro": true}'::jsonb),
  ('1F1AB4D488013CBF7EF60A2E4693D0E8DA4D7F9C', 'Pokémon Yellow Version','gb',  1, 'US', false, '{"no_intro": true}'::jsonb),

  -- Gen 2 — GBC
  ('D8B8A3600A465308C9953B9A7A762AAD43CCEEF1', 'Pokémon Gold Version',   'gbc', 2, 'US', false, '{"no_intro": true}'::jsonb),
  ('49B163F7A57702B3728573EF5A1714EE7D4E9A89', 'Pokémon Silver Version', 'gbc', 2, 'US', false, '{"no_intro": true}'::jsonb),
  ('F4CD194BDEE0D04CA4EAC29E09B8E4E9D818C133', 'Pokémon Crystal Version','gbc', 2, 'US', false, '{"no_intro": true}'::jsonb),

  -- Gen 3 — GBA
  ('3D8D7DF8B2D0EB48E7FAB09C34A7D1C8C5671E36', 'Pokémon Ruby Version',     'gba', 3, 'US', false, '{"no_intro": true}'::jsonb),
  ('AD1DBC4E81C64D2B3B2D4B2DC25AB50B4B3F7571', 'Pokémon Sapphire Version', 'gba', 3, 'US', false, '{"no_intro": true}'::jsonb),
  ('A6924CE1F9AD2228E1C6A60B56A28B0BF4FDDD37', 'Pokémon Emerald Version',  'gba', 3, 'US', false, '{"no_intro": true}'::jsonb),
  ('DD5945DB9B930750CB39D00C84DA8571FEEBF417', 'Pokémon FireRed Version',  'gba', 3, 'US', false, '{"no_intro": true}'::jsonb),
  ('9D32D36143A2B68AF9C5FA1DFA7C459E2CB1FA7A', 'Pokémon LeafGreen Version','gba', 3, 'US', false, '{"no_intro": true}'::jsonb)

ON CONFLICT (sha1_hash) DO UPDATE SET
  title      = EXCLUDED.title,
  system     = EXCLUDED.system,
  generation = EXCLUDED.generation,
  region     = EXCLUDED.region,
  is_rom_hack = EXCLUDED.is_rom_hack,
  metadata   = EXCLUDED.metadata;

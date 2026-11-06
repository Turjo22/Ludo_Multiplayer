-- PostgreSQL Schema for Ludo Persistent Match History and Audit Records
CREATE TABLE IF NOT EXISTS game_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(16) NOT NULL,
  mode VARCHAR(4) NOT NULL,
  status VARCHAR(16) NOT NULL,
  winner_color VARCHAR(8),
  total_turns INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES game_matches(id) ON DELETE CASCADE,
  player_id VARCHAR(64) NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  player_color VARCHAR(8) NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  completed_tokens INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_matches_session ON game_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);

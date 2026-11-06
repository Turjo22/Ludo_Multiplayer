import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDatabasePool(): pg.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.warn('[PostgreSQL] Unexpected pool client error:', err.message);
    });
  }

  return pool;
}

export async function recordFinishedMatch(
  sessionId: string,
  mode: string,
  winnerColor: string,
  totalTurns: number
): Promise<void> {
  const db = getDatabasePool();
  if (!db) return;

  try {
    await db.query(
      `INSERT INTO game_matches (session_id, mode, status, winner_color, total_turns, finished_at)
       VALUES ($1, $2, 'FINISHED', $3, $4, NOW())`,
      [sessionId, mode, winnerColor, totalTurns]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Failed to record finished match:', err.message);
  }
}

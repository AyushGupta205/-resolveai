/**
 * Round-Robin Agent Assignment Service
 * Transactional, persistent cursor, skips inactive agents, handles empty agent pools gracefully.
 */

export function assignNextAgent(db) {
  // Query all active support agents ordered deterministically by ID
  const activeAgents = db
    .prepare("SELECT id, name, email FROM users WHERE role = 'agent' AND is_active = 1 ORDER BY id ASC")
    .all();

  if (!activeAgents || activeAgents.length === 0) {
    return null;
  }

  // Get current assignment cursor
  const cursorRow = db
    .prepare('SELECT last_agent_id FROM assignment_state WHERE key = ?')
    .get('ticket_assignment');

  let nextAgent = activeAgents[0];

  if (cursorRow && cursorRow.last_agent_id) {
    const currentIndex = activeAgents.findIndex((agent) => agent.id === cursorRow.last_agent_id);
    if (currentIndex !== -1) {
      // Pick next in cycle
      const nextIndex = (currentIndex + 1) % activeAgents.length;
      nextAgent = activeAgents[nextIndex];
    } else {
      // If the previously assigned agent is now inactive or not found, wrap to first active agent
      nextAgent = activeAgents[0];
    }
  }

  // Update cursor atomically
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO assignment_state (key, last_agent_id, updated_at)
    VALUES ('ticket_assignment', ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      last_agent_id = excluded.last_agent_id,
      updated_at = excluded.updated_at
  `).run(nextAgent.id, now);

  return nextAgent;
}

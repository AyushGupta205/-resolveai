import db from '../database/db.js';
import { updateAgentStatusSchema } from '../validators/auth.validator.js';
import { getTicketSlaStatus } from '../services/sla.service.js';

export function getOverview(req, res, next) {
  try {
    const totalTicketsRow = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    const openTicketsRow = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get();
    const inProgressRow = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'").get();
    const waitingRow = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'waiting_customer'").get();
    const resolvedTicketsRow = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved'").get();

    // SLA breach query:
    // Either already responded after deadline OR not yet responded and current time > deadline
    const allTickets = db.prepare('SELECT created_at, first_response_deadline, first_response_at FROM tickets').all();
    let slaBreaches = 0;
    let totalResponseTimeMinutes = 0;
    let respondedTicketsCount = 0;

    const now = new Date();
    for (const ticket of allTickets) {
      const sla = getTicketSlaStatus(ticket, now);
      if (sla.isOverdue || sla.status === 'breached_responded') {
        slaBreaches++;
      }
      if (ticket.first_response_at) {
        respondedTicketsCount++;
        const createdMs = new Date(ticket.created_at).getTime();
        const respMs = new Date(ticket.first_response_at).getTime();
        totalResponseTimeMinutes += Math.max(0, (respMs - createdMs) / 60000);
      }
    }

    const avgFirstResponseMinutes = respondedTicketsCount > 0
      ? Math.round(totalResponseTimeMinutes / respondedTicketsCount)
      : null;

    const agentsCountRow = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM users WHERE role = 'agent'").get();
    const customersCountRow = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'customer'").get();

    return res.json({
      overview: {
        totalTickets: totalTicketsRow.count,
        openTickets: openTicketsRow.count,
        inProgressTickets: inProgressRow.count,
        waitingTickets: waitingRow.count,
        resolvedTickets: resolvedTicketsRow.count,
        slaBreachCount: slaBreaches,
        respondedTicketsCount,
        avgFirstResponseMinutes,
        totalAgents: agentsCountRow.total || 0,
        activeAgents: agentsCountRow.active || 0,
        totalCustomers: customersCountRow.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getAgents(req, res, next) {
  try {
    const agents = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.is_active, u.created_at,
        COUNT(t.id) as assigned_tickets_count,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets_count,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'waiting_customer') THEN 1 ELSE 0 END) as active_workload
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id
      WHERE u.role = 'agent'
      GROUP BY u.id
      ORDER BY u.is_active DESC, u.name ASC
    `).all();

    // Calculate each agent's average first response time
    const agentsWithMetrics = agents.map((agent) => {
      const respondedTickets = db.prepare(`
        SELECT created_at, first_response_at
        FROM tickets
        WHERE assigned_agent_id = ? AND first_response_at IS NOT NULL
      `).all(agent.id);

      let avgMinutes = null;
      if (respondedTickets.length > 0) {
        const totalMin = respondedTickets.reduce((acc, t) => {
          const diff = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60000;
          return acc + Math.max(0, diff);
        }, 0);
        avgMinutes = Math.round(totalMin / respondedTickets.length);
      }

      return {
        ...agent,
        avg_response_time_minutes: avgMinutes,
      };
    });

    return res.json({ agents: agentsWithMetrics });
  } catch (error) {
    next(error);
  }
}

export function updateAgentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const validated = updateAgentStatusSchema.parse(req.body);

    const agent = db.prepare('SELECT id, name, role, is_active FROM users WHERE id = ?').get(id);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ error: 'Agent not found' });
    }

    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(validated.is_active, id);

    const updated = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(id);
    return res.json({
      message: `Agent ${updated.is_active ? 'activated' : 'deactivated'} successfully`,
      agent: updated,
    });
  } catch (error) {
    next(error);
  }
}

export function getAnalytics(req, res, next) {
  try {
    // Ticket distribution by category
    const categoryDistribution = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM tickets
      GROUP BY category
      ORDER BY count DESC
    `).all();

    // Ticket distribution by priority
    const priorityDistribution = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      GROUP BY priority
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END ASC
    `).all();

    // Ticket distribution by status
    const statusDistribution = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tickets
      GROUP BY status
    `).all();

    // Ticket volume over time (by day)
    const volumeOverTime = db.prepare(`
      SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
      FROM tickets
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `).all();

    // Agent response metrics
    const agentPerformance = db.prepare(`
      SELECT
        u.id, u.name,
        COUNT(t.id) as total_assigned,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN t.first_response_at IS NOT NULL AND t.first_response_at <= t.first_response_deadline THEN 1 ELSE 0 END) as sla_met_count,
        SUM(CASE WHEN t.first_response_at IS NOT NULL AND t.first_response_at > t.first_response_deadline THEN 1 ELSE 0 END) as sla_breached_count
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id
      WHERE u.role = 'agent'
      GROUP BY u.id
      ORDER BY total_assigned DESC
    `).all();

    return res.json({
      analytics: {
        categoryDistribution,
        priorityDistribution,
        statusDistribution,
        volumeOverTime,
        agentPerformance,
      },
    });
  } catch (error) {
    next(error);
  }
}

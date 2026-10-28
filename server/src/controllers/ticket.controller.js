import path from 'path';
import fs from 'fs';
import db from '../database/db.js';
import { config } from '../config/env.js';
import { createTicketSchema, updateTicketSchema } from '../validators/ticket.validator.js';
import { createMessageSchema } from '../validators/message.validator.js';
import { calculateDeadline, getTicketSlaStatus } from '../services/sla.service.js';
import { assignNextAgent } from '../services/assignment.service.js';
import { suggestCategory, generateReplyDraft, ALLOWED_CATEGORIES } from '../services/ai.service.js';
import { UPLOAD_DIR } from '../utils/upload.js';

function generateTicketId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `TCK-${timestamp}-${random}`;
}

export async function createTicket(req, res, next) {
  try {
    const validated = createTicketSchema.parse(req.body);
    const customerId = req.user.role === 'customer' ? req.user.id : (req.body.customer_id || req.user.id);
    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, config.slaHours);
    const ticketId = generateTicketId();

    // AI category suggestion if not explicitly provided with a valid category
    let finalCategory = validated.category;
    if (!finalCategory || !ALLOWED_CATEGORIES.includes(finalCategory)) {
      try {
        const aiResult = await suggestCategory({
          subject: validated.subject,
          description: validated.description,
        });
        finalCategory = (aiResult && aiResult.category) || 'General Inquiry';
      } catch (err) {
        console.warn('[Ticket Controller] AI categorization failed, falling back to General Inquiry:', err.message);
        finalCategory = 'General Inquiry';
      }
    }

    // Round-robin assignment and ticket creation in a transaction
    const createTx = db.transaction(() => {
      const assignedAgent = assignNextAgent(db);
      const assignedAgentId = assignedAgent ? assignedAgent.id : null;

      db.prepare(`
        INSERT INTO tickets (
          id, subject, description, customer_id, assigned_agent_id,
          category, priority, status, created_at, updated_at,
          first_response_deadline, first_response_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, NULL)
      `).run(
        ticketId,
        validated.subject,
        validated.description,
        customerId,
        assignedAgentId,
        finalCategory,
        validated.priority || 'medium',
        now,
        now,
        deadline
      );

      // Handle optional file attachment if uploaded with ticket creation
      let attachmentName = null;
      let attachmentPath = null;
      let attachmentType = null;
      let attachmentSize = null;

      if (req.file) {
        attachmentName = req.file.originalname;
        attachmentPath = req.file.filename;
        attachmentType = req.file.mimetype;
        attachmentSize = req.file.size;
      }

      // Record the opening message in the conversation thread
      db.prepare(`
        INSERT INTO messages (
          ticket_id, author_id, author_role, body, visibility,
          attachment_name, attachment_path, attachment_type, attachment_size, created_at
        ) VALUES (?, ?, ?, ?, 'public', ?, ?, ?, ?, ?)
      `).run(
        ticketId,
        req.user.id,
        req.user.role,
        validated.description,
        attachmentName,
        attachmentPath,
        attachmentType,
        attachmentSize,
        now
      );

      return { ticketId, assignedAgent };
    });

    const result = createTx();

    const createdTicket = db
      .prepare(`
        SELECT t.*,
               c.name AS customer_name, c.email AS customer_email,
               a.name AS agent_name, a.email AS agent_email
        FROM tickets t
        LEFT JOIN users c ON t.customer_id = c.id
        LEFT JOIN users a ON t.assigned_agent_id = a.id
        WHERE t.id = ?
      `)
      .get(result.ticketId);

    const sla = getTicketSlaStatus(createdTicket);

    return res.status(201).json({
      message: 'Ticket created successfully',
      ticket: {
        ...createdTicket,
        sla,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getTickets(req, res, next) {
  try {
    const {
      status,
      priority,
      category,
      assigned_agent_id,
      search,
      sortBy = 'newest',
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    const conditions = [];
    const params = [];

    // Role-based access control
    if (req.user.role === 'customer') {
      conditions.push('t.customer_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'agent') {
      // If agent specifies filter or views queue
      if (assigned_agent_id) {
        conditions.push('t.assigned_agent_id = ?');
        params.push(parseInt(assigned_agent_id, 10));
      } else if (req.query.scope === 'assigned') {
        conditions.push('t.assigned_agent_id = ?');
        params.push(req.user.id);
      }
    } else if (req.user.role === 'admin' && assigned_agent_id) {
      conditions.push('t.assigned_agent_id = ?');
      params.push(parseInt(assigned_agent_id, 10));
    }

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    if (category) {
      conditions.push('t.category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(t.id LIKE ? OR t.subject LIKE ? OR t.description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sort order
    let orderByClause = 'ORDER BY t.created_at DESC';
    if (sortBy === 'oldest') {
      orderByClause = 'ORDER BY t.created_at ASC';
    } else if (sortBy === 'deadline') {
      orderByClause = 'ORDER BY t.first_response_deadline ASC';
    } else if (sortBy === 'priority') {
      orderByClause = `ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END ASC`;
    }

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM tickets t ${whereClause}`)
      .get(...params);
    const total = countRow ? countRow.total : 0;

    const rows = db
      .prepare(`
        SELECT t.*,
               c.name AS customer_name, c.email AS customer_email,
               a.name AS agent_name, a.email AS agent_email
        FROM tickets t
        LEFT JOIN users c ON t.customer_id = c.id
        LEFT JOIN users a ON t.assigned_agent_id = a.id
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `)
      .all(...params, parsedLimit, offset);

    const tickets = rows.map((ticket) => ({
      ...ticket,
      sla: getTicketSlaStatus(ticket),
    }));

    return res.json({
      tickets,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getTicketById(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = db
      .prepare(`
        SELECT t.*,
               c.name AS customer_name, c.email AS customer_email,
               a.name AS agent_name, a.email AS agent_email
        FROM tickets t
        LEFT JOIN users c ON t.customer_id = c.id
        LEFT JOIN users a ON t.assigned_agent_id = a.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Role-based access validation
    if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const sla = getTicketSlaStatus(ticket);

    return res.json({
      ticket: {
        ...ticket,
        sla,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function updateTicket(req, res, next) {
  try {
    const { id } = req.params;
    const validated = updateTicketSchema.parse(req.body);

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Customer permissions check
    if (req.user.role === 'customer') {
      if (ticket.customer_id !== req.user.id) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      // Customer can only reopen a resolved ticket or mark it resolved
      if (validated.priority || validated.category || validated.assigned_agent_id !== undefined) {
        return res.status(403).json({ error: 'Customers cannot change ticket priority, category, or agent assignment.' });
      }
      if (validated.status && !['open', 'resolved'].includes(validated.status)) {
        return res.status(403).json({ error: 'Customers can only set ticket status to open or resolved.' });
      }
    }

    const updates = [];
    const params = [];
    const now = new Date().toISOString();

    if (validated.status !== undefined) {
      updates.push('status = ?');
      params.push(validated.status);

      if (validated.status === 'resolved') {
        updates.push('resolved_at = ?');
        params.push(now);
      } else if (ticket.resolved_at && validated.status !== 'resolved') {
        updates.push('resolved_at = NULL');
      }
    }

    if (validated.priority !== undefined) {
      updates.push('priority = ?');
      params.push(validated.priority);
    }

    if (validated.category !== undefined) {
      updates.push('category = ?');
      params.push(validated.category);
    }

    if (validated.assigned_agent_id !== undefined) {
      updates.push('assigned_agent_id = ?');
      params.push(validated.assigned_agent_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided.' });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db
      .prepare(`
        SELECT t.*,
               c.name AS customer_name, c.email AS customer_email,
               a.name AS agent_name, a.email AS agent_email
        FROM tickets t
        LEFT JOIN users c ON t.customer_id = c.id
        LEFT JOIN users a ON t.assigned_agent_id = a.id
        WHERE t.id = ?
      `)
      .get(id);

    return res.json({
      message: 'Ticket updated successfully',
      ticket: {
        ...updated,
        sla: getTicketSlaStatus(updated),
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getTicketMessages(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = db.prepare('SELECT customer_id FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // STRICT SECURITY: Customers only receive public messages!
    let messages;
    if (req.user.role === 'customer') {
      messages = db
        .prepare(`
          SELECT m.id, m.ticket_id, m.author_id, m.author_role, m.body,
                 m.visibility, m.attachment_name, m.attachment_type, m.attachment_size,
                 m.created_at,
                 u.name AS author_name, u.email AS author_email
          FROM messages m
          JOIN users u ON m.author_id = u.id
          WHERE m.ticket_id = ? AND m.visibility = 'public'
          ORDER BY m.created_at ASC
        `)
        .all(id);
    } else {
      // Agents and Admins see both public and internal notes
      messages = db
        .prepare(`
          SELECT m.id, m.ticket_id, m.author_id, m.author_role, m.body,
                 m.visibility, m.attachment_name, m.attachment_type, m.attachment_size,
                 m.created_at,
                 u.name AS author_name, u.email AS author_email
          FROM messages m
          JOIN users u ON m.author_id = u.id
          WHERE m.ticket_id = ?
          ORDER BY m.created_at ASC
        `)
        .all(id);
    }

    return res.json({ messages });
  } catch (error) {
    next(error);
  }
}

export function createMessage(req, res, next) {
  try {
    const { id } = req.params;
    const validated = createMessageSchema.parse(req.body);

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access check
    if (req.user.role === 'customer') {
      if (ticket.customer_id !== req.user.id) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      // Customer CANNOT create internal notes
      if (validated.visibility === 'internal') {
        return res.status(403).json({ error: 'Customers are not permitted to create internal notes.' });
      }
    }

    const visibility = req.user.role === 'customer' ? 'public' : (validated.visibility || 'public');
    const now = new Date().toISOString();

    let attachmentName = null;
    let attachmentPath = null;
    let attachmentType = null;
    let attachmentSize = null;

    if (req.file) {
      attachmentName = req.file.originalname;
      attachmentPath = req.file.filename;
      attachmentType = req.file.mimetype;
      attachmentSize = req.file.size;
    }

    const messageTx = db.transaction(() => {
      // Insert message
      const msgResult = db.prepare(`
        INSERT INTO messages (
          ticket_id, author_id, author_role, body, visibility,
          attachment_name, attachment_path, attachment_type, attachment_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.user.id,
        req.user.role,
        validated.body,
        visibility,
        attachmentName,
        attachmentPath,
        attachmentType,
        attachmentSize,
        now
      );

      // SLA TIMER RULE:
      // A public agent/admin reply stops the first-response timer!
      // Internal notes NEVER stop the first-response timer!
      if (
        ['agent', 'admin'].includes(req.user.role) &&
        visibility === 'public' &&
        !ticket.first_response_at
      ) {
        db.prepare(`
          UPDATE tickets
          SET first_response_at = ?,
              status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
              updated_at = ?
          WHERE id = ?
        `).run(now, now, id);
      } else {
        // Just touch updated_at
        db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(now, id);
      }

      // If customer adds a follow-up to a resolved ticket, move to in_progress
      if (req.user.role === 'customer' && ticket.status === 'resolved') {
        db.prepare("UPDATE tickets SET status = 'in_progress', resolved_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
      }

      return msgResult.lastInsertRowid;
    });

    const messageId = messageTx();

    const createdMessage = db
      .prepare(`
        SELECT m.*, u.name AS author_name, u.email AS author_email
        FROM messages m
        JOIN users u ON m.author_id = u.id
        WHERE m.id = ?
      `)
      .get(messageId);

    // Refresh ticket to show updated SLA / status
    const updatedTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

    return res.status(201).json({
      message: 'Message added successfully',
      ticketMessage: createdMessage,
      ticketSla: getTicketSlaStatus(updatedTicket),
    });
  } catch (error) {
    next(error);
  }
}

export function downloadAttachment(req, res, next) {
  try {
    const { id, filename } = req.params;

    const ticket = db.prepare('SELECT customer_id FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Find attachment message
    const msg = db
      .prepare('SELECT visibility, attachment_name, attachment_path FROM messages WHERE ticket_id = ? AND attachment_path = ?')
      .get(id, filename);

    if (!msg) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // If customer and attachment is on an internal note, block access!
    if (req.user.role === 'customer' && msg.visibility === 'internal') {
      return res.status(403).json({ error: 'Access denied to attachment' });
    }

    const safePath = path.resolve(UPLOAD_DIR, path.basename(filename));
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Attachment file missing from storage' });
    }

    return res.download(safePath, msg.attachment_name || filename);
  } catch (error) {
    next(error);
  }
}

export async function getAiCategorySuggestion(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = db.prepare('SELECT subject, description FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const suggestion = await suggestCategory({
      subject: ticket.subject,
      description: ticket.description,
    });

    return res.json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function getAiDraft(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // STRICT RULE: Only pass public messages to AI draft generator!
    const publicMessages = db
      .prepare(`
        SELECT author_role, body
        FROM messages
        WHERE ticket_id = ? AND visibility = 'public'
        ORDER BY created_at ASC
      `)
      .all(id);

    const draftResult = await generateReplyDraft({
      ticket,
      publicMessages,
    });

    return res.json(draftResult);
  } catch (error) {
    return res.status(503).json({
      error: error.message || 'AI drafting service unavailable',
    });
  }
}

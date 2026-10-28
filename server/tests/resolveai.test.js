import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { getDatabase, setDatabase, closeDatabase } from '../src/database/db.js';
import { createApp } from '../src/app.js';
import { calculateDeadline, getTicketSlaStatus } from '../src/services/sla.service.js';
import { assignNextAgent } from '../src/services/assignment.service.js';
import * as aiService from '../src/services/ai.service.js';
import { UPLOAD_DIR } from '../src/utils/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test-resolveai.db');

describe('ResolveAI Support Desk Test Suite', () => {
  let app;
  let testDb;

  beforeEach(() => {
    testDb = getDatabase(TEST_DB_PATH);
    setDatabase(testDb);
    // Clean all tables before each test
    testDb.exec(`
      DELETE FROM messages;
      DELETE FROM tickets;
      DELETE FROM assignment_state;
      DELETE FROM users;
    `);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {}
    }
  });

  // Helper to create users
  async function createUser({ name, email, password, role, isActive = 1 }) {
    const hash = await bcrypt.hash(password, 8);
    const now = new Date().toISOString();
    const result = testDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email.toLowerCase(), hash, role, isActive, now);
    return Number(result.lastInsertRowid);
  }

  // Helper to log in and get token
  async function loginUser(email, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    return {
      token: res.body.token,
      cookie: res.headers['set-cookie'],
      user: res.body.user,
    };
  }

  // 1. Customer registration and password hashing
  it('1. should register a customer and securely hash the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Springs',
        email: 'alice@example.com',
        password: 'SecurePassword123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('customer');

    // Verify in database: password must be hashed, never plaintext
    const dbUser = testDb.prepare('SELECT * FROM users WHERE email = ?').get('alice@example.com');
    expect(dbUser).toBeDefined();
    expect(dbUser.password_hash).not.toBe('SecurePassword123!');
    expect(dbUser.password_hash.startsWith('$2')).toBe(true);

    const isMatch = await bcrypt.compare('SecurePassword123!', dbUser.password_hash);
    expect(isMatch).toBe(true);
  });

  // 2. Authentication failure with invalid credentials
  it('2. should reject authentication with invalid credentials', async () => {
    await createUser({
      name: 'Bob Agent',
      email: 'bob@example.com',
      password: 'CorrectPassword123!',
      role: 'agent',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bob@example.com',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/i);
  });

  // 3. Customer cannot access another customer's ticket
  it('3. should prevent a customer from accessing another customer ticket', async () => {
    const cust1Id = await createUser({
      name: 'Customer One',
      email: 'cust1@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const cust2Id = await createUser({
      name: 'Customer Two',
      email: 'cust2@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    // Create ticket owned by Customer Two
    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-CUST2-01', 'Private Ticket', 'Sensitive details here', ?, 'Billing and Payments', 'high', 'open', ?, ?, ?)
    `).run(cust2Id, now, now, deadline);

    // Customer One logs in
    const { token } = await loginUser('cust1@example.com', 'Password123!');

    // Customer One attempts to fetch Customer Two's ticket
    const res = await request(app)
      .get('/api/tickets/TCK-CUST2-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  // 4. Customer cannot read internal notes
  it('4. should exclude internal notes from customer ticket message queries', async () => {
    const custId = await createUser({
      name: 'Customer User',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const agentId = await createUser({
      name: 'Agent User',
      email: 'agent@example.com',
      password: 'Password123!',
      role: 'agent',
    });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-SEC-01', 'Security Test', 'Checking note isolation', ?, ?, 'Technical Issue', 'medium', 'open', ?, ?, ?)
    `).run(custId, agentId, now, now, deadline);

    // Add public message
    testDb.prepare(`
      INSERT INTO messages (ticket_id, author_id, author_role, body, visibility, created_at)
      VALUES ('TCK-SEC-01', ?, 'agent', 'Hello, this is a public reply.', 'public', ?)
    `).run(agentId, now);

    // Add internal note with confidential data
    testDb.prepare(`
      INSERT INTO messages (ticket_id, author_id, author_role, body, visibility, created_at)
      VALUES ('TCK-SEC-01', ?, 'agent', 'INTERNAL NOTE: Sensitive backend credentials and logs', 'internal', ?)
    `).run(agentId, now);

    // Customer fetches messages
    const { token: custToken } = await loginUser('customer@example.com', 'Password123!');
    const custRes = await request(app)
      .get('/api/tickets/TCK-SEC-01/messages')
      .set('Authorization', `Bearer ${custToken}`);

    expect(custRes.status).toBe(200);
    expect(custRes.body.messages).toHaveLength(1);
    expect(custRes.body.messages[0].body).toBe('Hello, this is a public reply.');
    expect(custRes.body.messages.some((m) => m.visibility === 'internal')).toBe(false);

    // Agent fetches messages: sees both public reply and internal note
    const { token: agentToken } = await loginUser('agent@example.com', 'Password123!');
    const agentRes = await request(app)
      .get('/api/tickets/TCK-SEC-01/messages')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(agentRes.status).toBe(200);
    expect(agentRes.body.messages).toHaveLength(2);
    expect(agentRes.body.messages.some((m) => m.visibility === 'internal')).toBe(true);
  });

  // 5. Customer cannot create internal notes
  it('5. should reject customer attempts to create internal notes', async () => {
    const custId = await createUser({
      name: 'Customer User',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-NOTE-01', 'Subject', 'Desc', ?, 'General Inquiry', 'low', 'open', ?, ?, ?)
    `).run(custId, now, now, deadline);

    const { token } = await loginUser('customer@example.com', 'Password123!');

    const res = await request(app)
      .post('/api/tickets/TCK-NOTE-01/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        body: 'Malicious attempt to create internal note',
        visibility: 'internal',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Customers are not permitted to create internal notes/i);
  });

  // 6. Round-robin assignment distributes tickets correctly
  it('6. should distribute tickets in round-robin order among active agents', async () => {
    const agent1 = await createUser({ name: 'Agent Alpha', email: 'alpha@test.com', password: 'Password123!', role: 'agent', isActive: 1 });
    const agent2 = await createUser({ name: 'Agent Beta', email: 'beta@test.com', password: 'Password123!', role: 'agent', isActive: 1 });
    const agent3 = await createUser({ name: 'Agent Gamma', email: 'gamma@test.com', password: 'Password123!', role: 'agent', isActive: 1 });

    const first = assignNextAgent(testDb);
    const second = assignNextAgent(testDb);
    const third = assignNextAgent(testDb);
    const fourth = assignNextAgent(testDb);

    expect(first.id).toBe(agent1);
    expect(second.id).toBe(agent2);
    expect(third.id).toBe(agent3);
    expect(fourth.id).toBe(agent1); // Wraps around
  });

  // 7. Inactive agents are skipped
  it('7. should skip inactive agents during round-robin assignment', async () => {
    const agent1 = await createUser({ name: 'Agent Alpha', email: 'alpha@test.com', password: 'Password123!', role: 'agent', isActive: 1 });
    await createUser({ name: 'Agent Inactive', email: 'inactive@test.com', password: 'Password123!', role: 'agent', isActive: 0 });
    const agent3 = await createUser({ name: 'Agent Gamma', email: 'gamma@test.com', password: 'Password123!', role: 'agent', isActive: 1 });

    const first = assignNextAgent(testDb);
    const second = assignNextAgent(testDb);
    const third = assignNextAgent(testDb);

    expect(first.id).toBe(agent1);
    expect(second.id).toBe(agent3); // Skipped inactive agent!
    expect(third.id).toBe(agent1);
  });

  // 8. Internal notes do not stop the SLA timer
  it('8. should ensure internal notes do NOT stop the SLA timer', async () => {
    const custId = await createUser({ name: 'Cust', email: 'c@test.com', password: 'Password123!', role: 'customer' });
    const agentId = await createUser({ name: 'Agent', email: 'a@test.com', password: 'Password123!', role: 'agent' });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-SLA-01', 'SLA Ticket', 'Testing SLA timer', ?, ?, 'Technical Issue', 'high', 'open', ?, ?, ?)
    `).run(custId, agentId, now, now, deadline);

    const { token } = await loginUser('a@test.com', 'Password123!');

    // Post internal note
    const res = await request(app)
      .post('/api/tickets/TCK-SLA-01/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        body: 'Investigating this behind the scenes',
        visibility: 'internal',
      });

    expect(res.status).toBe(201);

    // Verify ticket in database: first_response_at must remain NULL
    const ticket = testDb.prepare('SELECT first_response_at, status FROM tickets WHERE id = ?').get('TCK-SLA-01');
    expect(ticket.first_response_at).toBeNull();
  });

  // 9. A public agent reply stops the first-response timer
  it('9. should stop the first-response timer when a public agent reply is saved', async () => {
    const custId = await createUser({ name: 'Cust', email: 'c@test.com', password: 'Password123!', role: 'customer' });
    const agentId = await createUser({ name: 'Agent', email: 'a@test.com', password: 'Password123!', role: 'agent' });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-SLA-02', 'SLA Ticket 2', 'Testing SLA timer stop', ?, ?, 'Technical Issue', 'high', 'open', ?, ?, ?)
    `).run(custId, agentId, now, now, deadline);

    const { token } = await loginUser('a@test.com', 'Password123!');

    // Post public reply
    const res = await request(app)
      .post('/api/tickets/TCK-SLA-02/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        body: 'Hello, we are working on your ticket now.',
        visibility: 'public',
      });

    expect(res.status).toBe(201);

    // Verify ticket: first_response_at must be populated!
    const ticket = testDb.prepare('SELECT first_response_at, status FROM tickets WHERE id = ?').get('TCK-SLA-02');
    expect(ticket.first_response_at).not.toBeNull();
    expect(ticket.status).toBe('in_progress');
  });

  // 10. Overdue status is calculated correctly
  it('10. should accurately calculate overdue SLA status when deadline passes without response', () => {
    const pastCreated = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5 hours ago
    const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago

    const overdueTicket = {
      id: 'TCK-OVERDUE-01',
      created_at: pastCreated,
      first_response_deadline: pastDeadline,
      first_response_at: null,
    };

    const slaStatus = getTicketSlaStatus(overdueTicket);
    expect(slaStatus.isOverdue).toBe(true);
    expect(slaStatus.status).toBe('overdue');
    expect(slaStatus.overdueMinutes).toBeGreaterThanOrEqual(59);

    // Test met SLA ticket
    const metTicket = {
      id: 'TCK-MET-01',
      created_at: pastCreated,
      first_response_deadline: pastDeadline,
      first_response_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // responded before deadline
    };

    const metSla = getTicketSlaStatus(metTicket);
    expect(metSla.isOverdue).toBe(false);
    expect(metSla.status).toBe('met');
  });

  // 11. Ticket creation succeeds if the AI provider fails
  it('11. should succeed with fallback category if AI provider fails or times out', async () => {
    await createUser({ name: 'Customer', email: 'cust@test.com', password: 'Password123!', role: 'customer' });
    await createUser({ name: 'Agent One', email: 'ag1@test.com', password: 'Password123!', role: 'agent' });

    // Mock AI categorization to throw error or timeout
    const spy = vi.spyOn(aiService, 'suggestCategory').mockRejectedValueOnce(new Error('Gemini API 500 Network Timeout'));

    const { token } = await loginUser('cust@test.com', 'Password123!');

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Cannot login to billing portal',
        description: 'Receiving 403 forbidden error whenever I click settings.',
      });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toBeDefined();
    // Default fallback category assigned smoothly
    expect(res.body.ticket.category).toBe('General Inquiry');
    spy.mockRestore();
  });

  // 12. Invalid ticket inputs are rejected by server validation
  it('12. should reject invalid ticket inputs with field-level 400 errors', async () => {
    await createUser({ name: 'Customer', email: 'cust@test.com', password: 'Password123!', role: 'customer' });
    const { token } = await loginUser('cust@test.com', 'Password123!');

    // Subject too short (< 3 chars) and description too short (< 10 chars)
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Hi',
        description: 'Help',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'subject' }),
        expect.objectContaining({ field: 'description' }),
      ])
    );
  });

  // 13. Unauthorized users cannot access admin endpoints
  it('13. should forbid non-admin users from accessing admin endpoints', async () => {
    await createUser({ name: 'Customer', email: 'cust@test.com', password: 'Password123!', role: 'customer' });
    await createUser({ name: 'Agent', email: 'agent@test.com', password: 'Password123!', role: 'agent' });
    await createUser({ name: 'Admin', email: 'admin@test.com', password: 'Password123!', role: 'admin' });

    const { token: custToken } = await loginUser('cust@test.com', 'Password123!');
    const { token: agentToken } = await loginUser('agent@test.com', 'Password123!');
    const { token: adminToken } = await loginUser('admin@test.com', 'Password123!');

    // Customer attempt -> 403
    const custRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${custToken}`);
    expect(custRes.status).toBe(403);

    // Agent attempt -> 403
    const agentRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(agentRes.status).toBe(403);

    // Admin attempt -> 200
    const adminRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.overview).toBeDefined();
  });

  // 14. AI-generated drafts are not sent without explicit agent action
  it('14. should require explicit agent action to send a generated AI draft', async () => {
    const custId = await createUser({ name: 'Cust', email: 'c@test.com', password: 'Password123!', role: 'customer' });
    const agentId = await createUser({ name: 'Agent', email: 'a@test.com', password: 'Password123!', role: 'agent' });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-DRAFT-01', 'Feature question', 'How to export logs?', ?, ?, 'General Inquiry', 'low', 'open', ?, ?, ?)
    `).run(custId, agentId, now, now, deadline);

    // Mock AI draft generation
    const spy = vi.spyOn(aiService, 'generateReplyDraft').mockResolvedValueOnce({
      draft: 'Hi there, you can export logs by going to Settings > Exports > Download.',
      generatedAt: now,
    });

    const { token } = await loginUser('a@test.com', 'Password123!');

    // Agent generates draft
    const draftRes = await request(app)
      .post('/api/tickets/TCK-DRAFT-01/ai-draft')
      .set('Authorization', `Bearer ${token}`);

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.draft).toContain('Settings > Exports');

    // VERIFY: The draft is NOT automatically inserted into the database!
    const messages = testDb.prepare('SELECT * FROM messages WHERE ticket_id = ?').all('TCK-DRAFT-01');
    expect(messages).toHaveLength(0);

    // Agent modifies the draft and explicitly sends it
    const editedReply = draftRes.body.draft + ' Please let us know if you need further help!';
    const sendRes = await request(app)
      .post('/api/tickets/TCK-DRAFT-01/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        body: editedReply,
        visibility: 'public',
      });

    expect(sendRes.status).toBe(201);

    // Now message is saved and visible
    const savedMessages = testDb.prepare('SELECT * FROM messages WHERE ticket_id = ?').all('TCK-DRAFT-01');
    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].body).toBe(editedReply);
    expect(savedMessages[0].author_role).toBe('agent');

    spy.mockRestore();
  });

  // 15. Customer cannot download internal note attachments
  it('15. should forbid customers from downloading attachments from internal notes', async () => {
    const custId = await createUser({ name: 'Cust Attach', email: 'cust_attach@test.com', password: 'Password123!', role: 'customer' });
    const agentId = await createUser({ name: 'Agent Attach', email: 'agent_attach@test.com', password: 'Password123!', role: 'agent' });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline)
      VALUES ('TCK-ATTACH-01', 'Attachment Security', 'Testing attachment visibility', ?, ?, 'Technical Issue', 'high', 'open', ?, ?, ?)
    `).run(custId, agentId, now, now, deadline);

    // Create a dummy file in UPLOAD_DIR
    const testFileName = `test-internal-${Date.now()}.txt`;
    const testFilePath = path.join(UPLOAD_DIR, testFileName);
    fs.writeFileSync(testFilePath, 'Confidential Staff Debug Logs');

    // Attach to an internal message
    testDb.prepare(`
      INSERT INTO messages (ticket_id, author_id, author_role, body, visibility, attachment_name, attachment_path, attachment_type, attachment_size, created_at)
      VALUES ('TCK-ATTACH-01', ?, 'agent', 'Staff Note with log', 'internal', 'debug.txt', ?, 'text/plain', 30, ?)
    `).run(agentId, testFileName, now);

    // Customer attempts to download the internal note attachment
    const { token: custToken } = await loginUser('cust_attach@test.com', 'Password123!');
    const custRes = await request(app)
      .get(`/api/tickets/TCK-ATTACH-01/attachments/${testFileName}`)
      .set('Authorization', `Bearer ${custToken}`);

    expect(custRes.status).toBe(403);
    expect(custRes.body.error).toMatch(/Access denied/i);

    // Staff member attempts to download -> succeeds (200)
    const { token: agentToken } = await loginUser('agent_attach@test.com', 'Password123!');
    const agentRes = await request(app)
      .get(`/api/tickets/TCK-ATTACH-01/attachments/${testFileName}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(agentRes.status).toBe(200);
    expect(agentRes.text).toBe('Confidential Staff Debug Logs');

    // Clean up test file
    try {
      fs.unlinkSync(testFilePath);
    } catch (e) {}
  });

  // 16. Customer ticket reopening and unauthorized field protection
  it('16. should allow customers to reopen resolved tickets but forbid tampering with priority or agent', async () => {
    const custId = await createUser({ name: 'Cust Reopen', email: 'cust_reopen@test.com', password: 'Password123!', role: 'customer' });
    const agentId = await createUser({ name: 'Agent', email: 'agent_reopen@test.com', password: 'Password123!', role: 'agent' });

    const now = new Date().toISOString();
    const deadline = calculateDeadline(now, 4);
    testDb.prepare(`
      INSERT INTO tickets (id, subject, description, customer_id, assigned_agent_id, category, priority, status, created_at, updated_at, first_response_deadline, resolved_at)
      VALUES ('TCK-REOPEN-01', 'Resolved Issue', 'Everything was solved', ?, ?, 'General Inquiry', 'low', 'resolved', ?, ?, ?, ?)
    `).run(custId, agentId, now, now, deadline, now);

    const { token } = await loginUser('cust_reopen@test.com', 'Password123!');

    // Malicious attempt: Customer tries to reassign agent and raise priority
    const hackRes = await request(app)
      .patch('/api/tickets/TCK-REOPEN-01')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'open',
        priority: 'urgent',
        assigned_agent_id: 999,
      });

    expect(hackRes.status).toBe(403);
    expect(hackRes.body.error).toMatch(/Customers cannot change ticket priority/i);

    // Legitimate customer action: Reopen ticket
    const reopenRes = await request(app)
      .patch('/api/tickets/TCK-REOPEN-01')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'open' });

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.ticket.status).toBe('open');
    expect(reopenRes.body.ticket.resolved_at).toBeNull();
  });

  // 17. Client cannot spoof customer_id during ticket creation
  it('17. should ignore client-supplied customer_id and enforce authenticated user ID', async () => {
    const legitimateCustId = await createUser({ name: 'Real Customer', email: 'real@test.com', password: 'Password123!', role: 'customer' });
    const victimCustId = await createUser({ name: 'Victim Customer', email: 'victim@test.com', password: 'Password123!', role: 'customer' });
    await createUser({ name: 'Agent', email: 'agent_spoof@test.com', password: 'Password123!', role: 'agent' });

    const { token } = await loginUser('real@test.com', 'Password123!');

    // Customer tries to create ticket under victim's ID
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Spoofed ticket attempt',
        description: 'Trying to attribute ticket to another user',
        customer_id: victimCustId,
      });

    expect(res.status).toBe(201);
    expect(res.body.ticket.customer_id).toBe(legitimateCustId); // Bound to real user
    expect(res.body.ticket.customer_id).not.toBe(victimCustId);
  });

  // 18. Agent deactivation preserves existing tickets and updates assignment cursor
  it('18. should preserve tickets upon agent deactivation and immediately skip from future assignments', async () => {
    const agent1 = await createUser({ name: 'Agent One', email: 'ag1_deact@test.com', password: 'Password123!', role: 'agent', isActive: 1 });
    const agent2 = await createUser({ name: 'Agent Two', email: 'ag2_deact@test.com', password: 'Password123!', role: 'agent', isActive: 1 });
    const adminId = await createUser({ name: 'Admin', email: 'admin_deact@test.com', password: 'Password123!', role: 'admin' });

    const { token: adminToken } = await loginUser('admin_deact@test.com', 'Password123!');

    // Deactivate agent 1
    const patchRes = await request(app)
      .patch(`/api/admin/agents/${agent1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.agent.is_active).toBe(0);

    // Next assigned ticket MUST go to agent 2
    const nextAssigned = assignNextAgent(testDb);
    expect(nextAssigned.id).toBe(agent2);

    // And consecutive assignment also goes to agent 2 (only active agent)
    const subsequent = assignNextAgent(testDb);
    expect(subsequent.id).toBe(agent2);
  });
});

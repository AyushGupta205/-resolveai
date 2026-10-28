import bcrypt from 'bcryptjs';
import db from './db.js';
import { calculateDeadline } from '../services/sla.service.js';
import { config } from '../config/env.js';

export async function seedDatabase() {
  console.log('🌱 Starting ResolveAI database seeding...');

  // Reset existing tables idempotently
  db.exec(`
    DELETE FROM messages;
    DELETE FROM tickets;
    DELETE FROM assignment_state;
    DELETE FROM users;
  `);

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const now = new Date();

  // 1. Seed Users
  const usersToSeed = [
    // Admin
    { name: 'Alex Mercer (Admin)', email: 'admin@resolveai.com', role: 'admin', is_active: 1 },
    // Agents (including 1 inactive agent to demonstrate skipping)
    { name: 'Sarah Connor (Senior Agent)', email: 'sarah.agent@resolveai.com', role: 'agent', is_active: 1 },
    { name: 'David Miller (Specialist)', email: 'david.agent@resolveai.com', role: 'agent', is_active: 1 },
    { name: 'Elena Rostova (Technical Support)', email: 'elena.agent@resolveai.com', role: 'agent', is_active: 1 },
    { name: 'Marcus Vance (On Leave)', email: 'marcus.agent@resolveai.com', role: 'agent', is_active: 0 },
    // Customers
    { name: 'John Doe', email: 'john.doe@acmecorp.com', role: 'customer', is_active: 1 },
    { name: 'Emma Watson', email: 'emma.watson@globex.io', role: 'customer', is_active: 1 },
    { name: 'Liam Chen', email: 'liam.chen@techstartup.co', role: 'customer', is_active: 1 },
    { name: 'Sophia Rodriguez', email: 'sophia.rodriguez@innovate.net', role: 'customer', is_active: 1 },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const userMap = {};
  for (const u of usersToSeed) {
    const userCreatedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = insertUser.run(u.name, u.email.toLowerCase(), passwordHash, u.role, u.is_active, userCreatedAt);
    userMap[u.email.toLowerCase()] = Number(result.lastInsertRowid);
  }

  console.log(`✅ Seeded ${usersToSeed.length} users (Admin, Agents, Customers).`);

  // Initialize assignment cursor to first active agent
  db.prepare(`
    INSERT INTO assignment_state (key, last_agent_id, updated_at)
    VALUES ('ticket_assignment', ?, ?)
  `).run(userMap['sarah.agent@resolveai.com'], now.toISOString());

  // 2. Realistic Tickets Data
  // Various creation timestamps relative to now
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

  const ticketsData = [
    {
      id: 'TCK-801-101',
      subject: 'SSO SAML authentication loop on Google Workspace login',
      description: 'Our organization configured SAML 2.0 with Google Workspace yesterday. Users entering their work credentials are redirected in an infinite authentication loop back to the login page without an error message.',
      customerEmail: 'john.doe@acmecorp.com',
      agentEmail: 'sarah.agent@resolveai.com',
      category: 'Account Access',
      priority: 'urgent',
      status: 'in_progress',
      createdAt: hoursAgo(5), // 5 hours ago
      // First response was 1 hour after creation -> within 4h SLA
      firstResponseAt: hoursAgo(4),
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'john.doe@acmecorp.com',
          body: 'Our organization configured SAML 2.0 with Google Workspace yesterday. Users entering their work credentials are redirected in an infinite authentication loop back to the login page without an error message.',
          visibility: 'public',
          createdAt: hoursAgo(5),
        },
        {
          authorEmail: 'sarah.agent@resolveai.com',
          body: 'INTERNAL NOTE: Checked IdP logs. Looks like ACS URL in their Google SAML metadata is pointing to https://auth.resolveai.com/saml instead of https://app.resolveai.com/saml/acs. Do not share raw stacktrace.',
          visibility: 'internal',
          createdAt: hoursAgo(4.2),
        },
        {
          authorEmail: 'sarah.agent@resolveai.com',
          body: 'Hello John, thank you for reaching out. We inspected the SAML handshake telemetry and identified that the Assertion Consumer Service (ACS) URL in your Google Workspace SAML app configuration needs to be updated. Please verify that the ACS endpoint is set to https://app.resolveai.com/saml/acs.',
          visibility: 'public',
          createdAt: hoursAgo(4),
        },
        {
          authorEmail: 'john.doe@acmecorp.com',
          body: 'Thanks Sarah, our IT admin is reviewing the endpoint mapping now. Will update you shortly.',
          visibility: 'public',
          createdAt: hoursAgo(2),
        },
      ],
    },
    {
      id: 'TCK-801-102',
      subject: 'Duplicate credit card charge on Annual Enterprise Invoice #INV-9204',
      description: 'We were billed twice on October 25th for our annual enterprise subscription ($4,800.00 x 2). Please issue a refund for the duplicate transaction and send the updated credit note.',
      customerEmail: 'emma.watson@globex.io',
      agentEmail: 'david.agent@resolveai.com',
      category: 'Billing and Payments',
      priority: 'high',
      status: 'resolved',
      createdAt: hoursAgo(48),
      firstResponseAt: hoursAgo(46), // within SLA
      resolvedAt: hoursAgo(24),
      messages: [
        {
          authorEmail: 'emma.watson@globex.io',
          body: 'We were billed twice on October 25th for our annual enterprise subscription ($4,800.00 x 2). Please issue a refund for the duplicate transaction and send the updated credit note.',
          visibility: 'public',
          createdAt: hoursAgo(48),
        },
        {
          authorEmail: 'david.agent@resolveai.com',
          body: 'INTERNAL NOTE: Confirmed via Stripe dashboard. Webhook retry caused two payment intents to settle. Initiated refund for ch_3Mxx9284920. Funds should arrive in 3-5 business days.',
          visibility: 'internal',
          createdAt: hoursAgo(46.5),
        },
        {
          authorEmail: 'david.agent@resolveai.com',
          body: 'Dear Emma, we sincerely apologize for the inconvenience. We have verified the duplicate transaction with our payment gateway and immediately initiated a full refund of $4,800.00 to your corporate card ending in 4112. The receipt and credit note have been dispatched to your billing email.',
          visibility: 'public',
          createdAt: hoursAgo(46),
        },
        {
          authorEmail: 'emma.watson@globex.io',
          body: 'Received the credit memo and refund confirmation. Thank you for the swift resolution!',
          visibility: 'public',
          createdAt: hoursAgo(25),
        },
      ],
    },
    {
      id: 'TCK-801-103',
      subject: 'CRITICAL: Production API returning 504 Gateway Timeout on webhook deliveries',
      description: 'Starting around 20:00 UTC, all outbound webhook events to our EU endpoint (api.techstartup.co/hooks) are timing out after 30 seconds. We have missed over 400 order confirmation events.',
      customerEmail: 'liam.chen@techstartup.co',
      agentEmail: 'elena.agent@resolveai.com',
      category: 'Technical Issue',
      priority: 'urgent',
      status: 'in_progress',
      createdAt: hoursAgo(6),
      firstResponseAt: hoursAgo(5.5),
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'liam.chen@techstartup.co',
          body: 'Starting around 20:00 UTC, all outbound webhook events to our EU endpoint (api.techstartup.co/hooks) are timing out after 30 seconds. We have missed over 400 order confirmation events.',
          visibility: 'public',
          createdAt: hoursAgo(6),
        },
        {
          authorEmail: 'elena.agent@resolveai.com',
          body: 'INTERNAL NOTE: Escalated to DevOps on call. Looks like Cloudflare rate limiting rule was misconfigured on our egress NAT gateway.',
          visibility: 'internal',
          createdAt: hoursAgo(5.8),
        },
        {
          authorEmail: 'elena.agent@resolveai.com',
          body: 'Hi Liam, our engineering on-call has isolated the issue to an egress routing bottleneck and is applying a hotfix. We have queued all failed webhook payloads and will replay them as soon as the gateway stabilizes.',
          visibility: 'public',
          createdAt: hoursAgo(5.5),
        },
      ],
    },
    {
      id: 'TCK-801-104',
      subject: 'OVERDUE DEMO: Export to CSV truncates UTF-8 foreign characters in customer report',
      description: 'When exporting our monthly customer records containing Japanese, Arabic, and German characters, the generated CSV file shows broken replacement glyphs (e.g. ??? or mojibake).',
      customerEmail: 'sophia.rodriguez@innovate.net',
      agentEmail: 'sarah.agent@resolveai.com',
      category: 'Bug Report',
      priority: 'high',
      status: 'open',
      createdAt: hoursAgo(10), // Created 10h ago! SLA window was 4h -> OVERDUE with NO response!
      firstResponseAt: null,
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'sophia.rodriguez@innovate.net',
          body: 'When exporting our monthly customer records containing Japanese, Arabic, and German characters, the generated CSV file shows broken replacement glyphs (e.g. ??? or mojibake).',
          visibility: 'public',
          createdAt: hoursAgo(10),
        },
      ],
    },
    {
      id: 'TCK-801-105',
      subject: 'APPROACHING SLA DEMO: Requesting webhook signature verification documentation',
      description: 'Could you share the secret key rotation procedure and HMAC SHA-256 header specification for verifying incoming event payloads from your notification service?',
      customerEmail: 'john.doe@acmecorp.com',
      agentEmail: 'david.agent@resolveai.com',
      category: 'General Inquiry',
      priority: 'medium',
      status: 'open',
      createdAt: hoursAgo(3.3), // 3.3 hours ago -> deadline in 0.7h (42 mins)! SLA APPROACHING!
      firstResponseAt: null,
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'john.doe@acmecorp.com',
          body: 'Could you share the secret key rotation procedure and HMAC SHA-256 header specification for verifying incoming event payloads from your notification service?',
          visibility: 'public',
          createdAt: hoursAgo(3.3),
        },
      ],
    },
    {
      id: 'TCK-801-106',
      subject: 'Feature Request: Dark mode theme support for agent dashboard',
      description: 'Our customer support team works 24/7 in shifting lighting conditions. We would love to have a built-in dark mode or system theme sync toggle.',
      customerEmail: 'emma.watson@globex.io',
      agentEmail: 'elena.agent@resolveai.com',
      category: 'Feature Request',
      priority: 'low',
      status: 'waiting_customer',
      createdAt: hoursAgo(20),
      firstResponseAt: hoursAgo(18),
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'emma.watson@globex.io',
          body: 'Our customer support team works 24/7 in shifting lighting conditions. We would love to have a built-in dark mode or system theme sync toggle.',
          visibility: 'public',
          createdAt: hoursAgo(20),
        },
        {
          authorEmail: 'elena.agent@resolveai.com',
          body: 'Hi Emma! Thank you for the great suggestion. Our product team has dark mode on our Q4 design roadmap. Are there specific high-contrast color requirements your team prefers?',
          visibility: 'public',
          createdAt: hoursAgo(18),
        },
      ],
    },
    {
      id: 'TCK-801-107',
      subject: 'Cannot invite new team members with domain @globex.io',
      description: 'When sending team invites via the Members settings page, the form displays a red alert saying "Domain restriction policy prevents invite" even though globex.io is our verified primary domain.',
      customerEmail: 'emma.watson@globex.io',
      agentEmail: 'sarah.agent@resolveai.com',
      category: 'Account Access',
      priority: 'high',
      status: 'resolved',
      createdAt: hoursAgo(30),
      firstResponseAt: hoursAgo(28),
      resolvedAt: hoursAgo(22),
      messages: [
        {
          authorEmail: 'emma.watson@globex.io',
          body: 'When sending team invites via the Members settings page, the form displays a red alert saying "Domain restriction policy prevents invite" even though globex.io is our verified primary domain.',
          visibility: 'public',
          createdAt: hoursAgo(30),
        },
        {
          authorEmail: 'sarah.agent@resolveai.com',
          body: 'Hello Emma, we refreshed the domain whitelist DNS verification cache on our authorization server. Please try resending the invitation now.',
          visibility: 'public',
          createdAt: hoursAgo(28),
        },
        {
          authorEmail: 'emma.watson@globex.io',
          body: 'That worked! The invites sent immediately. Thank you!',
          visibility: 'public',
          createdAt: hoursAgo(23),
        },
      ],
    },
    {
      id: 'TCK-801-108',
      subject: 'REST API Rate Limit 429 encountered during batch sync operations',
      description: 'We are receiving HTTP 429 Too Many Requests during our nightly 02:00 UTC inventory sync. Can we request an enterprise rate limit increase to 2,000 req/min?',
      customerEmail: 'liam.chen@techstartup.co',
      agentEmail: 'david.agent@resolveai.com',
      category: 'Technical Issue',
      priority: 'medium',
      status: 'open',
      createdAt: hoursAgo(1), // 1 hour ago -> Within SLA!
      firstResponseAt: null,
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'liam.chen@techstartup.co',
          body: 'We are receiving HTTP 429 Too Many Requests during our nightly 02:00 UTC inventory sync. Can we request an enterprise rate limit increase to 2,000 req/min?',
          visibility: 'public',
          createdAt: hoursAgo(1),
        },
      ],
    },
    {
      id: 'TCK-801-109',
      subject: 'Inquiry regarding SOC 2 Type II compliance report download',
      description: 'Our security auditing team requires your latest SOC 2 Type II compliance audit report and ISO 27001 certificate before our annual vendor security assessment.',
      customerEmail: 'sophia.rodriguez@innovate.net',
      agentEmail: 'elena.agent@resolveai.com',
      category: 'General Inquiry',
      priority: 'low',
      status: 'resolved',
      createdAt: hoursAgo(72),
      firstResponseAt: hoursAgo(70),
      resolvedAt: hoursAgo(68),
      messages: [
        {
          authorEmail: 'sophia.rodriguez@innovate.net',
          body: 'Our security auditing team requires your latest SOC 2 Type II compliance audit report and ISO 27001 certificate before our annual vendor security assessment.',
          visibility: 'public',
          createdAt: hoursAgo(72),
        },
        {
          authorEmail: 'elena.agent@resolveai.com',
          body: 'Hello Sophia, we have sent our SOC 2 Type II report and certificate package to your security team via our secure DocuSign portal.',
          visibility: 'public',
          createdAt: hoursAgo(70),
        },
      ],
    },
    {
      id: 'TCK-801-110',
      subject: 'Unable to update payment method: 3D Secure modal fails to render',
      description: 'Attempting to change our credit card in the Billing tab opens a blank popup modal and never triggers our bank’s 3D Secure verification step.',
      customerEmail: 'john.doe@acmecorp.com',
      agentEmail: 'sarah.agent@resolveai.com',
      category: 'Billing and Payments',
      priority: 'urgent',
      status: 'in_progress',
      createdAt: hoursAgo(2),
      firstResponseAt: hoursAgo(1.5),
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'john.doe@acmecorp.com',
          body: 'Attempting to change our credit card in the Billing tab opens a blank popup modal and never triggers our bank’s 3D Secure verification step.',
          visibility: 'public',
          createdAt: hoursAgo(2),
        },
        {
          authorEmail: 'sarah.agent@resolveai.com',
          body: 'INTERNAL NOTE: Browser CSP header had missing connect-src for sandbox bank frames. Fixed in CDN config.',
          visibility: 'internal',
          createdAt: hoursAgo(1.7),
        },
        {
          authorEmail: 'sarah.agent@resolveai.com',
          body: 'Hi John, thank you for alerting us. We identified a CSP frame restriction that affected some 3DS banking challenges. We pushed a fix; could you please perform a hard refresh and test once more?',
          visibility: 'public',
          createdAt: hoursAgo(1.5),
        },
      ],
    },
    {
      id: 'TCK-801-111',
      subject: 'OVERDUE DEMO: Mobile app push notifications failing on Android 14',
      description: 'Several customers reported that push alerts for ticket assignments and replies are not arriving on devices running Android 14.',
      customerEmail: 'liam.chen@techstartup.co',
      agentEmail: 'david.agent@resolveai.com',
      category: 'Bug Report',
      priority: 'high',
      status: 'open',
      createdAt: hoursAgo(15), // 15 hours ago -> OVERDUE
      firstResponseAt: null,
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'liam.chen@techstartup.co',
          body: 'Several customers reported that push alerts for ticket assignments and replies are not arriving on devices running Android 14.',
          visibility: 'public',
          createdAt: hoursAgo(15),
        },
      ],
    },
    {
      id: 'TCK-801-112',
      subject: 'Requesting custom webhook retry policy settings',
      description: 'We would like to configure exponential backoff intervals for webhook deliveries that fail due to intermittent endpoint maintenance.',
      customerEmail: 'sophia.rodriguez@innovate.net',
      agentEmail: 'elena.agent@resolveai.com',
      category: 'Feature Request',
      priority: 'low',
      status: 'in_progress',
      createdAt: hoursAgo(4),
      firstResponseAt: hoursAgo(2),
      resolvedAt: null,
      messages: [
        {
          authorEmail: 'sophia.rodriguez@innovate.net',
          body: 'We would like to configure exponential backoff intervals for webhook deliveries that fail due to intermittent endpoint maintenance.',
          visibility: 'public',
          createdAt: hoursAgo(4),
        },
        {
          authorEmail: 'elena.agent@resolveai.com',
          body: 'Hi Sophia, our team has forwarded this to the integrations squad. We currently default to 5 retries over 2 hours, but are building configurable retry policies for enterprise workspaces.',
          visibility: 'public',
          createdAt: hoursAgo(2),
        },
      ],
    },
  ];

  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      id, subject, description, customer_id, assigned_agent_id,
      category, priority, status, created_at, updated_at,
      first_response_deadline, first_response_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT INTO messages (
      ticket_id, author_id, author_role, body, visibility, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const t of ticketsData) {
    const customerId = userMap[t.customerEmail.toLowerCase()];
    const agentId = userMap[t.agentEmail.toLowerCase()];
    const deadline = calculateDeadline(t.createdAt, config.slaHours);
    const updatedAt = t.resolvedAt || t.firstResponseAt || t.createdAt;

    insertTicket.run(
      t.id,
      t.subject,
      t.description,
      customerId,
      agentId,
      t.category,
      t.priority,
      t.status,
      t.createdAt,
      updatedAt,
      deadline,
      t.firstResponseAt,
      t.resolvedAt
    );

    for (const m of t.messages) {
      const authorId = userMap[m.authorEmail.toLowerCase()];
      const authorUser = usersToSeed.find((u) => u.email.toLowerCase() === m.authorEmail.toLowerCase());
      const authorRole = authorUser ? authorUser.role : 'customer';

      insertMsg.run(
        t.id,
        authorId,
        authorRole,
        m.body,
        m.visibility,
        m.createdAt
      );
    }
  }

  console.log(`✅ Seeded ${ticketsData.length} realistic tickets across various SLA states and categories.`);
  console.log('🎉 Seeding complete!');
}

// Run directly if executed as main
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}

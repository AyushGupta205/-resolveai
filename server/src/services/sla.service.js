import { config } from '../config/env.js';

/**
 * Calculates SLA first response deadline from creation time.
 * @param {string|Date} createdAt - ISO string or Date
 * @param {number} [slaHours] - SLA window in hours (default config.slaHours)
 * @returns {string} ISO 8601 UTC timestamp string
 */
export function calculateDeadline(createdAt, slaHours = config.slaHours) {
  const createdDate = new Date(createdAt);
  const deadlineMs = createdDate.getTime() + (slaHours * 60 * 60 * 1000);
  return new Date(deadlineMs).toISOString();
}

/**
 * Derives SLA status for a given ticket record.
 * Statuses: 'met' | 'breached_responded' | 'overdue' | 'approaching' | 'within_sla'
 * @param {Object} ticket
 * @param {Date} [currentTime] - optional for deterministic testing
 */
export function getTicketSlaStatus(ticket, currentTime = new Date()) {
  const now = currentTime.getTime();
  const deadline = new Date(ticket.first_response_deadline).getTime();
  const firstResponse = ticket.first_response_at ? new Date(ticket.first_response_at).getTime() : null;

  if (firstResponse !== null) {
    if (firstResponse <= deadline) {
      return {
        status: 'met',
        label: 'SLA Met',
        isOverdue: false,
        isApproaching: false,
        isResponded: true,
        firstResponseAt: ticket.first_response_at,
        timeToFirstResponseMinutes: Math.round((firstResponse - new Date(ticket.created_at).getTime()) / 60000),
      };
    } else {
      return {
        status: 'breached_responded',
        label: 'SLA Breached (Late Response)',
        isOverdue: true,
        isApproaching: false,
        isResponded: true,
        firstResponseAt: ticket.first_response_at,
        timeToFirstResponseMinutes: Math.round((firstResponse - new Date(ticket.created_at).getTime()) / 60000),
      };
    }
  }

  // Not yet responded
  if (now > deadline) {
    const overdueMinutes = Math.round((now - deadline) / 60000);
    return {
      status: 'overdue',
      label: 'SLA Overdue',
      isOverdue: true,
      isApproaching: false,
      isResponded: false,
      overdueMinutes,
      formattedTime: formatDuration(overdueMinutes) + ' overdue',
    };
  }

  const remainingMs = deadline - now;
  const remainingMinutes = Math.round(remainingMs / 60000);
  const oneHourMs = 60 * 60 * 1000;

  if (remainingMs <= oneHourMs) {
    return {
      status: 'approaching',
      label: 'SLA Approaching',
      isOverdue: false,
      isApproaching: true,
      isResponded: false,
      remainingMinutes,
      formattedTime: formatDuration(remainingMinutes) + ' remaining',
    };
  }

  return {
    status: 'within_sla',
    label: 'Within SLA',
    isOverdue: false,
    isApproaching: false,
    isResponded: false,
    remainingMinutes,
    formattedTime: formatDuration(remainingMinutes) + ' remaining',
  };
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

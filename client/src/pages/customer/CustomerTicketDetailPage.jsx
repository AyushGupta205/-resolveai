import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ticketApi } from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import SlaBadge from '../../components/common/SlaBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  ArrowLeft,
  Paperclip,
  Send,
  Download,
  AlertCircle,
  Headphones,
  User,
  Clock,
  RotateCcw,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export default function CustomerTicketDetailPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const [tRes, mRes] = await Promise.all([
        ticketApi.getTicketById(id),
        ticketApi.getMessages(id),
      ]);
      setTicket(tRes.data.ticket);
      setMessages(mRes.data.messages || []);
    } catch (err) {
      setError(err.message || 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('body', replyBody.trim());
      formData.append('visibility', 'public');
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await ticketApi.sendMessage(id, formData);
      setReplyBody('');
      setAttachment(null);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopenTicket() {
    setReopening(true);
    setError('');
    try {
      await ticketApi.updateTicket(id, { status: 'open' });
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to reopen ticket.');
    } finally {
      setReopening(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading ticket details..." size="large" />;
  }

  if (!ticket) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-800">Ticket not found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This ticket may not exist or you do not have permission to access it.
        </p>
        <Link
          to="/customer/tickets"
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
        >
          Return to My Tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top back link */}
      <Link
        to="/customer/tickets"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Tickets</span>
      </Link>

      {/* Ticket Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {ticket.id}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {ticket.category}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">
              {ticket.subject}
            </h1>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <SlaBadge sla={ticket.sla} />
            <span className="text-[11px] text-slate-400">
              Deadline: {new Date(ticket.first_response_deadline).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Assigned Specialist</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Headphones className="w-3.5 h-3.5 text-indigo-500" />
              {ticket.agent_name || 'Queued for Assignment'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Created Timestamp</span>
            <span className="font-medium text-slate-700 mt-0.5 block">
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">First Public Response</span>
            <span className="font-medium text-slate-700 mt-0.5 block">
              {ticket.first_response_at
                ? new Date(ticket.first_response_at).toLocaleString()
                : 'Pending initial reply'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Resolution Status</span>
            <span className="font-medium text-slate-700 mt-0.5 block">
              {ticket.resolved_at
                ? `Resolved on ${new Date(ticket.resolved_at).toLocaleDateString()}`
                : 'Active investigation'}
            </span>
          </div>
        </div>

        {/* Reopen banner if resolved */}
        {ticket.status === 'resolved' && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>This ticket has been marked as resolved. Still experiencing issues?</span>
            </div>
            <button
              onClick={handleReopenTicket}
              disabled={reopening}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs disabled:opacity-60 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{reopening ? 'Reopening...' : 'Reopen Ticket'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">
          Conversation Thread ({messages.length})
        </h2>

        {messages.map((msg, index) => {
          const isCustomer = msg.author_role === 'customer';
          return (
            <div
              key={msg.id || index}
              className={`p-5 rounded-2xl border transition-all ${
                isCustomer
                  ? 'bg-white border-slate-200 shadow-xs ml-0 md:mr-12'
                  : 'bg-indigo-50/40 border-indigo-100 shadow-xs mr-0 md:ml-12'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCustomer ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {isCustomer ? <User className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 mr-2">
                      {msg.author_name}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                        isCustomer
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-indigo-100 text-indigo-700 font-bold'
                      }`}
                    >
                      {isCustomer ? 'Customer' : 'Support Specialist'}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>

              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {msg.body}
              </div>

              {/* Attachment if present */}
              {msg.attachment_path && (
                <div className="mt-3 pt-3 border-t border-slate-100/70">
                  <a
                    href={`/api/tickets/${ticket.id}/attachments/${msg.attachment_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="truncate max-w-xs">{msg.attachment_name || 'Download Attachment'}</span>
                    <Download className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reply Composer Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Add Reply / Follow-up
        </h3>

        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            rows={4}
            required
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Type your response to the support team..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400"
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-600">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span>Attach file</span>
                <input
                  type="file"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
                />
              </label>

              {attachment && (
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded truncate max-w-[200px]">
                  {attachment.name}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !replyBody.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sending...' : 'Send Message'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

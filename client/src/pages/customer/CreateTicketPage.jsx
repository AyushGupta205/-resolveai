import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ticketApi } from '../../services/api';
import { Sparkles, Paperclip, ArrowLeft, Send, AlertCircle, X } from 'lucide-react';

const CATEGORIES = [
  'Technical Issue',
  'Billing and Payments',
  'Account Access',
  'Feature Request',
  'Bug Report',
  'General Inquiry',
];

export default function CreateTicketPage() {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 5 * 1024 * 1024) {
        setError('File size exceeds the 5MB limit.');
        return;
      }
      setFile(selected);
      setError('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters long.');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please provide a description of at least 10 characters.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      formData.append('priority', priority);
      if (category) {
        formData.append('category', category);
      }
      if (file) {
        formData.append('attachment', file);
      }

      const res = await ticketApi.createTicket(formData);
      navigate(`/customer/tickets/${res.data.ticket.id}`);
    } catch (err) {
      setError(err.message || 'Failed to submit ticket.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top back button */}
      <Link
        to="/customer/tickets"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Tickets</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              New Support Request
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              AI Routed
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Create a Support Ticket</h1>
          <p className="text-xs text-slate-500 mt-1">
            Our round-robin dispatcher assigns your ticket to an active specialist within minutes.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. SSO login failing with 500 error on checkout"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Category & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category (Optional)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white"
              >
                <option value="">🤖 Auto-detect with Gemini AI</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                If omitted, Gemini classifies your ticket automatically.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white"
              >
                <option value="low">Low (General question, minor issue)</option>
                <option value="medium">Medium (Standard request)</option>
                <option value="high">High (Impacting production feature)</option>
                <option value="urgent">Urgent (System down / revenue blocked)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide steps to reproduce, error messages, and context..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* File attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Attachment (Optional, max 5MB)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span>Choose File (PNG, JPEG, PDF, TXT)</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
                  className="hidden"
                />
              </label>

              {file && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs border border-indigo-100 font-medium">
                  <span className="truncate max-w-xs">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-indigo-400 hover:text-indigo-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              to="/customer/tickets"
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Submitting & Routing...' : 'Submit Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

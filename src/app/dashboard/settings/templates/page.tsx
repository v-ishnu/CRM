'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  Bell,
  MessageSquare,
  Search,
  RefreshCw,
  Edit2,
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code,
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Quote,
  X,
  Check,
  Smartphone,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

interface TemplateVariable {
  name: string;
  description: string;
  sampleValue?: string;
}

interface MessageTemplate {
  _id: string;
  key: string;
  name: string;
  description: string;
  recipientType: 'TEAM_MEMBER' | 'CLIENT' | 'ADMIN';
  channel: 'TELEGRAM' | 'CRM' | 'CHAT' | 'WEB_PUSH' | 'EMAIL';
  subject?: string;
  body: string;
  enabled: boolean;
  variables: TemplateVariable[];
  isSystem: boolean;
  version: number;
  updatedBy?: string;
  updatedAt: string;
}

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // Edit / Preview Modal
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    body: '',
    enabled: true,
  });

  // Live Preview State
  const [previewData, setPreviewData] = useState<{
    telegram: string;
    chat: string;
    webPush: { title: string; body: string };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mockVariables, setMockVariables] = useState<Record<string, string>>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (recipientFilter) params.set('recipientType', recipientFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/templates?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data);
      } else {
        setError(json.error?.message || 'Failed to load message templates');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [recipientFilter, channelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemplates();
  };

  const handleOpenEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      subject: template.subject || '',
      body: template.body,
      enabled: template.enabled,
    });

    // Populate mock variables
    const initialMocks: Record<string, string> = {};
    if (template.variables) {
      for (const v of template.variables) {
        initialMocks[v.name] = v.sampleValue || `[${v.name}]`;
      }
    }
    setMockVariables(initialMocks);
    setActiveModalTab('edit');
    setIsEditing(true);
  };

  const handleOpenPreview = (template: MessageTemplate) => {
    handleOpenEdit(template);
    setActiveModalTab('preview');
  };

  // Fetch live preview when tab is switched to preview or mock vars change
  useEffect(() => {
    if (isEditing && activeModalTab === 'preview' && selectedTemplate) {
      fetchPreview();
    }
  }, [activeModalTab, formData.body, formData.subject, mockVariables]);

  const fetchPreview = async () => {
    if (!selectedTemplate) return;
    try {
      setPreviewLoading(true);
      const res = await fetch('/api/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selectedTemplate.key,
          customBody: formData.body,
          customSubject: formData.subject,
          variables: mockVariables,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPreviewData(json.data);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleInsertTag = (tag: string, endTag: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = formData.body;
    const selected = current.substring(start, end);

    const replacement = `${tag}${selected}${endTag}`;
    const newBody = current.substring(0, start) + replacement + current.substring(end);
    setFormData({ ...formData, body: newBody });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, end + tag.length);
    }, 0);
  };

  const handleInsertVariable = (varName: string) => {
    handleInsertTag(`{{${varName}}}`);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/templates/${selectedTemplate._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setIsEditing(false);
        setBannerSuccess(`Template "${json.data.name}" updated successfully (v${json.data.version})!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchTemplates();
      } else {
        alert(json.error?.message || 'Failed to update template');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating template');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedTemplate) return;
    if (!confirm(`Are you sure you want to reset "${selectedTemplate.name}" to the system default template?`)) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/templates/${selectedTemplate._id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setFormData({
          name: json.data.name,
          description: json.data.description,
          subject: json.data.subject || '',
          body: json.data.body,
          enabled: json.data.enabled,
        });
        setBannerSuccess(`Template "${json.data.name}" reset to system default!`);
        setTimeout(() => setBannerSuccess(null), 4000);
        fetchTemplates();
      } else {
        alert(json.error?.message || 'Failed to reset template');
      }
    } catch (err: any) {
      alert(err.message || 'Error resetting template');
    } finally {
      setSaving(false);
    }
  };

  const getRecipientBadge = (type: string) => {
    switch (type) {
      case 'TEAM_MEMBER':
        return <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#ff3e00]/10 border border-[#ff3e00]/30 text-[#ff3e00]">TEAM MEMBER</span>;
      case 'CLIENT':
        return <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6]">CLIENT</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b]">ADMIN</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-zinc-800 text-zinc-400">{type}</span>;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'TELEGRAM':
        return <span className="px-2 py-0.5 text-[9px] font-mono bg-[#0088cc]/10 border border-[#0088cc]/30 text-[#38bdf8] flex items-center gap-1"><Send className="w-2.5 h-2.5" /> TELEGRAM</span>;
      case 'WEB_PUSH':
        return <span className="px-2 py-0.5 text-[9px] font-mono bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] flex items-center gap-1"><Bell className="w-2.5 h-2.5" /> WEB PUSH</span>;
      case 'CHAT':
      case 'CRM':
        return <span className="px-2 py-0.5 text-[9px] font-mono bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> CHAT / CRM</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-mono bg-zinc-800 text-zinc-400">{channel}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#242428] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-[#ff3e00]" />
            <span>Universal Message Templates</span>
          </h1>
          <p className="text-xs font-mono text-[#8a8a93] mt-1">
            Centralized notification formatting for Team Members, Clients, and Admins across Telegram, Web Push, and Chat.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchTemplates()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-[#141416] border border-[#242428] text-white hover:border-[#ff3e00] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ff3e00]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Banner Feedback */}
      {bannerSuccess && (
        <div className="bg-[#00d664]/10 border border-[#00d664]/30 px-4 py-3 rounded-none md:rounded-xs flex items-center gap-2 text-xs font-mono text-[#00d664] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-[#ff3e00]/10 border border-[#ff3e00]/30 px-4 py-3 rounded-none md:rounded-xs flex items-center gap-2 text-xs font-mono text-[#ff3e00]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-[#141416] border border-[#242428] p-3 rounded-none md:rounded-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by key, name, or description..."
            className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-[#52525b] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value)}
            className="crm-select-sm text-xs font-mono"
          >
            <option value="">ALL RECIPIENTS</option>
            <option value="TEAM_MEMBER">TEAM MEMBER</option>
            <option value="CLIENT">CLIENT</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="crm-select-sm text-xs font-mono"
          >
            <option value="">ALL CHANNELS</option>
            <option value="TELEGRAM">TELEGRAM</option>
            <option value="WEB_PUSH">WEB PUSH</option>
            <option value="CHAT">CHAT / CRM</option>
          </select>

          <button
            type="submit"
            className="px-3.5 py-2 bg-[#ff3e00] hover:bg-[#ff3e00]/90 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
          >
            Search
          </button>
        </div>
      </form>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#88888e] font-mono text-xs">
          Loading message templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center p-12 bg-[#141416] border border-[#242428] rounded-none md:rounded-xs">
          <Mail className="w-12 h-12 text-[#71717a] mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-white">No templates found</h3>
          <p className="text-xs font-mono text-[#8a8a93] mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className={`bg-[#141416] border p-5 flex flex-col justify-between transition-colors rounded-none md:rounded-xs ${
                tpl.enabled ? 'border-[#242428] hover:border-[#ff3e00]/40' : 'border-zinc-800 opacity-60'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white text-sm leading-tight truncate">
                      {tpl.name}
                    </h3>
                    <code className="text-[10px] font-mono text-[#a1a1aa] block mt-0.5 truncate">
                      {tpl.key}
                    </code>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {getRecipientBadge(tpl.recipientType)}
                    {getChannelBadge(tpl.channel)}
                  </div>
                </div>

                <p className="text-xs font-mono text-[#8a8a93] line-clamp-2 my-2">
                  {tpl.description}
                </p>

                {/* Variable chips */}
                <div className="py-2.5 border-y border-[#242428] my-3">
                  <span className="text-[10px] font-mono text-[#71717a] uppercase tracking-wider block mb-1.5">
                    Available Variables ({tpl.variables?.length || 0}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {tpl.variables?.map((v) => (
                      <span
                        key={v.name}
                        title={`${v.name}: ${v.description}`}
                        className="text-[9px] font-mono px-1.5 py-0.5 bg-[#0e0e10] border border-[#242428] text-white/80"
                      >
                        {`{{${v.name}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="pt-3 border-t border-[#242428] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#71717a]">
                    v{tpl.version || 1}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 ${tpl.enabled ? 'text-[#00d664]' : 'text-[#ff3e00]'}`}>
                    {tpl.enabled ? '● ACTIVE' : '○ DISABLED'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(tpl)}
                    className="p-1.5 text-[#8a8a93] hover:text-white border border-[#242428] hover:border-[#38383e] bg-[#18181b] transition-colors cursor-pointer"
                    title="Live Multi-Channel Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tpl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff3e00]/10 hover:bg-[#ff3e00]/20 border border-[#ff3e00]/30 text-[#ff3e00] hover:text-white font-mono text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT / PREVIEW MODAL */}
      {isEditing && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#141416] border border-[#242428] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl rounded-none md:rounded-xs overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#242428] bg-[#0e0e11] shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white font-mono truncate">
                    {selectedTemplate.name}
                  </h2>
                  {getRecipientBadge(selectedTemplate.recipientType)}
                  {getChannelBadge(selectedTemplate.channel)}
                </div>
                <code className="text-[10px] text-[#8a8a93] font-mono block mt-0.5 truncate">
                  Key: {selectedTemplate.key} (Version: {selectedTemplate.version || 1})
                </code>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-[#8a8a93] hover:text-white hover:bg-[#242428] cursor-pointer ml-3 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 border-b border-[#242428] px-4 sm:px-6 bg-[#111114] text-xs font-mono shrink-0">
              <button
                type="button"
                onClick={() => setActiveModalTab('edit')}
                className={`py-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeModalTab === 'edit'
                    ? 'border-[#ff3e00] text-white'
                    : 'border-transparent text-[#8a8a93] hover:text-white'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5 text-[#ff3e00]" />
                <span>Template Editor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('preview')}
                className={`py-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeModalTab === 'preview'
                    ? 'border-[#ff3e00] text-white'
                    : 'border-transparent text-[#8a8a93] hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Multi-Channel Preview</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {activeModalTab === 'edit' ? (
                <form id="templateForm" onSubmit={handleSaveTemplate} className="space-y-4">
                  {/* Meta Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-[#8a8a93] uppercase mb-1">
                        Template Label
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] p-2 text-xs font-mono text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-[#8a8a93] uppercase mb-1">
                        Status
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-mono text-white">
                        <input
                          type="checkbox"
                          checked={formData.enabled}
                          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                          className="text-[#ff3e00] focus:ring-0"
                        />
                        <span>Enable Template (falls back to system default if disabled)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-[#8a8a93] uppercase mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] p-2 text-xs font-mono text-white outline-none"
                    />
                  </div>

                  {selectedTemplate.channel === 'WEB_PUSH' && (
                    <div>
                      <label className="block text-[11px] font-mono text-[#8a8a93] uppercase mb-1">
                        Notification Title / Subject
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Push title (supports {{variables}})"
                        className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] p-2 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  )}

                  {/* Body Editor Toolbar */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-[11px] font-mono text-[#8a8a93] uppercase">
                        Template Body (HTML / Rich Text / Markdown)
                      </label>
                      <span className="text-[10px] font-mono text-[#71717a]">
                        Telegram HTML supported
                      </span>
                    </div>

                    {/* Formatting buttons */}
                    <div className="flex items-center gap-1 p-1 bg-[#101012] border border-[#242428] border-b-0 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<b>', '</b>')}
                        title="Bold (<b>...</b>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<i>', '</i>')}
                        title="Italic (<i>...</i>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<s>', '</s>')}
                        title="Strikethrough (<s>...</s>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<code>', '</code>')}
                        title="Inline Code (<code>...</code>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<pre>', '</pre>')}
                        title="Code Block (<pre>...</pre>)"
                        className="px-2 py-1 hover:bg-[#242428] text-[#a1a1aa] hover:text-white font-mono text-[10px] cursor-pointer"
                      >
                        [pre]
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<blockquote>', '</blockquote>')}
                        title="Quote (<blockquote>...</blockquote>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('<a href="https://">', '</a>')}
                        title="Link (<a href=...>...</a>)"
                        className="p-1.5 hover:bg-[#242428] text-[#a1a1aa] hover:text-white cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={10}
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      required
                      className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[#ff3e00] p-3 text-xs sm:text-sm font-mono text-white outline-none resize-y leading-relaxed"
                    />
                  </div>

                  {/* Registered Variables Inserter */}
                  <div className="bg-[#101012] border border-[#242428] p-3 space-y-2">
                    <span className="text-[11px] font-mono text-[#8a8a93] uppercase tracking-wider block">
                      Click to insert variable into template:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTemplate.variables?.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => handleInsertVariable(v.name)}
                          className="px-2 py-1 bg-[#18181b] hover:bg-[#ff3e00]/20 border border-[#2e2e34] hover:border-[#ff3e00]/50 text-white font-mono text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                          title={`${v.name}: ${v.description} (Sample: ${v.sampleValue || 'N/A'})`}
                        >
                          <span className="text-[#ff3e00]">+</span>
                          <span>{`{{${v.name}}}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                /* LIVE PREVIEW TAB */
                <div className="space-y-6">
                  {/* Mock Variables Tweaker */}
                  <div className="bg-[#101012] border border-[#242428] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-white font-semibold">
                        Preview Sample Variables
                      </span>
                      <span className="text-[10px] font-mono text-[#71717a]">
                        Changes reflect live in the previews below
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.keys(mockVariables).map((key) => (
                        <div key={key}>
                          <label className="block text-[9px] font-mono text-[#8a8a93] truncate">
                            {key}
                          </label>
                          <input
                            type="text"
                            value={mockVariables[key] || ''}
                            onChange={(e) => setMockVariables({ ...mockVariables, [key]: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-[#242428] px-2 py-1 text-xs font-mono text-white outline-none focus:border-[#ff3e00]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Channel Previews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Telegram Bubble Preview */}
                    <div className="bg-[#0b141a] border border-[#242428] p-4 rounded-none md:rounded-xs shadow-lg">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                        <span className="text-xs font-mono text-[#38bdf8] flex items-center gap-1.5 font-bold">
                          <Send className="w-3.5 h-3.5" /> Telegram Preview
                        </span>
                        <span className="text-[10px] font-mono text-white/50">Bot Message</span>
                      </div>

                      {previewLoading ? (
                        <div className="p-8 text-center text-xs font-mono text-white/40">Rendering...</div>
                      ) : (
                        <div className="bg-[#1f2c34] text-white p-3.5 text-xs sm:text-sm font-sans rounded-xs shadow-md space-y-2 max-w-[95%]">
                          <div
                            className="whitespace-pre-wrap break-words leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: previewData?.telegram || '' }}
                          />
                          <div className="text-right text-[10px] text-white/40 font-mono">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Web Push & Chat Preview */}
                    <div className="space-y-4">
                      {/* Web Push Toast */}
                      <div className="bg-[#141416] border border-[#242428] p-4 rounded-none md:rounded-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-[#10b981] flex items-center gap-1.5 font-bold">
                            <Bell className="w-3.5 h-3.5" /> Web Push Notification
                          </span>
                        </div>
                        <div className="bg-[#1c1c20] border border-[#2a2a30] p-3 flex items-start gap-3 shadow-lg">
                          <div className="w-8 h-8 rounded-full bg-[#ff3e00] flex items-center justify-center text-white shrink-0 text-xs font-bold font-mono">
                            Dr
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white font-mono truncate">
                              {previewData?.webPush?.title || selectedTemplate.name}
                            </h4>
                            <p className="text-xs text-[#a1a1aa] font-mono mt-0.5 line-clamp-2">
                              {previewData?.webPush?.body || 'Push body preview...'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CRM / Chat Preview */}
                      <div className="bg-[#141416] border border-[#242428] p-4 rounded-none md:rounded-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-purple-400 flex items-center gap-1.5 font-bold">
                            <MessageSquare className="w-3.5 h-3.5" /> CRM / Chat Display
                          </span>
                        </div>
                        <div className="bg-[#18181b] border border-[#242428] p-3 text-xs sm:text-sm text-white">
                          <div
                            className="whitespace-pre-wrap break-words leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: previewData?.chat || '' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-[#242428] bg-[#0e0e11] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#8a8a93] hover:text-[#ff3e00] border border-[#242428] hover:border-[#ff3e00]/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-xs font-mono text-[#8a8a93] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="templateForm"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#ff3e00] hover:bg-[#ff3e00]/90 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Server,
  FolderKanban,
  CreditCard,
  Key,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { MasterDataType, MASTER_DATA_TYPES } from '@/types/master-data';

interface MasterDataItem {
  _id: string;
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentId?: { _id: string; label: string; key: string } | string;
  sortOrder: number;
  isActive: boolean;
  isSystemDefault: boolean;
  createdAt: string;
}

const TABS: { id: string; label: string; types: MasterDataType[]; icon: any }[] = [
  { id: 'services', label: 'Services & Categories', types: ['SERVICE_CATEGORY', 'SERVICE'], icon: FolderKanban },
  { id: 'hosting', label: 'Hosting Configuration', types: ['HOSTING_PROVIDER', 'HOSTING_TYPE'], icon: Server },
  { id: 'payments', label: 'Payment Options', types: ['PAYMENT_METHOD', 'PAYMENT_TYPE'], icon: CreditCard },
  { id: 'credentials', label: 'Credential Types', types: ['CREDENTIAL_TYPE'], icon: Key },
  { id: 'team', label: 'Team Designations', types: ['TEAM_DESIGNATION'], icon: Briefcase },
];

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('services');
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [formData, setFormData] = useState({
    type: 'SERVICE' as MasterDataType,
    key: '',
    label: '',
    description: '',
    parentId: '',
    sortOrder: 0,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch items for currently selected types
      const currentTabDef = TABS.find((t) => t.id === activeTab) || TABS[0];
      const promises = currentTabDef.types.map((type) =>
        fetch(`/api/master-data?type=${type}&includeInactive=true`).then((r) => r.json())
      );

      // Also always fetch categories for parent selection
      const catPromise = fetch('/api/master-data?type=SERVICE_CATEGORY&includeInactive=true').then((r) => r.json());

      const [catRes, ...typeResponses] = await Promise.all([catPromise, ...promises]);

      if (catRes.success) {
        setCategories(catRes.data || []);
      }

      const merged: MasterDataItem[] = [];
      for (const res of typeResponses) {
        if (res.success && Array.isArray(res.data)) {
          merged.push(...res.data);
        }
      }
      setItems(merged);
    } catch (err: any) {
      setError(err.message || 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    const currentTabDef = TABS.find((t) => t.id === activeTab) || TABS[0];
    const defaultType = currentTabDef.types[0];
    setFormData({
      type: defaultType,
      key: '',
      label: '',
      description: '',
      parentId: '',
      sortOrder: items.length + 1,
      isActive: true,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      key: item.key,
      label: item.label,
      description: item.description || '',
      parentId: typeof item.parentId === 'object' ? item.parentId?._id || '' : item.parentId || '',
      sortOrder: item.sortOrder || 0,
      isActive: item.isActive,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleToggleActive = async (item: MasterDataItem) => {
    try {
      const res = await fetch(`/api/master-data/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`"${item.label}" is now ${!item.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        setTimeout(() => setBannerSuccess(null), 3000);
        fetchItems();
      } else {
        alert(data.error?.message || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating item');
    }
  };

  const handleDelete = async (item: MasterDataItem) => {
    if (item.isSystemDefault) {
      alert('System default configuration items cannot be deleted. You can deactivate them instead.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${item.label}"? If it is referenced in any database records, deletion will be blocked.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/master-data/${item._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setBannerSuccess(`"${item.label}" deleted successfully`);
        setTimeout(() => setBannerSuccess(null), 3000);
        fetchItems();
      } else {
        alert(data.error?.message || 'Failed to delete item');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      setModalError('Label is required');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      if (editingItem) {
        // Update
        const payload: any = {
          label: formData.label.trim(),
          description: formData.description.trim(),
          sortOrder: Number(formData.sortOrder) || 0,
          isActive: formData.isActive,
        };
        if (formData.type === 'SERVICE') {
          payload.parentId = formData.parentId || null;
        }

        const res = await fetch(`/api/master-data/${editingItem._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setShowModal(false);
          setBannerSuccess(`Master data "${formData.label}" updated successfully`);
          setTimeout(() => setBannerSuccess(null), 3000);
          fetchItems();
        } else {
          setModalError(data.error?.message || 'Failed to update item');
        }
      } else {
        // Create
        const payload: any = {
          type: formData.type,
          key: formData.key.trim() || formData.label.trim(),
          label: formData.label.trim(),
          description: formData.description.trim(),
          sortOrder: Number(formData.sortOrder) || 0,
          isActive: formData.isActive,
        };
        if (formData.type === 'SERVICE' && formData.parentId) {
          payload.parentId = formData.parentId;
        }

        const res = await fetch('/api/master-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setShowModal(false);
          setBannerSuccess(`Master data "${formData.label}" created successfully`);
          setTimeout(() => setBannerSuccess(null), 3000);
          fetchItems();
        } else {
          setModalError(data.error?.message || 'Failed to create item');
        }
      }
    } catch (err: any) {
      setModalError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-white p-4 md:p-6 space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242428] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ff3e00]" />
            <h1 className="text-base font-bold text-white tracking-wider uppercase">SYS::CONFIG // MASTER_DATA</h1>
          </div>
          <p className="text-[11px] text-[#88888e] mt-1">
            Centrally manage configurable classifications, service hierarchies, and dropdown items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchItems()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141416] border border-[#242428] hover:border-[#ff3e00] text-[#88888e] hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff3e00] text-black font-semibold hover:bg-[#e03700] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Configuration Item</span>
          </button>
        </div>
      </div>

      {/* Banner */}
      {bannerSuccess && (
        <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#242428] pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 transition-colors border ${
                isActive
                  ? 'bg-[#141416] border-[#ff3e00] text-white font-semibold'
                  : 'bg-[#0e0e11] border-[#242428] text-[#88888e] hover:text-white hover:border-[#38383e]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff3e00]' : 'text-[#88888e]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table Section */}
      <div className="bg-[#141416] border border-[#242428] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0e0e11] border-b border-[#242428] text-[10px] text-[#88888e] uppercase tracking-wider">
                <th className="p-3">Type</th>
                <th className="p-3">Internal Key</th>
                <th className="p-3">Display Label</th>
                {activeTab === 'services' && <th className="p-3">Parent Category</th>}
                <th className="p-3">Sort Order</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242428]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#88888e]">
                    Loading configuration data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#88888e]">
                    No items found for this category. Click "+ Add Configuration Item" to create one.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const parentLabel =
                    typeof item.parentId === 'object' && item.parentId
                      ? (item.parentId as any).label
                      : categories.find((c) => c._id === item.parentId)?.label || '—';

                  return (
                    <tr key={item._id} className="hover:bg-[#1a1a1e] transition-colors">
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 bg-[#242428] text-[#88888e] text-[9px] uppercase tracking-wider rounded-xs">
                          {item.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#ff3e00]">
                        <code>{item.key}</code>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{item.label}</div>
                        {item.description && <div className="text-[10px] text-[#88888e]">{item.description}</div>}
                      </td>
                      {activeTab === 'services' && (
                        <td className="p-3 text-[#a1a1aa]">
                          {item.type === 'SERVICE' ? (
                            <span className="text-[#3b82f6]">{parentLabel}</span>
                          ) : (
                            <span className="text-[#88888e] italic">Root Category</span>
                          )}
                        </td>
                      )}
                      <td className="p-3 text-[#88888e] font-mono">{item.sortOrder}</td>
                      <td className="p-3">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[#10b981] text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#88888e] text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#88888e]" />
                            INACTIVE
                          </span>
                        )}
                        {item.isSystemDefault && (
                          <span className="ml-2 px-1 py-0.2 bg-[#242428] text-[#eab308] text-[8px] uppercase">
                            SYSTEM
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(item)}
                            title={item.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 border transition-colors ${
                              item.isActive
                                ? 'border-[#242428] text-[#88888e] hover:text-[#EF4444] hover:border-[#EF4444]'
                                : 'border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/10'
                            }`}
                          >
                            {item.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Item"
                            className="p-1.5 border border-[#242428] text-[#88888e] hover:text-white hover:border-[#ff3e00] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSystemDefault && (
                            <button
                              onClick={() => handleDelete(item)}
                              title="Delete Item"
                              className="p-1.5 border border-[#242428] text-[#88888e] hover:text-[#EF4444] hover:border-[#EF4444] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 bg-[#141416] border border-[#242428] flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-[#ff3e00] shrink-0 mt-0.5" />
        <div className="space-y-1 text-[#88888e] text-[11px]">
          <span className="font-semibold text-white">Production Safety & Invalidation:</span>
          <p>
            When an item is deactivated, existing database records retain historical references without breakage, while new creation forms will hide inactive options. System default records cannot be hard-deleted to safeguard CRM referential integrity. All updates immediately evict relevant Redis caches.
          </p>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141416] border border-[#242428] w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#242428]">
              <span className="font-bold text-white uppercase tracking-wider">
                {editingItem ? `SYS::EDIT // ${editingItem.key}` : 'SYS::NEW // MASTER_DATA'}
              </span>
              <button onClick={() => setShowModal(false)} className="text-[#88888e] hover:text-white">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Configuration Type *</label>
                <select
                  disabled={!!editingItem}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as MasterDataType })}
                  className="crm-select disabled:opacity-50"
                >
                  {MASTER_DATA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Display Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hostinger Cloud / Website Development"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              {!editingItem && (
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">
                    Internal Key (Immutable Unique ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. hostinger_cloud (auto-generated if blank)"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00] font-mono text-[11px]"
                  />
                </div>
              )}

              {formData.type === 'SERVICE' && (
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Parent Service Category *</label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="crm-select"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.label} ({c.key})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-[#88888e] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief note or classification details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) || 0 })}
                    className="w-full bg-[#0a0a0a] border border-[#242428] px-3.5 py-2 text-white focus:outline-none focus:border-[#ff3e00]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#88888e] mb-1">Active Status</label>
                  <select
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                    className="crm-select"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242428]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#242428] text-[#88888e] hover:text-white hover:border-[#38383e]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#ff3e00] text-black font-semibold hover:bg-[#e03700] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

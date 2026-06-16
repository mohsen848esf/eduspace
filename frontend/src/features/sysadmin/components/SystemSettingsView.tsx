import { useEffect, useState } from "react";
import { sysAdminApi, type SystemConfig } from "../api/sysadmin.api";

export default function SystemSettingsView() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SystemConfig | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({ key: "", value: "", description: "" });
  const [editForm, setEditForm] = useState({ value: "", description: "" });

  const loadConfigs = () => {
    setLoading(true);
    sysAdminApi.getConfigs({ search })
      .then(setConfigs)
      .catch((err) => setError(err.response?.data?.detail || "Failed to load configs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfigs();
  }, [search]);

  // Create Config
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await sysAdminApi.createConfig(createForm);
      setConfigs([created, ...configs]);
      setCreateForm({ key: "", value: "", description: "" });
      setIsCreateOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create configuration");
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (config: SystemConfig) => {
    setSelectedConfig(config);
    setEditForm({ value: config.value, description: config.description });
    setIsEditOpen(true);
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfig) return;
    try {
      const updated = await sysAdminApi.updateConfig(selectedConfig.id, editForm);
      setConfigs(configs.map(c => c.id === selectedConfig.id ? updated : c));
      setIsEditOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update configuration");
    }
  };

  // Delete Config
  const handleDelete = async (config: SystemConfig) => {
    if (!confirm(`Are you sure you want to delete ${config.key}?`)) return;
    try {
      await sysAdminApi.deleteConfig(config.id);
      setConfigs(configs.filter(c => c.id !== config.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete configuration");
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search variables by key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-sm text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none"
          />
          <span className="absolute left-3.5 top-2.5 text-[var(--t3)]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-medium text-sm rounded-lg transition flex items-center gap-1.5"
          >
            <span>+ Add Variable</span>
          </button>
          <button
            onClick={loadConfigs}
            className="px-3.5 py-2 border border-[var(--b)] bg-[var(--s2)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t1)] transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Configurations List */}
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)]" />
          </div>
        ) : error ? (
          <div className="p-4 text-[var(--red)]">{error}</div>
        ) : configs.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)] text-sm">No configurations found</div>
        ) : (
          <div className="divide-y divide-[var(--b)]">
            {configs.map((config) => (
              <div key={config.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--s2)]/30 transition">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs md:text-sm font-bold text-[var(--t1)] bg-[var(--s2)] px-2 py-0.5 border border-[var(--b)] rounded">
                      {config.key}
                    </span>
                    <span className="text-xs text-[var(--t3)]">
                      Updated {new Date(config.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-[var(--t2)] font-medium leading-relaxed">
                    {config.description || "No description provided."}
                  </p>
                </div>
                <div className="flex items-center gap-4 justify-between md:justify-end">
                  <div className="text-right">
                    <div className="text-xs text-[var(--t3)] uppercase font-semibold">Value</div>
                    <div className="font-mono text-sm md:text-md font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] px-3 py-1 rounded border border-[var(--brand)]/10">
                      {config.value}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(config)}
                      className="p-1.5 bg-[var(--s2)] border border-[var(--b)] hover:bg-[var(--s3)] rounded-md text-[var(--t1)] transition"
                      title="Edit Variable"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(config)}
                      className="p-1.5 bg-[var(--red)]/10 border border-[var(--red)]/20 hover:bg-[var(--red)] hover:text-white rounded-md text-[var(--red)] transition"
                      title="Delete Variable"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Config Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-[var(--b)] flex justify-between items-center">
              <h3 className="font-bold text-md text-[var(--t1)]">Register Global Variable</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">✕</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="p-6 space-y-4 text-xs md:text-sm">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Variable Key</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEFAULT_MEETING_DURATION"
                    value={createForm.key}
                    onChange={(e) => setCreateForm({ ...createForm, key: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Variable Value</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 60"
                    value={createForm.value}
                    onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Description</label>
                  <textarea
                    required
                    placeholder="Provide detailed description of the setting purpose..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full h-20 px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-[var(--s2)] border-t border-[var(--b)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-[var(--b)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t2)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-medium text-sm rounded-lg transition"
                >
                  Add Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Config Modal */}
      {isEditOpen && selectedConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-[var(--b)] flex justify-between items-center">
              <h3 className="font-bold text-md text-[var(--t1)]">Update Variable — {selectedConfig.key}</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="p-6 space-y-4 text-xs md:text-sm">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Variable Value</label>
                  <input
                    type="text"
                    required
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Description</label>
                  <textarea
                    required
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full h-20 px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-[var(--s2)] border-t border-[var(--b)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-[var(--b)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t2)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-medium text-sm rounded-lg transition"
                >
                  Save Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

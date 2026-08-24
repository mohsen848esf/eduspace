import { useEffect, useState } from "react";
import { sysAdminApi, type OrganizationAdmin } from "../api/sysadmin.api";

export default function OrganizationsView() {
  const [orgs, setOrgs] = useState<OrganizationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Modals state
  const [selectedOrg, setSelectedOrg] = useState<OrganizationAdmin | null>(null);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form states
  const [quotaForm, setQuotaForm] = useState({
    max_students: 100,
    max_teachers: 10,
    max_courses: 10,
    max_storage_gb: 5.0,
    max_active_sessions: 5,
    max_recording_minutes: 120,
  });
  const [suspensionReason, setSuspensionReason] = useState("");

  const loadOrganizations = () => {
    setLoading(true);
    sysAdminApi.getOrganizations({ search })
      .then(setOrgs)
      .catch((err) => setError(err.response?.data?.detail || "Failed to load organizations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrganizations();
  }, [search]);

  // Open Quota Modal
  const handleOpenQuota = (org: OrganizationAdmin) => {
    setSelectedOrg(org);
    if (org.quota) {
      setQuotaForm({
        max_students: org.quota.max_students ?? 100,
        max_teachers: org.quota.max_teachers ?? 10,
        max_courses: org.quota.max_courses ?? 10,
        max_storage_gb: org.quota.max_storage_gb ?? 5.0,
        max_active_sessions: org.quota.max_active_sessions ?? 5,
        max_recording_minutes: org.quota.max_recording_minutes ?? 120,
      });
    }
    setIsQuotaModalOpen(true);
  };

  // Save Quota
  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      const updated = await sysAdminApi.updateOrganization(selectedOrg.id, {
        quota: quotaForm
      });
      setOrgs(orgs.map(o => o.id === selectedOrg.id ? updated : o));
      setIsQuotaModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update quota");
    }
  };

  // Open Suspend Modal
  const handleOpenSuspend = (org: OrganizationAdmin) => {
    setSelectedOrg(org);
    setSuspensionReason("");
    setIsSuspendModalOpen(true);
  };

  // Execute Suspend
  const handleSuspend = async () => {
    if (!selectedOrg) return;
    try {
      const updated = await sysAdminApi.suspendOrganization(selectedOrg.id, suspensionReason);
      setOrgs(orgs.map(o => o.id === selectedOrg.id ? updated : o));
      setIsSuspendModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to suspend organization");
    }
  };

  // Execute Restore
  const handleRestore = async (org: OrganizationAdmin) => {
    if (!confirm(`Are you sure you want to restore ${org.name}?`)) return;
    try {
      const updated = await sysAdminApi.restoreOrganization(org.id);
      setOrgs(orgs.map(o => o.id === org.id ? updated : o));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to restore organization");
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (org: OrganizationAdmin) => {
    setSelectedOrg(org);
    setIsDetailModalOpen(true);
    // Fetch details to recalculate usage in real-time
    try {
      const detailed = await sysAdminApi.getOrganization(org.id);
      setSelectedOrg(detailed);
      setOrgs(orgs.map(o => o.id === org.id ? detailed : o));
    } catch (err) {}
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-sm text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none"
          />
          <span className="absolute left-3.5 top-2.5 text-[var(--t3)]">
            {/* Search Icon */}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
        </div>
        <button
          onClick={loadOrganizations}
          className="px-4 py-2 border border-[var(--b)] bg-[var(--s2)] text-sm rounded-lg hover:bg-[var(--s3)] transition text-[var(--t1)] flex items-center gap-1.5"
        >
          {/* Refresh Icon */}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>
          Refresh
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)]" />
          </div>
        ) : error ? (
          <div className="p-4 text-[var(--red)]">{error}</div>
        ) : orgs.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)] text-sm">No organizations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] uppercase text-[10px] tracking-wider font-semibold">
                  <th className="px-5 py-4">Name / Slug</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Plan / Type</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b)]">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-[var(--s2)]/40 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {org.logo ? (
                          <img src={org.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center font-bold uppercase">
                            {org.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-[var(--t1)]">{org.name}</div>
                          <div className="text-xs text-[var(--t3)]">{org.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--t2)] font-medium">@{org.owner_username}</td>
                    <td className="px-5 py-3 text-[var(--t3)] uppercase font-semibold text-[10px] tracking-wider">{org.type}</td>
                    <td className="px-5 py-3">
                      {org.is_suspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--red)]/10 text-[var(--red)] font-semibold text-[10px]">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--green)]/10 text-[var(--green)] font-semibold text-[10px]">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetails(org)}
                          className="px-2.5 py-1 text-xs bg-[var(--s2)] border border-[var(--b)] hover:bg-[var(--s3)] text-[var(--t1)] rounded-md transition"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleOpenQuota(org)}
                          className="px-2.5 py-1 text-xs bg-[var(--brand-soft)] hover:bg-[var(--brand)] hover:text-[var(--brand-text)] text-[var(--brand)] rounded-md font-medium transition"
                        >
                          Quota
                        </button>
                        {org.is_suspended ? (
                          <button
                            onClick={() => handleRestore(org)}
                            className="px-2.5 py-1 text-xs bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20 hover:bg-[var(--green)] hover:text-white rounded-md font-semibold transition"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenSuspend(org)}
                            className="px-2.5 py-1 text-xs bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20 hover:bg-[var(--red)] hover:text-white rounded-md font-semibold transition"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quota Modal */}
      {isQuotaModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-[var(--b)] flex justify-between items-center">
              <h3 className="font-bold text-md text-[var(--t1)]">Edit Quota Limits — {selectedOrg.name}</h3>
              <button onClick={() => setIsQuotaModalOpen(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">✕</button>
            </div>
            <form onSubmit={handleSaveQuota}>
              <div className="p-6 space-y-4 text-xs md:text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Students</label>
                    <input
                      type="number"
                      required
                      value={quotaForm.max_students}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_students: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Teachers / Admins</label>
                    <input
                      type="number"
                      required
                      value={quotaForm.max_teachers}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_teachers: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Courses</label>
                    <input
                      type="number"
                      required
                      value={quotaForm.max_courses}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_courses: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Storage (GB)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={quotaForm.max_storage_gb}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_storage_gb: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Active Sessions</label>
                    <input
                      type="number"
                      required
                      value={quotaForm.max_active_sessions}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_active_sessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Max Recording Minutes</label>
                    <input
                      type="number"
                      required
                      value={quotaForm.max_recording_minutes}
                      onChange={(e) => setQuotaForm({ ...quotaForm, max_recording_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] focus:border-[var(--brand)] outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[var(--s2)] border-t border-[var(--b)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="px-4 py-2 border border-[var(--b)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t2)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-h)] text-[var(--brand-text)] font-medium text-sm rounded-lg transition"
                >
                  Save Limits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {isSuspendModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-[var(--b)] flex justify-between items-center">
              <h3 className="font-bold text-md text-[var(--t1)]">Suspend Organization</h3>
              <button onClick={() => setIsSuspendModalOpen(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs md:text-sm">
              <p className="text-[var(--t2)]">
                You are about to suspend <strong>{selectedOrg.name}</strong>. All active user sessions of this tenant will be terminated, and login will be blocked.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--t3)] uppercase">Reason for Suspension</label>
                <textarea
                  placeholder="Specify violation or unpaid fees..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full h-24 px-3.5 py-2 bg-[var(--s2)] border border-[var(--b)] rounded-lg text-[var(--t1)] placeholder-[var(--t3)] focus:border-[var(--brand)] outline-none resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-[var(--s2)] border-t border-[var(--b)] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsSuspendModalOpen(false)}
                className="px-4 py-2 border border-[var(--b)] text-sm rounded-lg hover:bg-[var(--s3)] text-[var(--t2)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSuspend}
                disabled={!suspensionReason.trim()}
                className="px-4 py-2 bg-[var(--red)] disabled:opacity-50 hover:bg-[var(--red)]/95 text-white font-medium text-sm rounded-lg transition"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-[var(--b)] flex justify-between items-center">
              <h3 className="font-bold text-md text-[var(--t1)]">Organization Governance Overview</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">✕</button>
            </div>
            <div className="p-6 space-y-6 text-xs md:text-sm max-h-[70vh] overflow-y-auto">
              {/* Org Main Info */}
              <div className="flex gap-4 items-start bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
                {selectedOrg.logo ? (
                  <img src={selectedOrg.logo} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center font-extrabold text-2xl uppercase">
                    {selectedOrg.name.charAt(0)}
                  </div>
                )}
                <div className="space-y-1">
                  <h4 className="font-bold text-lg text-[var(--t1)]">{selectedOrg.name}</h4>
                  <p className="text-[var(--t2)]">Slug: <span className="font-semibold">{selectedOrg.slug}</span></p>
                  <p className="text-xs text-[var(--t3)]">Created on {new Date(selectedOrg.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Suspension Details */}
              {selectedOrg.is_suspended && (
                <div className="p-4 bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] rounded-xl space-y-1">
                  <h5 className="font-bold text-[var(--red)] uppercase text-[10px] tracking-wide">Suspension Record</h5>
                  <p className="font-medium text-xs">Suspended at: {selectedOrg.suspended_at ? new Date(selectedOrg.suspended_at).toLocaleString() : "N/A"}</p>
                  <p className="text-xs italic">" {selectedOrg.suspension_reason || "No reason specified" } "</p>
                </div>
              )}

              {/* Usage vs Quota Limit bar charts */}
              {selectedOrg.quota && selectedOrg.usage ? (
                <div className="space-y-4">
                  <h5 className="font-bold text-[var(--t1)] text-sm border-b border-[var(--b)] pb-2">Active Limit Utilization</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Students Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Students Enrolled</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.students_count} / {selectedOrg.quota.max_students ?? 100}</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.students_count / (selectedOrg.quota.max_students ?? 100)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Teachers Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Teachers & Admins</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.teachers_count} / {selectedOrg.quota.max_teachers ?? 10}</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.teachers_count / (selectedOrg.quota.max_teachers ?? 10)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Courses Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Active Courses</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.courses_count} / {selectedOrg.quota.max_courses ?? 10}</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.courses_count / (selectedOrg.quota.max_courses ?? 10)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Storage Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Storage Used</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.storage_used_gb} / {selectedOrg.quota.max_storage_gb ?? 5.0} GB</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.storage_used_gb / (selectedOrg.quota.max_storage_gb ?? 5.0)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Sessions Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Active Sessions</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.active_sessions_count} / {selectedOrg.quota.max_active_sessions ?? 5}</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.active_sessions_count / (selectedOrg.quota.max_active_sessions ?? 5)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Recording Minutes Usage */}
                    <div className="space-y-1.5 p-3.5 bg-[var(--s2)] rounded-lg border border-[var(--b)]">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--t2)]">Recording Minutes</span>
                        <span className="text-[var(--t1)]">{selectedOrg.usage.recording_minutes_used} / {selectedOrg.quota.max_recording_minutes ?? 120}</span>
                      </div>
                      <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${Math.min(100, (selectedOrg.usage.recording_minutes_used / (selectedOrg.quota.max_recording_minutes ?? 120)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[var(--s2)] text-center text-[var(--t3)] rounded-lg">
                  Loading usage details...
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-[var(--s2)] border-t border-[var(--b)] flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-h)] text-[var(--brand-text)] font-medium text-sm rounded-lg transition"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

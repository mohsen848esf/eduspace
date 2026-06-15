import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { authApi, type OrganizationDetail, type OrgMember, type Role } from "../../auth/api/auth.api";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";

export default function OrgSettingsPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();
  const { hasPermission } = useOrgPermission();

  const canManageMembers = hasPermission("can_manage_members");

  const [activeTab, setActiveTab] = useState<"details" | "members" | "audit_logs">("details");

  // Edit organization details state
  const [orgName, setOrgName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invite member form state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteUser, setInviteUser] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<number | null>(null);
  const [inviteContract, setInviteContract] = useState("full_time");
  const [inviteExpires, setInviteExpires] = useState("");

  // Audit Logs state
  const [selectedActor, setSelectedActor] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [logsPage, setLogsPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Queries
  const { data: orgs, isLoading: loadingOrgs } = useQuery<OrganizationDetail[]>({
    queryKey: ["activeOrganization"],
    queryFn: authApi.getOrganizations,
  });

  const activeOrg = orgs?.[0];

  const { data: members = [], isLoading: loadingMembers } = useQuery<OrgMember[]>({
    queryKey: ["orgMembers"],
    queryFn: authApi.getMembers,
    enabled: activeTab === "members",
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["orgRoles"],
    queryFn: authApi.getRoles,
    enabled: isInviteOpen,
  });

  // Audit Log queries
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ["orgAuditLogs", logsPage, selectedActor, selectedAction, selectedEntity],
    queryFn: () => authApi.getAuditLogs({
      page: logsPage,
      actor_id: selectedActor || undefined,
      action: selectedAction || undefined,
      entity_type: selectedEntity || undefined,
    }),
    enabled: activeTab === "audit_logs",
  });

  const { data: filterMeta } = useQuery({
    queryKey: ["orgAuditLogFilters"],
    queryFn: authApi.getAuditLogFilters,
    enabled: activeTab === "audit_logs",
  });

  // Sync state with query result
  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg]);

  // Set default role when roles load
  useEffect(() => {
    if (roles.length > 0 && !inviteRoleId) {
      // Find 'Student' or fallback to first role
      const student = roles.find(r => r.name.toLowerCase().includes("student"));
      setInviteRoleId(student ? student.id : roles[0].id);
    }
  }, [roles, inviteRoleId]);

  // Mutations
  const updateOrgMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData | Partial<OrganizationDetail> }) => 
      authApi.updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      toast.success(isFarsi ? "تغییرات سازمان با موفقیت ذخیره شد" : "Organization settings saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ذخیره تغییرات" : "Failed to update organization"));
    }
  });

  const inviteMemberMutation = useMutation({
    mutationFn: authApi.inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      toast.success(isFarsi ? "عضو جدید با موفقیت دعوت شد" : "Member invited successfully");
      setIsInviteOpen(false);
      // Reset form
      setInviteUser("");
      setInviteExpires("");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const fieldError = err.response?.data?.non_field_errors?.[0];
      toast.error(detail || fieldError || (isFarsi ? "خطا در ارسال دعوت‌نامه" : "Failed to invite member"));
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OrgMember> }) => 
      authApi.updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      toast.success(isFarsi ? "عضو با موفقیت ویرایش شد" : "Member updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش عضو" : "Failed to update member"));
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: authApi.removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      toast.success(isFarsi ? "عضو با موفقیت حذف شد" : "Member removed successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف عضو" : "Failed to remove member"));
    }
  });

  // Form Handlers
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !orgName.trim()) return;
    updateOrgMutation.mutate({ id: activeOrg.id, data: { name: orgName } });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeOrg) {
      const formData = new FormData();
      formData.append("logo", file);
      updateOrgMutation.mutate({ id: activeOrg.id, data: formData });
    }
  };

  const triggerFileInput = () => {
    if (canManageMembers) {
      fileInputRef.current?.click();
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUser.trim() || !inviteRoleId) {
      toast.error(isFarsi ? "لطفاً اطلاعات را به طور کامل وارد کنید" : "Please fill in all required fields");
      return;
    }
    const isEmail = inviteUser.includes("@");
    inviteMemberMutation.mutate({
      username: isEmail ? undefined : inviteUser,
      email: isEmail ? inviteUser : undefined,
      role: inviteRoleId,
      contract_type: inviteContract,
      expires_at: inviteExpires || null,
    });
  };

  const toggleMemberActive = (member: OrgMember) => {
    if (!canManageMembers) return;
    updateMemberMutation.mutate({
      id: member.id,
      data: { is_active: !member.is_active }
    });
  };

  const handleRemoveMember = (memberId: number) => {
    if (!canManageMembers) return;
    if (window.confirm(isFarsi ? "آیا از حذف این عضو اطمینان دارید؟" : "Are you sure you want to remove this member?")) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const getContractTypeLabel = (type: string) => {
    const map: Record<string, string> = isFarsi ? {
      full_time: "تمام وقت",
      part_time: "پاره وقت",
      contractor: "پیمانکار",
      guest: "مهمان",
    } : {
      full_time: "Full Time",
      part_time: "Part Time",
      contractor: "Contractor",
      guest: "Guest",
    };
    return map[type] || type;
  };

  const getRoleBadgeStyle = (roleName: string) => {
    const name = (roleName || "").toLowerCase();
    if (name.includes("admin")) {
      return { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" };
    }
    if (name.includes("teacher")) {
      return { backgroundColor: "rgba(14, 165, 233, 0.1)", color: "#0ea5e9", border: "1px solid rgba(14, 165, 233, 0.2)" };
    }
    return { backgroundColor: "var(--s3)", color: "var(--t2)", border: "1px solid var(--b)" };
  };

  const renderStateChanges = (before: Record<string, any> | null, after: Record<string, any> | null) => {
    if (!before && !after) return <div className="text-xs text-[var(--t3)]">{isFarsi ? "اطلاعاتی ثبت نشده است" : "No state recorded"}</div>;
    
    if (!before && after) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] bg-[var(--s3)] p-4 rounded-xl border border-[var(--b)] font-mono text-[var(--t2)] max-h-60 overflow-y-auto">
          {Object.entries(after).map(([key, val]) => (
            <div key={key} className="flex justify-between border-b border-[var(--b)] pb-1.5">
              <span className="text-[var(--t3)] font-semibold">{key}:</span>
              <span className="text-[var(--green)] truncate max-w-[200px]" title={JSON.stringify(val)}>{JSON.stringify(val)}</span>
            </div>
          ))}
        </div>
      );
    }
    
    if (before && !after) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] bg-[var(--s3)] p-4 rounded-xl border border-[var(--b)] font-mono text-[var(--t2)] max-h-60 overflow-y-auto">
          {Object.entries(before).map(([key, val]) => (
            <div key={key} className="flex justify-between border-b border-[var(--b)] pb-1.5">
              <span className="text-[var(--t3)] font-semibold">{key}:</span>
              <span className="text-[var(--red)] line-through truncate max-w-[200px]" title={JSON.stringify(val)}>{JSON.stringify(val)}</span>
            </div>
          ))}
        </div>
      );
    }
    
    const allKeys = Array.from(new Set([...Object.keys(before!), ...Object.keys(after!)]));
    const changedKeys = allKeys.filter(k => JSON.stringify(before![k]) !== JSON.stringify(after![k]));
    
    if (changedKeys.length === 0) {
      return <div className="text-xs text-[var(--t3)]">{isFarsi ? "تغییراتی در فیلدها ثبت نشده است" : "No field differences recorded"}</div>;
    }
    
    return (
      <div className="flex flex-col gap-2.5 bg-[var(--s3)] p-4 rounded-xl border border-[var(--b)] text-[11px] font-mono text-[var(--t2)] max-h-60 overflow-y-auto">
        {changedKeys.map(key => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--b)] pb-2">
            <span className="text-[var(--t3)] font-semibold min-w-32">{key}:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[var(--red)]/10 text-[var(--red)] line-through max-w-[180px] truncate" title={JSON.stringify(before![key])}>
                {JSON.stringify(before![key])}
              </span>
              <span>➡️</span>
              <span className="px-2 py-0.5 rounded bg-[var(--green)]/10 text-[var(--green)] max-w-[180px] truncate" title={JSON.stringify(after![key])}>
                {JSON.stringify(after![key])}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loadingOrgs) {
    return (
      <AppShell title={isFarsi ? "تنظیمات سازمان" : "Organization Settings"}>
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isFarsi ? "تنظیمات سازمان" : "Organization Settings"}>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        
        {/* Tabs navigation */}
        <div className="flex border-b border-[var(--b)] gap-6">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 ${
              activeTab === "details"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "جزئیات سازمان" : "Organization Details"}
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 ${
              activeTab === "members"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "اعضا و پرسنل" : "Members & Staff"}
          </button>
          <button
            onClick={() => {
              setActiveTab("audit_logs");
              setLogsPage(1);
            }}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 ${
              activeTab === "audit_logs"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "سوابق فعالیت‌ها" : "Audit Logs"}
          </button>
        </div>

        {/* Tab content 1: Details */}
        {activeTab === "details" && activeOrg && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-8 animate-in fade-in duration-150">
            <h2 className="text-base font-bold text-[var(--t1)]">
              {isFarsi ? "پروفایل آکادمی" : "Academy Profile"}
            </h2>

            {/* Logo Section */}
            <div className="flex items-center gap-5">
              <div
                onClick={triggerFileInput}
                className={`relative w-20 h-20 rounded-2xl border border-[var(--b)] flex items-center justify-center bg-[var(--s3)] overflow-hidden group transition-all duration-200 ${
                  canManageMembers ? "cursor-pointer hover:border-[var(--brand-text)]" : ""
                }`}
              >
                {activeOrg.logo ? (
                  <img src={activeOrg.logo} alt="Org Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">🏢</span>
                )}
                {canManageMembers && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <span className="text-[10px] text-white font-bold tracking-wide uppercase">
                      {isFarsi ? "تغییر" : "Change"}
                    </span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoChange}
                className="hidden"
                accept="image/*"
              />
              <div>
                <h3 className="text-xs font-semibold text-[var(--t1)]">
                  {isFarsi ? "لوگوی سازمان" : "Organization Logo"}
                </h3>
                <p className="text-[11px] text-[var(--t3)] mt-1.5 leading-relaxed">
                  {isFarsi 
                    ? "یک تصویر مربع با پسوند PNG یا JPG انتخاب کنید." 
                    : "Select a square image in PNG or JPG format."}
                </p>
              </div>
            </div>

            {/* Form Details */}
            <form onSubmit={handleSaveDetails} className="flex flex-col gap-5 max-w-lg">
              <Input
                label={isFarsi ? "نام آکادمی" : "Academy Name"}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManageMembers}
                required
              />

              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    label={isFarsi ? "شناسه (Slug)" : "Slug"}
                    value={activeOrg.slug}
                    disabled
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label={isFarsi ? "نوع سازمان" : "Organization Type"}
                    value={activeOrg.type === "personal" ? (isFarsi ? "شخصی" : "Personal") : (isFarsi ? "مجموعه" : "Organization")}
                    disabled
                  />
                </div>
              </div>

              {canManageMembers && (
                <div className="mt-2 flex justify-end">
                  <Button type="submit" disabled={updateOrgMutation.isPending}>
                    {updateOrgMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ذخیره تغییرات" : "Save Changes")}
                  </Button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab content 2: Members */}
        {activeTab === "members" && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--t1)]">
                  {isFarsi ? "مدیریت اعضا" : "Member Management"}
                </h2>
                <p className="text-xs text-[var(--t3)] mt-1">
                  {isFarsi ? "لیست کامل همکاران و اساتید آکادمی" : "Full list of staff, teachers, and students in this organization."}
                </p>
              </div>
              {canManageMembers && (
                <Button onClick={() => setIsInviteOpen(true)} size="sm">
                  {isFarsi ? "دعوت عضو جدید" : "Invite Member"}
                </Button>
              )}
            </div>

            {loadingMembers ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[var(--b)] rounded-2xl">
                <span className="text-4xl block mb-2">👥</span>
                <h3 className="text-sm font-semibold text-[var(--t1)]">
                  {isFarsi ? "عضوی یافت نشد" : "No members found"}
                </h3>
                <p className="text-xs text-[var(--t3)] mt-1">
                  {isFarsi ? "کاربری در این سازمان ثبت نشده است." : "There are no members in this organization yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold">
                      <th className="py-3 px-2 text-start">{isFarsi ? "نام عضو" : "Member"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "نقش" : "Role"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "نوع قرارداد" : "Contract Type"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "تاریخ عضویت" : "Joined At"}</th>
                      <th className="py-3 px-2 text-center">{isFarsi ? "وضعیت" : "Status"}</th>
                      {canManageMembers && <th className="py-3 px-2 text-end">{isFarsi ? "عملیات" : "Actions"}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-[var(--b)]/60 text-[var(--t2)] hover:bg-[var(--s3)]/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                              {member.user_details?.avatar ? (
                                <img src={member.user_details.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(member.user_details?.full_name || member.user_details?.username || "?").charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[var(--t1)] truncate">
                                {member.user_details?.full_name || member.user_details?.username}
                              </span>
                              <span className="text-[10px] text-[var(--t3)] truncate mt-0.5">
                                {member.user_details?.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={getRoleBadgeStyle(member.role_name || "")}
                          >
                            {member.role_name || (isFarsi ? "بدون نقش" : "No Role")}
                          </span>
                        </td>
                        <td className="py-3 px-2">{getContractTypeLabel(member.contract_type)}</td>
                        <td className="py-3 px-2 text-[var(--t3)]">
                          {new Date(member.joined_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleMemberActive(member)}
                            disabled={!canManageMembers || updateMemberMutation.isPending}
                            className={`w-10 h-5 rounded-full p-0.5 border-none cursor-pointer transition-colors relative flex items-center ${
                              member.is_active ? "bg-[var(--brand-text)]" : "bg-[var(--s3)] border border-[var(--b)]"
                            } ${!canManageMembers ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <span 
                              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 absolute ${
                                member.is_active ? (isFarsi ? "translate-x-1" : "translate-x-5") : (isFarsi ? "translate-x-5" : "translate-x-0")
                              }`}
                            />
                          </button>
                        </td>
                        {canManageMembers && (
                          <td className="py-3 px-2 text-end">
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="w-7 h-7 rounded-lg bg-transparent border-none text-[var(--t3)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] cursor-pointer flex items-center justify-center transition-all"
                              title={isFarsi ? "حذف عضو" : "Remove member"}
                            >
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab content 3: Audit Logs */}
        {activeTab === "audit_logs" && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--t1)]">
                  {isFarsi ? "سوابق فعالیت‌های سیستم" : "System Audit Logs"}
                </h2>
                <p className="text-xs text-[var(--t3)] mt-1">
                  {isFarsi ? "ردیابی تمام تغییرات و عملیات‌های امنیتی آکادمی" : "Track all changes, updates, and configuration actions in the organization."}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[var(--s3)]/30 p-4 rounded-xl border border-[var(--b)]/60 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[var(--t2)]">{isFarsi ? "کاربر عامل" : "Actor"}</label>
                <select
                  value={selectedActor}
                  onChange={(e) => { setSelectedActor(e.target.value); setLogsPage(1); }}
                  className="h-9 px-3 rounded-lg bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                >
                  <option value="">{isFarsi ? "همه کاربران" : "All Users"}</option>
                  {filterMeta?.actors?.map((actor) => (
                    <option key={actor.actor_id} value={actor.actor_id}>
                      {actor.actor__full_name || actor.actor__username} (@{actor.actor__username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[var(--t2)]">{isFarsi ? "نوع عملیات" : "Action"}</label>
                <select
                  value={selectedAction}
                  onChange={(e) => { setSelectedAction(e.target.value); setLogsPage(1); }}
                  className="h-9 px-3 rounded-lg bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                >
                  <option value="">{isFarsi ? "همه عملیات‌ها" : "All Actions"}</option>
                  {filterMeta?.actions?.map((act) => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[var(--t2)]">{isFarsi ? "نوع داده" : "Entity Type"}</label>
                <select
                  value={selectedEntity}
                  onChange={(e) => { setSelectedEntity(e.target.value); setLogsPage(1); }}
                  className="h-9 px-3 rounded-lg bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                >
                  <option value="">{isFarsi ? "همه موجودیت‌ها" : "All Entities"}</option>
                  {filterMeta?.entities?.map((ent) => (
                    <option key={ent} value={ent}>{ent}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingLogs ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner />
              </div>
            ) : !logsData || logsData.results.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[var(--b)] rounded-2xl">
                <span className="text-4xl block mb-2">📜</span>
                <h3 className="text-sm font-semibold text-[var(--t1)]">
                  {isFarsi ? "سابقه‌ای یافت نشد" : "No logs found"}
                </h3>
                <p className="text-xs text-[var(--t3)] mt-1">
                  {isFarsi ? "هیچ فعالیت منطبقی در این سازمان ثبت نشده است." : "No matching system audit records were found."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold">
                        <th className="py-3 px-2 text-start">{isFarsi ? "کاربر" : "Actor"}</th>
                        <th className="py-3 px-2 text-start">{isFarsi ? "عملیات" : "Action"}</th>
                        <th className="py-3 px-2 text-start">{isFarsi ? "موجودیت" : "Target"}</th>
                        <th className="py-3 px-2 text-start">{isFarsi ? "آدرس IP" : "IP Address"}</th>
                        <th className="py-3 px-2 text-start">{isFarsi ? "تاریخ و زمان" : "Timestamp"}</th>
                        <th className="py-3 px-2 text-end"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsData.results.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <>
                            <tr
                              key={log.id}
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="border-b border-[var(--b)]/60 text-[var(--t2)] hover:bg-[var(--s3)]/30 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-2 font-semibold">
                                {log.actor_name ? `${log.actor_name} (@${log.actor_username})` : (isFarsi ? "سیستم" : "System")}
                              </td>
                              <td className="py-3 px-2">
                                <span className="px-2 py-0.5 rounded bg-[var(--s3)] border border-[var(--b)] font-mono text-[10px]">
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                {log.entity_type} (ID: {log.entity_id})
                              </td>
                              <td className="py-3 px-2 text-[var(--t3)] font-mono">
                                {log.ip_address || "-"}
                              </td>
                              <td className="py-3 px-2 text-[var(--t3)]">
                                {new Date(log.created_at).toLocaleString(isFarsi ? "fa-IR" : "en-US")}
                              </td>
                              <td className="py-3 px-2 text-end text-[var(--t3)]">
                                {isExpanded ? "▲" : "▼"}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[var(--s3)]/10">
                                <td colSpan={6} className="py-4 px-6 border-b border-[var(--b)]/60">
                                  <div className="flex flex-col gap-3">
                                    <div className="text-[10px] font-semibold text-[var(--t3)] tracking-wide uppercase">
                                      {isFarsi ? "تغییرات داده‌ها (قبل ➡️ بعد)" : "Data Changes (Before ➡️ After)"}
                                    </div>
                                    {renderStateChanges(log.before_state, log.after_state)}
                                    {log.user_agent && (
                                      <div className="text-[10px] text-[var(--t3)] mt-2 font-mono truncate max-w-4xl" title={log.user_agent}>
                                        <strong>User Agent:</strong> {log.user_agent}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-2 text-xs">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                    disabled={logsPage === 1}
                  >
                    {isFarsi ? "قبلی" : "Previous"}
                  </Button>
                  <span className="text-[var(--t3)]">
                    {isFarsi ? `صفحه ${logsPage} از ${Math.ceil(logsData.count / 15)}` : `Page ${logsPage} of ${Math.ceil(logsData.count / 15)}`}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setLogsPage(prev => prev + 1)}
                    disabled={logsPage * 15 >= logsData.count}
                  >
                    {isFarsi ? "بعدی" : "Next"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invite Dialog */}
        <Modal open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <form onSubmit={handleInviteSubmit}>
            <ModalHeader>
              <ModalTitle>
                {isFarsi ? "دعوت عضو جدید" : "Invite New Member"}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Input
                  label={isFarsi ? "نام کاربری یا ایمیل" : "Username or Email"}
                  placeholder={isFarsi ? "مثال: ali_teacher" : "e.g. teacher_john or teacher@example.com"}
                  value={inviteUser}
                  onChange={(e) => setInviteUser(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    {isFarsi ? "نقش" : "Role"}
                  </label>
                  <select
                    value={inviteRoleId || ""}
                    onChange={(e) => setInviteRoleId(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                    required
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    {isFarsi ? "نوع قرارداد" : "Contract Type"}
                  </label>
                  <select
                    value={inviteContract}
                    onChange={(e) => setInviteContract(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                  >
                    <option value="full_time">{isFarsi ? "تمام وقت (Full Time)" : "Full Time"}</option>
                    <option value="part_time">{isFarsi ? "پاره وقت (Part Time)" : "Part Time"}</option>
                    <option value="contractor">{isFarsi ? "پیمانکار (Contractor)" : "Contractor"}</option>
                    <option value="guest">{isFarsi ? "مهمان (Guest)" : "Guest"}</option>
                  </select>
                </div>

                <Input
                  label={isFarsi ? "تاریخ انقضای عضویت (اختیاری)" : "Expiration Date (Optional)"}
                  type="date"
                  value={inviteExpires}
                  onChange={(e) => setInviteExpires(e.target.value)}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setIsInviteOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={inviteMemberMutation.isPending}>
                {inviteMemberMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ارسال دعوت" : "Send Invite")}
              </Button>
            </ModalFooter>
          </form>
        </Modal>

      </div>
    </AppShell>
  );
}

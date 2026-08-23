import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { authApi, type OrganizationDetail, type OrgMember, type Role, type UserSession, type SystemPermission } from "../../auth/api/auth.api";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { DatePicker } from "../../../components/forms/DatePicker";
import { ImageUpload } from "../../../components/forms/ImageUpload";
import { useOrgContextStore } from "../../auth/store/orgContextStore";

import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import { Switch } from "../../../components/ui";
import ReportsExportWidget from "./ReportsExportWidget";
import OrgAppearanceSettings from "../../organization/components/OrgAppearanceSettings";

const parseUA = (ua: string) => {
  if (!ua) return "Unknown Device";
  const userAgent = ua.toLowerCase();

  let browser = "Browser";
  if (userAgent.includes("firefox")) browser = "Firefox";
  else if (userAgent.includes("chrome") && !userAgent.includes("chromium")) browser = "Chrome";
  else if (userAgent.includes("safari") && !userAgent.includes("chrome")) browser = "Safari";
  else if (userAgent.includes("edge") || userAgent.includes("edg")) browser = "Edge";
  else if (userAgent.includes("opera") || userAgent.includes("opr")) browser = "Opera";

  let os = "OS";
  if (userAgent.includes("windows")) os = "Windows";
  else if (userAgent.includes("macintosh") || userAgent.includes("mac os")) os = "macOS";
  else if (userAgent.includes("linux")) os = "Linux";
  else if (userAgent.includes("android")) os = "Android";
  else if (userAgent.includes("iphone") || userAgent.includes("ipad")) os = "iOS";

  return `${browser} on ${os}`;
};

const getFarsiPermName = (codename: string, fallback: string) => {
  const map: Record<string, string> = {
    can_view_dashboard: "مشاهده داشبورد",
    can_attend_class: "حضور در کلاس",
    can_teach_class: "تدریس کلاس",
    can_manage_members: "مدیریت اعضا و پرسنل",
    can_view_financials: "مشاهده گزارشات مالی",
    can_manage_financials: "مدیریت امور مالی",
    can_control_recordings: "مدیریت ضبط کلاس",
    can_view_sessions: "مشاهده جلسات",
    can_manage_sessions: "مدیریت جلسات",
    can_view_attendance: "مشاهده حضور و غیاب",
    can_manage_attendance: "مدیریت حضور و غیاب",
  };
  return map[codename] || fallback;
};

const getFarsiPermDesc = (codename: string, fallback: string) => {
  const map: Record<string, string> = {
    can_view_dashboard: "دسترسی به داشبورد و آمارهای عمومی",
    can_attend_class: "شرکت در جلسات زنده به عنوان دانش‌آموز",
    can_teach_class: "برگزاری کلاس‌های زنده و تدریس دروس",
    can_manage_members: "افزودن، ویرایش یا حذف دانش‌آموزان و دبیران",
    can_view_financials: "مشاهده صورت‌حساب‌ها و گزارشات درآمد و هزینه",
    can_manage_financials: "صدور فاکتور شهریه، تایید هزینه‌ها و پرداخت‌ها",
    can_control_recordings: "شروع، توقف یا مکث در ضبط کلاس‌های آنلاین",
    can_view_sessions: "مشاهده لیست جلسات و کلاس‌های برگزار شده",
    can_manage_sessions: "برنامه‌ریزی، ایجاد، ویرایش و حذف جلسات درسی",
    can_view_attendance: "مشاهده گزارش وضعیت حضور دانش‌آموزان",
    can_manage_attendance: "ثبت یا تغییر وضعیت حضور و غیاب دانش‌آموزان",
  };
  return map[codename] || fallback;
};

export default function OrgSettingsPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();
  const { hasPermission } = useOrgPermission();

  const canManageMembers = hasPermission("can_manage_members");

  const [activeTab, setActiveTab] = useState<"appearance" | "details" | "members" | "connections" | "roles" | "audit_logs" | "reports">("appearance");

  // Edit organization details state
  const [orgName, setOrgName] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  // Invite member form state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteUser, setInviteUser] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<number | null>(null);
  const [inviteContract, setInviteContract] = useState("full_time");
  const [inviteExpires, setInviteExpires] = useState("");

  // Create member form state (Separate Modal)
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [createMemberForm, setCreateMemberForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role: "" as string,
    contract_type: "full_time" as string,
    expires_at: "",
  });

  // Role change states for member directory tab
  const [isRoleChangeOpen, setIsRoleChangeOpen] = useState(false);
  const [selectedMemberForRoleChange, setSelectedMemberForRoleChange] = useState<OrgMember | null>(null);
  const [newRoleId, setNewRoleId] = useState<string>("");

  // Custom role creation state
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);

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
  console.log('activeOrg', activeOrg)
  const { data: members = [], isLoading: loadingMembers } = useQuery<OrgMember[]>({
    queryKey: ["orgMembers"],
    queryFn: authApi.getMembers,
    enabled: activeTab === "members",
  });

  const { data: roles = [], isLoading: loadingRoles } = useQuery<Role[]>({
    queryKey: ["orgRoles"],
    queryFn: authApi.getRoles,
    enabled: activeTab === "roles" || activeTab === "members" || isInviteOpen || isRoleChangeOpen || isCreateMemberOpen,
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery<UserSession[]>({
    queryKey: ["orgSessions"],
    queryFn: authApi.getSessions,
    enabled: activeTab === "connections",
  });

  const { data: systemPermissions = [], isLoading: loadingPermissions } = useQuery<SystemPermission[]>({
    queryKey: ["systemPermissions"],
    queryFn: authApi.getPermissions,
    enabled: activeTab === "roles",
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
      setApprovalRequired(!!activeOrg.approval_required_to_join);
      setLogoPreview(activeOrg.logo || null);
      setLogoFile(null);
    }
  }, [activeOrg]);

  // Set default role when roles load
  useEffect(() => {
    if (roles.length > 0 && !inviteRoleId) {
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
      if (activeOrg?.slug) {
        useOrgContextStore.getState().fetchOrgContext(activeOrg.slug);
      }
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
      setInviteUser("");
      setInviteExpires("");
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const fieldError = err.response?.data?.non_field_errors?.[0];
      toast.error(detail || fieldError || (isFarsi ? "خطا در ارسال دعوت‌نامه" : "Failed to invite member"));
    }
  });

  const createMemberMutation = useMutation({
    mutationFn: authApi.inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      toast.success(isFarsi ? "عضو جدید با موفقیت ایجاد شد" : "Member created successfully");
      setIsCreateMemberOpen(false);
      setCreateMemberForm({
        username: "",
        email: "",
        password: "",
        full_name: "",
        role: roles.length > 0 ? (roles.find(r => r.name.toLowerCase().includes("student"))?.id?.toString() || roles[0].id.toString()) : "",
        contract_type: "full_time",
        expires_at: "",
      });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const fieldError = err.response?.data?.non_field_errors?.[0];
      const errorMsg = err.response?.data?.[0];
      toast.error(detail || fieldError || errorMsg || (isFarsi ? "خطا در ایجاد عضو جدید" : "Failed to create member"));
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

  const revokeSessionMutation = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgSessions"] });
      toast.success(isFarsi ? "اتصال با موفقیت خاتمه یافت" : "Session revoked successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در لغو اتصال" : "Failed to revoke session"));
    }
  });

  const createRoleMutation = useMutation({
    mutationFn: authApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgRoles"] });
      toast.success(isFarsi ? "نقش با موفقیت ایجاد شد" : "Role created successfully");
      setIsCreateRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setNewRolePerms([]);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ایجاد نقش" : "Failed to create role"));
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; permissions?: string[] } }) =>
      authApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgRoles"] });
      toast.success(isFarsi ? "نقش با موفقیت بروزرسانی شد" : "Role updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در بروزرسانی نقش" : "Failed to update role"));
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: authApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgRoles"] });
      toast.success(isFarsi ? "نقش با موفقیت حذف شد" : "Role deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف نقش" : "Failed to delete role"));
    }
  });

  // Handlers
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !orgName.trim()) return;

    const formData = new FormData();
    formData.append("name", orgName);
    formData.append("approval_required_to_join", String(approvalRequired));
    if (logoFile) {
      formData.append("logo", logoFile);
    }

    updateOrgMutation.mutate({
      id: activeOrg.id,
      data: formData
    });
  };

  const handleCopyLink = () => {
    if (!activeOrg) return;
    const link = `${window.location.origin}/join/${activeOrg.invite_code || activeOrg.slug}`;
    navigator.clipboard.writeText(link);
    toast.success(isFarsi ? "لینک دعوت کپی شد" : "Invitation link copied!");
  };

  const handleCopyCode = () => {
    if (!activeOrg) return;
    navigator.clipboard.writeText(activeOrg.invite_code || activeOrg.slug);
    toast.success(isFarsi ? "کد دعوت کپی شد" : "Invitation code copied!");
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

  const handleCreateMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createMemberForm.username.trim() || !createMemberForm.password.trim() || !createMemberForm.role) {
      toast.error(isFarsi ? "نام کاربری، رمز عبور و نقش الزامی هستند" : "Username, Password and Role are required");
      return;
    }
    createMemberMutation.mutate({
      username: createMemberForm.username,
      email: createMemberForm.email || undefined,
      password: createMemberForm.password,
      full_name: createMemberForm.full_name || undefined,
      role: parseInt(createMemberForm.role),
      contract_type: createMemberForm.contract_type,
      expires_at: createMemberForm.expires_at || null,
    });
  };

  const handleRoleChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForRoleChange) return;
    updateMemberMutation.mutate({
      id: selectedMemberForRoleChange.id,
      data: { role: newRoleId ? parseInt(newRoleId) : null } as any,
    }, {
      onSuccess: () => {
        setIsRoleChangeOpen(false);
        setSelectedMemberForRoleChange(null);
        setNewRoleId("");
      }
    });
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error(isFarsi ? "لطفاً نام نقش را وارد کنید" : "Please enter a role name");
      return;
    }
    createRoleMutation.mutate({
      name: newRoleName,
      description: newRoleDesc,
      permissions: newRolePerms
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

  const handleRevokeSession = (sessionId: number, isCurrent: boolean) => {
    const confirmMessage = isCurrent
      ? (isFarsi ? "این اتصال، دستگاه فعلی شما است. آیا مطمئنید می‌خواهید خارج شوید؟" : "This is your current active connection. Are you sure you want to log out?")
      : (isFarsi ? "آیا از خاتمه دادن به این اتصال اطمینان دارید؟" : "Are you sure you want to revoke this session?");

    if (window.confirm(confirmMessage)) {
      revokeSessionMutation.mutate(sessionId);
    }
  };

  const handleTogglePermission = (role: Role, permCodename: string, checked: boolean) => {
    if (!role.permissions) return;
    const updatedPerms = checked
      ? [...role.permissions, permCodename]
      : role.permissions.filter(p => p !== permCodename);

    updateRoleMutation.mutate({
      id: role.id,
      data: { permissions: updatedPerms }
    });
  };

  const handleDeleteRole = (roleId: number) => {
    if (window.confirm(isFarsi ? "آیا از حذف این نقش اطمینان دارید؟" : "Are you sure you want to delete this role?")) {
      deleteRoleMutation.mutate(roleId);
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
        <div className="flex border-b border-[var(--b)] gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("appearance")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "appearance"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            <span>🎨</span>
            <span>{isFarsi ? "طرح ظاهر و برندینگ" : "Appearance & Branding"}</span>
          </button>
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "details"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "جزئیات سازمان" : "Organization Details"}
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "members"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "اعضا و پرسنل" : "Members & Staff"}
          </button>
          <button
            onClick={() => setActiveTab("connections")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "connections"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "دستگاه‌ها و اتصالات" : "Devices & Connections"}
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "roles"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "نقش‌ها و دسترسی‌ها" : "Roles & Permissions"}
          </button>
          <button
            onClick={() => {
              setActiveTab("audit_logs");
              setLogsPage(1);
            }}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "audit_logs"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "سوابق فعالیت‌ها" : "Audit Logs"}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-sm font-medium border-b-2 bg-transparent border-none cursor-pointer transition-all duration-150 whitespace-nowrap ${activeTab === "reports"
                ? "border-[var(--brand-text)] text-[var(--brand-text)] font-semibold"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
              }`}
          >
            {isFarsi ? "گزارشات و خروجی‌ها" : "Reports & Exports"}
          </button>
        </div>

        {/* Tab content 0: Appearance & Visual Identity */}
        {activeTab === "appearance" && activeOrg && (
          <OrgAppearanceSettings organization={activeOrg} />
        )}

        {/* Tab content 1: Details */}
        {activeTab === "details" && activeOrg && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-8 animate-in fade-in duration-150">
            <h2 className="text-base font-bold text-[var(--t1)]">
              {isFarsi ? "پروفایل آکادمی" : "Academy Profile"}
            </h2>

            {/* Logo Section */}
            <div className="flex items-center gap-5">
              <ImageUpload
                preset="logo"
                value={logoPreview}
                onChange={(file) => {
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                }}
                disabled={!canManageMembers}
                isFarsi={isFarsi}
              />
              <div>
                <h3 className="text-xs font-semibold text-[var(--t1)]">
                  {isFarsi ? "لوگوی سازمان" : "Organization Logo"}
                </h3>
                <p className="text-[11px] text-[var(--t3)] mt-1.5 leading-relaxed">
                  {isFarsi
                    ? "یک تصویر با پسوند PNG یا JPG انتخاب کنید."
                    : "Select a PNG or JPG format image."}
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

              <div className="flex items-center gap-2.5 mt-1">
                <input
                  type="checkbox"
                  id="approval_required"
                  checked={approvalRequired}
                  onChange={(e) => setApprovalRequired(e.target.checked)}
                  disabled={!canManageMembers}
                  className="rounded border-[var(--b)] text-[var(--brand)] focus:ring-[var(--brand)] bg-[var(--s3)] h-4 w-4 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="approval_required" className="text-xs font-semibold text-[var(--t2)] cursor-pointer select-none">
                  {isFarsi
                    ? "تایید عضویت اعضای جدید توسط مدیر الزامی باشد (عدم عضویت خودکار)"
                    : "Require admin approval for new members to join (disable auto-join)"}
                </label>
              </div>

              {canManageMembers && (
                <div className="mt-2 flex justify-end">
                  <Button type="submit" disabled={updateOrgMutation.isPending}>
                    {updateOrgMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ذخیره تغییرات" : "Save Changes")}
                  </Button>
                </div>
              )}
            </form>

            {/* Invite Link & Code Section */}
            <div className="border-t border-[var(--b)] pt-6 flex flex-col gap-4 max-w-lg">
              <h3 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wide">
                {isFarsi ? "لینک و کد دعوت آکادمی" : "Academy Invite Link & Code"}
              </h3>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                {isFarsi
                  ? "کاربران با استفاده از این لینک یا با وارد کردن کد دعوت در داشبورد خود می‌توانند به آکادمی بپیوندند."
                  : "Users can join the academy using this link or by entering the invitation code in their dashboard."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3 flex flex-col gap-2 justify-between">
                  <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                    {isFarsi ? "لینک دعوت مستقیم" : "Direct Invite Link"}
                  </span>
                  <span className="text-xs font-mono text-[var(--t2)] truncate">
                    {`${window.location.origin}/join/${activeOrg.invite_code || activeOrg.slug}`}
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={handleCopyLink}>
                    {isFarsi ? "کپی لینک" : "Copy Link"}
                  </Button>
                </div>

                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3 flex flex-col gap-2 justify-between">
                  <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                    {isFarsi ? "کد دعوت" : "Invite Code"}
                  </span>
                  <span className="text-xs font-mono text-[var(--t2)] truncate">
                    {activeOrg.invite_code || activeOrg.slug}
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={handleCopyCode}>
                    {isFarsi ? "کپی کد دعوت" : "Copy Invite Code"}
                  </Button>
                </div>
              </div>
            </div>
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
                <div className="flex gap-2">
                  <Button onClick={() => setIsInviteOpen(true)} size="sm" variant="secondary">
                    {isFarsi ? "دعوت عضو" : "Invite Member"}
                  </Button>
                  <Button onClick={() => {
                    const defaultRoleId = roles.length > 0 ? (roles.find(r => r.name.toLowerCase().includes("student"))?.id?.toString() || roles[0].id.toString()) : "";
                    setCreateMemberForm({
                      username: "",
                      email: "",
                      password: "",
                      full_name: "",
                      role: defaultRoleId,
                      contract_type: "full_time",
                      expires_at: "",
                    });
                    setIsCreateMemberOpen(true);
                  }} size="sm">
                    {isFarsi ? "+ ایجاد عضو جدید" : "+ Create Member"}
                  </Button>
                </div>
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
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:opacity-85"
                            style={getRoleBadgeStyle(member.role_name || "")}
                            onClick={() => {
                              if (canManageMembers) {
                                setSelectedMemberForRoleChange(member);
                                setNewRoleId(member.role?.toString() || "");
                                setIsRoleChangeOpen(true);
                              }
                            }}
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
                          <Switch
                            checked={member.is_active}
                            onChange={() => toggleMemberActive(member)}
                            disabled={!canManageMembers || updateMemberMutation.isPending}
                            variant="brand"
                          />
                        </td>
                        {canManageMembers && (
                          <td className="py-3 px-2 text-end flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedMemberForRoleChange(member);
                                setNewRoleId(member.role?.toString() || "");
                                setIsRoleChangeOpen(true);
                              }}
                              className="w-7 h-7 rounded-lg bg-transparent border-none text-[var(--t3)] hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] cursor-pointer flex items-center justify-center transition-all"
                              title={isFarsi ? "تغییر نقش" : "Change role"}
                            >
                              👤
                            </button>
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

        {/* Tab content 3: Connections */}
        {activeTab === "connections" && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-[var(--t1)]">
                {isFarsi ? "دستگاه‌ها و اتصالات فعال" : "Active Devices & Connections"}
              </h2>
              <p className="text-xs text-[var(--t3)] mt-1">
                {isFarsi
                  ? "لیست دستگاه‌هایی که به حساب کاربری اعضای آکادمی متصل هستند. شما می‌توانید دسترسی هر کدام را لغو کنید."
                  : "List of devices connected to academy members. You can revoke connections to force logout."}
              </p>
            </div>

            {loadingSessions ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[var(--b)] rounded-2xl">
                <span className="text-4xl block mb-2">💻</span>
                <h3 className="text-sm font-semibold text-[var(--t1)]">
                  {isFarsi ? "اتصالی یافت نشد" : "No connections found"}
                </h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold">
                      <th className="py-3 px-2 text-start">{isFarsi ? "کاربر" : "User"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "دستگاه و مرورگر" : "Device & Browser"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "آدرس IP" : "IP Address"}</th>
                      <th className="py-3 px-2 text-start">{isFarsi ? "آخرین فعالیت" : "Logged/Active"}</th>
                      <th className="py-3 px-2 text-center">{isFarsi ? "وضعیت" : "Status"}</th>
                      <th className="py-3 px-2 text-end">{isFarsi ? "عملیات" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="border-b border-[var(--b)]/60 text-[var(--t2)] hover:bg-[var(--s3)]/30 transition-colors">
                        <td className="py-3 px-2 font-semibold">
                          {sess.full_name || sess.username}
                          <span className="text-[10px] text-[var(--t3)] block mt-0.5 font-normal">@{sess.username}</span>
                        </td>
                        <td className="py-3 px-2 font-mono text-[11px] text-[var(--t2)]">
                          {parseUA(sess.user_agent)}
                        </td>
                        <td className="py-3 px-2 font-mono text-[var(--t3)]">{sess.ip_address || "-"}</td>
                        <td className="py-3 px-2 text-[var(--t3)]">
                          {new Date(sess.created_at).toLocaleString(isFarsi ? "fa-IR" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {sess.is_current ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--green)]/15 text-[var(--green)]">
                              {isFarsi ? "این دستگاه" : "Current Device"}
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" title="Active" />
                          )}
                        </td>
                        <td className="py-3 px-2 text-end">
                          <button
                            onClick={() => handleRevokeSession(sess.id, sess.is_current)}
                            disabled={revokeSessionMutation.isPending}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-transparent border border-[var(--red)]/40 text-[var(--red)] cursor-pointer hover:bg-[var(--red)]/10 transition-colors"
                          >
                            {isFarsi ? "خاتمه دسترسی" : "Revoke"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab content 4: Roles & Permissions */}
        {activeTab === "roles" && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--t1)]">
                  {isFarsi ? "نقش‌ها و ماتریس دسترسی‌ها" : "Roles & Permissions Builder"}
                </h2>
                <p className="text-xs text-[var(--t3)] mt-1">
                  {isFarsi
                    ? "مدیریت سطوح دسترسی و تعریف نقش‌های شخصی‌سازی شده برای اعضای سازمان."
                    : "Configure permission scopes for standard and custom roles in your organization."}
                </p>
              </div>
              {canManageMembers && (
                <Button onClick={() => setIsCreateRoleOpen(true)} size="sm">
                  {isFarsi ? "ایجاد نقش جدید" : "Create Custom Role"}
                </Button>
              )}
            </div>

            {loadingPermissions || loadingRoles ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold">
                      <th className="py-3 px-2 text-start min-w-[220px]">{isFarsi ? "عنوان و شرح دسترسی" : "Permission Title & Description"}</th>
                      {roles.map((role) => (
                        <th key={role.id} className="py-3 px-2 text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="font-semibold text-[var(--t1)]">{role.name}</span>
                            {!["admin", "teacher", "student"].includes(role.name.toLowerCase()) && canManageMembers && (
                              <button
                                onClick={() => handleDeleteRole(role.id)}
                                className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--red)]/10 text-[var(--red)] border border-none cursor-pointer hover:bg-[var(--red)]/20 transition-all font-semibold"
                              >
                                {isFarsi ? "حذف نقش" : "Delete"}
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {systemPermissions.map((perm) => (
                      <tr key={perm.codename} className="border-b border-[var(--b)]/60 text-[var(--t2)] hover:bg-[var(--s3)]/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-[var(--t1)]">
                              {isFarsi ? getFarsiPermName(perm.codename, perm.name) : perm.name}
                            </span>
                            <span className="text-[10px] text-[var(--t3)] mt-0.5">
                              {isFarsi ? getFarsiPermDesc(perm.codename, perm.description) : perm.description}
                            </span>
                          </div>
                        </td>
                        {roles.map((role) => {
                          const isSystem = ["admin", "teacher", "student"].includes(role.name.toLowerCase());
                          const hasPerm = role.permissions?.includes(perm.codename);
                          return (
                            <td key={role.id} className="py-3 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={hasPerm || false}
                                disabled={isSystem || !canManageMembers || updateRoleMutation.isPending}
                                onChange={(e) => handleTogglePermission(role, perm.codename, e.target.checked)}
                                className="w-4.5 h-4.5 cursor-pointer accent-[var(--brand-text)] disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab content 5: Audit Logs */}
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

        {/* Tab content 6: Reports & Exports */}
        {activeTab === "reports" && (
          <div className="bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-150">
            <ReportsExportWidget />
          </div>
        )}

        {/* Invite Dialog */}
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

                <DatePicker
                  label={isFarsi ? "تاریخ انقضای عضویت (اختیاری)" : "Expiration Date (Optional)"}
                  value={inviteExpires || undefined}
                  onChange={(val) => setInviteExpires(val)}
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

        {/* Create Member Modal */}
        <Modal open={isCreateMemberOpen} onOpenChange={setIsCreateMemberOpen}>
          <form onSubmit={handleCreateMemberSubmit}>
            <ModalHeader>
              <ModalTitle>
                {isFarsi ? "ایجاد و ثبت‌نام عضو جدید" : "Create New Member"}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Input
                  label={isFarsi ? "نام کاربری" : "Username"}
                  placeholder={isFarsi ? "مثال: ali_student" : "e.g. ali_student"}
                  value={createMemberForm.username}
                  onChange={(e) => setCreateMemberForm({ ...createMemberForm, username: e.target.value })}
                  required
                />
                
                <Input
                  label={isFarsi ? "رمز عبور" : "Password"}
                  placeholder={isFarsi ? "رمز عبور را وارد کنید" : "Enter password"}
                  type="password"
                  value={createMemberForm.password}
                  onChange={(e) => setCreateMemberForm({ ...createMemberForm, password: e.target.value })}
                  required
                />

                <Input
                  label={isFarsi ? "نام کامل (اختیاری)" : "Full Name (Optional)"}
                  placeholder={isFarsi ? "مثال: علی محمدی" : "e.g. Ali Mohammadi"}
                  value={createMemberForm.full_name}
                  onChange={(e) => setCreateMemberForm({ ...createMemberForm, full_name: e.target.value })}
                />

                <Input
                  label={isFarsi ? "ایمیل (اختیاری)" : "Email (Optional)"}
                  placeholder={isFarsi ? "ali@example.com" : "ali@example.com"}
                  value={createMemberForm.email}
                  onChange={(e) => setCreateMemberForm({ ...createMemberForm, email: e.target.value })}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    {isFarsi ? "نقش" : "Role"}
                  </label>
                  <select
                    value={createMemberForm.role}
                    onChange={(e) => setCreateMemberForm({ ...createMemberForm, role: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                    required
                  >
                    <option value="" disabled>{isFarsi ? "انتخاب نقش..." : "Select Role..."}</option>
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
                    value={createMemberForm.contract_type}
                    onChange={(e) => setCreateMemberForm({ ...createMemberForm, contract_type: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] focus:outline-none focus:border-[var(--brand-text)]"
                  >
                    <option value="full_time">{isFarsi ? "تمام وقت (Full Time)" : "Full Time"}</option>
                    <option value="part_time">{isFarsi ? "پاره وقت (Part Time)" : "Part Time"}</option>
                    <option value="contractor">{isFarsi ? "پیمانکار (Contractor)" : "Contractor"}</option>
                    <option value="guest">{isFarsi ? "مهمان (Guest)" : "Guest"}</option>
                  </select>
                </div>

                <DatePicker
                  label={isFarsi ? "تاریخ انقضای عضویت (اختیاری)" : "Expiration Date (Optional)"}
                  value={createMemberForm.expires_at || undefined}
                  onChange={(val) => setCreateMemberForm({ ...createMemberForm, expires_at: val })}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setIsCreateMemberOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={createMemberMutation.isPending}>
                {createMemberMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ایجاد عضو" : "Create Member")}
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Custom Role Creation Dialog */}
        <Modal open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
          <form onSubmit={handleCreateRoleSubmit}>
            <ModalHeader>
              <ModalTitle>
                {isFarsi ? "ایجاد نقش سفارشی" : "Create Custom Role"}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Input
                  label={isFarsi ? "نام نقش" : "Role Name"}
                  placeholder={isFarsi ? "مثال: پشتیبان فنی" : "e.g. Support Specialist"}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                />
                <Input
                  label={isFarsi ? "توضیحات" : "Description"}
                  placeholder={isFarsi ? "مثال: نظارت بر عملکرد فنی سیستم" : "e.g. Manages technical system logs"}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[var(--t2)]">
                    {isFarsi ? "مجوزها و دسترسی‌های اولیه" : "Initial Permissions"}
                  </label>
                  <div className="max-h-60 overflow-y-auto border border-[var(--b)] rounded-xl p-3 flex flex-col gap-2">
                    {systemPermissions.map((perm) => (
                      <label key={perm.codename} className="flex items-center gap-2 text-xs text-[var(--t2)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRolePerms.includes(perm.codename)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRolePerms([...newRolePerms, perm.codename]);
                            } else {
                              setNewRolePerms(newRolePerms.filter(p => p !== perm.codename));
                            }
                          }}
                          className="accent-[var(--brand-text)]"
                        />
                        <span>{isFarsi ? getFarsiPermName(perm.codename, perm.name) : perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setIsCreateRoleOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ایجاد" : "Create")}
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Change Member Role Modal */}
        <Modal open={isRoleChangeOpen} onOpenChange={setIsRoleChangeOpen}>
          <ModalHeader>
            <ModalTitle>{isFarsi ? "تغییر نقش عضو" : "Change Member Role"}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleRoleChangeSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-[var(--t2)]">
                {isFarsi 
                  ? `در حال تغییر نقش کاربر ${selectedMemberForRoleChange?.user_details?.full_name || selectedMemberForRoleChange?.user_details?.username}` 
                  : `Changing role for user: ${selectedMemberForRoleChange?.user_details?.full_name || selectedMemberForRoleChange?.user_details?.username}`}
              </p>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "نقش جدید" : "New Role"}
                </label>
                <select
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                >
                  <option value="">{isFarsi ? "بدون نقش (لغو دسترسی)" : "No Role (Revoke Role)"}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="secondary" onClick={() => setIsRoleChangeOpen(false)}>
                  {isFarsi ? "انصراف" : "Cancel"}
                </Button>
                <Button type="submit" disabled={updateMemberMutation.isPending}>
                  {updateMemberMutation.isPending 
                    ? (isFarsi ? "در حال تغییر..." : "Saving...") 
                    : (isFarsi ? "ذخیره تغییرات" : "Save Changes")}
                </Button>
              </div>
            </form>
          </ModalBody>
        </Modal>

      </div>
    </AppShell>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type Enrollment, type SimpleUser, type OrgMember, type Permission } from "../api/crm.api";
import { useSessions } from "../../sessions/hooks/useSessions";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import { useQueryParamState } from "../../../hooks/useQueryParamState";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";

type SubTab = "enrollments" | "directory" | "roles";
type StatusFilter = "all" | "active" | "inactive";

export default function MembersPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";

  const isOrisAdmin = hasPermission("can_manage_members");

  const [inspectType, setInspectType] = useQueryParamState("inspect_type");
  const [inspectId, setInspectId] = useQueryParamState("inspect_id");
  const isDrawerOpen = !!inspectType && !!inspectId;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("enrollments");



  // ──────────────────────────────────────────────
  // Org Members Tab State
  // ──────────────────────────────────────────────
  const [memberStatusFilter, setMemberStatusFilter] = useState<StatusFilter>("all");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  // ──────────────────────────────────────────────
  // Invite Modal State
  // ──────────────────────────────────────────────
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    username: "",
    email: "",
    role: "" as string,
    contract_type: "full_time" as string,
  });

  // ──────────────────────────────────────────────
  // Role Modal State
  // ──────────────────────────────────────────────
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // ──────────────────────────────────────────────
  // Enrollment Modal State
  // ──────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState<{
    academy_class: string;
    student: string;
    is_active: boolean;
    completion_status: "in_progress" | "completed" | "dropped";
  }>({
    academy_class: "",
    student: "",
    is_active: true,
    completion_status: "in_progress"
  });
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);

  // ──────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: liveSessions = [] } = useSessions(undefined, "live");

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["org-members"],
    queryFn: crmApi.getMembers,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: crmApi.getRoles,
  });

  const { data: availablePermissions = [] } = useQuery<Permission[]>({
    queryKey: ["available-permissions"],
    queryFn: crmApi.getAvailablePermissions,
    staleTime: Infinity,
  });

  // ──────────────────────────────────────────────
  // Filtered Members
  // ──────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    let result = members;
    if (memberStatusFilter === "active") result = result.filter((m) => m.is_active);
    if (memberStatusFilter === "inactive") result = result.filter((m) => !m.is_active);
    if (memberSearchTerm.trim()) {
      const q = memberSearchTerm.toLowerCase();
      result = result.filter((m) => {
        const u = m.user_details;
        return (
          u?.full_name?.toLowerCase().includes(q) ||
          u?.username?.toLowerCase().includes(q) ||
          u?.email?.toLowerCase().includes(q) ||
          m.role_name?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [members, memberStatusFilter, memberSearchTerm]);



  // ──────────────────────────────────────────────
  // Enrollment Mutations
  // ──────────────────────────────────────────────
  const createEnrollmentMutation = useMutation({
    mutationFn: crmApi.createEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "ثبت‌نام با موفقیت انجام شد" : "Enrollment created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت‌نام" : "Failed to enroll student"));
    }
  });

  const updateEnrollmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Enrollment> }) => crmApi.updateEnrollment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "ثبت‌نام با موفقیت ویرایش شد" : "Enrollment updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش ثبت‌نام" : "Failed to update enrollment"));
    }
  });

  const deleteEnrollmentMutation = useMutation({
    mutationFn: crmApi.deleteEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "لغو ثبت‌نام با موفقیت انجام شد" : "Enrollment deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در لغو ثبت‌نام" : "Failed to delete enrollment"));
    }
  });

  // ──────────────────────────────────────────────
  // Invite Member Mutation
  // ──────────────────────────────────────────────
  const inviteMemberMutation = useMutation({
    mutationFn: crmApi.createMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success(isFarsi ? "عضو جدید با موفقیت اضافه شد" : "Member added successfully");
      setIsInviteModalOpen(false);
      setInviteForm({ username: "", email: "", role: "", contract_type: "full_time" });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.[0] || (isFarsi ? "خطا در افزودن عضو" : "Failed to add member");
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OrgMember> }) => crmApi.updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success(isFarsi ? "اطلاعات عضو بروزرسانی شد" : "Member updated");
    },
    onError: () => {
      toast.error(isFarsi ? "خطا در بروزرسانی عضو" : "Failed to update member");
    }
  });

  const deleteMemberMutation = useMutation({
    mutationFn: crmApi.deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success(isFarsi ? "عضو حذف شد" : "Member removed");
    },
    onError: () => {
      toast.error(isFarsi ? "خطا در حذف عضو" : "Failed to remove member");
    }
  });

  // ──────────────────────────────────────────────
  // Role Mutations
  // ──────────────────────────────────────────────
  const createRoleMutation = useMutation({
    mutationFn: crmApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success(isFarsi ? "نقش جدید ایجاد شد" : "Role created successfully");
      setIsRoleModalOpen(false);
      setRoleForm({ name: "", description: "", permissions: [] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.detail || (isFarsi ? "خطا در ایجاد نقش" : "Failed to create role");
      toast.error(msg);
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; description: string; permissions: string[] }> }) =>
      crmApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success(isFarsi ? "نقش با موفقیت ویرایش شد" : "Role updated");
      setIsRoleModalOpen(false);
      setRoleForm({ name: "", description: "", permissions: [] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.detail || (isFarsi ? "خطا در ویرایش نقش" : "Failed to update role");
      toast.error(msg);
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: crmApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success(isFarsi ? "نقش حذف شد" : "Role deleted");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.detail || (isFarsi ? "خطا در حذف نقش" : "Failed to delete role");
      toast.error(msg);
    }
  });

  const openCreateRoleModal = () => {
    setEditRoleId(null);
    setRoleForm({ name: "", description: "", permissions: [] });
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: { id: number; name: string; description: string; permissions: string[] }) => {
    setEditRoleId(role.id);
    setRoleForm({ name: role.name, description: role.description, permissions: role.permissions });
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editRoleId) {
      updateRoleMutation.mutate({ id: editRoleId, data: roleForm });
    } else {
      createRoleMutation.mutate(roleForm);
    }
  };

  const togglePermission = (codename: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(codename)
        ? prev.permissions.filter((p) => p !== codename)
        : [...prev.permissions, codename],
    }));
  };

  // ──────────────────────────────────────────────
  // Student search autocomplete for enrollment modal
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      crmApi.searchUsers(userSearchQuery, "student").then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery]);

  const openCreateModal = () => {
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    setEnrollmentForm({
      academy_class: classes[0]?.id.toString() || "",
      student: "",
      is_active: true,
      completion_status: "in_progress"
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Enrollment) => {
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    setEnrollmentForm({
      academy_class: item.academy_class.toString(),
      student: item.student.toString(),
      is_active: item.is_active,
      completion_status: item.completion_status || "in_progress"
    });
    if (item.student_full_name || item.student_username) {
      setUserSearchQuery(item.student_full_name || item.student_username || "");
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Enrollment> = {
      academy_class: parseInt(enrollmentForm.academy_class),
      student: parseInt(enrollmentForm.student),
      is_active: enrollmentForm.is_active,
      completion_status: enrollmentForm.completion_status
    };

    if (editId) {
      updateEnrollmentMutation.mutate({ id: editId, data: payload });
    } else {
      createEnrollmentMutation.mutate(payload);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMemberMutation.mutate({
      username: inviteForm.username || undefined,
      email: inviteForm.email || undefined,
      role: inviteForm.role ? parseInt(inviteForm.role) : null,
      contract_type: inviteForm.contract_type,
    });
  };

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  const getRoleBadgeClass = (roleName?: string) => {
    const r = roleName?.toLowerCase();
    if (r === "admin") return "bg-red-500/10 text-red-500";
    if (r === "teacher") return "bg-blue-500/10 text-blue-500";
    if (r === "mentor") return "bg-cyan-500/10 text-cyan-500";
    return "bg-emerald-500/10 text-emerald-500";
  };

  const getInspectTypeForRole = (roleName?: string) => {
    const r = roleName?.toLowerCase();
    if (r === "teacher") return "teacher";
    if (r === "mentor") return "mentor";
    if (r === "admin") return "teacher";
    return "student";
  };

  const statusCounts = useMemo(() => {
    const active = members.filter((m) => m.is_active).length;
    return { all: members.length, active, inactive: members.length - active };
  }, [members]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <AppShell title={isFarsi ? "اعضا و ثبت‌نام" : "Members"}>
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 scrollbar-none bg-[var(--s1)] p-2 rounded-t-xl border border-b-0 border-[var(--b)]">
          {(["enrollments", "directory", "roles"] as SubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
                activeSubTab === tab
                  ? "border-[var(--brand)] text-[var(--brand-text)]"
                  : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
              }`}
            >
              {tab === "enrollments"
                ? (isFarsi ? "ثبت‌نام‌ها" : "Enrollments")
                : tab === "directory"
                ? (isFarsi ? "فهرست اعضا" : "Org Members")
                : (isFarsi ? "نقش‌ها و دسترسی" : "Roles & Permissions")}
            </button>
          ))}
        </div>

        <div className="rounded-b-xl overflow-hidden bg-[var(--s2)] border border-[var(--b)]">
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              TAB 1: Enrollments
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeSubTab === "enrollments" && (
            <div>
              <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
                <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
                  {isFarsi ? "ثبت‌نام دانش‌آموزان در کلاس‌ها" : "Student Enrollments"}
                </span>
                {isOrisAdmin && (
                  <Button size="sm" onClick={openCreateModal}>
                    {isFarsi ? "+ ثبت‌نام جدید" : "+ New Enrollment"}
                  </Button>
                )}
              </div>

              {loadingEnrollments ? (
                <div className="p-8 flex justify-center"><Spinner /></div>
              ) : enrollments.length === 0 ? (
                <div className="p-8 text-center text-[var(--t3)]">
                  {isFarsi ? "ثبت‌نامی یافت نشد" : "No enrollments found."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                        <th className="p-4">{isFarsi ? "دانش‌آموز" : "Student"}</th>
                        <th className="p-4">{isFarsi ? "کلاس" : "Class"}</th>
                        <th className="p-4">{isFarsi ? "تاریخ ثبت‌نام" : "Enrolled At"}</th>
                        <th className="p-4">{isFarsi ? "وضعیت ثبت‌نام" : "Enrollment Status"}</th>
                        <th className="p-4">{isFarsi ? "وضعیت دوره" : "Completion"}</th>
                        {isOrisAdmin && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => (
                        <tr key={e.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                          <td
                            className="p-4 font-semibold text-[var(--t1)] cursor-pointer hover:text-[var(--brand)] hover:underline"
                            onClick={() => {
                              setInspectType("student");
                              setInspectId(e.student.toString());
                            }}
                          >
                            {e.student_full_name || e.student_username}
                          </td>
                          <td className="p-4 text-[var(--t2)]">{e.class_name}</td>
                          <td className="p-4 text-[var(--t3)]">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.is_active ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]" : "bg-[var(--s3)] text-[var(--t3)]"}`}>
                                {e.is_active ? (isFarsi ? "فعال" : "Active") : (isFarsi ? "غیرفعال" : "Inactive")}
                              </span>
                              {(() => {
                                const liveSession = liveSessions.find((s) => s.academy_class === e.academy_class);
                                if (e.is_active && liveSession?.active_room_code) {
                                  return (
                                    <Link
                                      to={`/room/${liveSession.active_room_code}`}
                                      className="inline-block text-[10px] bg-[var(--green)] hover:brightness-110 text-white font-bold px-2 py-0.5 rounded-full cursor-pointer no-underline border-none animate-pulse"
                                    >
                                      {isFarsi ? "ورود به کلاس زنده" : "Join Live Class"}
                                    </Link>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              e.completion_status === "completed"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : e.completion_status === "dropped"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-blue-500/10 text-blue-500"
                            }`}>
                              {e.completion_status === "completed"
                                ? (isFarsi ? "تکمیل شده" : "Completed")
                                : e.completion_status === "dropped"
                                ? (isFarsi ? "انصراف داده" : "Dropped")
                                : (isFarsi ? "در حال یادگیری" : "In Progress")}
                            </span>
                          </td>
                          {isOrisAdmin && (
                            <td className="p-4 text-right flex justify-end gap-2">
                              <button
                                onClick={() => openEditModal(e)}
                                className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                              >
                                {isFarsi ? "تغییر وضعیت" : "Toggle/Edit"}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(isFarsi ? "لغو ثبت‌نام؟" : "Are you sure you want to cancel this enrollment?")) {
                                    deleteEnrollmentMutation.mutate(e.id);
                                  }
                                }}
                                className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                              >
                                {isFarsi ? "حذف" : "Remove"}
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

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              TAB 2: Org Members Directory
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeSubTab === "directory" && (
            <div>
              {/* Header with invite button and filters */}
              <div className="flex flex-wrap justify-between items-center gap-3 p-4 border-b border-[var(--b)]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
                    {isFarsi ? "فهرست اعضای سازمان" : "Organization Members"}
                  </span>
                  {/* Status filter pills */}
                  <div className="flex gap-1">
                    {(["all", "active", "inactive"] as StatusFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setMemberStatusFilter(f)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                          memberStatusFilter === f
                            ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                            : "bg-transparent text-[var(--t3)] border-[var(--b)] hover:border-[var(--brand)]/50"
                        }`}
                      >
                        {f === "all"
                          ? `${isFarsi ? "همه" : "All"} (${statusCounts.all})`
                          : f === "active"
                          ? `${isFarsi ? "فعال" : "Active"} (${statusCounts.active})`
                          : `${isFarsi ? "غیرفعال" : "Inactive"} (${statusCounts.inactive})`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-48">
                    <Input
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      placeholder={isFarsi ? "جستجو..." : "Search..."}
                    />
                  </div>
                  {isOrisAdmin && (
                    <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
                      {isFarsi ? "+ دعوت عضو" : "+ Invite Member"}
                    </Button>
                  )}
                </div>
              </div>

              {loadingMembers ? (
                <div className="p-8 flex justify-center"><Spinner /></div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-[var(--t3)]">
                  {isFarsi ? "عضوی یافت نشد" : "No members found."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                        <th className="p-4">{isFarsi ? "عضو" : "Member"}</th>
                        <th className="p-4">{isFarsi ? "ایمیل" : "Email"}</th>
                        <th className="p-4">{isFarsi ? "نقش" : "Role"}</th>
                        <th className="p-4">{isFarsi ? "نوع قرارداد" : "Contract"}</th>
                        <th className="p-4">{isFarsi ? "وضعیت" : "Status"}</th>
                        <th className="p-4">{isFarsi ? "عضویت" : "Joined"}</th>
                        {isOrisAdmin && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m) => {
                        const u = m.user_details || {} as any;
                        return (
                          <tr key={m.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(u.full_name || u.username || "?").charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span
                                    className="font-semibold text-[var(--t1)] cursor-pointer hover:text-[var(--brand)] hover:underline truncate"
                                    onClick={() => {
                                      setInspectType(getInspectTypeForRole(m.role_name));
                                      setInspectId(m.user?.toString() || m.id.toString());
                                    }}
                                  >
                                    {u.full_name || u.username}
                                  </span>
                                  <span className="text-[10px] text-[var(--t3)] truncate">@{u.username}</span>
                                </div>
                                {u.is_online && (
                                  <span className="w-2 h-2 rounded-full bg-[var(--green)] flex-shrink-0" title={isFarsi ? "آنلاین" : "Online"} />
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-[var(--t2)] text-xs">{u.email || "—"}</td>
                            <td className="p-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${getRoleBadgeClass(m.role_name)}`}>
                                {m.role_name || (isFarsi ? "بدون نقش" : "No Role")}
                              </span>
                            </td>
                            <td className="p-4 text-[var(--t2)] text-xs capitalize">
                              {m.contract_type?.replace("_", " ") || "Full Time"}
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.is_active ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]" : "bg-[var(--s3)] text-[var(--t3)]"}`}>
                                {m.is_active ? (isFarsi ? "فعال" : "Active") : (isFarsi ? "غیرفعال" : "Inactive")}
                              </span>
                            </td>
                            <td className="p-4 text-[var(--t3)] text-xs">
                              {new Date(m.joined_at).toLocaleDateString()}
                            </td>
                            {isOrisAdmin && (
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      updateMemberMutation.mutate({
                                        id: m.id,
                                        data: { is_active: !m.is_active } as any,
                                      });
                                    }}
                                    className="text-[10px] bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                                  >
                                    {m.is_active ? (isFarsi ? "غیرفعال" : "Deactivate") : (isFarsi ? "فعال" : "Activate")}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(isFarsi ? "حذف این عضو از سازمان؟" : "Remove this member from the organization?")) {
                                        deleteMemberMutation.mutate(m.id);
                                      }
                                    }}
                                    className="text-[10px] bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                                  >
                                    {isFarsi ? "حذف" : "Remove"}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              TAB 3: Roles & Permissions
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeSubTab === "roles" && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
                  {isFarsi ? "نقش‌های تعریف شده" : "Defined Roles"}
                </span>
                {isOrisAdmin && (
                  <Button size="sm" onClick={openCreateRoleModal}>
                    {isFarsi ? "+ نقش جدید" : "+ New Role"}
                  </Button>
                )}
              </div>

              {roles.length === 0 ? (
                <div className="p-8 text-center text-[var(--t3)]">
                  {isFarsi ? "نقشی تعریف نشده است" : "No roles defined."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map((role) => {
                    const isSystem = ["admin", "teacher", "student", "mentor"].includes(role.name.toLowerCase());
                    const memberCount = members.filter((m) => m.role === role.id).length;
                    return (
                      <div
                        key={role.id}
                        className="bg-[var(--s1)] border border-[var(--b)] rounded-xl p-4 hover:border-[var(--brand)]/30 transition-all group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${getRoleBadgeClass(role.name)}`}>
                              {role.name}
                            </span>
                            {isSystem && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--s3)] text-[var(--t3)]">
                                {isFarsi ? "سیستمی" : "System"}
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--t3)]">
                              {memberCount} {isFarsi ? "عضو" : "member(s)"}
                            </span>
                          </div>
                          {isOrisAdmin && !isSystem && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditRoleModal(role)}
                                className="text-[10px] bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer px-1"
                              >
                                {isFarsi ? "ویرایش" : "Edit"}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(isFarsi ? `حذف نقش «${role.name}»؟` : `Delete role "${role.name}"?`)) {
                                    deleteRoleMutation.mutate(role.id);
                                  }
                                }}
                                className="text-[10px] bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer px-1"
                              >
                                {isFarsi ? "حذف" : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[var(--t2)] mb-3 leading-relaxed">
                          {role.description || (isFarsi ? "بدون توضیحات" : "No description")}
                        </p>
                        {role.permissions && role.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.map((perm) => (
                              <span key={perm} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--s3)] text-[var(--t3)] border border-[var(--b)]">
                                {perm}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Enrollment Modal
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {editId
              ? (isFarsi ? "ویرایش ثبت‌نام" : "Edit Enrollment")
              : (isFarsi ? "ثبت‌نام جدید" : "New Enrollment")}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "کلاس آموزشی" : "Class"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={enrollmentForm.academy_class}
                onChange={(e) => setEnrollmentForm({ ...enrollmentForm, academy_class: e.target.value })}
                required
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name} ({cls.course_title})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "جستجوی دانشجو" : "Search Student"}
              </label>
              <Input
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (!e.target.value) setEnrollmentForm({ ...enrollmentForm, student: "" });
                }}
                placeholder={isFarsi ? "نام دانشجو را بنویسید" : "Type student name..."}
                disabled={!!editId}
                required
              />
              {searchResults.length > 0 && (
                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setEnrollmentForm({ ...enrollmentForm, student: u.id.toString() });
                        setUserSearchQuery(u.full_name || u.username);
                        setSearchResults([]);
                      }}
                      className="w-full text-start p-1.5 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                    >
                      {u.full_name} ({u.username})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="enroll-status"
                checked={enrollmentForm.is_active}
                onChange={(e) => setEnrollmentForm({ ...enrollmentForm, is_active: e.target.checked })}
              />
              <label htmlFor="enroll-status" className="text-xs font-semibold text-[var(--t2)] cursor-pointer">
                {isFarsi ? "ثبت‌نام فعال باشد" : "Is Active"}
              </label>
            </div>

            {editId && (
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "وضعیت پایان دوره" : "Completion Status"}
                </label>
                <select
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                  value={enrollmentForm.completion_status}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, completion_status: e.target.value as any })}
                  required
                >
                  <option value="in_progress">{isFarsi ? "در حال یادگیری" : "In Progress"}</option>
                  <option value="completed">{isFarsi ? "تکمیل شده" : "Completed"}</option>
                  <option value="dropped">{isFarsi ? "انصراف داده" : "Dropped"}</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={createEnrollmentMutation.isPending || updateEnrollmentMutation.isPending}
              >
                {isFarsi ? "ثبت اطلاعات" : "Save Changes"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Invite Member Modal
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Modal open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "دعوت عضو جدید" : "Invite New Member"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "نام کاربری" : "Username"}
              value={inviteForm.username}
              onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value })}
              placeholder={isFarsi ? "نام کاربری را وارد کنید" : "Enter username"}
            />
            <Input
              label={isFarsi ? "ایمیل (جایگزین)" : "Email (alternative)"}
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder={isFarsi ? "ایمیل را وارد کنید" : "Enter email address"}
            />
            <p className="text-[10px] text-[var(--t3)] -mt-2">
              {isFarsi ? "نام کاربری یا ایمیل را وارد کنید. کاربر باید از قبل در سیستم ثبت‌نام کرده باشد." : "Provide a username or email. The user must already be registered."}
            </p>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "نقش" : "Role"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                <option value="">{isFarsi ? "بدون نقش" : "No Role"}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "نوع قرارداد" : "Contract Type"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={inviteForm.contract_type}
                onChange={(e) => setInviteForm({ ...inviteForm, contract_type: e.target.value })}
              >
                <option value="full_time">{isFarsi ? "تمام وقت" : "Full Time"}</option>
                <option value="part_time">{isFarsi ? "پاره وقت" : "Part Time"}</option>
                <option value="contractor">{isFarsi ? "پیمانکار" : "Contractor"}</option>
                <option value="guest">{isFarsi ? "مهمان" : "Guest"}</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={inviteMemberMutation.isPending}>
                {inviteMemberMutation.isPending
                  ? (isFarsi ? "در حال افزودن..." : "Adding...")
                  : (isFarsi ? "افزودن عضو" : "Add Member")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Create / Edit Role Modal
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Modal open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {editRoleId
              ? (isFarsi ? "ویرایش نقش" : "Edit Role")
              : (isFarsi ? "ایجاد نقش جدید" : "Create New Role")}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleRoleSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "نام نقش" : "Role Name"}
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              placeholder={isFarsi ? "مثال: مدیر محتوا" : "e.g. Content Manager"}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "توضیحات" : "Description"}
              </label>
              <textarea
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors resize-none"
                rows={2}
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder={isFarsi ? "توضیح کوتاهی درباره این نقش..." : "Short description of this role..."}
              />
            </div>

            {availablePermissions.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "دسترسی‌ها" : "Permissions"}
                  <span className="ml-2 text-[var(--brand)] normal-case font-normal">
                    ({roleForm.permissions.length} {isFarsi ? "انتخاب شده" : "selected"})
                  </span>
                </label>
                <div className="bg-[var(--s1)] border border-[var(--b)] rounded-xl p-3 max-h-[220px] overflow-y-auto flex flex-col gap-1">
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm.codename}
                      className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-[var(--s3)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 flex-shrink-0 accent-[var(--brand)]"
                        checked={roleForm.permissions.includes(perm.codename)}
                        onChange={() => togglePermission(perm.codename)}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-[var(--t1)]">{perm.name}</span>
                        <span className="text-[10px] font-mono text-[var(--t3)]">{perm.codename}</span>
                        {perm.description && (
                          <span className="text-[10px] text-[var(--t3)] leading-relaxed">{perm.description}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setIsRoleModalOpen(false); setRoleForm({ name: "", description: "", permissions: [] }); }}
              >
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
              >
                {(createRoleMutation.isPending || updateRoleMutation.isPending)
                  ? (isFarsi ? "در حال ذخیره..." : "Saving...")
                  : (editRoleId ? (isFarsi ? "ذخیره تغییرات" : "Save Changes") : (isFarsi ? "ایجاد نقش" : "Create Role"))}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Inspection Drawer
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <InspectionDrawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInspectType(null);
            setInspectId(null);
          }
        }}
        entityType={inspectType as any}
        entityId={inspectId}
      />
    </AppShell>
  );
}

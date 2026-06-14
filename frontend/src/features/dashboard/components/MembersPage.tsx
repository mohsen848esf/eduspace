import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type Enrollment, type SimpleUser } from "../api/crm.api";
import { useSessions } from "../../sessions/hooks/useSessions";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

export default function MembersPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";

  const isOrisAdmin = hasPermission("can_manage_members");

  const [activeSubTab, setActiveSubTab] = useState<"enrollments" | "directory">("enrollments");

  // Directory Search State
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryResults, setDirectoryResults] = useState<SimpleUser[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Queries
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: liveSessions = [] } = useSessions(undefined, "live");

  // Search for directory tab
  useEffect(() => {
    if (activeSubTab === "directory" && directoryQuery.length >= 2) {
      setLoadingDirectory(true);
      crmApi.searchUsers(directoryQuery)
        .then((res) => {
          setDirectoryResults(res);
          setLoadingDirectory(false);
        })
        .catch(() => setLoadingDirectory(false));
    } else {
      setDirectoryResults([]);
    }
  }, [directoryQuery, activeSubTab]);

  // Mutations
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

  // Autocomplete Search State for modal
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);

  // Modal State
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

  return (
    <AppShell title={isFarsi ? "اعضا و ثبت‌نام" : "Members"}>
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 scrollbar-none bg-[var(--s1)] p-2 rounded-t-xl border border-b-0 border-[var(--b)]">
          <button
            onClick={() => setActiveSubTab("enrollments")}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeSubTab === "enrollments"
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "ثبت‌نام‌ها" : "Enrollments"}
          </button>
          <button
            onClick={() => setActiveSubTab("directory")}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeSubTab === "directory"
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "فهرست اعضا" : "User Directory"}
          </button>
        </div>

        <div className="rounded-b-xl overflow-hidden bg-[var(--s2)] border border-[var(--b)]">
          {/* Enrollments Tab */}
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
                          <td className="p-4 font-semibold text-[var(--t1)]">
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

          {/* Directory Tab */}
          {activeSubTab === "directory" && (
            <div className="p-4">
              <div className="max-w-md mb-6">
                <Input
                  label={isFarsi ? "جستجوی استاد یا دانشجو" : "Search Student or Teacher"}
                  value={directoryQuery}
                  onChange={(e) => setDirectoryQuery(e.target.value)}
                  placeholder={isFarsi ? "نام یا نام کاربری را وارد کنید (حداقل ۲ کاراکتر)..." : "Enter name or username..."}
                />
              </div>

              {loadingDirectory ? (
                <div className="flex justify-center p-8"><Spinner /></div>
              ) : directoryResults.length === 0 ? (
                <div className="text-sm text-[var(--t3)] text-center py-6">
                  {directoryQuery.length < 2
                    ? (isFarsi ? "برای جستجو حداقل ۲ کاراکتر تایپ کنید" : "Type at least 2 characters to search.")
                    : (isFarsi ? "کاربری یافت نشد" : "No users found.")}
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--b)] rounded-xl">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase bg-[var(--s3)] text-left">
                        <th className="p-4">{isFarsi ? "نام کامل" : "Full Name"}</th>
                        <th className="p-4">{isFarsi ? "نام کاربری" : "Username"}</th>
                        <th className="p-4">{isFarsi ? "ایمیل" : "Email"}</th>
                        <th className="p-4">{isFarsi ? "نقش" : "Role"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directoryResults.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                          <td className="p-4 font-semibold text-[var(--t1)]">{u.full_name}</td>
                          <td className="p-4 text-[var(--t2)]">@{u.username}</td>
                          <td className="p-4 text-[var(--t2)]">{u.email || "—"}</td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              u.role === "admin"
                                ? "bg-red-500/10 text-red-500"
                                : u.role === "teacher"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-emerald-500/10 text-emerald-500"
                            }`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
    </AppShell>
  );
}

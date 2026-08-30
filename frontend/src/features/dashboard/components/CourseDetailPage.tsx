import { getApiErrorData } from "@/lib/api/errors";
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type Course, type AcademyClass } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { language } = useLocale();
  const { hasPermission, activeRole } = useOrgPermission();
  const isStudent = activeRole?.toLowerCase() === "student";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isFarsi = language === "fa";
  const isAdmin = hasPermission("can_manage_members");
  const id = parseInt(courseId || "0");

  // ── Smart Inspection Drawer ─────────────────────────────────────
  const [inspectType, setInspectType] = useState<"student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | "assignment" | null>(null);
  const [inspectId, setInspectId] = useState<string | number | null>(null);

  const { data: courseBalance } = useQuery({
    queryKey: ["course-balance", id],
    queryFn: () => crmApi.getInvoiceBalance({ course_id: id }),
  });

  const totalBilled = courseBalance?.total_billed || 0;
  const totalPaid = courseBalance?.total_paid || 0;
  const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100;

  // ── Queries ──────────────────────────────────────────
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const course = courses.find((c) => c.id === id);
  const linkedClasses = classes.filter((cls) => cls.course === id);

  // ── Edit Modal ────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", code: "", description: "", price: "" });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailCleared, setThumbnailCleared] = useState(false);

  const openEdit = () => {
    if (!course) return;
    setCourseForm({ title: course.title, code: course.code, description: course.description, price: course.price });
    setThumbnailFile(null);
    setThumbnailPreview(course.thumbnail || null);
    setThumbnailCleared(false);
    setIsEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: ({ data }: { data: FormData | Partial<Course> }) => crmApi.updateCourse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(isFarsi ? "دوره با موفقیت ویرایش شد" : "Course updated");
      setIsEditOpen(false);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در ویرایش" : "Failed to update course"));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(isFarsi ? "دوره حذف شد" : "Course deleted");
      navigate("/academic/courses");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در حذف" : "Failed to delete"));
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", courseForm.title);
    formData.append("code", courseForm.code);
    formData.append("description", courseForm.description);
    formData.append("price", courseForm.price);
    if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
    else if (thumbnailCleared) formData.append("thumbnail", "");
    updateMutation.mutate({ data: formData });
  };

  // ── Helpers ────────────────────────────────────────────
  const getClassStudentCount = (classId: number) =>
    enrollments.filter((e) => e.academy_class === classId && e.is_active).length;

  const getClassStatus = (cls: AcademyClass) => {
    const now = new Date();
    if (cls.latest_session?.status === "live") return "live";
    if (cls.end_date && new Date(cls.end_date) < now) return "ended";
    if (cls.start_date && new Date(cls.start_date) > now) return "upcoming";
    return "active";
  };

  const statusBadge = (cls: AcademyClass) => {
    const s = getClassStatus(cls);
    if (s === "live") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[var(--green)] animate-pulse">{isFarsi ? "زنده" : "LIVE"}</span>;
    if (s === "ended") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--t3)]">{isFarsi ? "پایان یافته" : "Ended"}</span>;
    if (s === "upcoming") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{isFarsi ? "آینده" : "Upcoming"}</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{isFarsi ? "فعال" : "Active"}</span>;
  };

  // ── Loading / Not Found ────────────────────────────────
  if (loadingCourses) {
    return (
      <AppShell title="...">
        <div className="flex justify-center p-16"><Spinner /></div>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell title={isFarsi ? "دوره یافت نشد" : "Course Not Found"}>
        <div className="p-12 text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-[var(--t3)] mb-4">{isFarsi ? "این دوره وجود ندارد یا حذف شده است." : "This course does not exist or has been deleted."}</p>
          <Link to="/academic/courses">
            <Button variant="secondary">{isFarsi ? "بازگشت به لیست دوره‌ها" : "Back to Courses"}</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const totalStudents = linkedClasses.reduce((acc, cls) => acc + getClassStudentCount(cls.id), 0);

  return (
    <AppShell title={course.title}>
      <div className="flex flex-col gap-6">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
          <Link to="/academic/courses" className="hover:text-[var(--brand)] transition-colors">
            {isFarsi ? "دوره‌ها" : "Courses"}
          </Link>
          <span>/</span>
          <span className="text-[var(--t1)] font-medium">{course.title}</span>
        </div>

        {/* ── Hero Card ── */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden">
          <div className="relative h-44 bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 flex items-center justify-center overflow-hidden">
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <span className="text-7xl font-black text-[var(--brand)]/20 select-none">{course.code.slice(0, 3)}</span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--s2)] via-transparent to-transparent" />
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-[var(--brand)] bg-[var(--brand)]/10 px-2 py-0.5 rounded">{course.code}</span>
                </div>
                <h1 className="text-2xl font-bold text-[var(--t1)] mb-2">{course.title}</h1>
                <p className="text-sm text-[var(--t2)] leading-relaxed max-w-2xl">
                  {course.description || (isFarsi ? "توضیحاتی ثبت نشده است." : "No description provided.")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin && (
                  <>
                    <Button size="sm" variant="secondary" onClick={openEdit}>
                      {isFarsi ? "ویرایش" : "Edit"}
                    </Button>
                    <button
                      onClick={() => {
                        if (confirm(isFarsi ? "آیا از حذف این دوره مطمئن هستید؟" : "Delete this course?")) {
                          deleteMutation.mutate();
                        }
                      }}
                      className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer px-2 py-1.5"
                    >
                      {isFarsi ? "حذف" : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[var(--b)]">
              <div className="text-center">
                <div className="text-2xl font-black text-[var(--brand)]">{linkedClasses.length}</div>
                <div className="text-[10px] text-[var(--t3)] uppercase tracking-wide mt-0.5">{isFarsi ? "کلاس‌ها" : "Classes"}</div>
              </div>
              {isStudent ? (
                <div className="text-center">
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{course.code}</div>
                  <div className="text-[10px] text-[var(--t3)] uppercase tracking-wide mt-0.5">{isFarsi ? "کد دوره" : "Course Code"}</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400">{totalStudents}</div>
                  <div className="text-[10px] text-[var(--t3)] uppercase tracking-wide mt-0.5">{isFarsi ? "دانشجویان" : "Students"}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-black text-[var(--amber)]">${parseFloat(course.price).toFixed(0)}</div>
                <div className="text-[10px] text-[var(--t3)] uppercase tracking-wide mt-0.5">{isFarsi ? "شهریه" : "Tuition"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Financial Summary Block ── */}
        {hasPermission("can_view_financials") && (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
              {isFarsi ? "خلاصه مالی دوره" : "Course Financial Summary"}
            </h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-3 bg-[var(--s3)] rounded-xl border border-[var(--b)]">
                <div className="text-[10px] text-[var(--t3)] uppercase font-semibold mb-1">
                  {isFarsi ? "کل شهریه صادر شده" : "Total Billed"}
                </div>
                <div className="text-xl font-bold text-[var(--t1)]">
                  ${totalBilled.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-[var(--s3)] rounded-xl border border-[var(--b)]">
                <div className="text-[10px] text-[var(--t3)] uppercase font-semibold mb-1">
                  {isFarsi ? "نرخ وصول شهریه" : "Collection Rate"}
                </div>
                <div className="text-xl font-bold text-[var(--green)]">
                  {collectionRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Class Sections ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--t1)] uppercase tracking-wide">
              {isFarsi ? "کلاس‌های این دوره" : "Class Sections"}
            </h2>
            {isAdmin && (
              <Link to={`/academic/classes?course=${id}`}>
                <Button size="sm">{isFarsi ? "+ کلاس جدید" : "+ New Class"}</Button>
              </Link>
            )}
          </div>

          {loadingClasses ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : linkedClasses.length === 0 ? (
            <div className="bg-[var(--s2)] border border-dashed border-[var(--b)] rounded-2xl p-12 text-center">
              <div className="text-3xl mb-3">🏫</div>
              <p className="text-sm text-[var(--t3)]">
                {isFarsi ? "هیچ کلاسی برای این دوره ثبت نشده است." : "No class sections have been created for this course yet."}
              </p>
              {isAdmin && (
                <Link to="/academic/classes" className="inline-block mt-4">
                  <Button size="sm">{isFarsi ? "رفتن به کلاس‌ها" : "Go to Classes"}</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {linkedClasses.map((cls) => {
                const studentCount = getClassStudentCount(cls.id);
                return (
                  <Link
                    key={cls.id}
                    to={`/academic/classes/${cls.id}`}
                    className="group bg-[var(--s2)] border border-[var(--b)] rounded-xl p-4 hover:border-[var(--brand)]/40 hover:shadow-lg hover:shadow-[var(--brand)]/5 transition-all no-underline"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)] font-black text-sm flex-shrink-0">
                          {cls.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--t1)] text-sm group-hover:text-[var(--brand)] transition-colors">{cls.name}</div>
                          <div className="text-[10px] text-[var(--t3)] flex flex-col gap-0.5 mt-0.5">
                            <span>
                              👤{" "}
                              {cls.teacher ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInspectType("teacher");
                                    setInspectId(cls.teacher!);
                                  }}
                                  className="bg-transparent border-none p-0 text-[var(--t3)] hover:text-[var(--brand)] hover:underline cursor-pointer text-[10px] font-medium align-baseline text-left"
                                >
                                  {cls.teacher_name || (isFarsi ? "بدون مدرس" : "No Teacher")}
                                </button>
                              ) : (
                                <span>{cls.teacher_name || (isFarsi ? "بدون مدرس" : "No Teacher")}</span>
                              )}
                            </span>
                            <span>
                              🤝{" "}
                              {cls.mentor ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInspectType("mentor");
                                    setInspectId(cls.mentor!);
                                  }}
                                  className="bg-transparent border-none p-0 text-[var(--t3)] hover:text-[var(--brand)] hover:underline cursor-pointer text-[10px] font-medium align-baseline text-left"
                                >
                                  {cls.mentor_name || (isFarsi ? "بدون منتور" : "No Mentor")}
                                </button>
                              ) : (
                                <span>{cls.mentor_name || (isFarsi ? "بدون منتور" : "No Mentor")}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      {statusBadge(cls)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-[var(--b)]">
                      <div>
                        <div className="text-sm font-bold text-[var(--t1)]">{studentCount}</div>
                        <div className="text-[9px] text-[var(--t3)] uppercase">{isFarsi ? "دانشجو" : "Students"}</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--t1)]">{cls.session_count || 0}</div>
                        <div className="text-[9px] text-[var(--t3)] uppercase">{isFarsi ? "جلسات" : "Sessions"}</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--t1)]">{cls.room || "—"}</div>
                        <div className="text-[9px] text-[var(--t3)] uppercase">{isFarsi ? "اتاق" : "Room"}</div>
                      </div>
                    </div>
                    {(cls.start_date || cls.end_date) && (
                      <div className="flex items-center gap-1 mt-3 text-[10px] text-[var(--t3)]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {cls.start_date} {cls.end_date ? `→ ${cls.end_date}` : ""}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Quick Links ── */}
        {(() => {
          const links = [
            {
              label: isFarsi ? "مشاهده فاکتورها" : "View Invoices",
              desc: isFarsi ? "فاکتورهای مرتبط با این دوره" : "Tuition invoices for this course",
              icon: "💰",
              to: isStudent ? `/academic/payments?course=${id}` : `/finance/ledger?course=${id}`,
              visible: true,
            },
            {
              label: isFarsi ? "مشاهده ثبت‌نام‌ها" : "View Enrollments",
              desc: isFarsi ? "دانشجویان ثبت‌نام شده" : "Enrolled students across all classes",
              icon: "📋",
              to: `/crm/members?tab=enrollments&course=${id}`,
              visible: !isStudent,
            },
            {
              label: isFarsi ? "برنامه جلسات" : "Session Schedule",
              desc: isFarsi ? "تمام جلسات این دوره" : "All sessions for this course",
              icon: "📅",
              to: `/academic/sessions`,
              visible: true,
            },
          ].filter((l) => l.visible);

          return (
            <div className={`grid grid-cols-1 sm:grid-cols-${links.length} gap-3`}>
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 bg-[var(--s2)] border border-[var(--b)] rounded-xl p-4 hover:border-[var(--brand)]/40 hover:bg-[var(--s3)] transition-all no-underline group"
                >
                  <span className="text-2xl">{link.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--t1)] group-hover:text-[var(--brand)] transition-colors">{link.label}</div>
                    <div className="text-[10px] text-[var(--t3)]">{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Edit Modal ── */}
      <Modal open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "ویرایش دوره" : "Edit Course"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "کد دوره" : "Course Code"}
              value={courseForm.code}
              onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
              required
            />
            <Input
              label={isFarsi ? "عنوان دوره" : "Title"}
              value={courseForm.title}
              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "تصویر کاور" : "Thumbnail"}
              </label>
              <div className="flex items-center gap-4 bg-[var(--s3)] p-3 rounded-xl border border-[var(--b)]">
                {thumbnailPreview ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-[var(--b)] flex-shrink-0 group">
                    <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); setThumbnailCleared(true); }}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer text-xs"
                    >
                      {isFarsi ? "حذف" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[var(--s2)] border border-dashed border-[var(--b)] flex items-center justify-center text-[var(--t3)] text-xs flex-shrink-0">
                    {isFarsi ? "تصویر" : "Image"}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <input type="file" accept="image/*" id="edit-thumbnail" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")) {
                          toast.error(isFarsi ? "فایل‌های SVG مجاز نیستند" : "SVG files are not allowed");
                          e.target.value = "";
                          return;
                        }
                        setThumbnailFile(f);
                        setThumbnailPreview(URL.createObjectURL(f));
                        setThumbnailCleared(false);
                      }
                    }}
                  />
                  <label htmlFor="edit-thumbnail" className="px-3 py-1.5 bg-[var(--s2)] text-[var(--t1)] text-xs font-semibold rounded-lg border border-[var(--b)] hover:bg-[var(--s1)] cursor-pointer transition-colors inline-block text-center">
                    {isFarsi ? "انتخاب تصویر" : "Select Image"}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">{isFarsi ? "توضیحات" : "Description"}</label>
              <textarea
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[80px] resize-none"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
            </div>
            <Input
              label={isFarsi ? "شهریه ($)" : "Price ($)"}
              type="number"
              value={courseForm.price}
              onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })}
              required
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>{isFarsi ? "انصراف" : "Cancel"}</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (isFarsi ? "در حال ذخیره..." : "Saving...") : (isFarsi ? "ذخیره تغییرات" : "Save Changes")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
      <InspectionDrawer
        open={!!inspectType}
        onOpenChange={(open) => {
          if (!open) {
            setInspectType(null);
            setInspectId(null);
          }
        }}
        entityType={inspectType}
        entityId={inspectId}
      />
    </AppShell>
  );
}

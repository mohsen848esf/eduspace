import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type AcademyClass } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import ClassSessionsSubTable from "../../sessions/components/ClassSessionsSubTable";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

export default function ClassesPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";

  const isOrisAdmin = hasPermission("can_manage_members");

  const [expandedClassId, setExpandedClassId] = useState<number | null>(null);

  // Queries
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
  });

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: crmApi.createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "کلاس با موفقیت ایجاد شد" : "Class created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ایجاد کلاس" : "Failed to create class"));
    }
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AcademyClass> }) => crmApi.updateClass(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "کلاس با موفقیت ویرایش شد" : "Class updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش کلاس" : "Failed to update class"));
    }
  });

  const deleteClassMutation = useMutation({
    mutationFn: crmApi.deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "کلاس با موفقیت حذف شد" : "Class deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف کلاس" : "Failed to delete class"));
    }
  });

  // Autocomplete Search State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Enrollment management modal states
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [selectedClassForEnrollment, setSelectedClassForEnrollment] = useState<AcademyClass | null>(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [classForm, setClassForm] = useState({ name: "", course: "", teacher: "", start_date: "", end_date: "", room: "" });

  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      crmApi.searchUsers(userSearchQuery, "teacher").then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery]);

  const openCreateModal = () => {
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    setClassForm({
      name: "",
      course: courses[0]?.id.toString() || "",
      teacher: "",
      start_date: "",
      end_date: "",
      room: ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: AcademyClass) => {
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    setClassForm({
      name: item.name,
      course: item.course.toString(),
      teacher: item.teacher?.toString() || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      room: item.room || ""
    });
    if (item.teacher_name) {
      setUserSearchQuery(item.teacher_name);
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: classForm.name,
      course: parseInt(classForm.course),
      teacher: classForm.teacher ? parseInt(classForm.teacher) : null,
      start_date: classForm.start_date || null,
      end_date: classForm.end_date || null,
      room: classForm.room || null
    };

    if (editId) {
      updateClassMutation.mutate({ id: editId, data: payload });
    } else {
      createClassMutation.mutate(payload);
    }
  };

  return (
    <AppShell title={isFarsi ? "کلاس‌های آموزشی" : "Classes"}>
      <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
          <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
            {isFarsi ? "لیست کلاس‌ها و برنامه‌ها" : "Scheduled Classes"}
          </span>
          {isOrisAdmin && (
            <Button size="sm" onClick={openCreateModal}>
              {isFarsi ? "+ کلاس جدید" : "+ New Class"}
            </Button>
          )}
        </div>

        {loadingClasses ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)]">
            {isFarsi ? "کلاسی وجود ندارد" : "No classes scheduled."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                  <th className="p-4">{isFarsi ? "نام کلاس" : "Class Name"}</th>
                  <th className="p-4">{isFarsi ? "دوره" : "Course"}</th>
                  <th className="p-4">{isFarsi ? "مدرس" : "Teacher"}</th>
                  <th className="p-4">{isFarsi ? "اتاق" : "Room"}</th>
                  <th className="p-4">{isFarsi ? "تاریخ شروع" : "Start Date"}</th>
                  <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <Fragment key={cls.id}>
                    <tr className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4 font-semibold text-[var(--t1)]">
                        <div className="flex items-center gap-1.5">
                          {cls.name}
                          {cls.latest_session?.status === "live" && (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--green)] animate-pulse"
                              title={isFarsi ? "کلاس زنده در جریان است" : "Live Session in progress"}
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[var(--t2)]">{cls.course_title} ({cls.course_code})</td>
                      <td className="p-4 text-[var(--t1)]">{cls.teacher_name || "—"}</td>
                      <td className="p-4 text-[var(--t2)]">{cls.room || "—"}</td>
                      <td className="p-4 text-[var(--t3)]">{cls.start_date || "—"}</td>
                      <td className="p-4 text-right flex justify-end gap-2 flex-wrap max-w-xs">
                        <button
                          onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                          className="text-xs bg-transparent text-[var(--brand-text)] hover:underline border-none cursor-pointer font-bold"
                        >
                          {isFarsi ? `جلسات (${cls.session_count || 0})` : `Sessions (${cls.session_count || 0})`}
                        </button>
                        {isOrisAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedClassForEnrollment(cls);
                                setIsEnrollmentModalOpen(true);
                              }}
                              className="text-xs bg-transparent text-[var(--amber)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "ثبت‌نام‌ها" : "Enrollments"}
                            </button>
                            <button
                              onClick={() => openEditModal(cls)}
                              className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "ویرایش" : "Edit"}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(isFarsi ? "آیا از حذف این کلاس مطمئن هستید؟" : "Are you sure you want to delete this class?")) {
                                  deleteClassMutation.mutate(cls.id);
                                }
                              }}
                              className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "حذف" : "Delete"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedClassId === cls.id && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <ClassSessionsSubTable
                            cls={cls}
                            language={language}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {editId
              ? (isFarsi ? "ویرایش کلاس" : "Edit Class")
              : (isFarsi ? "ایجاد کلاس جدید" : "New Class")}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "نام گروه / کلاس" : "Class Name"}
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              placeholder="e.g. Group A"
              required
            />
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "دوره آموزشی" : "Course"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={classForm.course}
                onChange={(e) => setClassForm({ ...classForm, course: e.target.value })}
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "جستجوی مدرس" : "Search Teacher"}
              </label>
              <Input
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (!e.target.value) setClassForm({ ...classForm, teacher: "" });
                }}
                placeholder={isFarsi ? "نام مدرس را بنویسید (حداقل ۲ کاراکتر)" : "Type teacher name..."}
              />
              {searchResults.length > 0 && (
                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setClassForm({ ...classForm, teacher: u.id.toString() });
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

            <div className="grid grid-cols-2 gap-2">
              <Input
                label={isFarsi ? "تاریخ شروع" : "Start Date"}
                type="date"
                value={classForm.start_date}
                onChange={(e) => setClassForm({ ...classForm, start_date: e.target.value })}
              />
              <Input
                label={isFarsi ? "تاریخ پایان" : "End Date"}
                type="date"
                value={classForm.end_date}
                onChange={(e) => setClassForm({ ...classForm, end_date: e.target.value })}
              />
            </div>
            <Input
              label={isFarsi ? "شماره اتاق / کلاس فیزیکی" : "Room"}
              value={classForm.room}
              onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
              placeholder="e.g. Room 302"
            />

            {(() => {
              if (!classForm.start_date || !classForm.end_date) return null;
              const formStart = new Date(classForm.start_date);
              const formEnd = new Date(classForm.end_date);
              const formTeacher = classForm.teacher ? parseInt(classForm.teacher) : null;
              const formRoom = classForm.room ? classForm.room.trim().toLowerCase() : "";

              for (const c of classes) {
                if (editId && c.id === editId) continue;
                if (!c.start_date || !c.end_date) continue;
                const cStart = new Date(c.start_date);
                const cEnd = new Date(c.end_date);

                if (formStart <= cEnd && formEnd >= cStart) {
                  if (formTeacher && c.teacher === formTeacher) {
                    return (
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
                          {isFarsi ? "هشدار تداخل مدرس:" : "Teacher Conflict Warning:"}
                        </div>
                        <div>
                          {isFarsi
                            ? `مدرس ${c.teacher_name || "مورد نظر"} قبلاً در کلاس "${c.name}" برای این بازه زمانی انتخاب شده است.`
                            : `Teacher ${c.teacher_name || "selected"} is already assigned to "${c.name}" during this period.`}
                        </div>
                      </div>
                    );
                  }
                  if (formRoom && c.room && c.room.trim().toLowerCase() === formRoom) {
                    return (
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
                          {isFarsi ? "هشدار تداخل اتاق:" : "Room Conflict Warning:"}
                        </div>
                        <div>
                          {isFarsi
                            ? `اتاق ${c.room} قبلاً در کلاس "${c.name}" برای این بازه زمانی رزرو شده است.`
                            : `Room ${c.room} is already booked for "${c.name}" during this period.`}
                        </div>
                      </div>
                    );
                  }
                }
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={createClassMutation.isPending || updateClassMutation.isPending}
              >
                {isFarsi ? "ثبت اطلاعات" : "Save Changes"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* Enrollment Management Modal */}
      {isEnrollmentModalOpen && selectedClassForEnrollment && (
        <EnrollmentManagerModal
          cls={selectedClassForEnrollment}
          isFarsi={isFarsi}
          onClose={() => {
            setIsEnrollmentModalOpen(false);
            setSelectedClassForEnrollment(null);
          }}
        />
      )}
    </AppShell>
  );
}

interface EnrollmentManagerModalProps {
  cls: AcademyClass;
  isFarsi: boolean;
  onClose: () => void;
}

function EnrollmentManagerModal({ cls, isFarsi, onClose }: EnrollmentManagerModalProps) {
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Fetch all enrollments
  const { data: allEnrollments = [], isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  // Filter enrollments for this class
  const classEnrollments = allEnrollments.filter(
    (e) => e.academy_class === cls.id && e.is_active
  );

  // Search students
  useEffect(() => {
    if (studentSearch.length >= 2) {
      crmApi.searchUsers(studentSearch, "student").then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [studentSearch]);

  const enrollMutation = useMutation({
    mutationFn: (studentId: number) =>
      crmApi.createEnrollment({ academy_class: cls.id, student: studentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "دانشجو با موفقیت ثبت‌نام شد" : "Student enrolled successfully");
      setStudentSearch("");
      setSearchResults([]);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت‌نام دانشجو" : "Failed to enroll student"));
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: crmApi.deleteEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "ثبت‌نام دانشجو لغو شد" : "Student enrollment removed successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در لغو ثبت‌نام" : "Failed to remove enrollment"));
    },
  });

  return (
    <Modal open={true} onOpenChange={(open) => { if (!open) onClose(); }} panelClassName="max-w-xl">
      <ModalHeader>
        <ModalTitle>
          {isFarsi
            ? `مدیریت ثبت‌نام‌های کلاس ${cls.name}`
            : `Manage Enrollments - ${cls.name}`}
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        {/* Search Input for Students */}
        <div className="flex flex-col gap-1.5 w-full relative">
          <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
            {isFarsi ? "جستجو و ثبت‌نام دانشجو جدید" : "Search & Enroll New Student"}
          </label>
          <Input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder={isFarsi ? "نام یا نام کاربری دانشجو (حداقل ۲ کاراکتر)..." : "Search student by name/username..."}
          />
          {searchResults.length > 0 && (
            <div className="absolute top-[100%] left-0 right-0 z-50 bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[150px] overflow-y-auto mt-1 flex flex-col gap-1 shadow-lg">
              {searchResults.map((u) => {
                const isAlreadyEnrolled = classEnrollments.some((e) => e.student === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isAlreadyEnrolled}
                    onClick={() => enrollMutation.mutate(u.id)}
                    className="w-full text-start p-2 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{u.full_name} ({u.username})</span>
                    {isAlreadyEnrolled && (
                      <span className="text-[10px] text-[var(--t3)]">
                        {isFarsi ? "قبلاً ثبت‌نام شده" : "Already enrolled"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Enrollments list */}
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
            {isFarsi ? "دانشجویان ثبت‌نام شده" : "Enrolled Students"}
          </span>
          {isLoading ? (
            <div className="p-4 flex justify-center"><Spinner /></div>
          ) : classEnrollments.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--t3)] bg-[var(--s3)] border border-[var(--b)] rounded-xl">
              {isFarsi ? "هیچ دانشجویی در این کلاس ثبت‌نام نکرده است." : "No students enrolled in this class."}
            </div>
          ) : (
            <div className="border border-[var(--b)] rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] bg-[var(--s3)] text-left">
                    <th className="p-2.5">{isFarsi ? "نام و نام کاربری" : "Student"}</th>
                    <th className="p-2.5 text-right">{isFarsi ? "عملیات" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {classEnrollments.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-2.5 text-[var(--t1)]">
                        {e.student_full_name} ({e.student_username})
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(isFarsi ? `آیا می‌خواهید ثبت‌نام ${e.student_full_name} را لغو کنید؟` : `Are you sure you want to unenroll ${e.student_full_name}?`)) {
                              unenrollMutation.mutate(e.id);
                            }
                          }}
                          className="text-[10px] bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                        >
                          {isFarsi ? "لغو ثبت‌نام" : "Unenroll"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>
            {isFarsi ? "بستن" : "Close"}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

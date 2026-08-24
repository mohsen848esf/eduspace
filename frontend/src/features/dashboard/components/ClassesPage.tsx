import { useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type AcademyClass } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { DatePicker } from "../../../components/forms/DatePicker";

import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import ClassSessionsSubTable from "../../sessions/components/ClassSessionsSubTable";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import { useAuthStore } from "../../auth/store/authStore";
import BroadcastComposer from "./BroadcastComposer";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";
import { TableRowActions, type TableAction } from "../../../components/ui/TableRowActions";
import { Calendar, Send, Users } from "lucide-react";

export default function ClassesPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";
  const { user } = useAuthStore();

  const isOrisAdmin = hasPermission("can_manage_members");

  const [expandedClassId, setExpandedClassId] = useState<number | null>(null);
  
  // Smart Inspection Drawer states
  const [inspectType, setInspectType] = useState<"student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | "assignment" | null>(null);
  const [inspectId, setInspectId] = useState<string | number | null>(null);

  // Broadcast modal states
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [selectedClassForBroadcast, setSelectedClassForBroadcast] = useState<AcademyClass | null>(null);

  // Queries
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["orgMembers"],
    queryFn: crmApi.getMembers,
    enabled: isOrisAdmin,
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
  const [studentSearch, setStudentSearch] = useState("");
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Enrollment management modal states
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [selectedClassForEnrollment, setSelectedClassForEnrollment] = useState<AcademyClass | null>(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [classForm, setClassForm] = useState<{
    name: string;
    course: string;
    teacher: string;
    mentor: string;
    start_date: string;
    end_date: string;
    room: string;
    student_ids: number[];
    scheduling_mode: 'manual' | 'automatic';
    capacity_mode: 'unlimited' | 'limited';
    max_students: string;
    recurrence_weekdays: string[];
    recurrence_start_time: string;
    recurrence_duration_minutes: string;
    recurrence_timezone: string;
    recurrence_end_mode: 'date' | 'occurrences';
    recurrence_max_occurrences: string;
  }>({
    name: "",
    course: "",
    teacher: "",
    mentor: "",
    start_date: "",
    end_date: "",
    room: "",
    student_ids: [],
    scheduling_mode: "manual",
    capacity_mode: "unlimited",
    max_students: "",
    recurrence_weekdays: [],
    recurrence_start_time: "",
    recurrence_duration_minutes: "90",
    recurrence_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    recurrence_end_mode: "date",
    recurrence_max_occurrences: "",
  });
  const [mentorSearchQuery, setMentorSearchQuery] = useState("");
  const [mentorSearchResults, setMentorSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      crmApi.searchUsers(userSearchQuery, "teacher").then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery]);

  useEffect(() => {
    if (mentorSearchQuery.length >= 2) {
      crmApi.searchUsers(mentorSearchQuery, "mentor").then(setMentorSearchResults);
    } else {
      setMentorSearchResults([]);
    }
  }, [mentorSearchQuery]);

  const openCreateModal = () => {
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    setMentorSearchQuery("");
    setMentorSearchResults([]);
    setStudentSearch("");
    setIsStudentDropdownOpen(false);
    setClassForm({
      name: "",
      course: courses[0]?.id.toString() || "",
      teacher: "",
      mentor: "",
      start_date: "",
      end_date: "",
      room: "",
      student_ids: [],
      scheduling_mode: "manual",
      capacity_mode: "unlimited",
      max_students: "",
      recurrence_weekdays: [],
      recurrence_start_time: "",
      recurrence_duration_minutes: "90",
      recurrence_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      recurrence_end_mode: "date",
      recurrence_max_occurrences: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: AcademyClass) => {
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    setMentorSearchQuery("");
    setMentorSearchResults([]);
    setStudentSearch("");
    setIsStudentDropdownOpen(false);
    setClassForm({
      name: item.name,
      course: item.course.toString(),
      teacher: item.teacher?.toString() || "",
      mentor: item.mentor?.toString() || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      room: item.room || "",
      student_ids: item.enrolled_student_ids || [],
      scheduling_mode: item.scheduling_mode || "manual",
      capacity_mode: item.capacity_mode || "unlimited",
      max_students: item.max_students?.toString() || "",
      recurrence_weekdays: item.recurrence_weekdays || [],
      recurrence_start_time: item.recurrence_start_time || "",
      recurrence_duration_minutes: item.recurrence_duration_minutes?.toString() || "90",
      recurrence_timezone: item.recurrence_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      recurrence_end_mode: item.recurrence_end_mode || "date",
      recurrence_max_occurrences: item.recurrence_max_occurrences?.toString() || "",
    });
    if (item.teacher_name) {
      setUserSearchQuery(item.teacher_name);
    }
    if (item.mentor_name) {
      setMentorSearchQuery(item.mentor_name);
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: classForm.name,
      course: parseInt(classForm.course),
      teacher: classForm.teacher ? parseInt(classForm.teacher) : null,
      mentor: classForm.mentor ? parseInt(classForm.mentor) : null,
      start_date: classForm.start_date || null,
      end_date: classForm.end_date || null,
      room: classForm.room || null,
      student_ids: classForm.student_ids,
      scheduling_mode: classForm.scheduling_mode,
      capacity_mode: classForm.capacity_mode,
      max_students: classForm.capacity_mode === 'limited' ? parseInt(classForm.max_students) : null,
      recurrence_weekdays: classForm.scheduling_mode === 'automatic' ? classForm.recurrence_weekdays : [],
      recurrence_start_time: classForm.scheduling_mode === 'automatic' && classForm.recurrence_start_time ? classForm.recurrence_start_time : null,
      recurrence_duration_minutes: classForm.scheduling_mode === 'automatic' && classForm.recurrence_duration_minutes ? parseInt(classForm.recurrence_duration_minutes) : null,
      recurrence_timezone: classForm.scheduling_mode === 'automatic' ? classForm.recurrence_timezone : 'UTC',
      recurrence_end_mode: classForm.scheduling_mode === 'automatic' ? classForm.recurrence_end_mode : 'date',
      recurrence_max_occurrences: classForm.scheduling_mode === 'automatic' && classForm.recurrence_end_mode === 'occurrences' && classForm.recurrence_max_occurrences ? parseInt(classForm.recurrence_max_occurrences) : null,
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
                  <th className="p-4">{isFarsi ? "منتور" : "Mentor"}</th>
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
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/academic/classes/${cls.id}`}
                              className="font-semibold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline"
                            >
                              {cls.name}
                            </Link>
                            {cls.latest_session?.status === "live" && (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--green)] animate-pulse"
                                title={isFarsi ? "کلاس زنده در جریان است" : "Live Session in progress"}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {cls.scheduling_mode === 'automatic' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand)]/10 text-[var(--brand)]">
                                {isFarsi ? "خودکار" : "Automatic"}
                              </span>
                            )}
                            {cls.capacity_mode === 'limited' && cls.max_students && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                                {isFarsi ? `ظرفیت: ${(cls.enrolled_student_ids || []).length}/${cls.max_students}` : `Cap: ${(cls.enrolled_student_ids || []).length}/${cls.max_students}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-[var(--t2)]">{cls.course_title} ({cls.course_code})</td>
                      <td className="p-4">
                        {cls.teacher ? (
                          <button
                            onClick={() => {
                              setInspectType("teacher");
                              setInspectId(cls.teacher!);
                            }}
                            className="bg-transparent border-none p-0 text-[var(--t1)] hover:text-[var(--brand)] hover:underline cursor-pointer font-medium text-left"
                          >
                            {cls.teacher_name}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4">
                        {cls.mentor ? (
                          <button
                            onClick={() => {
                              setInspectType("mentor");
                              setInspectId(cls.mentor!);
                            }}
                            className="bg-transparent border-none p-0 text-[var(--t1)] hover:text-[var(--brand)] hover:underline cursor-pointer font-medium text-left"
                          >
                            {cls.mentor_name}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-[var(--t2)]">{cls.room || "—"}</td>
                      <td className="p-4 text-[var(--t3)]">{cls.start_date || "—"}</td>
                      <td className="p-4 text-right">
                        {(() => {
                          const classActions: TableAction[] = [];
                          
                          // Sessions toggle action
                          classActions.push({
                            label: isFarsi 
                              ? `جلسات (${cls.session_count || 0})` 
                              : `Sessions (${cls.session_count || 0})`,
                            onClick: () => setExpandedClassId(expandedClassId === cls.id ? null : cls.id),
                            icon: Calendar
                          });

                          // Broadcast action
                          if (isOrisAdmin || (hasPermission("can_teach_class") && cls.teacher === user?.id)) {
                            classActions.push({
                              label: isFarsi ? "ارسال پیام" : "Broadcast",
                              onClick: () => {
                                setSelectedClassForBroadcast(cls);
                                setIsBroadcastModalOpen(true);
                              },
                              icon: Send
                            });
                          }

                          // Admin-specific actions
                          if (isOrisAdmin) {
                            classActions.push({
                              label: isFarsi ? "ثبت‌نام‌ها" : "Enrollments",
                              onClick: () => {
                                setSelectedClassForEnrollment(cls);
                                setIsEnrollmentModalOpen(true);
                              },
                              icon: Users
                            });
                            classActions.push({
                              label: isFarsi ? "ویرایش" : "Edit",
                              onClick: () => openEditModal(cls),
                              isEdit: true
                            });
                            classActions.push({
                              label: isFarsi ? "حذف" : "Delete",
                              onClick: () => {
                                if (confirm(isFarsi ? "آیا از حذف این کلاس مطمئن هستید؟" : "Are you sure you want to delete this class?")) {
                                  deleteClassMutation.mutate(cls.id);
                                }
                              },
                              isDelete: true
                            });
                          }

                          return (
                            <TableRowActions
                              isFarsi={isFarsi}
                              actions={classActions}
                            />
                          );
                        })()}
                      </td>
                    </tr>
                    {expandedClassId === cls.id && (
                      <tr>
                        <td colSpan={7} className="p-0">
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

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} panelClassName="max-w-3xl w-full">
        <form onSubmit={handleFormSubmit}>
          <ModalHeader>
            <ModalTitle>
              {editId
                ? (isFarsi ? "ویرایش کلاس" : "Edit Class")
                : (isFarsi ? "ایجاد کلاس جدید" : "New Class")}
            </ModalTitle>
          </ModalHeader>
          <ModalBody className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
              {/* Left Column: Core Settings */}
              <div className="flex flex-col gap-4">
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

                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    label={isFarsi ? "تاریخ شروع" : "Start Date"}
                    value={classForm.start_date || undefined}
                    onChange={(val) => setClassForm({ ...classForm, start_date: val })}
                  />
                  <DatePicker
                    label={isFarsi ? "تاریخ پایان" : "End Date"}
                    value={classForm.end_date || undefined}
                    onChange={(val) => setClassForm({ ...classForm, end_date: val })}
                  />
                </div>

                <Input
                  label={isFarsi ? "شماره اتاق / کلاس فیزیکی" : "Room"}
                  value={classForm.room}
                  onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                  placeholder="e.g. Room 302"
                />

                {/* Scheduling Mode Selection */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                    {isFarsi ? "نوع برنامه‌ریزی جلسات" : "Scheduling Mode"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClassForm({ ...classForm, scheduling_mode: 'manual' })}
                      className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                        classForm.scheduling_mode === 'manual'
                          ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                          : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {isFarsi ? "جلسات دستی" : "Manual Sessions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassForm({ ...classForm, scheduling_mode: 'automatic' })}
                      className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                        classForm.scheduling_mode === 'automatic'
                          ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                          : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {isFarsi ? "کلاس اتوماتیک" : "Automatic Continuous"}
                    </button>
                  </div>
                </div>

                {/* Automatic Recurrence Scheduling Config */}
                {classForm.scheduling_mode === 'automatic' && (
                  <div className="flex flex-col gap-4 border border-[var(--b)] p-4 rounded-2xl bg-[var(--s1)] transition-all">
                    <span className="text-xs font-semibold text-[var(--brand)] uppercase tracking-wide">
                      {isFarsi ? "تنظیمات زمان‌بندی تکرار هفتگی" : "Weekly Recurrence Config"}
                    </span>

                    {/* Weekday Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--t2)]">
                        {isFarsi ? "روزهای هفته" : "Days of Week"}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                          const isSelected = classForm.recurrence_weekdays.includes(day);
                          const dayLabel = isFarsi ? {
                            monday: "دوشنبه", tuesday: "سه‌شنبه", wednesday: "چهارشنبه",
                            thursday: "پنج‌شنبه", friday: "جمعه", saturday: "شنبه", sunday: "یکشنبه"
                          }[day] : day.charAt(0).toUpperCase() + day.slice(1);

                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const newWeekdays = isSelected
                                  ? classForm.recurrence_weekdays.filter(d => d !== day)
                                  : [...classForm.recurrence_weekdays, day];
                                setClassForm({ ...classForm, recurrence_weekdays: newWeekdays });
                              }}
                              className={`py-1.5 px-2 text-[10px] font-medium rounded-lg border transition-all cursor-pointer text-center ${
                                isSelected
                                  ? "bg-[var(--brand-dim)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm font-semibold"
                                  : "bg-[var(--s2)] text-[var(--t3)] border-[var(--b)] hover:border-[var(--brand)]"
                              }`}
                            >
                              {dayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Start Time */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-xs font-semibold text-[var(--t2)]">
                          {isFarsi ? "ساعت شروع" : "Start Time"}
                        </label>
                        <input
                          type="time"
                          className="w-full bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                          value={classForm.recurrence_start_time}
                          onChange={(e) => setClassForm({ ...classForm, recurrence_start_time: e.target.value })}
                          required
                        />
                      </div>

                      {/* Duration */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-xs font-semibold text-[var(--t2)]">
                          {isFarsi ? "مدت زمان (دقیقه)" : "Duration (Minutes)"}
                        </label>
                        <select
                          className="w-full bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                          value={classForm.recurrence_duration_minutes}
                          onChange={(e) => setClassForm({ ...classForm, recurrence_duration_minutes: e.target.value })}
                          required
                        >
                          <option value="60">60 {isFarsi ? "دقیقه" : "mins"}</option>
                          <option value="90">90 {isFarsi ? "دقیقه" : "mins"}</option>
                          <option value="120">120 {isFarsi ? "دقیقه" : "mins"}</option>
                          <option value="180">180 {isFarsi ? "دقیقه" : "mins"}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--t2)]">
                        {isFarsi ? "منطقه زمانی" : "Timezone"}
                      </label>
                      <select
                        className="w-full bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                        value={classForm.recurrence_timezone}
                        onChange={(e) => setClassForm({ ...classForm, recurrence_timezone: e.target.value })}
                        required
                      >
                        <option value="Asia/Tehran">Tehran Time (Asia/Tehran)</option>
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                        <option value="Europe/London">London Time (Europe/London)</option>
                        <option value="America/New_York">New York Time (America/New_York)</option>
                      </select>
                    </div>

                    {/* End Condition Toggle */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--t2)]">
                        {isFarsi ? "نحوه خاتمه دوره" : "End Condition"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          key="end_mode_date"
                          type="button"
                          onClick={() => setClassForm({ ...classForm, recurrence_end_mode: 'date' })}
                          className={`py-1.5 px-3 text-[10px] font-medium rounded-lg border transition-all cursor-pointer ${
                            classForm.recurrence_end_mode === 'date'
                              ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                              : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)]"
                          }`}
                        >
                          {isFarsi ? "براساس تاریخ پایان" : "Until End Date"}
                        </button>
                        <button
                          key="end_mode_occurrences"
                          type="button"
                          onClick={() => setClassForm({ ...classForm, recurrence_end_mode: 'occurrences' })}
                          className={`py-1.5 px-3 text-[10px] font-medium rounded-lg border transition-all cursor-pointer ${
                            classForm.recurrence_end_mode === 'occurrences'
                              ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                              : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)]"
                          }`}
                        >
                          {isFarsi ? "تعداد دفعات برگزاری" : "Occurrence Count"}
                        </button>
                      </div>
                    </div>

                    {/* Occurrences Count Input */}
                    {classForm.recurrence_end_mode === 'occurrences' && (
                      <Input
                        label={isFarsi ? "حداکثر دفعات تکرار" : "Number of Occurrences"}
                        type="number"
                        min="1"
                        value={classForm.recurrence_max_occurrences}
                        onChange={(e) => setClassForm({ ...classForm, recurrence_max_occurrences: e.target.value })}
                        placeholder="e.g. 12"
                        required
                      />
                    )}
                  </div>
                )}

                {/* Enrollment Capacity Mode */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                    {isFarsi ? "ظرفیت ثبت‌نام" : "Enrollment Capacity"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClassForm({ ...classForm, capacity_mode: 'unlimited' })}
                      className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                        classForm.capacity_mode === 'unlimited'
                          ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                          : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {isFarsi ? "نامحدود" : "Unlimited"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassForm({ ...classForm, capacity_mode: 'limited' })}
                      className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                        classForm.capacity_mode === 'limited'
                          ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                          : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {isFarsi ? "محدود" : "Limited"}
                    </button>
                  </div>
                </div>

                {/* Maximum Students (Only when limited capacity) */}
                {classForm.capacity_mode === 'limited' && (
                  <Input
                    label={isFarsi ? "حداکثر تعداد دانشجویان" : "Maximum Students"}
                    type="number"
                    min="1"
                    value={classForm.max_students}
                    onChange={(e) => setClassForm({ ...classForm, max_students: e.target.value })}
                    placeholder="e.g. 20"
                    required
                  />
                )}
              </div>

              {/* Right Column: Roles & Members */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 w-full relative">
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
                    <div className="absolute top-full left-0 right-0 z-[110] bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1 shadow-lg">
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

                <div className="flex flex-col gap-1.5 w-full relative">
                  <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                    {isFarsi ? "جستجوی منتور" : "Search Mentor"}
                  </label>
                  <Input
                    value={mentorSearchQuery}
                    onChange={(e) => {
                      setMentorSearchQuery(e.target.value);
                      if (!e.target.value) setClassForm({ ...classForm, mentor: "" });
                    }}
                    placeholder={isFarsi ? "نام منتور را بنویسید (حداقل ۲ کاراکتر)" : "Type mentor name..."}
                  />
                  {mentorSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[110] bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1 shadow-lg">
                      {mentorSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setClassForm({ ...classForm, mentor: u.id.toString() });
                            setMentorSearchQuery(u.full_name || u.username);
                            setMentorSearchResults([]);
                          }}
                          className="w-full text-start p-1.5 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                        >
                          {u.full_name} ({u.username})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Enroll Students Dropdown (Absolute overlay) */}
                <div className="flex flex-col gap-1.5 w-full relative">
                  <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide flex justify-between items-center">
                    <span>{isFarsi ? "ثبت‌نام دانشجویان در کلاس" : "Enroll Students"}</span>
                    <span className="text-[10px] text-[var(--t3)] font-normal">
                      {isFarsi 
                        ? `${classForm.student_ids.length} دانشجو` 
                        : `${classForm.student_ids.length} selected`}
                    </span>
                  </label>
                  
                  <div
                    onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t2)] flex items-center justify-between cursor-pointer hover:border-[var(--brand)] transition-colors select-none"
                  >
                    <span className="truncate max-w-[200px]">
                      {classForm.student_ids.length > 0
                        ? (isFarsi 
                            ? `${classForm.student_ids.length} دانشجو انتخاب شده` 
                            : `${classForm.student_ids.length} selected`)
                        : (isFarsi ? "برای انتخاب کلیک کنید..." : "Click to select...")}
                    </span>
                    <span>{isStudentDropdownOpen ? "▲" : "▼"}</span>
                  </div>

                  {isStudentDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 z-[120] bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 w-full animate-in fade-in duration-100">
                      <div className="flex justify-between items-center border-b border-[var(--b)] pb-1.5">
                        <span className="text-[10px] font-bold text-[var(--t3)] uppercase">
                          {isFarsi ? "لیست دانشجوها" : "Students list"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsStudentDropdownOpen(false);
                          }}
                          className="text-[10px] text-[var(--brand)] border-none bg-transparent hover:underline cursor-pointer font-bold"
                        >
                          {isFarsi ? "بستن ✕" : "Close ✕"}
                        </button>
                      </div>

                      <Input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder={isFarsi ? "جستجوی دانشجو..." : "Filter students..."}
                        className="py-1 text-xs"
                      />

                      <div className="flex gap-2.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="py-0.5 px-2 text-[9px] h-6 flex-1"
                          onClick={() => {
                            const filteredStudents = members.filter(
                              (m) =>
                                m.role_name?.toLowerCase().includes("student") ||
                                !m.role_name ||
                                (!m.role_name?.toLowerCase().includes("teacher") &&
                                  !m.role_name?.toLowerCase().includes("mentor") &&
                                  !m.role_name?.toLowerCase().includes("admin"))
                            );
                            const allFilteredIds = filteredStudents
                              .filter(m => (m.user_details?.full_name || m.user_details?.username || "").toLowerCase().includes(studentSearch.toLowerCase()))
                              .map(m => m.user_details.id);
                            setClassForm({
                              ...classForm,
                              student_ids: Array.from(new Set([...classForm.student_ids, ...allFilteredIds])),
                            });
                          }}
                        >
                          {isFarsi ? "انتخاب همه" : "Select All"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="py-0.5 px-2 text-[9px] h-6 flex-1"
                          onClick={() => {
                            const filteredStudents = members.filter(
                              (m) =>
                                m.role_name?.toLowerCase().includes("student") ||
                                !m.role_name ||
                                (!m.role_name?.toLowerCase().includes("teacher") &&
                                  !m.role_name?.toLowerCase().includes("mentor") &&
                                  !m.role_name?.toLowerCase().includes("admin"))
                            );
                            const allFilteredIds = filteredStudents
                              .filter(m => (m.user_details?.full_name || m.user_details?.username || "").toLowerCase().includes(studentSearch.toLowerCase()))
                              .map(m => m.user_details.id);
                            setClassForm({
                              ...classForm,
                              student_ids: classForm.student_ids.filter(id => !allFilteredIds.includes(id)),
                            });
                          }}
                        >
                          {isFarsi ? "لغو همه" : "Deselect All"}
                        </Button>
                      </div>

                      <div className="max-h-40 overflow-y-auto border border-[var(--b)] rounded-lg p-1 bg-[var(--s3)]/30 flex flex-col gap-1">
                        {(() => {
                          const filteredStudents = members.filter(
                            (m) =>
                              m.role_name?.toLowerCase().includes("student") ||
                              !m.role_name ||
                              (!m.role_name?.toLowerCase().includes("teacher") &&
                                !m.role_name?.toLowerCase().includes("mentor") &&
                                !m.role_name?.toLowerCase().includes("admin"))
                          ).filter(m => 
                            (m.user_details?.full_name || m.user_details?.username || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
                            (m.user_details?.email || "").toLowerCase().includes(studentSearch.toLowerCase())
                          );

                          if (filteredStudents.length === 0) {
                            return (
                              <div className="text-center text-[10px] text-[var(--t3)] py-3">
                                {isFarsi ? "دانشجویی یافت نشد" : "No students found"}
                              </div>
                            );
                          }

                          return filteredStudents.map((m) => {
                            const isChecked = classForm.student_ids.includes(m.user_details.id);
                            return (
                              <label
                                key={m.id}
                                className="flex items-center justify-between gap-2 text-xs text-[var(--t2)] hover:bg-[var(--s3)] p-1.5 rounded cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setClassForm({
                                          ...classForm,
                                          student_ids: [...classForm.student_ids, m.user_details.id],
                                        });
                                      } else {
                                        setClassForm({
                                          ...classForm,
                                          student_ids: classForm.student_ids.filter(id => id !== m.user_details.id),
                                        });
                                      }
                                    }}
                                    className="accent-[var(--brand)] w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="font-semibold text-[var(--t1)]">
                                    {m.user_details.full_name || m.user_details.username}
                                  </span>
                                </div>
                                <span className="text-[9px] text-[var(--t3)] font-mono">
                                  @{m.user_details.username}
                                </span>
                              </label>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Warnings Container */}
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
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1 mb-2">
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
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1 mb-2">
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
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              {isFarsi ? "انصراف" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={createClassMutation.isPending || updateClassMutation.isPending}
            >
              {createClassMutation.isPending || updateClassMutation.isPending 
                ? <Spinner size="sm" /> 
                : (isFarsi ? "ثبت اطلاعات" : "Save Changes")}
            </Button>
          </ModalFooter>
        </form>
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

      {isBroadcastModalOpen && selectedClassForBroadcast && (
        <BroadcastComposer
          classId={selectedClassForBroadcast.id}
          className={selectedClassForBroadcast.name}
          isFarsi={isFarsi}
          onClose={() => {
            setIsBroadcastModalOpen(false);
            setSelectedClassForBroadcast(null);
          }}
        />
      )}
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

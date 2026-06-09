



import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  crmApi,
  type Course,
  type AcademyClass,
  type Enrollment,
  type TuitionInvoice,
  type ExpenseItem,
  type SimpleUser
} from "../api/crm.api";
import { useAuthStore } from "../../auth/store/authStore";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import { useSessions } from "../../sessions/hooks/useSessions";
import ClassSessionsSubTable from "../../sessions/components/ClassSessionsSubTable";

interface CRMTabsProps {
  language: string;
}

export default function CRMTabs({ language }: CRMTabsProps) {
  useTranslation(["dashboard", "common"]);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: liveSessions = [] } = useSessions(undefined, "live");
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null);

  const isFarsi = language === "fa";

  // Determine role-based access
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  const canManageCRM = isAdmin || isTeacher;
  const canManageFinance = isAdmin;

  // Tabs setup based on permissions
  const tabsList = [
    { id: "overview", label: isFarsi ? "خلاصه وضعیت" : "Overview" },
    ...(isAdmin || isTeacher ? [
      { id: "courses", label: isFarsi ? "دوره‌ها" : "Courses" },
      { id: "classes", label: isFarsi ? "کلاس‌ها" : "Classes" }
    ] : []),
    { id: "enrollments", label: isFarsi ? "ثبت‌نام‌ها" : "Enrollments" },
    ...(isAdmin || isStudent ? [
      { id: "invoices", label: isFarsi ? "شهریه‌ها / فاکتورها" : "Invoices" }
    ] : []),
    ...(isAdmin ? [
      { id: "expenses", label: isFarsi ? "دفتر هزینه‌ها" : "Expenses" }
    ] : [])
  ];

  const [activeTab, setActiveTab] = useState("overview");

  // --- Search state for dropdowns ---
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);

  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      crmApi.searchUsers(userSearchQuery).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery]);

  // --- Queries ---
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
    enabled: activeTab === "courses" || activeTab === "classes" || activeTab === "invoices" || activeTab === "overview"
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
    enabled: activeTab === "classes" || activeTab === "enrollments" || activeTab === "invoices" || activeTab === "overview"
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
    enabled: activeTab === "enrollments" || activeTab === "overview"
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: crmApi.getInvoices,
    enabled: activeTab === "invoices" || activeTab === "overview"
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: crmApi.getExpenses,
    enabled: activeTab === "expenses" || activeTab === "overview"
  });

  // --- Mutations ---
  const createCourseMutation = useMutation({
    mutationFn: crmApi.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(isFarsi ? "دوره با موفقیت ایجاد شد" : "Course created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ایجاد دوره" : "Failed to create course"));
    }
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Course> }) => crmApi.updateCourse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(isFarsi ? "دوره با موفقیت ویرایش شد" : "Course updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش دوره" : "Failed to update course"));
    }
  });

  const deleteCourseMutation = useMutation({
    mutationFn: crmApi.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(isFarsi ? "دوره با موفقیت حذف شد" : "Course deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف دوره" : "Failed to delete course"));
    }
  });

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

  const createInvoiceMutation = useMutation({
    mutationFn: crmApi.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(isFarsi ? "فاکتور با موفقیت صادر شد" : "Invoice created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در صدور فاکتور" : "Failed to create invoice"));
    }
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TuitionInvoice> }) => crmApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(isFarsi ? "فاکتور با موفقیت بروزرسانی شد" : "Invoice updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در بروزرسانی فاکتور" : "Failed to update invoice"));
    }
  });

  const createExpenseMutation = useMutation({
    mutationFn: crmApi.createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(isFarsi ? "هزینه ثبت شد" : "Expense recorded successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت هزینه" : "Failed to record expense"));
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExpenseItem> }) => crmApi.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(isFarsi ? "هزینه با موفقیت ویرایش شد" : "Expense updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش هزینه" : "Failed to update expense"));
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: crmApi.deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(isFarsi ? "هزینه حذف شد" : "Expense deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف هزینه" : "Failed to delete expense"));
    }
  });

  // --- Form & Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"course" | "class" | "enrollment" | "invoice" | "expense">("course");
  const [editId, setEditId] = useState<number | null>(null);

  // Form Fields State
  const [courseForm, setCourseForm] = useState({ title: "", code: "", description: "", price: "" });
  const [classForm, setClassForm] = useState({ name: "", course: "", teacher: "", start_date: "", end_date: "", room: "" });
  const [enrollmentForm, setEnrollmentForm] = useState({ academy_class: "", student: "", is_active: true });
  const [invoiceForm, setInvoiceForm] = useState({ student: "", academy_class: "", amount: "", status: "unpaid" as const, due_date: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "rent" as const, description: "", recipient: "", incurred_at: "" });

  const openCreateModal = (type: typeof modalType) => {
    setModalType(type);
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    if (type === "course") setCourseForm({ title: "", code: "", description: "", price: "" });
    else if (type === "class") setClassForm({ name: "", course: courses[0]?.id.toString() || "", teacher: "", start_date: "", end_date: "", room: "" });
    else if (type === "enrollment") setEnrollmentForm({ academy_class: classes[0]?.id.toString() || "", student: "", is_active: true });
    else if (type === "invoice") setInvoiceForm({ student: "", academy_class: classes[0]?.id.toString() || "", amount: "", status: "unpaid", due_date: "" });
    else if (type === "expense") setExpenseForm({ amount: "", category: "rent", description: "", recipient: "", incurred_at: new Date().toISOString().split("T")[0] });
    setIsModalOpen(true);
  };

  const openEditModal = (type: typeof modalType, item: any) => {
    setModalType(type);
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    if (type === "course") {
      setCourseForm({ title: item.title, code: item.code, description: item.description, price: item.price });
    } else if (type === "class") {
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
    } else if (type === "enrollment") {
      setEnrollmentForm({
        academy_class: item.academy_class.toString(),
        student: item.student.toString(),
        is_active: item.is_active
      });
      if (item.student_full_name || item.student_username) {
        setUserSearchQuery(item.student_full_name || item.student_username);
      }
    } else if (type === "invoice") {
      setInvoiceForm({
        student: item.student.toString(),
        academy_class: item.academy_class?.toString() || "",
        amount: item.amount,
        status: item.status,
        due_date: item.due_date || ""
      });
      if (item.student_full_name || item.student_username) {
        setUserSearchQuery(item.student_full_name || item.student_username);
      }
    } else if (type === "expense") {
      setExpenseForm({
        amount: item.amount,
        category: item.category,
        description: item.description,
        recipient: item.recipient?.toString() || "",
        incurred_at: item.incurred_at || ""
      });
      if (item.recipient_full_name || item.recipient_username) {
        setUserSearchQuery(item.recipient_full_name || item.recipient_username);
      }
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === "course") {
      if (editId) updateCourseMutation.mutate({ id: editId, data: courseForm });
      else createCourseMutation.mutate(courseForm);
    } else if (modalType === "class") {
      const payload = {
        name: classForm.name,
        course: parseInt(classForm.course),
        teacher: classForm.teacher ? parseInt(classForm.teacher) : null,
        start_date: classForm.start_date || null,
        end_date: classForm.end_date || null,
        room: classForm.room || null
      };
      if (editId) updateClassMutation.mutate({ id: editId, data: payload });
      else createClassMutation.mutate(payload);
    } else if (modalType === "enrollment") {
      const payload = {
        academy_class: parseInt(enrollmentForm.academy_class),
        student: parseInt(enrollmentForm.student),
        is_active: enrollmentForm.is_active
      };
      if (editId) updateEnrollmentMutation.mutate({ id: editId, data: payload });
      else createEnrollmentMutation.mutate(payload);
    } else if (modalType === "invoice") {
      const payload = {
        student: parseInt(invoiceForm.student),
        academy_class: invoiceForm.academy_class ? parseInt(invoiceForm.academy_class) : null,
        amount: invoiceForm.amount,
        status: invoiceForm.status,
        due_date: invoiceForm.due_date || null
      };
      if (editId) updateInvoiceMutation.mutate({ id: editId, data: payload });
      else createInvoiceMutation.mutate(payload);
    } else if (modalType === "expense") {
      const payload = {
        amount: expenseForm.amount,
        category: expenseForm.category,
        description: expenseForm.description,
        recipient: expenseForm.recipient ? parseInt(expenseForm.recipient) : null,
        incurred_at: expenseForm.incurred_at || new Date().toISOString().split("T")[0]
      };
      if (editId) updateExpenseMutation.mutate({ id: editId, data: payload });
      else createExpenseMutation.mutate(payload);
    }
  };

  // --- Financial Summary Helpers ---
  const totalRevenue = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  const totalPendingRevenue = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  const totalExpense = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs navigation */}
      <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 scrollbar-none">
        {tabsList.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeTab === tab.id
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- Overview Tab --- */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Quick Metrics */}
          {(isAdmin || isTeacher) && (
            <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
              <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                {isFarsi ? "دوره‌ها و کلاس‌ها" : "Courses & Classes"}
              </h3>
              <div className="flex justify-between items-center mt-3">
                <div>
                  <div className="text-2xl font-bold text-[var(--t1)]">{courses.length}</div>
                  <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "تعداد کل دوره‌ها" : "Total Courses"}</div>
                </div>
                <div className="h-8 w-px bg-[var(--b)]" />
                <div>
                  <div className="text-2xl font-bold text-[var(--t1)]">{classes.length}</div>
                  <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "کلاس‌های فعال" : "Active Classes"}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
            <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
              {isFarsi ? "ثبت‌نام‌ها" : "Enrollments"}
            </h3>
            <div className="flex items-baseline gap-2 mt-3">
              <div className="text-3xl font-bold text-[var(--t1)]">{enrollments.length}</div>
              <div className="text-xs text-[var(--green)]">
                {isFarsi ? "ثبت‌نام فعال" : "Active student enrollments"}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-1 md:col-span-2 lg:col-span-1">
              <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                {isFarsi ? "تراز مالی" : "Financial Balance"}
              </h3>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--green)]">${totalRevenue.toFixed(1)}</div>
                  <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "دریافت شده" : "Revenue"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--amber)]">${totalPendingRevenue.toFixed(1)}</div>
                  <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "در انتظار" : "Pending"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--red)]">${totalExpense.toFixed(1)}</div>
                  <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "هزینه‌ها" : "Expenses"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Logs */}
          <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-full">
            <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-3">
              {isFarsi ? "اطلاعات کلی و اعضا" : "General Info & Members"}
            </h3>
            <div className="text-sm text-[var(--t2)] flex flex-col gap-2">
              <p>
                {isFarsi
                  ? "به سیستم مدیریت آکادمی خوش آمدید. بر اساس نقش کاربری خود می‌توانید دوره‌ها، ثبت‌نام‌ها و بخش مالی را مدیریت کنید."
                  : "Welcome to the Academy CRM. Use the tabs above to manage courses, enrollments, schedules, and view financial ledger statements."}
              </p>
              <div className="mt-2 p-3 bg-[var(--s3)] rounded-lg text-xs text-[var(--t3)]">
                {isFarsi
                  ? `نقش شما: ${user?.role} | سازمان فعال: پیش‌فرض`
                  : `Your active role: ${user?.role} | Active organization context: default-academy`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Courses Tab --- */}
      {activeTab === "courses" && (
        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "لیست دوره‌های آموزشی" : "Academy Courses"}
            </span>
            {canManageCRM && (
              <Button size="sm" onClick={() => openCreateModal("course")}>
                {isFarsi ? "+ دوره جدید" : "+ New Course"}
              </Button>
            )}
          </div>

          {loadingCourses ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">{isFarsi ? "دوره ای وجود ندارد" : "No courses found."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                    <th className="p-4">{isFarsi ? "کد دوره" : "Code"}</th>
                    <th className="p-4">{isFarsi ? "عنوان" : "Title"}</th>
                    <th className="p-4">{isFarsi ? "توضیحات" : "Description"}</th>
                    <th className="p-4">{isFarsi ? "شهریه (دلار)" : "Price"}</th>
                    {canManageCRM && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4 font-semibold text-[var(--brand-text)]">{c.code}</td>
                      <td className="p-4 text-[var(--t1)]">{c.title}</td>
                      <td className="p-4 text-[var(--t2)] max-w-xs truncate">{c.description || "—"}</td>
                      <td className="p-4 text-[var(--t1)]">${parseFloat(c.price).toFixed(2)}</td>
                      {canManageCRM && (
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal("course", c)}
                            className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                          >
                            {isFarsi ? "ویرایش" : "Edit"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(isFarsi ? "آیا از حذف این دوره مطمئن هستید؟" : "Are you sure you want to delete this course?")) {
                                deleteCourseMutation.mutate(c.id);
                              }
                            }}
                            className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                          >
                            {isFarsi ? "حذف" : "Delete"}
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

      {/* --- Classes Tab --- */}
      {activeTab === "classes" && (
        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "لیست کلاس‌ها و برنامه‌ها" : "Scheduled Classes"}
            </span>
            {canManageCRM && (
              <Button size="sm" onClick={() => openCreateModal("class")}>
                {isFarsi ? "+ کلاس جدید" : "+ New Class"}
              </Button>
            )}
          </div>

          {loadingClasses ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : classes.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">{isFarsi ? "کلاسی وجود ندارد" : "No classes scheduled."}</div>
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
                    {canManageCRM && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
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
                        {canManageCRM && (
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button
                              onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                              className="text-xs bg-transparent text-[var(--brand-text)] hover:underline border-none cursor-pointer font-bold"
                            >
                              {isFarsi ? `جلسات (${cls.session_count || 0})` : `Sessions (${cls.session_count || 0})`}
                            </button>
                            <button
                              onClick={() => openEditModal("class", cls)}
                              className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "ویرایش" : "Edit"}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(isFarsi ? "آیا مطمئن هستید؟" : "Are you sure you want to delete this class?")) {
                                  deleteClassMutation.mutate(cls.id);
                                }
                              }}
                              className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "حذف" : "Delete"}
                            </button>
                          </td>
                        )}
                      </tr>
                      {expandedClassId === cls.id && (
                        <tr>
                          <td colSpan={canManageCRM ? 6 : 5} className="p-0">
                            <ClassSessionsSubTable
                              cls={cls}
                              language={language}
                              canManageCRM={canManageCRM}
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
      )}

      {/* --- Enrollments Tab --- */}
      {activeTab === "enrollments" && (
        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "ثبت‌نام دانش‌آموزان در کلاس‌ها" : "Student Enrollments"}
            </span>
            {canManageCRM && (
              <Button size="sm" onClick={() => openCreateModal("enrollment")}>
                {isFarsi ? "+ ثبت‌نام جدید" : "+ New Enrollment"}
              </Button>
            )}
          </div>

          {loadingEnrollments ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : enrollments.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">{isFarsi ? "ثبت‌نامی یافت نشد" : "No enrollments found."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                    <th className="p-4">{isFarsi ? "دانش‌آموز" : "Student"}</th>
                    <th className="p-4">{isFarsi ? "کلاس" : "Class"}</th>
                    <th className="p-4">{isFarsi ? "تاریخ ثبت‌نام" : "Enrolled At"}</th>
                    <th className="p-4">{isFarsi ? "وضعیت" : "Status"}</th>
                    {canManageCRM && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
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
                                <button
                                  onClick={() => navigate(`/room/${liveSession.active_room_code}`)}
                                  className="text-[10px] bg-[var(--green)] hover:brightness-110 text-white font-bold px-2 py-0.5 rounded-full cursor-pointer border-none animate-pulse"
                                >
                                  {isFarsi ? "ورود به کلاس زنده" : "Join Live Class"}
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      {canManageCRM && (
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal("enrollment", e)}
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

      {/* --- Invoices Tab --- */}
      {activeTab === "invoices" && (
        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "شهریه‌ها و وضعیت مالی دانشجویان" : "Tuition Invoices"}
            </span>
            {canManageFinance && (
              <Button size="sm" onClick={() => openCreateModal("invoice")}>
                {isFarsi ? "+ صدور فاکتور" : "+ Issue Invoice"}
              </Button>
            )}
          </div>

          {loadingInvoices ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">{isFarsi ? "فاکتوری صادر نشده است" : "No invoices found."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                    <th className="p-4">ID</th>
                    <th className="p-4">{isFarsi ? "دانشجو" : "Student"}</th>
                    <th className="p-4">{isFarsi ? "کلاس مربوطه" : "Class"}</th>
                    <th className="p-4">{isFarsi ? "مبلغ" : "Amount"}</th>
                    <th className="p-4">{isFarsi ? "مهلت پرداخت" : "Due Date"}</th>
                    <th className="p-4">{isFarsi ? "وضعیت" : "Status"}</th>
                    {canManageFinance && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4 font-semibold text-[var(--brand-text)]">#{inv.id}</td>
                      <td className="p-4 text-[var(--t1)]">{inv.student_full_name || inv.student_username}</td>
                      <td className="p-4 text-[var(--t2)]">{inv.class_name || "—"}</td>
                      <td className="p-4 font-semibold text-[var(--t1)]">${parseFloat(inv.amount).toFixed(2)}</td>
                      <td className="p-4 text-[var(--t3)]">{inv.due_date || "—"}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          inv.status === "paid"
                            ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                            : inv.status === "unpaid"
                            ? "bg-[rgba(245,158,11,0.1)] text-[var(--amber)]"
                            : "bg-[var(--s3)] text-[var(--t3)]"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      {canManageFinance && (
                        <td className="p-4 text-right flex justify-end gap-2">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => {
                                updateInvoiceMutation.mutate({
                                  id: inv.id,
                                  data: { status: "paid", paid_at: new Date().toISOString() }
                                });
                              }}
                              className="text-xs bg-transparent text-[var(--green)] hover:underline border-none cursor-pointer"
                            >
                              {isFarsi ? "ثبت پرداخت" : "Mark Paid"}
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal("invoice", inv)}
                            className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                          >
                            {isFarsi ? "ویرایش" : "Edit"}
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

      {/* --- Expenses Tab --- */}
      {activeTab === "expenses" && (
        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "دفتر هزینه‌های آکادمی" : "Academy Expense Ledger"}
            </span>
            {canManageFinance && (
              <Button size="sm" onClick={() => openCreateModal("expense")}>
                {isFarsi ? "+ ثبت هزینه" : "+ Record Expense"}
              </Button>
            )}
          </div>

          {loadingExpenses ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">{isFarsi ? "هزینه‌ای ثبت نشده است" : "No expense items recorded."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                    <th className="p-4">{isFarsi ? "بابت" : "Category"}</th>
                    <th className="p-4">{isFarsi ? "توضیحات" : "Description"}</th>
                    <th className="p-4">{isFarsi ? "گیرنده پرداخت" : "Recipient"}</th>
                    <th className="p-4">{isFarsi ? "تاریخ ثبت" : "Date"}</th>
                    <th className="p-4">{isFarsi ? "مبلغ" : "Amount"}</th>
                    {canManageFinance && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4 font-semibold text-[var(--brand-text)] capitalize">{exp.category.replace("_", " ")}</td>
                      <td className="p-4 text-[var(--t2)] max-w-xs truncate">{exp.description}</td>
                      <td className="p-4 text-[var(--t1)]">{exp.recipient_full_name || exp.recipient_username || "—"}</td>
                      <td className="p-4 text-[var(--t3)]">{exp.incurred_at}</td>
                      <td className="p-4 font-semibold text-[var(--red)]">${parseFloat(exp.amount).toFixed(2)}</td>
                      {canManageFinance && (
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal("expense", exp)}
                            className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                          >
                            {isFarsi ? "ویرایش" : "Edit"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(isFarsi ? "حذف هزینه؟" : "Are you sure you want to delete this expense?")) {
                                deleteExpenseMutation.mutate(exp.id);
                              }
                            }}
                            className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                          >
                            {isFarsi ? "حذف" : "Delete"}
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

      {/* --- FORM MODAL --- */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <ModalHeader>
          <ModalTitle>
            {editId
              ? (isFarsi ? "ویرایش اطلاعات" : `Edit ${modalType}`)
              : (isFarsi ? "ثبت مورد جدید" : `New ${modalType}`)}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {/* COURSE FORM */}
          {modalType === "course" && (
            <>
              <Input
                label={isFarsi ? "کد دوره" : "Course Code"}
                value={courseForm.code}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                placeholder="e.g. PY-101"
                required
              />
              <Input
                label={isFarsi ? "عنوان دوره" : "Title"}
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                placeholder="e.g. Python Programming"
                required
              />
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "توضیحات" : "Description"}
                </label>
                <textarea
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[80px]"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                />
              </div>
              <Input
                label={isFarsi ? "شهریه (دلار)" : "Price ($)"}
                type="number"
                value={courseForm.price}
                onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })}
                required
              />
            </>
          )}

          {/* CLASS FORM */}
          {modalType === "class" && (
            <>
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

              {/* User search for Teacher */}
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
                    {searchResults.filter(u => u.role === "teacher" || u.role === "admin").map((u) => (
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
            </>
          )}

          {/* ENROLLMENT FORM */}
          {modalType === "enrollment" && (
            <>
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

              {/* User search for Student */}
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
                    {searchResults.filter(u => u.role === "student").map((u) => (
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
            </>
          )}

          {/* INVOICE FORM */}
          {modalType === "invoice" && (
            <>
              {/* User search for Student */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "جستجوی دانشجو" : "Search Student"}
                </label>
                <Input
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    if (!e.target.value) setInvoiceForm({ ...invoiceForm, student: "" });
                  }}
                  placeholder={isFarsi ? "نام دانشجو..." : "Type student name..."}
                  disabled={!!editId}
                  required
                />
                {searchResults.length > 0 && (
                  <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1">
                    {searchResults.filter(u => u.role === "student").map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setInvoiceForm({ ...invoiceForm, student: u.id.toString() });
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

              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "کلاس (اختیاری)" : "Class (Optional)"}
                </label>
                <select
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                  value={invoiceForm.academy_class}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, academy_class: e.target.value })}
                >
                  <option value="">{isFarsi ? "هیچکدام" : "None"}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name} ({cls.course_title})</option>
                  ))}
                </select>
              </div>

              <Input
                label={isFarsi ? "مبلغ (دلار)" : "Amount ($)"}
                type="number"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                required
              />

              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "وضعیت پرداخت" : "Status"}
                </label>
                <select
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                  value={invoiceForm.status}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as any })}
                  required
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </div>

              <Input
                label={isFarsi ? "مهلت پرداخت" : "Due Date"}
                type="date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />
            </>
          )}

          {/* EXPENSE FORM */}
          {modalType === "expense" && (
            <>
              <Input
                label={isFarsi ? "مبلغ هزینه (دلار)" : "Amount ($)"}
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />

              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "دسته‌بندی" : "Category"}
                </label>
                <select
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  required
                >
                  <option value="rent">Rent</option>
                  <option value="utilities">Utilities</option>
                  <option value="teacher_payout">Teacher Payout</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <Input
                label={isFarsi ? "توضیح بابت هزینه" : "Description"}
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                required
              />

              {/* User search for Recipient (optional) */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "دریافت‌کننده هزینه (اختیاری)" : "Recipient User (Optional)"}
                </label>
                <Input
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    if (!e.target.value) setExpenseForm({ ...expenseForm, recipient: "" });
                  }}
                  placeholder={isFarsi ? "جستجوی کاربر..." : "Search user..."}
                />
                {searchResults.length > 0 && (
                  <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto mt-1 flex flex-col gap-1">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setExpenseForm({ ...expenseForm, recipient: u.id.toString() });
                          setUserSearchQuery(u.full_name || u.username);
                          setSearchResults([]);
                        }}
                        className="w-full text-start p-1.5 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                      >
                        {u.full_name} ({u.username}) [{u.role}]
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Input
                label={isFarsi ? "تاریخ هزینه" : "Date Incurred"}
                type="date"
                value={expenseForm.incurred_at}
                onChange={(e) => setExpenseForm({ ...expenseForm, incurred_at: e.target.value })}
                required
              />
            </>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              {isFarsi ? "انصراف" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={
                createCourseMutation.isPending ||
                updateCourseMutation.isPending ||
                createClassMutation.isPending ||
                updateClassMutation.isPending ||
                createEnrollmentMutation.isPending ||
                updateEnrollmentMutation.isPending ||
                createInvoiceMutation.isPending ||
                updateInvoiceMutation.isPending ||
                createExpenseMutation.isPending ||
                updateExpenseMutation.isPending
              }
            >
              {isFarsi ? "ثبت اطلاعات" : "Save Changes"}
            </Button>
          </div>
        </form>
        </ModalBody>
      </Modal>
    </div>
  );
}

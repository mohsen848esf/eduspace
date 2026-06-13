import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type TuitionInvoice, type ExpenseItem, type SimpleUser } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

export default function LedgerPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";

  const canViewFinancials = hasPermission("can_view_financials");
  const canManageFinance = hasPermission("can_manage_financials");

  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "expenses">("invoices");

  // Queries
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: crmApi.getInvoices,
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: crmApi.getExpenses,
    enabled: canViewFinancials,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  // Mutations
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

  // Autocomplete Search State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"invoice" | "expense">("invoice");
  const [editId, setEditId] = useState<number | null>(null);

  // Forms State
  const [invoiceForm, setInvoiceForm] = useState({ student: "", academy_class: "", amount: "", status: "unpaid" as const, due_date: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "rent" as const, description: "", recipient: "", incurred_at: "" });

  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      const roleFilter = modalType === "invoice" ? "student" : undefined;
      crmApi.searchUsers(userSearchQuery, roleFilter).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery, modalType]);

  const openCreateModal = (type: "invoice" | "expense") => {
    setModalType(type);
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    if (type === "invoice") {
      setInvoiceForm({ student: "", academy_class: classes[0]?.id.toString() || "", amount: "", status: "unpaid", due_date: "" });
    } else {
      setExpenseForm({ amount: "", category: "rent", description: "", recipient: "", incurred_at: new Date().toISOString().split("T")[0] });
    }
    setIsModalOpen(true);
  };

  const openEditModal = (type: "invoice" | "expense", item: any) => {
    setModalType(type);
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    if (type === "invoice") {
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
    } else {
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
    if (modalType === "invoice") {
      const payload = {
        student: parseInt(invoiceForm.student),
        academy_class: invoiceForm.academy_class ? parseInt(invoiceForm.academy_class) : null,
        amount: invoiceForm.amount,
        status: invoiceForm.status,
        due_date: invoiceForm.due_date || null
      };
      if (editId) {
        updateInvoiceMutation.mutate({ id: editId, data: payload });
      } else {
        createInvoiceMutation.mutate(payload);
      }
    } else {
      const payload = {
        amount: expenseForm.amount,
        category: expenseForm.category,
        description: expenseForm.description,
        recipient: expenseForm.recipient ? parseInt(expenseForm.recipient) : null,
        incurred_at: expenseForm.incurred_at || new Date().toISOString().split("T")[0]
      };
      if (editId) {
        updateExpenseMutation.mutate({ id: editId, data: payload });
      } else {
        createExpenseMutation.mutate(payload);
      }
    }
  };

  return (
    <AppShell title={isFarsi ? "دفتر مالی" : "Financial Ledger"}>
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs (Only expose expenses if has financials viewer access) */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 scrollbar-none bg-[var(--s1)] p-2 rounded-t-xl border border-b-0 border-[var(--b)]">
          <button
            onClick={() => setActiveSubTab("invoices")}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeSubTab === "invoices"
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "شهریه‌ها / فاکتورها" : "Tuition Invoices"}
          </button>
          {canViewFinancials && (
            <button
              onClick={() => setActiveSubTab("expenses")}
              className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
                activeSubTab === "expenses"
                  ? "border-[var(--brand)] text-[var(--brand-text)]"
                  : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
              }`}
            >
              {isFarsi ? "دفتر هزینه‌ها" : "Expense Ledger"}
            </button>
          )}
        </div>

        <div className="rounded-b-xl overflow-hidden bg-[var(--s2)] border border-[var(--b)]">
          {/* Tuition Invoices Tab */}
          {activeSubTab === "invoices" && (
            <div>
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
                <div className="p-8 text-center text-[var(--t3)]">
                  {isFarsi ? "فاکتوری صادر نشده است" : "No invoices found."}
                </div>
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

          {/* Expense Ledger Tab */}
          {activeSubTab === "expenses" && canViewFinancials && (
            <div>
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
                <div className="p-8 text-center text-[var(--t3)]">
                  {isFarsi ? "هزینه‌ای ثبت نشده است" : "No expense items recorded."}
                </div>
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
        </div>
      </div>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {editId
              ? (isFarsi ? "ویرایش اطلاعات مالی" : `Edit ${modalType}`)
              : (isFarsi ? "ثبت مورد جدید" : `New ${modalType}`)}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            {/* INVOICE FORM */}
            {modalType === "invoice" && (
              <>
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
                      {searchResults.map((u) => (
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
                          {u.full_name} ({u.username})
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
    </AppShell>
  );
}

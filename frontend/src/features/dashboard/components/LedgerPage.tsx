import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type TuitionInvoice, type ExpenseItem, type SimpleUser, type TuitionInvoiceItem } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import { Drawer, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter } from "../../../components/layout/Drawer";
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

  // Invoices Filter & Pagination States
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [invoiceStartDate, setInvoiceStartDate] = useState("");
  const [invoiceEndDate, setInvoiceEndDate] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);

  // Expenses Filter & Pagination States
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseMinAmount, setExpenseMinAmount] = useState("");
  const [expenseMaxAmount, setExpenseMaxAmount] = useState("");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");
  const [expensePage, setExpensePage] = useState(1);

  // Queries
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices", invoicePage, invoiceSearch, invoiceStatus, invoiceStartDate, invoiceEndDate],
    queryFn: () => crmApi.getInvoices({
      page: invoicePage,
      page_size: 10,
      q: invoiceSearch,
      status: invoiceStatus,
      start_date: invoiceStartDate,
      end_date: invoiceEndDate
    }),
  });

  const { data: expensesData, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", expensePage, expenseSearch, expenseCategory, expenseMinAmount, expenseMaxAmount, expenseStartDate, expenseEndDate],
    queryFn: () => crmApi.getExpenses({
      page: expensePage,
      page_size: 10,
      q: expenseSearch,
      category: expenseCategory,
      min_amount: expenseMinAmount,
      max_amount: expenseMaxAmount,
      start_date: expenseStartDate,
      end_date: expenseEndDate
    }),
    enabled: canViewFinancials,
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["financeSummary"],
    queryFn: crmApi.getFinanceSummary,
    enabled: canViewFinancials,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const invoices = invoicesData?.results || [];
  const expenses = expensesData?.results || [];

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: crmApi.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "فاکتور با موفقیت صادر شد" : "Invoice created successfully");
      setIsDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در صدور فاکتور" : "Failed to create invoice"));
    }
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TuitionInvoice> }) => crmApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "فاکتور با موفقیت بروزرسانی شد" : "Invoice updated successfully");
      setIsDrawerOpen(false);
      setIsPaymentModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در بروزرسانی فاکتور" : "Failed to update invoice"));
    }
  });

  const createExpenseMutation = useMutation({
    mutationFn: crmApi.createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "هزینه ثبت شد" : "Expense recorded successfully");
      setIsDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت هزینه" : "Failed to record expense"));
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData | Partial<ExpenseItem> }) => crmApi.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "هزینه با موفقیت ویرایش شد" : "Expense updated successfully");
      setIsDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش هزینه" : "Failed to update expense"));
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: crmApi.deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "هزینه حذف شد" : "Expense deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف هزینه" : "Failed to delete expense"));
    }
  });

  const approveExpenseMutation = useMutation({
    mutationFn: crmApi.approveExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
      toast.success(isFarsi ? "هزینه با موفقیت تأیید شد" : "Expense approved successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در تأیید هزینه" : "Failed to approve expense"));
    }
  });

  // Autocomplete Search State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);

  // Drawers State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"invoice" | "expense">("invoice");
  const [editId, setEditId] = useState<number | null>(null);

  // Forms State
  const [invoiceForm, setInvoiceForm] = useState({ student: "", academy_class: "", amount: "", status: "unpaid" as const, due_date: "" });
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "rent" as const, description: "", recipient: "", incurred_at: "" });
  
  // Line items and payment / receipts state
  const [lineItems, setLineItems] = useState<TuitionInvoiceItem[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<File | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "online">("cash");
  const [paymentDate, setPaymentDate] = useState("");

  // Cash Prompt calculator states
  const [cashReceived, setCashReceived] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [invoicePaymentStatus, setInvoicePaymentStatus] = useState<"paid" | "partial" | "refunded">("paid");

  // Receipt Preview states
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<"image" | "pdf" | "video" | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      const roleFilter = drawerType === "invoice" ? "student" : undefined;
      crmApi.searchUsers(userSearchQuery, roleFilter).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [userSearchQuery, drawerType]);

  // Recalculate invoice total sum whenever line items change
  useEffect(() => {
    if (drawerType === "invoice" && lineItems.length > 0) {
      const sum = lineItems.reduce((acc, item) => {
        const price = parseFloat(item.unit_price) || 0;
        const qty = item.quantity || 1;
        return acc + price * qty;
      }, 0);
      setInvoiceForm(prev => ({ ...prev, amount: sum.toString() }));
    }
  }, [lineItems, drawerType]);

  const openCreateDrawer = (type: "invoice" | "expense") => {
    setDrawerType(type);
    setEditId(null);
    setUserSearchQuery("");
    setSearchResults([]);
    setSelectedReceipt(null);
    if (type === "invoice") {
      setInvoiceForm({ student: "", academy_class: classes[0]?.id.toString() || "", amount: "0", status: "unpaid", due_date: "" });
      setLineItems([{ description: "", quantity: 1, unit_price: "" }]);
    } else {
      setExpenseForm({ amount: "", category: "rent", description: "", recipient: "", incurred_at: new Date().toISOString().split("T")[0] });
    }
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (type: "invoice" | "expense", item: any) => {
    setDrawerType(type);
    setEditId(item.id);
    setUserSearchQuery("");
    setSearchResults([]);
    setSelectedReceipt(null);
    if (type === "invoice") {
      setInvoiceForm({
        student: item.student.toString(),
        academy_class: item.academy_class?.toString() || "",
        amount: item.amount,
        status: item.status,
        due_date: item.due_date || ""
      });
      setLineItems(item.items || []);
      if (item.student_full_name || item.student_username) {
        setUserSearchQuery(item.student_full_name || item.student_username);
      }
    } else {
      setExpenseForm({
        amount: item.amount,
        category: item.category,
        description: item.description,
        recipient: item.recipient?.toString() || "",
        incurred_at: item.incurred_at ? item.incurred_at.split("T")[0] : ""
      });
      if (item.recipient_full_name || item.recipient_username) {
        setUserSearchQuery(item.recipient_full_name || item.recipient_username);
      }
    }
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drawerType === "invoice") {
      const payload = {
        student: parseInt(invoiceForm.student),
        academy_class: invoiceForm.academy_class ? parseInt(invoiceForm.academy_class) : null,
        amount: invoiceForm.amount,
        status: invoiceForm.status,
        due_date: invoiceForm.due_date || null,
        items: lineItems
      };
      if (editId) {
        updateInvoiceMutation.mutate({ id: editId, data: payload });
      } else {
        createInvoiceMutation.mutate(payload);
      }
    } else {
      const formData = new FormData();
      formData.append("amount", expenseForm.amount);
      formData.append("category", expenseForm.category);
      formData.append("description", expenseForm.description);
      if (expenseForm.recipient) {
        formData.append("recipient", expenseForm.recipient);
      }
      formData.append("incurred_at", expenseForm.incurred_at || new Date().toISOString().split("T")[0]);
      if (selectedReceipt) {
        formData.append("attachment", selectedReceipt);
      }

      if (editId) {
        updateExpenseMutation.mutate({ id: editId, data: formData });
      } else {
        createExpenseMutation.mutate(formData);
      }
    }
  };

  // Document Viewer attachment logic
  const openAttachmentPreview = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    setZoomScale(1);
    if (cleanUrl.endsWith(".pdf")) {
      setPreviewFileType("pdf");
    } else if (cleanUrl.endsWith(".mp4") || cleanUrl.endsWith(".webm") || cleanUrl.endsWith(".ogg")) {
      setPreviewFileType("video");
    } else {
      setPreviewFileType("image");
    }
    setPreviewFileUrl(url);
  };

  // iframe print code
  const printInvoice = (inv: TuitionInvoice) => {
    const iframeId = "invoice-print-iframe";
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.style.position = "absolute";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;
    
    const isPaid = inv.status === "paid";
    const statusLabel = isFarsi 
      ? (inv.status === "paid" ? "پرداخت شده" : inv.status === "partial" ? "پرداخت شده (بخشی)" : "پرداخت نشده")
      : inv.status.toUpperCase();
      
    const itemsHtml = (inv.items || []).map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px; text-align: start;">${idx + 1}</td>
        <td style="padding: 8px; text-align: start;">${item.description}</td>
        <td style="padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; text-align: end;">$${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="padding: 8px; text-align: end;">$${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</td>
      </tr>
    `).join("");

    const totalCalculated = (inv.items || []).reduce((sum, item) => sum + item.quantity * parseFloat(item.unit_price), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${isFarsi ? "rtl" : "ltr"}">
      <head>
        <title>Invoice #${inv.invoice_number || inv.id}</title>
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
          body {
            font-family: 'Vazirmatn', sans-serif, system-ui;
            padding: 20px;
            color: #1e293b;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .meta-block {
            line-height: 1.6;
          }
          .table-container {
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          th {
            background-color: #f1f5f9;
            padding: 10px 8px;
            text-align: start;
            font-weight: 700;
          }
          .stamp {
            display: inline-block;
            border: 3px double ${isPaid ? "#22c55e" : "#ef4444"};
            color: ${isPaid ? "#22c55e" : "#ef4444"};
            padding: 8px 16px;
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            border-radius: 4px;
            transform: rotate(-5deg);
            margin-top: 10px;
          }
          .summary {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .summary-table {
            width: 300px;
            font-size: 14px;
          }
          .summary-table tr td {
            padding: 6px 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${isFarsi ? "پیش‌فاکتور / رسید مالی" : "Tuition Invoice"}</div>
            <div style="font-size: 12px; color: #64748b;">${isFarsi ? "سامانه مدیریت آموزشی ادواسپیس" : "Eduspace Education System"}</div>
          </div>
          <div>
            <div class="stamp">${statusLabel}</div>
          </div>
        </div>
        
        <div class="meta-info">
          <div class="meta-block">
            <strong>${isFarsi ? "مشخصات دانشجو:" : "Student Details:"}</strong><br/>
            ${isFarsi ? "نام:" : "Name:"} ${inv.student_full_name || inv.student_username}<br/>
            ${inv.class_name ? `${isFarsi ? "کلاس:" : "Class:"} ${inv.class_name}` : ""}<br/>
          </div>
          <div class="meta-block" style="text-align: ${isFarsi ? "left" : "right"};">
            <strong>${isFarsi ? "مشخصات فاکتور:" : "Invoice Details:"}</strong><br/>
            ${isFarsi ? "شماره فاکتور:" : "Invoice Number:"} ${inv.invoice_number || `#${inv.id}`}<br/>
            ${isFarsi ? "تاریخ صدور:" : "Issue Date:"} ${new Date(inv.created_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}<br/>
            ${inv.due_date ? `${isFarsi ? "مهلت پرداخت:" : "Due Date:"} ${new Date(inv.due_date).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}` : ""}<br/>
            ${inv.paid_at ? `${isFarsi ? "تاریخ پرداخت:" : "Payment Date:"} ${new Date(inv.paid_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}` : ""}<br/>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>${isFarsi ? "شرح خدمات" : "Description"}</th>
                <th style="text-align: center; width: 60px;">${isFarsi ? "تعداد" : "Qty"}</th>
                <th style="text-align: right; width: 100px;">${isFarsi ? "قیمت واحد" : "Unit Price"}</th>
                <th style="text-align: right; width: 120px;">${isFarsi ? "مبلغ کل" : "Total Price"}</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || `<tr><td colspan="5" style="text-align: center; padding: 15px;">${isFarsi ? "هیچ آیتمی ثبت نشده است" : "No items listed"}</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="summary">
          <table class="summary-table">
            <tr style="font-weight: 700; border-top: 2px solid #e2e8f0; font-size: 16px;">
              <td>${isFarsi ? "مبلغ کل فاکتور:" : "Total Invoice Amount:"}</td>
              <td style="text-align: right;">$${totalCalculated.toFixed(2)}</td>
            </tr>
            ${inv.payment_method ? `
            <tr style="color: #64748b; font-size: 12px;">
              <td>${isFarsi ? "روش پرداخت:" : "Payment Method:"}</td>
              <td style="text-align: right;">${inv.payment_method}</td>
            </tr>
            ` : ""}
          </table>
        </div>
        
        ${inv.notes ? `
        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px;">
          <strong>${isFarsi ? "توضیحات:" : "Notes:"}</strong>
          <p style="color: #475569; margin-top: 5px;">${inv.notes}</p>
        </div>
        ` : ""}
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
    
    doc.open();
    doc.write(htmlContent);
    doc.close();
  };

  const selectedInvoice = invoices.find(inv => inv.id === paymentInvoiceId);
  const paymentAmount = selectedInvoice ? parseFloat(selectedInvoice.amount) : 0;
  const changeDue = cashReceived ? parseFloat(cashReceived) - paymentAmount : 0;

  return (
    <AppShell title={isFarsi ? "دفتر مالی" : "Financial Ledger"}>
      <div className="flex flex-col gap-6">
        
        {/* KPI metrics cards connected to /finance/summary/ API */}
        {canViewFinancials && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] shadow-sm flex flex-col gap-1 transition-all hover:-translate-y-1">
              <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "درآمد کل" : "Total Revenue"}</span>
              {loadingSummary ? <Spinner size="sm" /> : (
                <span className="text-2xl font-bold text-[var(--green)]">${summaryData?.revenue?.toFixed(2)}</span>
              )}
            </div>
            <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] shadow-sm flex flex-col gap-1 transition-all hover:-translate-y-1">
              <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "هزینه‌های ثبت‌شده" : "Total Expenses"}</span>
              {loadingSummary ? <Spinner size="sm" /> : (
                <span className="text-2xl font-bold text-[var(--red)]">${summaryData?.expenses?.toFixed(2)}</span>
              )}
            </div>
            <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] shadow-sm flex flex-col gap-1 transition-all hover:-translate-y-1">
              <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "مطالبات معوق" : "Outstanding Balances"}</span>
              {loadingSummary ? <Spinner size="sm" /> : (
                <span className="text-2xl font-bold text-[var(--amber)]">${summaryData?.outstanding?.toFixed(2)}</span>
              )}
            </div>
            <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] shadow-sm flex flex-col gap-1 transition-all hover:-translate-y-1">
              <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "نرخ وصول مطالبات" : "Collection Rate"}</span>
              {loadingSummary ? <Spinner size="sm" /> : (
                <span className="text-2xl font-bold text-[var(--brand-text)]">{summaryData?.collection_rate}%</span>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
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
          
          {/* Tuition Invoices View */}
          {activeSubTab === "invoices" && (
            <div>
              {/* Filters Header */}
              <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-[var(--b)] items-end">
                <div className="flex-1 w-full flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "جستجوی فاکتور / دانشجو" : "Search Invoice / Student"}</span>
                  <Input
                    placeholder={isFarsi ? "نام دانشجو یا شماره فاکتور..." : "Student name or invoice #..."}
                    value={invoiceSearch}
                    onChange={(e) => {
                      setInvoiceSearch(e.target.value);
                      setInvoicePage(1);
                    }}
                  />
                </div>
                <div className="w-full md:w-48 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "وضعیت پرداخت" : "Status"}</span>
                  <select
                    className="bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)]"
                    value={invoiceStatus}
                    onChange={(e) => {
                      setInvoiceStatus(e.target.value);
                      setInvoicePage(1);
                    }}
                  >
                    <option value="">{isFarsi ? "همه وضعیت‌ها" : "All Statuses"}</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div className="w-full md:w-44 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "از تاریخ سررسید" : "Due Date From"}</span>
                  <Input type="date" value={invoiceStartDate} onChange={(e) => { setInvoiceStartDate(e.target.value); setInvoicePage(1); }} />
                </div>
                <div className="w-full md:w-44 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "تا تاریخ سررسید" : "Due Date To"}</span>
                  <Input type="date" value={invoiceEndDate} onChange={(e) => { setInvoiceEndDate(e.target.value); setInvoicePage(1); }} />
                </div>
                {canManageFinance && (
                  <Button size="sm" onClick={() => openCreateDrawer("invoice")} className="w-full md:w-auto h-11 whitespace-nowrap">
                    {isFarsi ? "+ صدور فاکتور" : "+ Issue Invoice"}
                  </Button>
                )}
              </div>

              {loadingInvoices ? (
                <div className="p-12 flex justify-center"><Spinner /></div>
              ) : invoices.length === 0 ? (
                <div className="p-12 text-center text-[var(--t3)]">
                  {isFarsi ? "فاکتوری با فیلترهای مشخص شده پیدا نشد." : "No invoices found matching current criteria."}
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
                        <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                          <td className="p-4 font-semibold text-[var(--brand-text)]">{inv.invoice_number || `#${inv.id}`}</td>
                          <td className="p-4 text-[var(--t1)]">{inv.student_full_name || inv.student_username}</td>
                          <td className="p-4 text-[var(--t2)]">{inv.class_name || "—"}</td>
                          <td className="p-4 font-semibold text-[var(--t1)]">${parseFloat(inv.amount).toFixed(2)}</td>
                          <td className="p-4 text-[var(--t3)]">{inv.due_date || "—"}</td>
                          <td className="p-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                              inv.status === "paid"
                                ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                                : inv.status === "partial"
                                ? "bg-[rgba(14,165,233,0.12)] text-[var(--cyan)]"
                                : inv.status === "overdue"
                                ? "bg-[rgba(239,68,68,0.12)] text-[var(--red)] animate-pulse"
                                : inv.status === "unpaid"
                                ? "bg-[rgba(245,158,11,0.1)] text-[var(--amber)]"
                                : "bg-[var(--s3)] text-[var(--t3)]"
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button
                              onClick={() => printInvoice(inv)}
                              className="text-xs bg-transparent text-[var(--brand-text)] hover:underline border-none cursor-pointer"
                            >
                              🖨️ {isFarsi ? "چاپ رسید" : "Print"}
                            </button>
                            {canManageFinance && (
                              <>
                                {inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "refunded" && (
                                  <button
                                    onClick={() => {
                                      setPaymentInvoiceId(inv.id);
                                      setPaymentMethod("cash");
                                      setCashReceived(inv.amount);
                                      setBankReference("");
                                      setReceivingAccount("");
                                      setInvoicePaymentStatus("paid");
                                      setPaymentDate(new Date().toISOString().split("T")[0]);
                                      setIsPaymentModalOpen(true);
                                    }}
                                    className="text-xs bg-transparent text-[var(--green)] hover:underline border-none cursor-pointer"
                                  >
                                    {isFarsi ? "ثبت پرداخت" : "Mark Paid"}
                                  </button>
                                )}
                                <button
                                    onClick={() => openEditDrawer("invoice", inv)}
                                    className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                                >
                                  {isFarsi ? "ویرایش" : "Edit"}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Footer */}
                  {invoicesData && invoicesData.count > 10 && (
                    <div className="flex justify-between items-center p-4 border-t border-[var(--b)]">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={invoicePage === 1}
                        onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                      >
                        {isFarsi ? "قبلی" : "Previous"}
                      </Button>
                      <span className="text-xs text-[var(--t3)]">
                        {isFarsi 
                          ? `صفحه ${invoicePage} از ${Math.ceil(invoicesData.count / 10)}`
                          : `Page ${invoicePage} of ${Math.ceil(invoicesData.count / 10)}`}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={invoicePage >= Math.ceil(invoicesData.count / 10)}
                        onClick={() => setInvoicePage(p => p + 1)}
                      >
                        {isFarsi ? "بعدی" : "Next"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expense Ledger View */}
          {activeSubTab === "expenses" && canViewFinancials && (
            <div>
              {/* Filters Header */}
              <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-[var(--b)] items-end">
                <div className="flex-1 w-full flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "جستجوی هزینه‌ها" : "Search Expenses"}</span>
                  <Input
                    placeholder={isFarsi ? "شرح هزینه، نام گیرنده..." : "Search category, recipient..."}
                    value={expenseSearch}
                    onChange={(e) => {
                      setExpenseSearch(e.target.value);
                      setExpensePage(1);
                    }}
                  />
                </div>
                <div className="w-full md:w-44 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "دسته‌بندی" : "Category"}</span>
                  <select
                    className="bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)]"
                    value={expenseCategory}
                    onChange={(e) => {
                      setExpenseCategory(e.target.value);
                      setExpensePage(1);
                    }}
                  >
                    <option value="">{isFarsi ? "همه دسته‌ها" : "All Categories"}</option>
                    <option value="rent">Rent</option>
                    <option value="utilities">Utilities</option>
                    <option value="teacher_payout">Teacher Payout</option>
                    <option value="marketing">Marketing</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="w-24 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "حداقل مبلغ" : "Min Price"}</span>
                  <Input type="number" placeholder="Min" value={expenseMinAmount} onChange={(e) => { setExpenseMinAmount(e.target.value); setExpensePage(1); }} />
                </div>
                <div className="w-24 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "حداکثر مبلغ" : "Max Price"}</span>
                  <Input type="number" placeholder="Max" value={expenseMaxAmount} onChange={(e) => { setExpenseMaxAmount(e.target.value); setExpensePage(1); }} />
                </div>
                <div className="w-full md:w-36 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "از تاریخ" : "From Date"}</span>
                  <Input type="date" value={expenseStartDate} onChange={(e) => { setExpenseStartDate(e.target.value); setExpensePage(1); }} />
                </div>
                <div className="w-full md:w-36 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--t2)]">{isFarsi ? "تا تاریخ" : "To Date"}</span>
                  <Input type="date" value={expenseEndDate} onChange={(e) => { setExpenseEndDate(e.target.value); setExpensePage(1); }} />
                </div>
                {canManageFinance && (
                  <Button size="sm" onClick={() => openCreateDrawer("expense")} className="w-full md:w-auto h-11 whitespace-nowrap">
                    {isFarsi ? "+ ثبت هزینه" : "+ Record Expense"}
                  </Button>
                )}
              </div>

              {loadingExpenses ? (
                <div className="p-12 flex justify-center"><Spinner /></div>
              ) : expenses.length === 0 ? (
                <div className="p-12 text-center text-[var(--t3)]">
                  {isFarsi ? "هزینه‌ای پیدا نشد." : "No expense items found."}
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
                        <th className="p-4">{isFarsi ? "وضعیت تأیید" : "Approval"}</th>
                        {canManageFinance && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                          <td className="p-4 font-semibold text-[var(--brand-text)] capitalize">{exp.category.replace("_", " ")}</td>
                          <td className="p-4 text-[var(--t2)] max-w-xs truncate flex items-center gap-1.5">
                            <span>{exp.description}</span>
                            {exp.attachment && (
                              <button
                                onClick={() => openAttachmentPreview(exp.attachment as string)}
                                className="text-[var(--cyan)] hover:underline inline-flex items-center ml-1 text-xs border-none bg-transparent cursor-pointer"
                                title={isFarsi ? "مشاهده رسید" : "View Receipt"}
                              >
                                📎
                              </button>
                            )}
                          </td>
                          <td className="p-4 text-[var(--t1)]">{exp.recipient_full_name || exp.recipient_username || "—"}</td>
                          <td className="p-4 text-[var(--t3)]">{exp.incurred_at ? exp.incurred_at.split("T")[0] : "—"}</td>
                          <td className="p-4 font-semibold text-[var(--red)]">${parseFloat(exp.amount).toFixed(2)}</td>
                          <td className="p-4">
                            {exp.approved_by ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[var(--green)]">
                                {isFarsi ? `تأیید شده` : `Approved`}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[var(--amber)] animate-pulse">
                                  {isFarsi ? "در انتظار" : "Pending"}
                                </span>
                                {canManageFinance && (
                                  <button
                                    onClick={() => approveExpenseMutation.mutate(exp.id)}
                                    className="text-xs bg-transparent text-[var(--green)] hover:underline border-none cursor-pointer font-semibold"
                                    disabled={approveExpenseMutation.isPending}
                                  >
                                    {isFarsi ? "تأیید" : "Approve"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          {canManageFinance && (
                            <td className="p-4 text-right flex justify-end gap-2">
                              <button
                                onClick={() => openEditDrawer("expense", exp)}
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

                  {/* Pagination Footer */}
                  {expensesData && expensesData.count > 10 && (
                    <div className="flex justify-between items-center p-4 border-t border-[var(--b)]">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={expensePage === 1}
                        onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                      >
                        {isFarsi ? "قبلی" : "Previous"}
                      </Button>
                      <span className="text-xs text-[var(--t3)]">
                        {isFarsi 
                          ? `صفحه ${expensePage} از ${Math.ceil(expensesData.count / 10)}`
                          : `Page ${expensePage} of ${Math.ceil(expensesData.count / 10)}`}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={expensePage >= Math.ceil(expensesData.count / 10)}
                        onClick={() => setExpensePage(p => p + 1)}
                      >
                        {isFarsi ? "بعدی" : "Next"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Drawer for Invoice Creation/Edit */}
      <Drawer open={isDrawerOpen && drawerType === "invoice"} onOpenChange={setIsDrawerOpen} side="end" panelClassName="w-full md:w-[650px] md:max-w-[650px] bg-[var(--s1)] shadow-2xl flex flex-col h-full border-s border-[var(--b)]">
        <DrawerHeader>
          <DrawerTitle>
            {editId
              ? (isFarsi ? "ویرایش فاکتور شهریه" : "Edit Tuition Invoice")
              : (isFarsi ? "صدور فاکتور جدید" : "Issue Tuition Invoice")}
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex-1 overflow-y-auto p-6">
          <form id="drawer-invoice-form" onSubmit={handleFormSubmit} className="flex flex-col gap-5">
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
              label={isFarsi ? "مبلغ کل (دلار) - محاسبه خودکار" : "Total Amount ($) - Auto calculated"}
              type="number"
              value={invoiceForm.amount}
              readOnly
              disabled
              required
            />

            {/* Invoices Line Items */}
            <div className="flex flex-col gap-3 p-4 bg-[var(--s3)] border border-[var(--b)] rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "آیتم‌های فاکتور" : "Invoice Line Items"}
                </span>
                <button
                  type="button"
                  onClick={() => setLineItems([...lineItems, { description: "", quantity: 1, unit_price: "" }])}
                  className="text-xs bg-transparent text-[var(--brand-text)] hover:underline border-none cursor-pointer font-semibold"
                >
                  {isFarsi ? "+ افزودن آیتم" : "+ Add Item"}
                </button>
              </div>
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex flex-col md:flex-row items-end gap-2 border-b border-[var(--b)] pb-3 last:border-b-0 last:pb-0">
                  <div className="flex-1 w-full">
                    <Input
                      label={idx === 0 ? (isFarsi ? "توضیح" : "Description") : undefined}
                      placeholder={isFarsi ? "شهریه دوره" : "e.g. Tuition fee"}
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].description = e.target.value;
                        setLineItems(newItems);
                      }}
                      required
                    />
                  </div>
                  <div className="w-full md:w-20">
                    <Input
                      label={idx === 0 ? (isFarsi ? "تعداد" : "Qty") : undefined}
                      type="number"
                      value={item.quantity}
                      min={1}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].quantity = parseInt(e.target.value) || 1;
                        setLineItems(newItems);
                      }}
                      required
                    />
                  </div>
                  <div className="w-full md:w-28">
                    <Input
                      label={idx === 0 ? (isFarsi ? "قیمت واحد ($)" : "Price ($)") : undefined}
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...lineItems];
                        newItems[idx].unit_price = e.target.value;
                        setLineItems(newItems);
                      }}
                      required
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = lineItems.filter((_, i) => i !== idx);
                        setLineItems(newItems);
                      }}
                      className="bg-transparent text-[var(--red)] border-none hover:text-red-700 cursor-pointer p-2 mb-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "وضعیت فاکتور" : "Invoice Status"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as any })}
                required
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <Input
              label={isFarsi ? "مهلت پرداخت" : "Due Date"}
              type="date"
              value={invoiceForm.due_date}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
            />
          </form>
        </DrawerBody>
        <DrawerFooter className="p-6 border-t border-[var(--b)] flex flex-row justify-end gap-2 flex-shrink-0">
          <Button type="button" variant="secondary" onClick={() => setIsDrawerOpen(false)}>
            {isFarsi ? "انصراف" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="drawer-invoice-form"
            disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
          >
            {isFarsi ? "ثبت اطلاعات" : "Save Invoice"}
          </Button>
        </DrawerFooter>
      </Drawer>

      {/* Slide-over Drawer for Expense Creation/Edit */}
      <Drawer open={isDrawerOpen && drawerType === "expense"} onOpenChange={setIsDrawerOpen} side="end" panelClassName="w-full md:w-[500px] md:max-w-[500px] bg-[var(--s1)] shadow-2xl flex flex-col h-full border-s border-[var(--b)]">
        <DrawerHeader>
          <DrawerTitle>
            {editId
              ? (isFarsi ? "ویرایش هزینه" : "Edit Expense")
              : (isFarsi ? "ثبت هزینه جدید" : "Record Expense")}
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex-1 overflow-y-auto p-6">
          <form id="drawer-expense-form" onSubmit={handleFormSubmit} className="flex flex-col gap-5">
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
                <option value="infrastructure">Infrastructure</option>
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

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "رسید هزینه / پیوست مدرک (تصویر، ویدئو یا PDF)" : "Attachment Receipt (Image, Video, PDF)"}
              </label>
              <input
                type="file"
                ref={receiptInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedReceipt(e.target.files[0]);
                  }
                }}
                className="text-xs text-[var(--t2)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--s3)] file:text-[var(--t1)] hover:file:bg-[var(--b)] cursor-pointer w-full bg-[var(--s2)] border border-[var(--b)] rounded-xl px-4 py-2"
                accept="image/*,application/pdf,video/mp4"
              />
            </div>
          </form>
        </DrawerBody>
        <DrawerFooter className="p-6 border-t border-[var(--b)] flex flex-row justify-end gap-2 flex-shrink-0">
          <Button type="button" variant="secondary" onClick={() => setIsDrawerOpen(false)}>
            {isFarsi ? "انصراف" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="drawer-expense-form"
            disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
          >
            {isFarsi ? "ثبت هزینه" : "Record Expense"}
          </Button>
        </DrawerFooter>
      </Drawer>

      {/* Smart Payment Mark Paid Modal */}
      <Modal open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {isFarsi ? "ثبت پرداخت فاکتور" : "Mark Invoice Payment"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (paymentInvoiceId) {
                const finalStatus = invoicePaymentStatus;
                updateInvoiceMutation.mutate({
                  id: paymentInvoiceId,
                  data: {
                    status: finalStatus,
                    payment_method: paymentMethod,
                    paid_at: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
                    notes: paymentMethod === "cash" 
                      ? `Cash payment. Cash received: $${cashReceived}. Change due: $${changeDue.toFixed(2)}.`
                      : `Bank transfer. Ref: ${bankReference}. Account: ${receivingAccount}.`
                  }
                });
              }
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "روش پرداخت" : "Payment Method"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                required
              >
                <option value="cash">{isFarsi ? "نقدی" : "Cash"}</option>
                <option value="bank_transfer">{isFarsi ? "حواله بانکی" : "Bank Transfer"}</option>
                <option value="online">{isFarsi ? "پرداخت آنلاین" : "Online Payment"}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "وضعیت تسویه فاکتور" : "Payment Status"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={invoicePaymentStatus}
                onChange={(e) => setInvoicePaymentStatus(e.target.value as any)}
                required
              >
                <option value="paid">{isFarsi ? "تسویه کامل (Paid)" : "Full Settlement (Paid)"}</option>
                <option value="partial">{isFarsi ? "تسویه بخشی (Partial)" : "Partial Settlement (Partial)"}</option>
                <option value="refunded">{isFarsi ? "برگشت داده شد (Refunded)" : "Refunded"}</option>
              </select>
            </div>

            {paymentMethod === "cash" && (
              <div className="p-3 bg-[var(--s3)] border border-[var(--b)] rounded-xl flex flex-col gap-2">
                <Input
                  label={isFarsi ? "مبلغ دریافتی صندوق‌دار" : "Cash Received"}
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  required
                />
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-[var(--t2)]">{isFarsi ? "مبلغ فاکتور:" : "Invoice Total:"}</span>
                  <span className="text-[var(--t1)]">${paymentAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-t border-[var(--b)] pt-2 mt-1">
                  <span className={changeDue >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
                    {isFarsi ? "باقی‌مانده پول خرد:" : "Change Due:"}
                  </span>
                  <span className={`text-sm ${changeDue >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                    ${changeDue >= 0 ? changeDue.toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === "bank_transfer" && (
              <div className="flex flex-col gap-3">
                <Input
                  label={isFarsi ? "کد رهگیری تراکنش" : "Reference Reference Code"}
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  required
                />
                <Input
                  label={isFarsi ? "حساب مقصد دریافت‌کننده" : "Receiving Account Details"}
                  placeholder={isFarsi ? "نام بانک یا شماره حساب..." : "Bank name / account #..."}
                  value={receivingAccount}
                  onChange={(e) => setReceivingAccount(e.target.value)}
                  required
                />
              </div>
            )}

            <Input
              label={isFarsi ? "تاریخ پرداخت" : "Payment Date"}
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={updateInvoiceMutation.isPending}>
                {isFarsi ? "تأیید پرداخت" : "Confirm Payment"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* Expense Attachment Document Viewer Modal */}
      <Modal open={!!previewFileUrl} onOpenChange={(open) => { if (!open) setPreviewFileUrl(null); }}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "پیش‌نمایش مدرک پیوست" : "Attachment Document Viewer"}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col items-center justify-center min-h-[350px]">
          {previewFileType === "image" && previewFileUrl && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="overflow-auto border border-[var(--b)] rounded-xl w-full max-h-[400px] flex items-center justify-center bg-[var(--s3)] p-2">
                <img 
                  src={previewFileUrl} 
                  alt="Attachment Receipt" 
                  style={{ transform: `scale(${zoomScale})` }}
                  className="transition-transform max-w-full h-auto rounded-lg shadow"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setZoomScale(s => Math.max(0.5, s - 0.25))}>Zoom -</Button>
                <Button size="sm" variant="secondary" onClick={() => setZoomScale(1)}>Reset</Button>
                <Button size="sm" variant="secondary" onClick={() => setZoomScale(s => Math.min(3, s + 0.25))}>Zoom +</Button>
              </div>
            </div>
          )}
          {previewFileType === "pdf" && previewFileUrl && (
            <iframe 
              src={previewFileUrl} 
              className="w-full h-[500px] border border-[var(--b)] rounded-xl bg-white"
              title="PDF Viewer"
            />
          )}
          {previewFileType === "video" && previewFileUrl && (
            <video 
              src={previewFileUrl} 
              controls 
              className="w-full max-h-[450px] rounded-xl bg-black shadow"
            />
          )}
        </ModalBody>
      </Modal>
    </AppShell>
  );
}

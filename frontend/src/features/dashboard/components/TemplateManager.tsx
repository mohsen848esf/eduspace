import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../../../lib/api/client";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";

interface Template {
  id: number;
  name: string;
  slug: string;
  channel: string;
  subject?: string;
  body: string;
  is_active: boolean;
}

export default function TemplateManager() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();

  // Dialog / Edit States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    channel: "EMAIL",
    subject: "",
    body: "",
    is_active: true,
  });

  // Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewContextText, setPreviewContextText] = useState('{\n  "username": "john_doe",\n  "course_title": "Physics I",\n  "class_name": "Class A"\n}');
  const [renderedPreview, setRenderedPreview] = useState({ body: "", subject: "" });
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Queries
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["notificationTemplates"],
    queryFn: async () => {
      const res = await client.get("/notifications/templates/");
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const res = await client.post("/notifications/templates/", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
      toast.success(isFarsi ? "قالب با موفقیت ایجاد شد" : "Template created successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ایجاد قالب" : "Failed to create template"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Template> }) => {
      const res = await client.put(`/notifications/templates/${id}/`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
      toast.success(isFarsi ? "قالب با موفقیت ویرایش شد" : "Template updated successfully");
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ویرایش قالب" : "Failed to update template"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.delete(`/notifications/templates/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
      toast.success(isFarsi ? "قالب با موفقیت حذف شد" : "Template deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در حذف قالب" : "Failed to delete template"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.body.trim()) {
      toast.error(isFarsi ? "لطفاً تمام فیلدهای اجباری را تکمیل کنید" : "Please fill in all required fields");
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      channel: form.channel,
      subject: form.channel === "EMAIL" ? form.subject : "",
      body: form.body,
      is_active: form.is_active,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateModal = () => {
    setEditId(null);
    setForm({
      name: "",
      slug: "",
      channel: "EMAIL",
      subject: "",
      body: "",
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (t: Template) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      slug: t.slug,
      channel: t.channel,
      subject: t.subject || "",
      body: t.body,
      is_active: t.is_active,
    });
    setIsModalOpen(true);
  };

  const handlePreview = async () => {
    if (!previewTemplate) return;
    setLoadingPreview(true);
    try {
      let context = {};
      try {
        context = JSON.parse(previewContextText);
      } catch {
        toast.error(isFarsi ? "خطا در قالب JSON متغیرها" : "Invalid context JSON format");
        setLoadingPreview(false);
        return;
      }

      const res = await client.post(`/notifications/templates/${previewTemplate.id}/preview/`, {
        context,
      });
      setRenderedPreview(res.data);
    } catch {
      toast.error(isFarsi ? "خطا در پیش‌نمایش" : "Failed to render preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <AppShell title={isFarsi ? "قالب‌های اعلان" : "Notification Templates"}>
      <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
          <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
            {isFarsi ? "مدیریت قالب‌های اعلانات" : "System Notification Templates"}
          </span>
          <Button size="sm" onClick={openCreateModal}>
            {isFarsi ? "+ قالب جدید" : "+ New Template"}
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)]">
            {isFarsi ? "هیچ قالبی ایجاد نشده است." : "No templates created yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                  <th className="p-4">{isFarsi ? "نام قالب" : "Name"}</th>
                  <th className="p-4">{isFarsi ? "شناسه یکتا (Slug)" : "Slug"}</th>
                  <th className="p-4">{isFarsi ? "کانال" : "Channel"}</th>
                  <th className="p-4">{isFarsi ? "وضعیت" : "Status"}</th>
                  <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tmpl) => (
                  <tr key={tmpl.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                    <td className="p-4 font-semibold text-[var(--t1)]">{tmpl.name}</td>
                    <td className="p-4 text-[var(--t2)] font-mono text-xs">{tmpl.slug}</td>
                    <td className="p-4 text-[var(--t2)]">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)]/40 text-[var(--brand)] font-semibold">
                        {tmpl.channel}
                      </span>
                    </td>
                    <td className="p-4">
                      {tmpl.is_active ? (
                        <span className="text-[var(--green)] font-semibold text-xs">● {isFarsi ? "فعال" : "Active"}</span>
                      ) : (
                        <span className="text-[var(--t3)] text-xs">○ {isFarsi ? "غیرفعال" : "Inactive"}</span>
                      )}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setPreviewTemplate(tmpl);
                          setRenderedPreview({ body: "", subject: "" });
                          setIsPreviewOpen(true);
                        }}
                        className="text-xs bg-transparent text-[var(--amber)] hover:underline border-none cursor-pointer"
                      >
                        {isFarsi ? "پیش‌نمایش" : "Preview"}
                      </button>
                      <button
                        onClick={() => openEditModal(tmpl)}
                        className="text-xs bg-transparent text-[var(--cyan)] hover:underline border-none cursor-pointer"
                      >
                        {isFarsi ? "ویرایش" : "Edit"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(isFarsi ? "آیا از حذف این قالب مطمئن هستید؟" : "Delete this template?")) {
                            deleteMutation.mutate(tmpl.id);
                          }
                        }}
                        className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                      >
                        {isFarsi ? "حذف" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} panelClassName="max-w-xl">
        <ModalHeader>
          <ModalTitle>
            {editId ? (isFarsi ? "ویرایش قالب" : "Edit Template") : (isFarsi ? "قالب جدید" : "Create Template")}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "نام قالب" : "Template Name"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label={isFarsi ? "شناسه یکتا (Slug)" : "Unique Slug"}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              disabled={editId !== null}
            />

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "کانال ارتباطی" : "Delivery Channel"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                disabled={editId !== null}
              >
                <option value="EMAIL">{isFarsi ? "ایمیل" : "Email"}</option>
                <option value="SMS">{isFarsi ? "پیامک" : "SMS"}</option>
                <option value="IN_APP">{isFarsi ? "درون‌برنامه‌ای" : "In-App"}</option>
              </select>
            </div>

            {form.channel === "EMAIL" && (
              <Input
                label={isFarsi ? "موضوع ایمیل" : "Email Subject"}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            )}

            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "محتوای پیام" : "Body Template"}
                </label>
                <span className="text-[10px] text-[var(--t3)]">
                  Use Django Template variables like {"{{ username }}"}
                </span>
              </div>
              <textarea
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[140px] resize-y font-mono text-xs"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--t2)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={() => setForm({ ...form, is_active: !form.is_active })}
                className="rounded text-[var(--brand)] focus:ring-[var(--brand)] border-[var(--b)] bg-[var(--s2)] h-4 w-4"
              />
              <span>{isFarsi ? "فعال باشد" : "Is Active"}</span>
            </label>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ذخیره" : "Save")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* Preview Modal */}
      <Modal open={isPreviewOpen} onOpenChange={setIsPreviewOpen} panelClassName="max-w-2xl">
        <ModalHeader>
          <ModalTitle>
            {isFarsi ? `پیش‌نمایش قالب ${previewTemplate?.name}` : `Preview Template: ${previewTemplate?.name}`}
          </ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Context Variables JSON editor */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "متغیرهای محیطی (Context JSON)" : "Context Variables (JSON)"}
              </label>
              <textarea
                className="w-full h-48 bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-xl p-3 outline-none focus:border-[var(--brand)] transition-colors resize-none font-mono"
                value={previewContextText}
                onChange={(e) => setPreviewContextText(e.target.value)}
              />
              <Button size="sm" onClick={handlePreview} disabled={loadingPreview} className="mt-1">
                {loadingPreview ? <Spinner size="sm" /> : (isFarsi ? "بروزرسانی پیش‌نمایش" : "Render Preview")}
              </Button>
            </div>

            {/* Rendered Preview Panel */}
            <div className="flex flex-col gap-2 bg-[var(--s3)] border border-[var(--b)] rounded-xl p-4 min-h-[200px]">
              <div className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--b)] pb-2 mb-2 flex items-center justify-between">
                <span>{isFarsi ? "خروجی رندر شده" : "Rendered Output"}</span>
                <span className="text-[10px] text-[var(--brand)] font-semibold">{previewTemplate?.channel}</span>
              </div>
              
              {previewTemplate?.channel === "EMAIL" && (
                <div className="mb-3">
                  <span className="text-xs font-bold text-[var(--t2)] block">{isFarsi ? "موضوع:" : "Subject:"}</span>
                  <span className="text-sm text-[var(--t1)] font-semibold">{renderedPreview.subject || "—"}</span>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-[var(--t2)] block">{isFarsi ? "متن پیام:" : "Body:"}</span>
                <div className="text-sm text-[var(--t1)] whitespace-pre-wrap mt-1 leading-relaxed bg-[var(--s2)] border border-[var(--b)] p-3 rounded-lg min-h-[80px]">
                  {renderedPreview.body || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
              {isFarsi ? "بستن" : "Close"}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </AppShell>
  );
}

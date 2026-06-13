import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type Course } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

export default function CoursesPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const isFarsi = language === "fa";

  const isOrisAdmin = hasPermission("can_manage_members");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
  });

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", code: "", description: "", price: "" });

  const openCreateModal = () => {
    setEditId(null);
    setCourseForm({ title: "", code: "", description: "", price: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Course) => {
    setEditId(item.id);
    setCourseForm({ title: item.title, code: item.code, description: item.description, price: item.price });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateCourseMutation.mutate({ id: editId, data: courseForm });
    } else {
      createCourseMutation.mutate(courseForm);
    }
  };

  return (
    <AppShell title={isFarsi ? "دوره‌های آموزشی" : "Courses"}>
      <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[var(--b)]">
          <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
            {isFarsi ? "لیست دوره‌های آموزشی" : "Academy Courses"}
          </span>
          {isOrisAdmin && (
            <Button size="sm" onClick={openCreateModal}>
              {isFarsi ? "+ دوره جدید" : "+ New Course"}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : courses.length === 0 ? (
          <div className="p-8 text-center text-[var(--t3)]">
            {isFarsi ? "دوره‌ای وجود ندارد" : "No courses found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                  <th className="p-4">{isFarsi ? "کد دوره" : "Code"}</th>
                  <th className="p-4">{isFarsi ? "عنوان" : "Title"}</th>
                  <th className="p-4">{isFarsi ? "توضیحات" : "Description"}</th>
                  <th className="p-4">{isFarsi ? "شهریه (دلار)" : "Price"}</th>
                  {isOrisAdmin && <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                    <td className="p-4 font-semibold text-[var(--brand-text)]">{c.code}</td>
                    <td className="p-4 text-[var(--t1)]">{c.title}</td>
                    <td className="p-4 text-[var(--t2)] max-w-xs truncate">{c.description || "—"}</td>
                    <td className="p-4 text-[var(--t1)]">${parseFloat(c.price).toFixed(2)}</td>
                    {isOrisAdmin && (
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(c)}
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

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalHeader>
          <ModalTitle>
            {editId
              ? (isFarsi ? "ویرایش اطلاعات دوره" : "Edit Course")
              : (isFarsi ? "ثبت دوره جدید" : "New Course")}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
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
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={createCourseMutation.isPending || updateCourseMutation.isPending}
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

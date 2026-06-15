import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import client from "../../../lib/api/client";
import { toast } from "react-hot-toast";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";

interface BroadcastComposerProps {
  classId: number;
  className: string;
  isFarsi: boolean;
  onClose: () => void;
}

export default function BroadcastComposer({ classId, className, isFarsi, onClose }: BroadcastComposerProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<string[]>(["EMAIL", "IN_APP"]);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await client.post(`/classes/${classId}/broadcast/`, {
        title,
        message,
        channels,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(isFarsi ? "پیام با موفقیت ارسال شد" : "Broadcast sent successfully");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ارسال پیام" : "Failed to send broadcast"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error(isFarsi ? "لطفاً موضوع و متن پیام را وارد کنید" : "Please enter a title and message");
      return;
    }
    if (channels.length === 0) {
      toast.error(isFarsi ? "لطفاً حداقل یک کانال ارتباطی انتخاب کنید" : "Please select at least one channel");
      return;
    }
    broadcastMutation.mutate();
  };

  const handleChannelToggle = (chan: string) => {
    setChannels((prev) => (prev.includes(chan) ? prev.filter((c) => c !== chan) : [...prev, chan]));
  };

  return (
    <Modal open={true} onOpenChange={(open) => { if (!open) onClose(); }} panelClassName="max-w-lg">
      <ModalHeader>
        <ModalTitle>
          {isFarsi ? `ارسال پیام جمعی به کلاس ${className}` : `Broadcast to ${className}`}
        </ModalTitle>
      </ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={isFarsi ? "موضوع پیام" : "Broadcast Title / Subject"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isFarsi ? "مثال: یادآوری امتحان میان‌ترم" : "e.g. Midterm Exam Reminder"}
            required
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
              {isFarsi ? "متن پیام" : "Message Body"}
            </label>
            <textarea
              className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[120px] resize-y"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isFarsi ? "متن پیام خود را بنویسید..." : "Write your announcement here..."}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
              {isFarsi ? "کانال‌های ارسال" : "Delivery Channels"}
            </label>
            <div className="flex gap-4">
              {["EMAIL", "SMS", "IN_APP"].map((chan) => (
                <label key={chan} className="flex items-center gap-2 text-sm text-[var(--t2)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.includes(chan)}
                    onChange={() => handleChannelToggle(chan)}
                    className="rounded text-[var(--brand)] focus:ring-[var(--brand)] border-[var(--b)] bg-[var(--s2)] h-4 w-4"
                  />
                  <span>
                    {chan === "EMAIL" && (isFarsi ? "ایمیل" : "Email")}
                    {chan === "SMS" && (isFarsi ? "پیامک" : "SMS")}
                    {chan === "IN_APP" && (isFarsi ? "درون‌برنامه‌ای" : "In-App")}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              {isFarsi ? "انصراف" : "Cancel"}
            </Button>
            <Button type="submit" disabled={broadcastMutation.isPending}>
              {broadcastMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ارسال پیام" : "Send Broadcast")}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}

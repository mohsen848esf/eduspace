import React from "react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export interface GuestDashboardViewProps {
  isFarsi: boolean;
  invitations: any[];
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
  onRespondInvite: (orgSlug: string, action: "accept" | "decline") => Promise<void>;
}

export const GuestDashboardView: React.FC<GuestDashboardViewProps> = ({
  isFarsi,
  invitations,
  onOpenCreateModal,
  onOpenJoinModal,
  onRespondInvite,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto w-full pt-4 fade-in">
      <div className="bg-gradient-to-br from-[var(--s2)] to-[var(--s1)] border border-[var(--b)] rounded-3xl p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="w-20 h-20 bg-[var(--brand)]/10 text-[var(--brand)] rounded-2xl flex items-center justify-center mx-auto text-3xl font-bold shadow-md animate-bounce">
          🏫
        </div>
        <div className="space-y-2 max-w-lg mx-auto">
          <h3 className="text-xl md:text-2xl font-black text-[var(--t1)] tracking-tight">
            {isFarsi ? "به EduSpace خوش آمدید!" : "Welcome to EduSpace!"}
          </h3>
          <p className="text-sm text-[var(--t3)] leading-relaxed">
            {isFarsi
              ? "شما در حال حاضر عضو هیچ سازمانی نیستید. برای شروع می‌توانید یک سازمان جدید بسازید یا با استفاده از شناسه آکادمی به یک سازمان موجود بپیوندید."
              : "You are not a member of any organization yet. To get started, you can create a new organization or join an existing one using an academy slug/ID."}
          </p>
        </div>

        {/* Call to Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto pt-4">
          <button
            onClick={onOpenCreateModal}
            className="flex flex-col items-center gap-3 p-6 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group"
          >
            <span className="text-3xl">✨</span>
            <div className="text-center">
              <h4 className="text-xs font-bold text-[var(--t1)]">
                {isFarsi ? "ایجاد سازمان جدید" : "Create Organization"}
              </h4>
              <p className="text-[10px] text-[var(--t3)] mt-1">
                {isFarsi ? "آکادمی خود را راه اندازی کنید" : "Setup your own academy"}
              </p>
            </div>
          </button>

          <button
            onClick={onOpenJoinModal}
            className="flex flex-col items-center gap-3 p-6 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group"
          >
            <span className="text-3xl">🔑</span>
            <div className="text-center">
              <h4 className="text-xs font-bold text-[var(--t1)]">
                {isFarsi ? "پیوستن به سازمان" : "Join Organization"}
              </h4>
              <p className="text-[10px] text-[var(--t3)] mt-1">
                {isFarsi ? "با استفاده از کد به سازمان ملحق شوید" : "Join using academy ID/slug"}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Pending Invitations list */}
      {invitations.length > 0 && (
        <Card className="p-0 overflow-hidden shadow-md">
          <CardHeader className="p-4 border-b border-[var(--b)]">
            <CardTitle className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
              {isFarsi ? "دعوت‌نامه‌های در انتظار" : "Pending Invitations"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-[var(--b)]">
            {invitations.map((invite: any) => (
              <div
                key={invite.id}
                className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[var(--s3)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-xl font-bold">
                    📩
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[var(--t1)]">
                      {invite.organization.name}
                    </h4>
                    <p className="text-xs text-[var(--t3)] mt-0.5">
                      {isFarsi
                        ? `نقش: ${invite.role || "دانشجو"} • دعوت شده توسط: ${invite.invited_by || "سیستم"}`
                        : `Role: ${invite.role || "Student"} • Invited by: ${invite.invited_by || "System"}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => onRespondInvite(invite.organization.slug, "decline")}
                    className="px-4 py-2 text-xs font-semibold text-[var(--red)] hover:bg-[var(--red)]/10 rounded-xl"
                  >
                    {isFarsi ? "رد کردن" : "Decline"}
                  </Button>
                  <Button
                    onClick={() => onRespondInvite(invite.organization.slug, "accept")}
                    className="px-4 py-2 text-xs font-bold rounded-xl"
                  >
                    {isFarsi ? "پذیرفتن" : "Accept"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GuestDashboardView;

import { getApiErrorData } from "@/lib/api/errors";
import { useState } from "react";
import { reportsApi } from "../../dashboard/api/reports.api";
import { Download, UserX, AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

export default function GDPRControl() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.loading("Compiling your personal data records...", { id: "gdpr-export" });
      await reportsApi.requestGDPRData();
      toast.success("Data export compiled and downloaded successfully!", { id: "gdpr-export" });
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorData(error)?.detail || "Failed to compile data export.", { id: "gdpr-export" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter your password for authentication.");
      return;
    }
    if (confirmText.toLowerCase() !== "delete my account") {
      toast.error("Please type the verification phrase exactly.");
      return;
    }

    try {
      setIsDeleting(true);
      toast.loading("Purging and deactivating your account...", { id: "gdpr-delete" });
      const res = await reportsApi.deleteAccount(password);
      toast.success(res.detail, { id: "gdpr-delete" });
      setIsDeleteModalOpen(false);
      
      // Force logout and redirect to login after a brief delay
      setTimeout(() => {
        localStorage.clear();
        window.location.href = "/login";
      }, 3000);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorData(error)?.detail || "Account erasure request failed.", { id: "gdpr-delete" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] hover:border-[var(--brand)]/20 transition-all duration-300 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--t1)] text-lg">GDPR Personal Data Export</h3>
            <p className="text-[var(--t2)] text-sm">Download a complete structured JSON copy of your profile demographics, logs, submissions, and preferences.</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold bg-[var(--s2)] text-[var(--t1)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-cyan-500/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isExporting ? "Compiling..." : "Request Data Export"}
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-[var(--s1)] border border-red-500/20 hover:border-red-500/35 transition-all duration-300 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--t1)] text-lg">GDPR Erasure Request & Deactivation</h3>
            <p className="text-[var(--t2)] text-sm">Request permanent deactivation and anonymization of your profile details. This scrambles all names, emails, and credentials, complying with the Right to be Forgotten.</p>
          </div>
        </div>
        <button
          onClick={() => {
            setPassword("");
            setConfirmText("");
            setIsDeleteModalOpen(true);
          }}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserX className="w-4 h-4" />
          <span>Permanently Anonymize Profile</span>
        </button>
      </div>

      {/* Erasure verification Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="w-full max-w-md bg-[var(--s1)] border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-[var(--b)] pb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--t1)]">Account Erasure Verification</h3>
                <p className="text-xs text-[var(--t2)]">GDPR Erasure & Personal Data Anonymization</p>
              </div>
            </div>

            <p className="text-[var(--t2)] text-sm leading-relaxed">
              This action is <strong className="text-[var(--red)]">irreversible</strong>. We will permanently scrub your email, full name, phone number, and password from the system. Your historical class averages and billing metrics will be kept, but will point to an anonymized user key.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--t2)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-[var(--t1)] focus:border-red-500/50 outline-none text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--t2)]">
                  Type <span className="text-[var(--red)] font-bold">"delete my account"</span> below:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type verification phrase"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-[var(--t1)] focus:border-red-500/50 outline-none text-sm"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold bg-[var(--s2)] text-[var(--t1)] hover:bg-[var(--s3)] border border-[var(--b)] transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || confirmText.toLowerCase() !== "delete my account"}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isDeleting ? "Anonymizing..." : "Erasure Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

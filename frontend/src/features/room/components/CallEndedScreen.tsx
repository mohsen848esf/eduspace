import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneOff, RotateCcw, Home, Star, CheckCircle2, Timer } from "lucide-react";
import Button from "../../../components/ui/Button";
import { useLocale } from "../../../i18n/useLocale";
import { useAuthStore } from "../../../features/auth/store/authStore";

interface CallEndedScreenProps {
  roomCode: string;
  roomName?: string;
  onRejoin?: () => void;
  onExit?: () => void;
}

export default function CallEndedScreen({
  roomCode,
  roomName,
  onRejoin,
  onExit,
}: CallEndedScreenProps) {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = Boolean(user);

  const [rating, setRating] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const exitedRef = useRef(false);

  const handleReturnHome = () => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    if (onExit) {
      onExit();
    } else {
      navigate(isAuthenticated ? "/dashboard" : "/login");
    }
  };

  // 60-second countdown timer for auto-redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleReturnHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRate = (stars: number) => {
    setRating(stars);
    setFeedbackSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--s0)] flex items-center justify-center p-4 text-[var(--t1)] relative overflow-hidden select-none font-sans">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md bg-[var(--s1)] border border-[var(--b)] backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* End Call Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/10">
          <PhoneOff className="w-8 h-8" />
        </div>

        {/* Title and Room Name */}
        <h2 className="text-xl font-black text-[var(--t1)]">
          {isFarsi ? "شما از جلسه خارج شدید" : "You have left the meeting"}
        </h2>
        <p className="text-xs text-[var(--t3)] mt-1 mb-4">
          {roomName || roomCode ? (
            <span>
              {isFarsi ? "جلسه:" : "Meeting:"}{" "}
              <strong className="text-[var(--t2)]">{roomName || roomCode}</strong>
            </span>
          ) : (
            <span>{isFarsi ? "تماس به پایان رسید" : "The call has ended"}</span>
          )}
        </p>

        {/* 60s Countdown Timer Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t2)] mb-6 font-medium">
          <Timer className="w-3.5 h-3.5 text-[var(--brand)] animate-pulse" />
          <span>
            {isFarsi
              ? `بازگشت خودکار به داشبورد در ${countdown} ثانیه`
              : `Auto-returning to dashboard in ${countdown}s`}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mb-6">
          {onRejoin && (
            <Button
              variant="primary"
              onClick={onRejoin}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-h)] text-[var(--brand-text)] font-bold"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isFarsi ? "پیوستن مجدد" : "Rejoin Call"}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={handleReturnHome}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-[var(--b)] hover:bg-[var(--s2)] text-[var(--t2)] font-bold"
          >
            <Home className="w-4 h-4" />
            <span>
              {isAuthenticated
                ? isFarsi
                  ? "بازگشت به داشبورد"
                  : "Return to Dashboard"
                : isFarsi
                  ? "ورود به حساب"
                  : "Go to Login"}
            </span>
          </Button>
        </div>

        {/* Call Quality Rating */}
        <div className="w-full pt-5 border-t border-[var(--b)] flex flex-col items-center">
          <span className="text-xs text-[var(--t3)] mb-3 font-medium">
            {feedbackSubmitted
              ? isFarsi
                ? "باتشکر از بازخورد شما!"
                : "Thank you for your feedback!"
              : isFarsi
                ? "کیفیت صوتی و تصویری جلسه چطور بود؟"
                : "How was the call quality?"}
          </span>

          {feedbackSubmitted ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFarsi ? "ثبت شد" : "Feedback recorded"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setRating(star)}
                  onMouseLeave={() => setRating(null)}
                  className="p-1 rounded-lg hover:bg-[var(--s2)] transition-colors cursor-pointer text-[var(--t3)] hover:text-amber-400"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      rating && rating >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-[var(--t3)] opacity-40"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

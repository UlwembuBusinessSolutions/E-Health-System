import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { listIncomingReferralNotifications } from "@/shared/api/referrals";

export function IncomingReferralNotifications() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const queryKey = ["incoming-referral-notifications", getTenantSlug(), user?.id];
  const notifications = useQuery({
    queryKey,
    queryFn: listIncomingReferralNotifications,
    enabled: Boolean(user),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const currentNotification = notifications.data?.find((notification) => notification.status === "SUBMITTED");

  if (pathname === "/app/notifications") return null;

  if (notifications.isError && !currentNotification) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-red-200 bg-white p-4 shadow-xl"
        role="alert">
        <p className="text-sm font-semibold text-red-800">Incoming notifications are unavailable.</p>
        <button type="button" onClick={() => notifications.refetch()}
          className="mt-2 text-sm font-semibold text-[#087f74] underline">
          Try again
        </button>
      </div>
    );
  }

  if (!currentNotification) return null;

  const referralLabel = currentNotification.referralType === "TRANSFER" ? "patient transfer" : "patient referral";

  return (
    <Link
      to={`/app/notifications?notificationId=${encodeURIComponent(currentNotification.id)}`}
      className="fixed bottom-4 right-4 z-50 block max-w-sm rounded-xl border border-border-subtle bg-white p-5 shadow-xl
        transition hover:border-[#087f74] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[#087f74]"
      aria-labelledby="incoming-referral-title"
    >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f74]">Clinic notification</p>
        <h2 id="incoming-referral-title" className="mt-2 text-lg font-bold text-slate-900">
          Incoming {referralLabel}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sent by {currentNotification.sourceOrganizationName}. Review the patient information before taking action.
        </p>
        <span className="mt-4 block w-full rounded-lg bg-[#087f74] px-4 py-3 text-center text-sm font-semibold text-white
          transition hover:bg-[#06695f]">
          Review patient details
        </span>
    </Link>
  );
}

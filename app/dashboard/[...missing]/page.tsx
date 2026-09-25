import { notFound } from "next/navigation";

/**
 * Unmatched /dashboard/* URLs would otherwise fall through to Next's bare root 404. Catching them here renders
 * app/dashboard/not-found.tsx inside the dashboard shell (sidebar, search) instead. Specific routes always win
 * over a catch-all, so this never shadows a real page.
 */
export default function MissingDashboardPage() {
  notFound();
}

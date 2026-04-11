/**
 * Formats an ISO 8601 timestamp as a human-readable relative date.
 * Uses Intl.DateTimeFormat for dates older than 7 days per project conventions.
 */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

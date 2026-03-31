export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) {
    return new Date(isoString).toLocaleDateString('en-US', { weekday: 'short' });
  }
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return time;

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${day} ${time}`;
  }

  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthDay} ${time}`;
}

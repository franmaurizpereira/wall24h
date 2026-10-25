export function formatComments(count: number): string {
  return `${count} ${count === 1 ? 'comentario' : 'comentarios'}`;
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Expirado';
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

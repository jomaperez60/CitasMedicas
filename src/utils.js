export function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getISOStringFromDate(date, timeString) {
  const [hours, minutes] = timeString.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}`;
}

export function calculatePosition(isoString) {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const headerHeight = 60;
  const slotHeight = 60; // 60px per hour
  
  // Start calendar at 6 AM
  const startHour = 6;
  const relativeMinutes = (hours - startHour) * 60 + minutes;
  return headerHeight + (relativeMinutes / 60) * slotHeight;
}

export function calculateHeight(durationMinutes) {
  const slotHeight = 60;
  return (durationMinutes / 60) * slotHeight;
}

export function getTimeFromPosition(y) {
  const headerHeight = 60;
  const slotHeight = 60;
  const startHour = 6;
  
  const relativeY = y - headerHeight;
  const totalMinutes = (relativeY / slotHeight) * 60;
  
  // Round to nearest 15 minutes
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  const hours = Math.floor(roundedMinutes / 60) + startHour;
  const mins = roundedMinutes % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getWeekDates(date) {
  const curr = new Date(date);
  const first = curr.getDate() - curr.getDay(); // First day is Sunday (0)
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(curr);
    d.setDate(first + i);
    return d;
  });
}

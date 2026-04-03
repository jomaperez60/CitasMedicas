export function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatTime(isoString, format = '24h') {
  let date;
  if (typeof isoString === 'string' && isoString.includes(':') && !isoString.includes('-')) {
    // Handle HH:MM format
    const [h, m] = isoString.split(':');
    date = new Date();
    date.setHours(parseInt(h), parseInt(m), 0, 0);
  } else {
    date = new Date(isoString);
  }

  if (isNaN(date.getTime())) return 'Hora no válida';
  
  if (format === '12h') {
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  }
  return date.toTimeString().substring(0, 5);
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

export function calculatePosition(isoString, headerHeight = 90, slotHeight = 100) {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Start calendar at 6 AM
  const startHour = 6;
  const relativeMinutes = (hours - startHour) * 60 + minutes;
  return headerHeight + (relativeMinutes / 60) * slotHeight;
}

export function calculateHeight(durationMinutes, slotHeight = 100) {
  return (durationMinutes / 60) * slotHeight;
}

export function getTimeFromPosition(y, headerHeight = 90, slotHeight = 100) {
  const startHour = 6;
  
  const relativeY = y - headerHeight;
  const totalMinutes = (relativeY / slotHeight) * 60;
  
  // Round to nearest 1 minute for better precision if needed, or 15 for snap
  const roundedMinutes = Math.round(totalMinutes); 
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

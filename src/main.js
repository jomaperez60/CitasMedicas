import { state, APPOINTMENT_TYPES } from './state.js';
import { formatDate, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';

const elements = {
  dateDisplay: document.getElementById('current-date-display'),
  prevDay: document.getElementById('prev-day'),
  nextDay: document.getElementById('next-day'),
  doctorsFilter: document.getElementById('doctors-filter'),
  roomsFilter: document.getElementById('rooms-filter'),
  timeColumn: document.getElementById('time-column'),
  calendarGrid: document.getElementById('calendar-grid'),
  modal: document.getElementById('appointment-modal'),
  form: document.getElementById('appointment-form'),
  cancelModal: document.getElementById('cancel-modal'),
  addBtn: document.getElementById('add-appointment-btn'),
  providerSelect: document.getElementById('provider-id'),
  typesSelection: document.getElementById('types-selection'),
  deleteBtn: document.getElementById('delete-appointment-btn'),
  miniCalendar: document.getElementById('mini-calendar'),
  viewDay: document.getElementById('view-day'),
  viewWeek: document.getElementById('view-week'),
  themeToggle: document.getElementById('theme-toggle'),
  printBtn: document.getElementById('print-btn'),
  patientSearch: document.getElementById('patient-search'),
  conflictWarning: document.getElementById('conflict-warning')
};

let isDragging = false;
let isMovingExisting = false;
let movingAppId = null;
let dragProviderId = null;
let dragStartTime = null;
let dragElement = null;

function init() {
  applyTheme();
  populateProviders();
  renderTypesSelection();
  updateDateDisplay();
  renderMiniCalendar();
  renderFilters();
  renderTimeSlots();
  renderGrid();
  renderAppointments();
  attachEventListeners();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  elements.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
}

function renderTypesSelection() {
  elements.typesSelection.innerHTML = APPOINTMENT_TYPES.map(t => `
    <label class="type-checkbox">
      <input type="checkbox" name="appointment-type" value="${t.id}">
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${t.color}; margin-right: 4px;"></span>
      <span>${t.label}</span>
    </label>
  `).join('');
}

function updateDateDisplay() {
  elements.dateDisplay.textContent = formatDate(state.currentDate);
}

function renderMiniCalendar() {
  const dates = [];
  const today = new Date(state.currentDate);
  for (let i = -3; i < 11; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }

  elements.miniCalendar.innerHTML = dates.map(d => {
    const isActive = d.toDateString() === state.currentDate.toDateString();
    return `
      <div class="calendar-day-btn ${isActive ? 'active' : ''}" data-date="${d.toISOString()}">
        <span>${new Intl.DateTimeFormat('es', { weekday: 'short' }).format(d)}</span>
        <span>${d.getDate()}</span>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.calendar-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentDate = new Date(btn.dataset.date);
      updateDateDisplay();
      renderMiniCalendar();
      renderGrid();
      renderAppointments();
    });
  });
}

function renderFilters() {
  elements.roomsFilter.innerHTML = state.rooms.map(r => `
    <label style="display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
      <input type="checkbox" data-id="${r.id}" ${r.visible ? 'checked' : ''} style="margin-right: 0.5rem;">
      <span style="color: var(--text-main); font-weight: 500;">${r.name}</span>
    </label>
  `).join('');

  elements.doctorsFilter.innerHTML = state.doctors.map(d => `
    <label style="display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
      <input type="checkbox" data-id="${d.id}" ${d.visible ? 'checked' : ''} style="margin-right: 0.5rem;">
      <span style="color: ${d.color}; font-weight: 500;">${d.name}</span>
    </label>
  `).join('');
}

function renderTimeSlots() {
  const slots = [];
  for (let h = 6; h <= 20; h++) {
    slots.push(`<div class="time-slot">${h}:00</div>`);
  }
  elements.timeColumn.innerHTML = `<div style="height: 60px;"></div>` + slots.join('');
}

function renderGrid() {
  const subSlotsHtml = `
    <div class="sub-slot" style="top: 15px;"></div>
    <div class="sub-slot" style="top: 30px;"></div>
    <div class="sub-slot" style="top: 45px;"></div>
  `;

  if (state.viewMode === 'day') {
    const visibleProviders = [...state.rooms, ...state.doctors].filter(p => p.visible);
    elements.calendarGrid.innerHTML = visibleProviders.map(p => `
      <div class="provider-column" data-provider-id="${p.id}">
        <div class="column-header">
          <span style="font-size: 0.85rem;">${p.name}</span>
        </div>
        ${Array.from({ length: 15 }).map(() => `<div class="time-slot">${subSlotsHtml}</div>`).join('')}
      </div>
    `).join('');
  } else {
    const provider = [...state.rooms, ...state.doctors].find(p => p.id === state.selectedProviderId) || state.rooms[0];
    state.selectedProviderId = provider.id;
    const weekDates = getWeekDates(state.currentDate);
    
    elements.calendarGrid.innerHTML = weekDates.map(d => `
      <div class="provider-column" data-provider-id="${provider.id}" data-date="${d.toISOString()}">
        <div class="column-header">
          <span style="font-size: 0.85rem; text-transform: capitalize;">${new Intl.DateTimeFormat('es', { weekday: 'short' }).format(d)}</span>
          <span class="date-sub">${d.getDate()} / ${d.getMonth() + 1}</span>
        </div>
        ${Array.from({ length: 15 }).map(() => `<div class="time-slot">${subSlotsHtml}</div>`).join('')}
      </div>
    `).join('');
  }
  attachGridEvents();
}

function renderAppointments() {
  document.querySelectorAll('.appointment').forEach(el => el.remove());

  const filterApps = (apps) => {
    if (!state.searchTerm) return apps;
    const term = state.searchTerm.toLowerCase();
    return apps.filter(a => a.patientName.toLowerCase().includes(term));
  };

  if (state.viewMode === 'day') {
    const apps = filterApps(state.getAppointmentsForDate(state.currentDate));
    apps.forEach(app => drawAppointment(app));
  } else {
    const weekDates = getWeekDates(state.currentDate);
    weekDates.forEach(date => {
      const apps = filterApps(state.getAppointmentsForDate(date).filter(a => a.providerId === state.selectedProviderId));
      apps.forEach(app => drawAppointment(app, date));
    });
  }
}

function drawAppointment(app, dateContext = null) {
  const targetDate = dateContext || new Date(app.startTime);
  const selector = state.viewMode === 'day' 
    ? `.provider-column[data-provider-id="${app.providerId}"]`
    : `.provider-column[data-date^="${targetDate.toISOString().substring(0, 10)}"]`;
    
  const column = document.querySelector(selector);
  if (!column) return;

  const div = document.createElement('div');
  const appTypes = app.types || (app.type ? [app.type] : []);
  const primaryType = APPOINTMENT_TYPES.find(t => appTypes.includes(t.id)) || APPOINTMENT_TYPES[0];
  
  div.className = `appointment status-${app.status}`;
  div.style.background = `linear-gradient(135deg, ${primaryType.color}15 0%, ${primaryType.color}30 100%)`;
  div.style.borderLeft = `4px solid ${primaryType.color}`;
  div.style.color = state.theme === 'dark' ? '#fff' : primaryType.color;
  div.dataset.appId = app.id;
  div.draggable = true;

  const typeLabels = appTypes.map(tid => APPOINTMENT_TYPES.find(t => t.id === tid)?.label || tid);
  
  div.innerHTML = `
    <div style="font-weight: 700;">${app.patientName}</div>
    <div style="font-size: 0.7rem; opacity: 0.9;">${formatTime(app.startTime)} - ${typeLabels.join(', ')}</div>
    ${app.notes ? `<div style="font-size: 0.65rem; margin-top: 2px; font-style: italic;">"${app.notes.substring(0, 30)}..."</div>` : ''}
  `;

  const top = calculatePosition(app.startTime);
  const height = calculateHeight(app.duration);
  div.style.top = `${top}px`;
  div.style.height = `${height}px`;

  div.addEventListener('click', (e) => {
    e.stopPropagation();
    editAppointment(app);
  });

  // Drag to reschedule
  div.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    isMovingExisting = true;
    movingAppId = app.id;
    div.style.opacity = '0.5';
  });

  div.addEventListener('dragend', () => {
    div.style.opacity = '1';
    isMovingExisting = false;
  });

  column.appendChild(div);
}

function populateProviders() {
  const all = [...state.rooms, ...state.doctors];
  elements.providerSelect.innerHTML = all.map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
}

function attachEventListeners() {
  elements.prevDay.addEventListener('click', () => {
    const delta = state.viewMode === 'day' ? 1 : 7;
    state.currentDate.setDate(state.currentDate.getDate() - delta);
    updateDateDisplay();
    renderMiniCalendar();
    renderAppointments();
  });

  elements.nextDay.addEventListener('click', () => {
    const delta = state.viewMode === 'day' ? 1 : 7;
    state.currentDate.setDate(state.currentDate.getDate() + delta);
    updateDateDisplay();
    renderMiniCalendar();
    renderAppointments();
  });

  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    state.save();
    applyTheme();
    renderAppointments(); // Re-render to adjust colors if needed
  });

  elements.printBtn.addEventListener('click', () => window.print());

  elements.patientSearch.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderAppointments();
  });

  const handleFilterChange = (e) => {
    const id = e.target.getAttribute('data-id');
    state.toggleVisibility(id);
    if (state.viewMode === 'week') state.selectedProviderId = id;
    renderGrid();
    renderAppointments();
  };

  elements.roomsFilter.addEventListener('change', handleFilterChange);
  elements.doctorsFilter.addEventListener('change', handleFilterChange);

  elements.viewDay.addEventListener('click', () => {
    state.viewMode = 'day';
    elements.viewDay.classList.add('active');
    elements.viewWeek.classList.remove('active');
    renderGrid();
    renderAppointments();
  });

  elements.viewWeek.addEventListener('click', () => {
    state.viewMode = 'week';
    elements.viewWeek.classList.add('active');
    elements.viewDay.classList.remove('active');
    renderGrid();
    renderAppointments();
  });

  elements.addBtn.addEventListener('click', () => openModal());
  elements.cancelModal.addEventListener('click', () => elements.modal.style.display = 'none');
  
  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedTypes = Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value);
    const data = {
      patientName: document.getElementById('patient-name').value,
      phone: document.getElementById('patient-phone').value,
      providerId: elements.providerSelect.value,
      types: selectedTypes,
      duration: parseInt(document.getElementById('duration').value),
      startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
      notes: document.getElementById('appointment-notes').value,
      status: state.selectedAppointment?.status || 'scheduled'
    };

    if (state.hasConflict(data, state.selectedAppointment?.id)) {
      elements.conflictWarning.style.display = 'block';
      return; // Stop and wait for user to fix or acknowledge? (USER asked for All, usually meaning block or warn)
    }

    if (state.selectedAppointment) {
      state.updateAppointment(state.selectedAppointment.id, data);
    } else {
      state.addAppointment(data);
    }

    elements.modal.style.display = 'none';
    renderAppointments();
  });

  // Re-check conflict on change
  ['start-time', 'duration', 'provider-id'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const selectedTypes = Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value);
      const data = {
        providerId: elements.providerSelect.value,
        duration: parseInt(document.getElementById('duration').value),
        startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
        types: selectedTypes
      };
      elements.conflictWarning.style.display = state.hasConflict(data, state.selectedAppointment?.id) ? 'block' : 'none';
    });
  });

  elements.deleteBtn.addEventListener('click', () => {
    if (state.selectedAppointment && confirm('¿Eliminar esta cita?')) {
      state.deleteAppointment(state.selectedAppointment.id);
      elements.modal.style.display = 'none';
      renderAppointments();
    }
  });

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.selectedAppointment) {
        state.updateAppointment(state.selectedAppointment.id, { status: btn.dataset.status });
        renderAppointments();
        elements.modal.style.display = 'none';
      }
    });
  });
}

function attachGridEvents() {
  document.querySelectorAll('.provider-column').forEach(column => {
    column.addEventListener('mousedown', (e) => {
      if (e.target !== column && !e.target.classList.contains('time-slot') && !e.target.classList.contains('sub-slot')) return;
      
      isDragging = true;
      dragProviderId = column.dataset.providerId;
      const rect = column.getBoundingClientRect();
      const y = e.clientY - rect.top + column.scrollTop;
      dragStartTime = getTimeFromPosition(y);
      
      if (column.dataset.date) state.currentDate = new Date(column.dataset.date);

      dragElement = document.createElement('div');
      dragElement.className = 'drag-preview';
      dragElement.style.top = `${calculatePosition(getISOStringFromDate(state.currentDate, dragStartTime))}px`;
      dragElement.style.height = '15px';
      column.appendChild(dragElement);
    });

    // Handle dropping an existing app
    column.addEventListener('dragover', (e) => e.preventDefault());
    column.addEventListener('drop', (e) => {
      if (!isMovingExisting) return;
      const rect = column.getBoundingClientRect();
      const y = e.clientY - rect.top + column.scrollTop;
      const newStartTimeStr = getTimeFromPosition(y);
      const newProviderId = column.dataset.providerId;
      const newDate = column.dataset.date ? new Date(column.dataset.date) : state.currentDate;
      const newFullStartTime = getISOStringFromDate(newDate, newStartTimeStr);

      const app = state.appointments.find(a => a.id === movingAppId);
      if (app) {
        const updates = { startTime: newFullStartTime, providerId: newProviderId };
        if (!state.hasConflict({ ...app, ...updates }, app.id)) {
          state.updateAppointment(app.id, updates);
          renderAppointments();
        } else {
          alert('Conflicto detectado: No se puede mover la cita a este horario.');
        }
      }
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !dragElement) return;
    const column = dragElement.parentElement;
    const rect = column.getBoundingClientRect();
    const currentY = e.clientY - rect.top + column.scrollTop;
    const startY = parseFloat(dragElement.style.top);
    const height = Math.max(15, currentY - startY);
    dragElement.style.height = `${Math.round(height / 15) * 15}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (dragElement) {
      const duration = Math.round(parseFloat(dragElement.style.height) / 60 * 60);
      const startTime = dragStartTime;
      const providerId = dragProviderId;
      dragElement.remove();
      dragElement = null;
      openModal({ startTime, providerId, duration });
    }
  });
}

function openModal(defaults = {}) {
  elements.form.reset();
  state.selectedAppointment = null;
  elements.deleteBtn.style.display = 'none';
  elements.conflictWarning.style.display = 'none';
  document.getElementById('modal-title').textContent = 'Agendar Cita';
  document.getElementById('status-group').style.display = 'none';
  
  if (defaults.startTime) document.getElementById('start-time').value = defaults.startTime;
  if (defaults.providerId) elements.providerSelect.value = defaults.providerId;
  if (defaults.duration) document.getElementById('duration').value = defaults.duration;
  
  document.querySelectorAll('input[name="appointment-type"]').forEach(cb => cb.checked = false);
  elements.modal.style.display = 'flex';
}

function editAppointment(appointment) {
  state.selectedAppointment = appointment;
  elements.deleteBtn.style.display = 'block';
  elements.conflictWarning.style.display = 'none';
  document.getElementById('modal-title').textContent = 'Editar Cita';
  document.getElementById('patient-name').value = appointment.patientName;
  document.getElementById('patient-phone').value = appointment.phone || '';
  elements.providerSelect.value = appointment.providerId;
  document.getElementById('duration').value = appointment.duration;
  document.getElementById('start-time').value = new Date(appointment.startTime).toTimeString().substring(0, 5);
  document.getElementById('appointment-notes').value = appointment.notes || '';
  
  document.querySelectorAll('input[name="appointment-type"]').forEach(cb => {
    cb.checked = appointment.types.includes(cb.value);
  });

  document.getElementById('status-group').style.display = 'block';
  elements.modal.style.display = 'flex';
}

init();

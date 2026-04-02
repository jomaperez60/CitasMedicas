import { state, APPOINTMENT_TYPES, HONDURAS_INSURANCES } from './state.js';
import { formatDate, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';

const elements = {
  activeTabButtons: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
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
  conflictWarning: document.getElementById('conflict-warning'),
  timeFormatToggle: document.getElementById('time-format-toggle'),
  insuranceSelect: document.getElementById('patient-insurance'),
  patientName: document.getElementById('patient-name'),
  patientPhone: document.getElementById('patient-phone'),
  patientDob: document.getElementById('patient-dob'),
  patientSuggestions: document.getElementById('patient-suggestions'),
  clinicalNotes: document.getElementById('clinical-notes'),
  treatmentNotes: document.getElementById('treatment-notes'),
  appointmentsListBody: document.getElementById('appointments-list-body'),
  patientsListBody: document.getElementById('patients-list-body'),
  sidebarControls: document.getElementById('agenda-sidebar-controls')
};

let isDragging = false;
let isMovingExisting = false;
let movingAppId = null;
let dragProviderId = null;
let dragStartTime = null;
let dragElement = null;

function init() {
  applyTheme();
  updateTimeFormatButton();
  populateDropdowns();
  renderTypesSelection();
  updateDateDisplay();
  refreshUI();
  attachEventListeners();
}

function refreshUI() {
  renderMiniCalendar();
  renderFilters();
  
  if (state.activeTab === 'agenda') {
    elements.sidebarControls.style.display = 'block';
    renderTimeSlots();
    renderGrid();
    renderAppointments();
  } else if (state.activeTab === 'lista') {
    elements.sidebarControls.style.display = 'none';
    renderAppointmentsList();
  } else if (state.activeTab === 'pacientes') {
    elements.sidebarControls.style.display = 'none';
    renderPatientsList();
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  elements.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
}

function updateTimeFormatButton() {
  elements.timeFormatToggle.textContent = state.timeFormat === '24h' ? '24h' : '12h';
}

function populateDropdowns() {
  // Insurances
  elements.insuranceSelect.innerHTML = HONDURAS_INSURANCES.map(i => `
    <option value="${i}">${i}</option>
  `).join('');

  // Providers
  const all = [...state.rooms, ...state.doctors];
  elements.providerSelect.innerHTML = all.map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
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

// --- Dynamic Rendering ---

function renderTimeSlots() {
  const slots = [];
  for (let h = 6; h <= 20; h++) {
    const timeLabel = state.timeFormat === '24h' ? `${h}:00` : (h > 12 ? `${h-12} PM` : (h === 12 ? '12 PM' : `${h} AM`));
    slots.push(`<div class="time-slot">${timeLabel}</div>`);
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
          <span style="font-size: 0.7rem; opacity: 0.7;">${d.getDate()} / ${d.getMonth() + 1}</span>
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
  const timeStr = formatTimeEnterprise(app.startTime);
  
  div.innerHTML = `
    <div style="font-weight: 700;">${app.patientName}</div>
    <div style="font-size: 0.7rem; opacity: 0.9;">${timeStr} - ${typeLabels.join(', ')}</div>
    ${app.treatmentNotes ? `<div style="font-size: 0.6rem; margin-top: 2px; font-style: italic; opacity: 0.8;">Rx: ${app.treatmentNotes.substring(0, 25)}...</div>` : ''}
  `;

  div.style.top = `${calculatePosition(app.startTime)}px`;
  div.style.height = `${calculateHeight(app.duration)}px`;

  div.addEventListener('click', (e) => {
    e.stopPropagation();
    editAppointment(app);
  });

  div.addEventListener('dragstart', (e) => {
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

// --- Tab Renderers ---

function renderAppointmentsList() {
  const apps = state.getAppointmentsForDate(state.currentDate);
  elements.appointmentsListBody.innerHTML = apps.map(app => {
    const provider = [...state.rooms, ...state.doctors].find(p => p.id === app.providerId);
    const types = (app.types || []).map(tid => APPOINTMENT_TYPES.find(t => t.id === tid)?.label).join(', ');
    return `
      <tr>
        <td>${formatTimeEnterprise(app.startTime)}</td>
        <td><strong>${app.patientName}</strong></td>
        <td>${provider?.name || 'N/A'}</td>
        <td style="font-size: 0.8rem;">${types}</td>
        <td><span class="badge">${app.insurance || 'Privado'}</span></td>
        <td><span class="status-pill status-${app.status}">${app.status}</span></td>
      </tr>
    `;
  }).join('');
}

function renderPatientsList() {
  elements.patientsListBody.innerHTML = state.patients.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.phone || '-'}</td>
      <td>${p.insurance || 'Privado'}</td>
      <td>${p.dob || '-'}</td>
      <td>
        <button class="btn btn-outline btn-sm edit-patient" data-id="${p.id}">✏️</button>
      </td>
    </tr>
  `).join('');
}

// --- Autocomplete ---

function handlePatientInput(e) {
  const val = e.target.value.toLowerCase();
  if (val.length < 2) {
    elements.patientSuggestions.style.display = 'none';
    return;
  }

  const matches = state.patients.filter(p => p.name.toLowerCase().includes(val));
  if (matches.length > 0) {
    elements.patientSuggestions.innerHTML = matches.map(p => `
      <div class="suggestion-item" data-id="${p.id}">${p.name} (${p.phone || 'Sin tel.'})</div>
    `).join('');
    elements.patientSuggestions.style.display = 'block';
  } else {
    elements.patientSuggestions.style.display = 'none';
  }
}

function selectPatient(patient) {
  elements.patientName.value = patient.name;
  elements.patientPhone.value = patient.phone || '';
  elements.insuranceSelect.value = patient.insurance || 'Privado / Sin Seguro';
  elements.patientDob.value = patient.dob || '';
  elements.clinicalNotes.value = patient.notes || '';
  elements.patientSuggestions.style.display = 'none';
}

// --- Event Handlers ---

function attachEventListeners() {
  // Tabs
  elements.activeTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      elements.activeTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      elements.tabContents.forEach(tc => tc.classList.remove('active'));
      document.getElementById(`tab-${state.activeTab}`).classList.add('active');
      refreshUI();
    });
  });

  // Time Navigation
  elements.prevDay.addEventListener('click', () => {
    const delta = state.viewMode === 'day' ? 1 : 7;
    state.currentDate.setDate(state.currentDate.getDate() - delta);
    updateDateDisplay();
    refreshUI();
  });

  elements.nextDay.addEventListener('click', () => {
    const delta = state.viewMode === 'day' ? 1 : 7;
    state.currentDate.setDate(state.currentDate.getDate() + delta);
    updateDateDisplay();
    refreshUI();
  });

  // Toggles
  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    state.save();
    applyTheme();
    refreshUI();
  });

  elements.timeFormatToggle.addEventListener('click', () => {
    state.timeFormat = state.timeFormat === '24h' ? '12h' : '24h';
    state.save();
    updateTimeFormatButton();
    refreshUI();
  });

  elements.printBtn.addEventListener('click', () => window.print());

  elements.patientSearch.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderAppointments();
    if (state.activeTab === 'lista') renderAppointmentsList();
    if (state.activeTab === 'pacientes') renderPatientsList();
  });

  // Filters
  elements.roomsFilter.addEventListener('change', (e) => {
    state.toggleVisibility(e.target.dataset.id);
    if (state.viewMode === 'week') state.selectedProviderId = e.target.dataset.id;
    renderGrid();
    renderAppointments();
  });

  elements.doctorsFilter.addEventListener('change', (e) => {
    state.toggleVisibility(e.target.dataset.id);
    if (state.viewMode === 'week') state.selectedProviderId = e.target.dataset.id;
    renderGrid();
    renderAppointments();
  });

  // Views
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

  // Modal logic
  elements.addBtn.addEventListener('click', () => openModal());
  elements.cancelModal.addEventListener('click', () => elements.modal.style.display = 'none');
  
  elements.patientName.addEventListener('input', handlePatientInput);
  elements.patientSuggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const patient = state.patients.find(p => p.id === item.dataset.id);
      if (patient) selectPatient(patient);
    }
  });

  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedTypes = Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value);
    const data = {
      patientName: elements.patientName.value,
      phone: elements.patientPhone.value,
      insurance: elements.insuranceSelect.value,
      dob: elements.patientDob.value,
      providerId: elements.providerSelect.value,
      types: selectedTypes,
      duration: parseInt(document.getElementById('duration').value),
      startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
      clinicalNotes: elements.clinicalNotes.value,
      treatmentNotes: elements.treatmentNotes.value
    };

    if (state.hasConflict(data, state.selectedAppointment?.id)) {
      elements.conflictWarning.style.display = 'block';
      return;
    }

    if (state.selectedAppointment) {
      state.updateAppointment(state.selectedAppointment.id, data);
    } else {
      state.addAppointment(data);
    }

    elements.modal.style.display = 'none';
    refreshUI();
  });

  elements.deleteBtn.addEventListener('click', () => {
    if (state.selectedAppointment && confirm('¿Eliminar esta cita?')) {
      state.deleteAppointment(state.selectedAppointment.id);
      elements.modal.style.display = 'none';
      refreshUI();
    }
  });

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.selectedAppointment) {
        state.updateAppointment(state.selectedAppointment.id, { status: btn.dataset.status });
        elements.modal.style.display = 'none';
        refreshUI();
      }
    });
  });
}

function attachGridEvents() {
  document.querySelectorAll('.provider-column').forEach(column => {
    column.addEventListener('mousedown', (e) => {
      if (!e.target.classList.contains('time-slot') && !e.target.classList.contains('sub-slot')) return;
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

    column.addEventListener('dragover', (e) => e.preventDefault());
    column.addEventListener('drop', (e) => {
      if (!isMovingExisting) return;
      const rect = column.getBoundingClientRect();
      const y = e.clientY - rect.top + column.scrollTop;
      const time = getTimeFromPosition(y);
      const start = getISOStringFromDate(column.dataset.date ? new Date(column.dataset.date) : state.currentDate, time);
      
      const app = state.appointments.find(a => a.id === movingAppId);
      if (app && !state.hasConflict({ ...app, startTime: start, providerId: column.dataset.providerId }, app.id)) {
        state.updateAppointment(app.id, { startTime: start, providerId: column.dataset.providerId });
        refreshUI();
      } else {
        alert('Conflicto detectado.');
      }
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !dragElement) return;
    const rect = dragElement.parentElement.getBoundingClientRect();
    const curY = e.clientY - rect.top + dragElement.parentElement.scrollTop;
    const sY = parseFloat(dragElement.style.top);
    dragElement.style.height = `${Math.max(15, Math.round((curY - sY)/15)*15)}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (dragElement) {
      const dur = Math.round(parseFloat(dragElement.style.height) / 60 * 60);
      const start = dragStartTime;
      const pid = dragProviderId;
      dragElement.remove();
      dragElement = null;
      openModal({ startTime: start, providerId: pid, duration: dur });
    }
  });
}

function openModal(defaults = {}) {
  elements.form.reset();
  state.selectedAppointment = null;
  elements.deleteBtn.style.display = 'none';
  elements.conflictWarning.style.display = 'none';
  elements.status-group.style.display = 'none';
  
  if (defaults.startTime) document.getElementById('start-time').value = defaults.startTime;
  if (defaults.providerId) elements.providerSelect.value = defaults.providerId;
  if (defaults.duration) document.getElementById('duration').value = defaults.duration;
  
  document.querySelectorAll('input[name="appointment-type"]').forEach(cb => cb.checked = false);
  elements.modal.style.display = 'flex';
}

function editAppointment(app) {
  state.selectedAppointment = app;
  elements.deleteBtn.style.display = 'block';
  elements.conflictWarning.style.display = 'none';
  document.getElementById('modal-title').textContent = 'Editar Cita';
  elements.patientName.value = app.patientName;
  elements.patientPhone.value = app.phone || '';
  elements.insuranceSelect.value = app.insurance || 'Privado / Sin Seguro';
  elements.patientDob.value = app.dob || '';
  elements.providerSelect.value = app.providerId;
  document.getElementById('duration').value = app.duration;
  document.getElementById('start-time').value = new Date(app.startTime).toTimeString().substring(0, 5);
  elements.clinicalNotes.value = app.clinicalNotes || '';
  elements.treatmentNotes.value = app.treatmentNotes || '';
  
  document.querySelectorAll('input[name="appointment-type"]').forEach(cb => {
    cb.checked = (app.types || []).includes(cb.value);
  });

  document.getElementById('status-group').style.display = 'block';
  elements.modal.style.display = 'flex';
}

function formatTimeEnterprise(iso) {
  const date = new Date(iso);
  if (state.timeFormat === '24h') {
    return date.toTimeString().substring(0, 5);
  } else {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes} ${ampm}`;
  }
}

function renderMiniCalendar() {
  const dates = [];
  const today = new Date(state.currentDate);
  for (let i = -3; i < 11; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  elements.miniCalendar.innerHTML = dates.map(d => `
    <div class="calendar-day-btn ${d.toDateString() === state.currentDate.toDateString() ? 'active' : ''}" data-date="${d.toISOString()}">
      <span>${new Intl.DateTimeFormat('es', { weekday: 'short' }).format(d)}</span>
      <span>${d.getDate()}</span>
    </div>
  `).join('');
  document.querySelectorAll('.calendar-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentDate = new Date(btn.dataset.date);
      refreshUI();
      updateDateDisplay();
    });
  });
}

function renderFilters() {
  elements.roomsFilter.innerHTML = state.rooms.map(r => `
    <label><input type="checkbox" data-id="${r.id}" ${r.visible ? 'checked' : ''}><span>${r.name}</span></label>
  `).join('');
  elements.doctorsFilter.innerHTML = state.doctors.map(d => `
    <label><input type="checkbox" data-id="${d.id}" ${d.visible ? 'checked' : ''}><span style="color:${d.color}">${d.name}</span></label>
  `).join('');
}

init();

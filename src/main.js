import { state, APPOINTMENT_TYPES, HONDURAS_INSURANCES } from './state.js';
import { formatDate, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';

const elements = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  dateText: document.getElementById('current-date-text'),
  statusMessage: document.getElementById('status-message'),
  prevMonthNav: document.getElementById('prev-month-navigator'),
  nextMonthNav: document.getElementById('next-month-navigator'),
  dateNavigatorMonths: document.getElementById('date-navigator-months'),
  doctorsFilter: document.getElementById('doctors-filter'),
  roomsFilter: document.getElementById('rooms-filter'),
  timeColumn: document.getElementById('time-column'),
  calendarGrid: document.getElementById('calendar-grid'),
  modal: document.getElementById('appointment-modal'),
  form: document.getElementById('appointment-form'),
  cancelModal: document.getElementById('cancel-modal'),
  cancelModalX: document.getElementById('cancel-modal-x'),
  addBtn: document.getElementById('add-appointment-btn'),
  providerSelect: document.getElementById('provider-id'),
  typesSelection: document.getElementById('types-selection'),
  deleteBtn: document.getElementById('delete-appointment-btn'),
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
  patientsListBody: document.getElementById('patients-list-body')
};

function init() {
  populateDropdowns();
  renderTypesSelection();
  updateStatusMessage();
  refreshUI();
  attachEventListeners();
}

function refreshUI() {
  renderDateNavigator();
  renderPhysicianSidebar();
  
  if (state.activeTab === 'agenda') {
    renderTimeSlots();
    renderGrid();
    renderAppointments();
  } else if (state.activeTab === 'lista') {
    renderAppointmentsList();
  } else if (state.activeTab === 'pacientes') {
    renderPatientsList();
  }
}

function updateStatusMessage() {
  elements.dateText.textContent = formatDate(state.currentDate);
}

function populateDropdowns() {
  elements.insuranceSelect.innerHTML = HONDURAS_INSURANCES.map(i => `
    <option value="${i}">${i}</option>
  `).join('');

  const all = [...state.rooms, ...state.doctors];
  elements.providerSelect.innerHTML = all.map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
}

function renderTypesSelection() {
  elements.typesSelection.innerHTML = APPOINTMENT_TYPES.map(t => `
    <label style="font-size: 0.7rem; display: flex; align-items: center; gap: 4px;">
      <input type="checkbox" name="appointment-type" value="${t.id}">
      <span>${t.label}</span>
    </label>
  `).join('');
}

// --- Classic Rendering ---

function renderTimeSlots() {
  const slots = [];
  for (let h = 6; h <= 20; h++) {
    const timeLabel = state.timeFormat === '24h' ? `${h}:00` : (h > 12 ? `${h-12} PM` : (h === 12 ? '12 PM' : `${h} AM`));
    slots.push(`<div class="classic-time-slot">${timeLabel}</div>`);
  }
  elements.timeColumn.innerHTML = `<div style="height: 40px;"></div>` + slots.join('');
}

function renderGrid() {
  if (state.viewMode === 'day') {
    const visibleProviders = [...state.rooms, ...state.doctors].filter(p => p.visible);
    elements.calendarGrid.innerHTML = visibleProviders.map(p => `
      <div class="classic-provider-col" data-provider-id="${p.id}">
        <div class="classic-col-header">${p.name}</div>
        ${Array.from({ length: 15 }).map(() => `<div class="classic-time-slot"></div>`).join('')}
      </div>
    `).join('');
  } else {
    const provider = [...state.rooms, ...state.doctors].find(p => p.id === state.selectedProviderId) || state.rooms[0];
    const weekDates = getWeekDates(state.currentDate);
    elements.calendarGrid.innerHTML = weekDates.map(d => `
      <div class="classic-provider-col" data-provider-id="${provider.id}" data-date="${d.toISOString()}">
        <div class="classic-col-header" style="flex-direction: column; align-items: flex-start; height: 50px;">
           <span style="font-size: 0.8rem;">${new Intl.DateTimeFormat('es', { weekday: 'short' }).format(d)}</span>
           <span style="font-size: 0.65rem; color: #666;">${d.getDate()}/${d.getMonth()+1}</span>
        </div>
        ${Array.from({ length: 15 }).map(() => `<div class="classic-time-slot"></div>`).join('')}
      </div>
    `).join('');
  }
  attachGridEvents();
}

function renderAppointments() {
  document.querySelectorAll('.appointment').forEach(el => el.remove());
  
  const draw = (app, dateContext = null) => {
    const targetDate = dateContext || new Date(app.startTime);
    const selector = state.viewMode === 'day' 
      ? `.classic-provider-col[data-provider-id="${app.providerId}"]`
      : `.classic-provider-col[data-date^="${targetDate.toISOString().substring(0, 10)}"]`;
    
    const col = document.querySelector(selector);
    if (!col) return;

    const div = document.createElement('div');
    div.className = 'appointment';
    const primaryType = APPOINTMENT_TYPES.find(t => (app.types || []).includes(t.id)) || APPOINTMENT_TYPES[0];
    div.style.backgroundColor = primaryType.color + '22';
    div.style.borderLeft = `3px solid ${primaryType.color}`;
    div.style.top = `${calculatePosition(app.startTime, 40, 50)}px`;
    div.style.height = `${calculateHeight(app.duration, 50)}px`;
    
    div.innerHTML = `
      <div style="font-weight: bold; overflow: hidden; white-space: nowrap;">${app.patientName}</div>
      <div style="font-size: 0.65rem;">${formatTime(app.startTime)} - ${primaryType.label}</div>
    `;
    
    div.onclick = () => editAppointment(app);
    col.appendChild(div);
  };

  if (state.viewMode === 'day') {
    state.getAppointmentsForDate(state.currentDate).forEach(a => draw(a));
  } else {
    getWeekDates(state.currentDate).forEach(d => {
      state.getAppointmentsForDate(d)
        .filter(a => a.providerId === state.selectedProviderId)
        .forEach(a => draw(a, d));
    });
  }
}

// --- Sidebar & Navigation ---

function renderPhysicianSidebar() {
  const renderList = (data, container) => {
    container.innerHTML = data.map(p => `
      <div class="classic-physician-item">
        <input type="checkbox" data-id="${p.id}" ${p.visible ? 'checked' : ''}>
        <div class="physician-avatar">${p.type === 'doctor' ? '👨‍⚕️' : '🏥'}</div>
        <span style="font-size: 0.75rem;">${p.name}</span>
      </div>
    `).join('');
  };
  renderList(state.doctors, elements.doctorsFilter);
  renderList(state.rooms, elements.roomsFilter);
}

function renderDateNavigator() {
  const start = new Date(state.currentDate);
  start.setDate(1);
  start.setMonth(start.getMonth() - 1);
  
  let html = '';
  for (let i = 0; i < 4; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    html += `
      <div class="mini-month-navigator">
        <div style="font-weight: bold; text-align: center; border-bottom: 1px solid #ddd; margin-bottom: 5px;">
          ${new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' }).format(d)}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
           ${['D','L','M','M','J','V','S'].map(day => `<span style="font-size: 0.6rem; opacity: 0.5;">${day}</span>`).join('')}
           ${renderMonthDays(d)}
        </div>
      </div>
    `;
  }
  elements.dateNavigatorMonths.innerHTML = html;
}

function renderMonthDays(date) {
  const days = [];
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  
  for (let i = 0; i < firstDay; i++) days.push('<span></span>');
  for (let i = 1; i <= lastDate; i++) {
    const isCurrent = (i === state.currentDate.getDate() && date.getMonth() === state.currentDate.getMonth());
    days.push(`<span class="day-num ${isCurrent ? 'active' : ''}" style="cursor:pointer; text-align:center; ${isCurrent ? 'background: #ffd54f;' : ''}">${i}</span>`);
  }
  return days.join('');
}

// --- Table Views ---

function renderAppointmentsList() {
  const apps = state.getAppointmentsForDate(state.currentDate);
  elements.appointmentsListBody.innerHTML = apps.map(app => {
    const provider = [...state.rooms, ...state.doctors].find(p => p.id === app.providerId);
    return `
      <tr>
        <td>${formatTime(app.startTime)}</td>
        <td>${new Date(new Date(app.startTime).getTime() + app.duration * 60000).toTimeString().substring(0, 5)}</td>
        <td><strong>${app.patientName}</strong></td>
        <td>${provider?.name}</td>
        <td><span class="status-pill ${app.status}">${app.status}</span></td>
        <td>${app.clinicalNotes || ''}</td>
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
      <td>${p.lastVisit || '-'}</td>
    </tr>
  `).join('');
}

// --- Event Handlers ---

function attachEventListeners() {
  // Tabs
  elements.tabButtons.forEach(btn => {
    btn.onclick = () => {
      state.activeTab = btn.dataset.tab;
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      elements.tabContents.forEach(tc => tc.classList.remove('active'));
      document.getElementById(`tab-${state.activeTab}`).classList.add('active');
      refreshUI();
    };
  });

  // Toolbar Actions
  elements.viewDay.onclick = () => {
    state.viewMode = 'day';
    elements.viewDay.classList.add('active');
    elements.viewWeek.classList.remove('active');
    refreshUI();
  };
  elements.viewWeek.onclick = () => {
    state.viewMode = 'week';
    elements.viewWeek.classList.add('active');
    elements.viewDay.classList.remove('active');
    refreshUI();
  };
  elements.addBtn.onclick = () => openModal();
  elements.printBtn.onclick = () => window.print();
  elements.themeToggle.onclick = () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    state.save();
    document.documentElement.setAttribute('data-theme', state.theme);
  };
  elements.timeFormatToggle.onclick = () => {
    state.timeFormat = state.timeFormat === '24h' ? '12h' : '24h';
    state.save();
    elements.timeFormatToggle.textContent = state.timeFormat;
    refreshUI();
  };

  // Sidebar Filters
  document.addEventListener('change', (e) => {
    if (e.target.closest('.classic-filter-list input')) {
      state.toggleVisibility(e.target.dataset.id);
      if (state.viewMode === 'week') state.selectedProviderId = e.target.dataset.id;
      refreshUI();
    }
  });

  // Modal logic
  elements.cancelModal.onclick = elements.cancelModalX.onclick = () => elements.modal.style.display = 'none';
  
  elements.form.onsubmit = (e) => {
    e.preventDefault();
    const data = {
      patientName: elements.patientName.value,
      phone: elements.patientPhone.value,
      insurance: elements.insuranceSelect.value,
      dob: elements.patientDob.value,
      providerId: elements.providerSelect.value,
      duration: parseInt(document.getElementById('duration').value),
      startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
      clinicalNotes: elements.clinicalNotes.value,
      treatmentNotes: elements.treatmentNotes.value,
      types: Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value)
    };

    if (state.hasConflict(data, state.selectedAppointment?.id)) {
      elements.conflictWarning.style.display = 'block';
      return;
    }

    if (state.selectedAppointment) state.updateAppointment(state.selectedAppointment.id, data);
    else state.addAppointment(data);

    elements.modal.style.display = 'none';
    refreshUI();
  };
}

function openModal(defs = {}) {
  elements.form.reset();
  state.selectedAppointment = null;
  elements.deleteBtn.style.display = 'none';
  elements.conflictWarning.style.display = 'none';
  if (defs.startTime) document.getElementById('start-time').value = defs.startTime;
  if (defs.providerId) elements.providerSelect.value = defs.providerId;
  elements.modal.style.display = 'flex';
}

function editAppointment(app) {
  state.selectedAppointment = app;
  elements.deleteBtn.style.display = 'block';
  elements.patientName.value = app.patientName;
  elements.patientPhone.value = app.phone || '';
  elements.insuranceSelect.value = app.insurance;
  elements.providerSelect.value = app.providerId;
  document.getElementById('start-time').value = new Date(app.startTime).toTimeString().substring(0, 5);
  elements.clinicalNotes.value = app.clinicalNotes || '';
  elements.treatmentNotes.value = app.treatmentNotes || '';
  elements.modal.style.display = 'flex';
}

function attachGridEvents() {
  document.querySelectorAll('.classic-provider-col').forEach(col => {
    col.onclick = (e) => {
      if (e.target.classList.contains('classic-time-slot')) {
        const y = e.offsetY + e.target.offsetTop;
        const time = getTimeFromPosition(y, 40, 50);
        openModal({ startTime: time, providerId: col.dataset.providerId });
      }
    };
  });
}

init();

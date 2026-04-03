import { state, APPOINTMENT_TYPES, HONDURAS_INSURANCES } from './state.js';
import { formatDate, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';

const elements = {
  // ... existing elements ...
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  dateText: document.getElementById('current-date-text'),
  statusMessage: document.getElementById('status-message'),
  dateNavigatorContainer: document.getElementById('date-navigator-container'),
  doctorsFilter: document.getElementById('doctors-filter'),
  roomsFilter: document.getElementById('rooms-filter'),
  timeColumn: document.getElementById('time-column'),
  calendarGrid: document.getElementById('calendar-grid'),
  leftSidebar: document.getElementById('left-sidebar'),
  sidebarHandle: document.getElementById('sidebar-handle'),
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
  patientsListBody: document.getElementById('patients-list-body'),
  // Recurrence
  recurrenceModal: document.getElementById('recurrence-modal'),
  cancelRecurrence: document.getElementById('cancel-recurrence'),
  cancelRecurrenceX: document.getElementById('cancel-recurrence-x'),
  saveRecurrence: document.getElementById('save-recurrence'),
  contextMenu: null // Dynamic
};

let selectionInfo = {
  isDragging: false,
  startY: 0,
  currentY: 0,
  providerId: null,
  active: false,
  startTime: null,
  duration: 30,
  selectionEl: null
};

function init() {
  populateDropdowns();
  renderTypesSelection();
  updateStatusMessage();
  refreshUI();
  attachEventListeners();
}

function refreshUI() {
  renderDateNavigatorRight();
  renderPhysicianSidebar();
  populateDropdowns(); // Update dropdowns when visibility changes
  
  if (state.activeTab === 'agenda') {
    renderTimeSlotsPro();
    renderGridPro();
    renderAppointmentsPro();
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

  const visibleProviders = [...state.rooms, ...state.doctors].filter(p => p.visible);
  elements.providerSelect.innerHTML = visibleProviders.map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
}

function renderTypesSelection() {
  elements.typesSelection.innerHTML = APPOINTMENT_TYPES.map(t => `
    <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 8px;">
      <input type="checkbox" name="appointment-type" value="${t.id}">
      <span>${t.label}</span>
    </label>
  `).join('');
}

// --- Pro Exact Rendering ---

function renderTimeSlotsPro() {
  const slots = [];
  for (let h = 6; h <= 20; h++) {
    const timeLabel = state.timeFormat === '24h' ? `${h}:00` : (h > 12 ? `${h-12} PM` : (h === 12 ? '12 PM' : `${h} AM`));
    slots.push(`
      <div class="hour-slot-container">
        <div class="hour-label">${timeLabel}</div>
        <div class="quarter-scale">
          <div class="quarter-slot">15</div>
          <div class="quarter-slot">30</div>
          <div class="quarter-slot">45</div>
        </div>
      </div>
    `);
  }
  elements.timeColumn.innerHTML = `<div class="classic-time-header"></div>` + slots.join('');
}

function renderGridPro() {
  const allProviders = [...state.rooms, ...state.doctors];
  const visibleProviders = allProviders.filter(p => p.visible);

  const providers = state.viewMode === 'day' 
    ? visibleProviders
    : [visibleProviders.find(p => p.id === state.selectedProviderId) || visibleProviders[0] || allProviders[0]];

  if (state.viewMode === 'day') {
    elements.calendarGrid.innerHTML = providers.map(p => `
      <div class="classic-provider-col" data-provider-id="${p.id}">
        <div class="classic-col-header">
           <div class="header-icon">${p.type === 'doctor' ? '👨‍⚕️' : '🏥'}</div>
           <div class="header-name">${p.name}</div>
           <div class="header-sub">${formatDate(state.currentDate)}</div>
        </div>
        ${Array.from({ length: 15 }).map(() => `
          <div class="hour-slot-container">
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
  } else {
    const provider = providers[0];
    const weekDates = getWeekDates(state.currentDate);
    elements.calendarGrid.innerHTML = weekDates.map(d => `
      <div class="classic-provider-col" data-provider-id="${provider.id}" data-date="${d.toISOString()}">
        <div class="classic-col-header">
           <div class="header-icon">📅</div>
           <div class="header-name">${new Intl.DateTimeFormat('es', { weekday: 'long' }).format(d)}</div>
           <div class="header-sub">${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div>
        </div>
        ${Array.from({ length: 15 }).map(() => `
          <div class="hour-slot-container">
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
            <div class="grid-sub-slot"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }
  attachGridEventsPro();
}

function renderAppointmentsPro() {
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
    div.style.borderLeft = `4px solid ${primaryType.color}`;
    
    // Position calc (Header is 90px, Slot is 80px)
    div.style.top = `${calculatePosition(app.startTime, 90, 80)}px`;
    div.style.height = `${calculateHeight(app.duration, 80)}px`;
    
    div.innerHTML = `
      <div class="app-time">${formatTime(app.startTime)} - ${formatTime(new Date(new Date(app.startTime).getTime() + app.duration * 60000))}</div>
      <div class="app-patient">${app.patientName.toUpperCase()}</div>
      <div class="app-details">${primaryType.label} ${app.phone ? `| T: ${app.phone}` : ''}</div>
      ${app.treatmentNotes ? `<div class="app-details" style="color:red; font-weight:bold;">Rx: ${app.treatmentNotes.substring(0, 30)}</div>` : ''}
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

// --- Sidebar & Navigator Pro ---

function renderPhysicianSidebar() {
  const render = (data, container) => {
    container.innerHTML = data.map(p => `
      <div class="classic-physician-item" style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" data-id="${p.id}" ${p.visible ? 'checked' : ''} style="width: 18px; height: 18px;">
        <div style="font-size: 1.2rem;">${p.type === 'doctor' ? '👨‍⚕️' : '🏥'}</div>
        <span style="font-weight: bold; font-size: 0.8rem;">${p.name}</span>
      </div>
    `).join('');
  };
  render(state.rooms, elements.roomsFilter);
  render(state.doctors, elements.doctorsFilter);
}

function renderDateNavigatorRight() {
  const current = new Date(state.currentDate);
  const next = new Date(current);
  next.setMonth(current.getMonth() + 1);
  
  elements.dateNavigatorContainer.innerHTML = [current, next].map(m => `
    <div class="mini-month-navigator">
      <div class="month-title">${new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(m)}</div>
      <div class="days-grid">
         ${['D','L','M','M','J','V','S'].map(d => `<div style="text-align:center; font-size: 8px; opacity: 0.5;">${d}</div>`).join('')}
         ${renderMiniMonthDays(m)}
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.day-box').forEach(box => {
    box.onclick = () => {
      state.currentDate = new Date(box.dataset.date);
      state.save();
      updateStatusMessage();
      refreshUI();
    };
  });
}

function renderMiniMonthDays(date) {
  const days = [];
  const startDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const endDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  
  for (let i = 0; i < startDay; i++) days.push('<div></div>');
  for (let i = 1; i <= endDay; i++) {
    const d = new Date(date.getFullYear(), date.getMonth(), i);
    const active = d.toDateString() === state.currentDate.toDateString();
    const today = d.toDateString() === new Date().toDateString();
    days.push(`<div class="day-box ${active ? 'active' : ''} ${today ? 'today' : ''}" data-date="${d.toISOString()}">${i}</div>`);
  }
  return days.join('');
}

// --- Interaction Logic ---

function attachEventListeners() {
  // Collapsible Sidebar
  elements.sidebarHandle.onclick = () => {
    elements.leftSidebar.classList.toggle('collapsed');
  };

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

  elements.viewDay.onclick = () => { state.viewMode = 'day'; refreshUI(); };
  elements.viewWeek.onclick = () => { state.viewMode = 'week'; refreshUI(); };
  elements.addBtn.onclick = () => openModal();
  elements.printBtn.onclick = () => window.print();

  elements.timeFormatToggle.onclick = () => {
    state.timeFormat = state.timeFormat === '24h' ? '12h' : '24h';
    state.save();
    elements.timeFormatToggle.textContent = state.timeFormat;
    refreshUI();
  };

  document.addEventListener('mousedown', (e) => {
    // Only close if clicking outside the menu
    if (elements.contextMenu && !elements.contextMenu.contains(e.target)) {
      closeContextMenu();
    }
    if (!e.target.closest('.classic-grid') && !e.target.closest('.classic-context-menu')) {
      clearSelection();
    }
  });

  document.addEventListener('change', (e) => {
    // ... filtering checkboxes ...
    if (e.target.closest('.classic-filter-list input')) {
      state.toggleVisibility(e.target.dataset.id);
      if (state.viewMode === 'week') state.selectedProviderId = e.target.dataset.id;
      refreshUI();
    }
  });

  elements.cancelModal.onclick = elements.cancelModalX.onclick = () => elements.modal.style.display = 'none';
  elements.cancelRecurrence.onclick = elements.cancelRecurrenceX.onclick = () => elements.recurrenceModal.style.display = 'none';
  elements.saveRecurrence.onclick = () => elements.recurrenceModal.style.display = 'none';
  
  elements.deleteBtn.onclick = () => {
    if (state.selectedAppointment && confirm('¿Está seguro de que desea eliminar esta cita?')) {
      state.deleteAppointment(state.selectedAppointment.id);
      elements.modal.style.display = 'none';
      refreshUI();
    }
  };

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
    clearSelection();
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
  
  if (defs.duration) {
    const durationSelect = document.getElementById('duration');
    const existingOption = Array.from(durationSelect.options).find(o => parseInt(o.value) === defs.duration);
    if (!existingOption) {
      const newOpt = new Option(`${defs.duration} min (seleccionado)`, defs.duration);
      durationSelect.add(newOpt);
      durationSelect.value = defs.duration;
    } else {
      durationSelect.value = defs.duration;
    }
  }
  
  elements.modal.style.display = 'flex';
}

function openRecurrenceModal(defs = {}) {
  const startStr = defs.startTime || '10:15 AM';
  const duration = defs.duration || 30;
  
  document.getElementById('rec-start-display').textContent = formatTime(startStr, '12h');
  document.getElementById('rec-duration-display').textContent = `${duration} minutos`;
  document.getElementById('rec-range-start').value = state.currentDate.toISOString().split('T')[0];
  
  elements.recurrenceModal.style.display = 'flex';
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

function attachGridEventsPro() {
  document.querySelectorAll('.classic-provider-col').forEach(col => {
    col.onmousedown = (e) => {
      if (e.button !== 0) return; // Only left click for selection
      if (e.target.closest('.appointment')) return;

      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y < 90) return; // Ignore click on header

      selectionInfo.isDragging = true;
      selectionInfo.active = true;
      selectionInfo.providerId = col.dataset.providerId;
      
      // Snap start position (Step 20px = 15m)
      selectionInfo.startY = Math.floor((y - 90) / 20) * 20 + 90;
      
      if (selectionInfo.selectionEl) selectionInfo.selectionEl.remove();
      selectionInfo.selectionEl = document.createElement('div');
      selectionInfo.selectionEl.className = 'drag-selection';
      selectionInfo.selectionEl.style.top = `${selectionInfo.startY}px`;
      selectionInfo.selectionEl.style.height = `0px`;
      col.appendChild(selectionInfo.selectionEl);
    };

    col.onmousemove = (e) => {
      if (!selectionInfo.isDragging) return;
      const rect = col.getBoundingClientRect();
      const currentRawY = e.clientY - rect.top;
      
      // Snap current position
      const snappedCurrentY = Math.ceil((currentRawY - 90) / 20) * 20 + 90;
      
      const top = Math.min(selectionInfo.startY, snappedCurrentY);
      const bottom = Math.max(selectionInfo.startY, snappedCurrentY);
      const height = bottom - top;
      
      selectionInfo.selectionEl.style.top = `${top}px`;
      selectionInfo.selectionEl.style.height = `${height}px`;
    };

    col.onmouseup = (e) => {
      if (!selectionInfo.isDragging) return;
      selectionInfo.isDragging = false;
      const rect = col.getBoundingClientRect();
      const endRawY = e.clientY - rect.top;
      const snappedEndY = Math.ceil((endRawY - 90) / 20) * 20 + 90;

      const top = Math.min(selectionInfo.startY, snappedEndY);
      const bottom = Math.max(selectionInfo.startY, snappedEndY);
      const height = bottom - top;

      selectionInfo.startTime = getTimeFromPosition(top, 90, 80);
      const durationHours = height / 80;
      selectionInfo.duration = Math.max(15, Math.round(durationHours * 60));
      
      if (height < 15) { // Small click - open default slot
        openModal({ startTime: selectionInfo.startTime, providerId: selectionInfo.providerId, duration: 30 });
        clearSelection();
      } else {
        selectionInfo.active = true;
      }
    };

    col.oncontextmenu = (e) => {
      if (!selectionInfo.active || e.target.closest('.appointment')) return;
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    };
  });
}

function clearSelection() {
  if (selectionInfo.selectionEl) selectionInfo.selectionEl.remove();
  selectionInfo.isDragging = false;
  selectionInfo.active = false;
  selectionInfo.selectionEl = null;
}

function showContextMenu(x, y) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'classic-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const items = [
    { label: 'Nuevo Evento...', icon: '📅', action: () => openModal({ startTime: selectionInfo.startTime, providerId: selectionInfo.providerId, duration: selectionInfo.duration }) },
    { label: 'Nuevo Evento Todo el Día', icon: '⏰', action: () => openModal({ startTime: '06:00', providerId: selectionInfo.providerId, duration: 840 }) },
    { label: 'Nuevo Evento Recurrente...', icon: '🔁', action: () => openRecurrenceModal({ startTime: selectionInfo.startTime, duration: selectionInfo.duration }) },
    { type: 'separator' },
    { label: 'Hoy', icon: '🏠', action: () => { state.currentDate = new Date(); state.save(); refreshUI(); updateStatusMessage(); } },
    { label: 'Ir a Fecha...', icon: '🔍', action: () => alert('Use el calendario lateral para navegar') }
  ];

  items.forEach(item => {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      el.innerHTML = `<span class="icon-placeholder">${item.icon}</span>${item.label}`;
      el.onclick = (e) => { e.stopPropagation(); item.action(); closeContextMenu(); };
      menu.appendChild(el);
    }
  });

  document.body.appendChild(menu);
  elements.contextMenu = menu;
}

function closeContextMenu() {
  if (elements.contextMenu) {
    elements.contextMenu.remove();
    elements.contextMenu = null;
  }
}

init();

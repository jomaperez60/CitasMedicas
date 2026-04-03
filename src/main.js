import { state, APPOINTMENT_TYPES, HONDURAS_INSURANCES } from './state.js';
import { formatDate, formatDateShort, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';

const ICON_DOCTOR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #1a73e8;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>`;
const ICON_ROOM = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ea4335;"><path d="M3 21h18"></path><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3"></path><path d="M19 21V11"></path><path d="M5 21V11"></path></svg>`;

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
  resourceLabel: document.getElementById('resource-label'),
  doctorAssignmentArea: document.getElementById('doctor-assignment-area'),
  doctorIdSelect: document.getElementById('doctor-id'),
  treatmentNotes: document.getElementById('treatment-notes'),
  appointmentsListBody: document.getElementById('appointments-list-body'),
  patientsListBody: document.getElementById('patients-list-body'),
  // Recurrence
  recurrenceModal: document.getElementById('recurrence-modal'),
  cancelRecurrence: document.getElementById('cancel-recurrence'),
  cancelRecurrenceX: document.getElementById('cancel-recurrence-x'),
  saveRecurrence: document.getElementById('save-recurrence'),
  recurrenceBanner: document.getElementById('recurrence-summary-banner'),
  recurrenceText: document.getElementById('recurrence-summary-text'),
  removeRecurrenceBtn: document.getElementById('remove-recurrence-btn'),
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
  // Apply persisted zoom
  document.documentElement.style.setProperty('--slot-height', `${state.slotHeight}px`);
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
  // Don't overwrite filtered dropdowns if modal is open
  if (elements.modal.style.display === 'flex') return;
  
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
      <input type="checkbox" name="appointment-type" value="${t.id}" data-can-consult="${t.id === 'consulta'}">
      <span>${t.label}</span>
    </label>
  `).join('');

  // Add event listeners for contextual logic
  elements.typesSelection.querySelectorAll('input').forEach(input => {
    input.onchange = () => updateContextualSelection(input);
  });
}

function updateContextualSelection(changedInput) {
  const allChecks = Array.from(elements.typesSelection.querySelectorAll('input'));
  const isConsulta = changedInput.value === 'consulta';

  if (changedInput.checked) {
    if (isConsulta) {
      // If Consulta checked, uncheck all others
      allChecks.forEach(cb => { if (cb.value !== 'consulta') cb.checked = false; });
    } else {
      // If procedure checked, uncheck Consulta
      const consultaCheck = allChecks.find(cb => cb.value === 'consulta');
      if (consultaCheck) consultaCheck.checked = false;
    }
  }

  const selectedConsulta = allChecks.find(cb => cb.value === 'consulta')?.checked;
  const anyProcedure = allChecks.some(cb => cb.value !== 'consulta' && cb.checked);

  if (selectedConsulta) {
    elements.resourceLabel.textContent = 'Médico:';
    populateDropdownsFiltered('doctor');
    elements.doctorAssignmentArea.style.display = 'none';
  } else if (anyProcedure) {
    elements.resourceLabel.textContent = 'Sala:';
    populateDropdownsFiltered('room');
    elements.doctorAssignmentArea.style.display = 'block';
  } else {
    // Default or mixed (show all if nothing selected)
    elements.resourceLabel.textContent = 'Médico / Recurso:';
    populateDropdowns();
    elements.doctorAssignmentArea.style.display = 'none';
  }
}

function populateDropdownsFiltered(type) {
  const list = type === 'doctor' ? state.doctors : state.rooms;
  elements.providerSelect.innerHTML = list.filter(p => p.visible).map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
  
  if (type === 'room') {
    elements.doctorIdSelect.innerHTML = state.doctors.filter(d => d.visible).map(d => `
      <option value="${d.id}">${d.name}</option>
    `).join('');
  }
}

// --- Pro Exact Rendering ---

function renderTimeSlotsPro() {
  const startHour = 6;
  const endHour = 20;
  const interval = state.slotInterval || 30;

  let slots = [`
    <div class="classic-time-header"></div>
  `];
  for (let h = startHour; h <= endHour; h++) {
    const hourVal = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const ampm = h >= 12 ? 'pm' : 'am';
    
    let subSlots = '';
    for (let m = 0; m < 60; m += interval) {
      if (m === 0) {
        subSlots += `
          <div class="time-sub-slot" style="flex: 1; border-top: 1px solid rgba(0,0,0,0.15); display: flex; box-sizing: border-box; background: transparent;">
            <div style="flex: 1; padding: 2px 4px 0 0; text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; line-height: 1;">
              <div style="display: flex; align-items: flex-start; gap: 2px;">
                <span style="font-size: 16px; font-weight: bold; color: #1e3a5f;">${hourVal}</span>
                <span style="font-size: 10px; font-weight: bold; padding-top: 2px; color: #1e3a5f;">00</span>
              </div>
              <span style="font-size: 9px; opacity: 0.6; color: #1e3a5f; margin-top: 1px;">${ampm}</span>
            </div>
          </div>
        `;
      } else {
        subSlots += `
          <div class="time-sub-slot" style="flex: 1; border-top: 1px solid rgba(0,0,0,0.05); display: flex; box-sizing: border-box; background: transparent;">
            <div style="flex: 1; text-align: right; font-size: 10px; color: #1e3a5f; padding-right: 4px; padding-top: 2px; opacity: 0.7;">
              ${String(m).padStart(2, '0')}
            </div>
          </div>
        `;
      }
    }

    slots.push(`
      <div class="hour-slot-container" style="display: flex; flex-direction: column; height: var(--slot-height); flex-shrink: 0; box-sizing: border-box;">
        ${subSlots}
      </div>
    `);
  }
  elements.timeColumn.innerHTML = slots.join('');
}

function renderGridPro() {
  const providers = [...state.rooms, ...state.doctors].filter(p => p.visible);
  const interval = state.slotInterval || 30;
  const subCount = 60 / interval;
  
  if (state.viewMode === 'day') {
    elements.calendarGrid.innerHTML = providers.map(p => `
      <div class="classic-provider-col" data-provider-id="${p.id}">
        <div class="classic-col-header">
           <div class="header-icon">${p.type === 'doctor' ? ICON_DOCTOR : ICON_ROOM}</div>
           <div class="header-name">${p.name}</div>
           <div class="header-sub">${formatDateShort(state.currentDate)}</div>
        </div>
        ${Array.from({ length: 15 }).map(() => `
          <div class="hour-slot-container" style="display: flex; flex-direction: column; height: var(--slot-height); flex-shrink: 0; box-sizing: border-box; border-bottom: none;">
            ${Array.from({ length: subCount }).map((_, i) => `
              <div class="grid-sub-slot" style="flex: 1; box-sizing: border-box; border-top: ${i === 0 ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.05)'};"></div>
            `).join('')}
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
           <div class="header-name">${new Intl.DateTimeFormat('es', { weekday: 'long' }).format(d).toUpperCase()}</div>
           <div class="header-sub">${formatDateShort(d)}</div>
        </div>
        ${Array.from({ length: 15 }).map(() => `
          <div class="hour-slot-container" style="display: flex; flex-direction: column; height: var(--slot-height); flex-shrink: 0; box-sizing: border-box; border-bottom: none;">
            ${Array.from({ length: subCount }).map((_, i) => `
              <div class="grid-sub-slot" style="flex: 1; box-sizing: border-box; border-top: ${i === 0 ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.05)'};"></div>
            `).join('')}
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
    
    // Position calc (Header is 90px, Slot is dynamic)
    div.style.top = `${calculatePosition(app.startTime, 90, state.slotHeight)}px`;
    div.style.height = `${calculateHeight(app.duration, state.slotHeight)}px`;
    
    const doctorName = app.doctorId ? (state.doctors.find(d => d.id === app.doctorId)?.name || '') : '';
    
    div.innerHTML = `
      <div class="app-time">${formatTime(app.startTime)} - ${formatTime(new Date(new Date(app.startTime).getTime() + app.duration * 60000))}</div>
      <div class="app-patient">${app.patientName.toUpperCase()} ${app.recurrence ? '🔁' : ''}</div>
      <div style="font-size: 9px; line-height: 1;">
        ${doctorName ? `<span style="color: #2171b5; font-weight: bold;">Dr: ${doctorName}</span><br>` : ''}
        ${primaryType.label} ${app.phone ? `| T: ${app.phone}` : ''}
      </div>
      ${app.clinicalNotes ? `<div class="app-details" style="color:#2c3e50; font-weight:bold; margin-top: 2px;">Nota: ${app.clinicalNotes.substring(0, 100)}</div>` : ''}
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
      <div class="classic-physician-item" style="padding: 10px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
        <input type="checkbox" data-id="${p.id}" ${p.visible ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
        <div class="sidebar-icon-wrap">${p.type === 'doctor' ? ICON_DOCTOR : ICON_ROOM}</div>
        <span style="font-weight: 500; font-size: 0.85rem; color: #444;">${p.name}</span>
      </div>
    `).join('');
  };
  render(state.rooms, elements.roomsFilter);
  render(state.doctors, elements.doctorsFilter);
}

function renderDateNavigatorRight() {
  const current = new Date(state.navigatorBaseDate);
  const next = new Date(current);
  next.setMonth(current.getMonth() + 1);
  
  const navHeader = `
    <div class="navigator-nav-bar">
      <button id="nav-prev-month" class="nav-arrow-btn">◀</button>
      <div class="nav-current-view">Navegador</div>
      <button id="nav-next-month" class="nav-arrow-btn">▶</button>
    </div>
  `;

  elements.dateNavigatorContainer.innerHTML = navHeader + [current, next].map(m => `
    <div class="mini-month-navigator">
      <div class="month-title">${new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(m)}</div>
      <div class="days-grid">
         ${['D','L','M','M','J','V','S'].map(d => `<div style="text-align:center; font-size: 8px; opacity: 0.5;">${d}</div>`).join('')}
         ${renderMiniMonthDays(m)}
      </div>
    </div>
  `).join('');

  // Arrows Logic
  document.getElementById('nav-prev-month').onclick = () => {
    state.navigatorBaseDate.setMonth(state.navigatorBaseDate.getMonth() - 1);
    refreshUI();
  };
  document.getElementById('nav-next-month').onclick = () => {
    state.navigatorBaseDate.setMonth(state.navigatorBaseDate.getMonth() + 1);
    refreshUI();
  };

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

  document.querySelectorAll('.recurrence-pattern-opt').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.recurrence-pattern-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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

  elements.timeColumn.oncontextmenu = (e) => {
    e.preventDefault();
    showZoomMenu(e.pageX, e.pageY);
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

  elements.cancelModal.onclick = elements.cancelModalX.onclick = () => {
    elements.modal.style.display = 'none';
    state.currentRecurrence = null; // Clear recurrence on cancel
  };
  
  elements.removeRecurrenceBtn.onclick = () => {
    state.currentRecurrence = null;
    elements.recurrenceBanner.style.display = 'none';
  };

  elements.cancelRecurrence.onclick = elements.cancelRecurrenceX.onclick = () => elements.recurrenceModal.style.display = 'none';
  
  elements.saveRecurrence.onclick = () => {
    // Collect Recurrence Data
    const pattern = document.querySelector('.recurrence-pattern-opt.active').textContent;
    const interval = document.querySelector('#recurrence-weekly-options input[type="number"]').value;
    const days = Array.from(document.querySelectorAll('.days-selector input:checked')).map(cb => cb.parentElement.textContent.trim());
    
    const radios = document.getElementsByName('rec-end');
    let endType = 'never';
    let endValue = null;

    if (radios[1].checked) {
      endType = 'after';
      endValue = parseInt(document.getElementById('rec-end-occurrences').value);
    } else if (radios[2].checked) {
      endType = 'on';
      endValue = document.getElementById('rec-end-date').value;
    }

    state.currentRecurrence = {
      pattern,
      interval,
      days,
      endType,
      endValue,
      summary: `${pattern} cada ${interval} semana(s) el: ${days.join(', ')}`
    };

    elements.recurrenceModal.style.display = 'none';
    
    // Return to Appointment Modal
    openModal({
      startTime: selectionInfo.startTime,
      duration: selectionInfo.duration,
      providerId: selectionInfo.providerId
    });
  };
  
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
      providerId: elements.providerSelect.value,
      doctorId: elements.doctorAssignmentArea.style.display !== 'none' ? elements.doctorIdSelect.value : null,
      duration: parseInt(document.getElementById('duration').value),
      startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
      clinicalNotes: elements.clinicalNotes.value,
      types: Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value)
    };

    if (state.hasConflict(data, state.selectedAppointment?.id)) {
      elements.conflictWarning.style.display = 'block';
      return;
    }

  if (state.selectedAppointment) state.updateAppointment(state.selectedAppointment.id, data);
  else state.addAppointment({ ...data, recurrence: state.currentRecurrence });

  elements.modal.style.display = 'none';
  state.currentRecurrence = null; // Clear after save
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
  
  if (state.currentRecurrence) {
    elements.recurrenceBanner.style.display = 'flex';
    elements.recurrenceText.textContent = state.currentRecurrence.summary;
  } else {
    elements.recurrenceBanner.style.display = 'none';
  }

  // Trigger contextual logic based on selection
  const provider = [...state.rooms, ...state.doctors].find(p => p.id === defs.providerId);
  const typeCheck = elements.typesSelection.querySelector(provider?.type === 'doctor' ? 'input[value="consulta"]' : 'input[value="endoscopia_alta"]');
  if (typeCheck) {
    typeCheck.checked = true;
    updateContextualSelection(typeCheck);
  }
  
  if (defs.providerId) elements.providerSelect.value = defs.providerId;

  elements.modal.style.display = 'flex';
}

function openRecurrenceModal(defs = {}) {
  const startStr = defs.startTime || '10:15';
  const duration = defs.duration || 30;
  
  // Calculate end time
  const [h, m] = startStr.split(':');
  const startDate = new Date();
  startDate.setHours(parseInt(h), parseInt(m), 0, 0);
  const endDate = new Date(startDate.getTime() + duration * 60000);
  
  document.getElementById('rec-start-display').textContent = formatTime(startStr, '12h');
  document.getElementById('rec-end-display').textContent = formatTime(endDate.toISOString(), '12h');
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
  document.getElementById('start-time').value = new Date(app.startTime).toTimeString().substring(0, 5);
  elements.clinicalNotes.value = app.clinicalNotes || '';
  
  // Set checkboxes
  elements.typesSelection.querySelectorAll('input').forEach(cb => cb.checked = (app.types || []).includes(cb.value));
  
  // Sync recurrence display logic
  if (app.recurrence) {
    state.currentRecurrence = app.recurrence;
    elements.recurrenceBanner.style.display = 'flex';
    elements.recurrenceText.textContent = app.recurrence.summary || 'Evento Recurrente';
  } else {
    state.currentRecurrence = null;
    elements.recurrenceBanner.style.display = 'none';
  }
  
  // Trigger logic
  const firstChecked = elements.typesSelection.querySelector('input:checked') || elements.typesSelection.querySelector('input');
  updateContextualSelection(firstChecked);
  
  elements.providerSelect.value = app.providerId;
  if (app.doctorId) elements.doctorIdSelect.value = app.doctorId;
  
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
      
      // Snap start position (Step = 15m)
      const snapStep = state.slotHeight / 4;
      selectionInfo.startY = Math.floor((y - 90) / snapStep) * snapStep + 90;
      
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
      const snapStep = state.slotHeight / 4;
      const snappedCurrentY = Math.ceil((currentRawY - 90) / snapStep) * snapStep + 90;
      
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
      const snapStep = state.slotHeight / 4;
      const snappedEndY = Math.ceil((endRawY - 90) / snapStep) * snapStep + 90;

      const top = Math.min(selectionInfo.startY, snappedEndY);
      const bottom = Math.max(selectionInfo.startY, snappedEndY);
      const height = bottom - top;

      selectionInfo.startTime = getTimeFromPosition(top, 90, state.slotHeight);
      const durationHours = height / state.slotHeight;
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
    { label: 'Nuevo Evento...', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>', action: () => openModal({ startTime: selectionInfo.startTime, providerId: selectionInfo.providerId, duration: selectionInfo.duration }) },
    { label: 'Nuevo Evento Todo el Día', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>', action: () => openModal({ startTime: '06:00', providerId: selectionInfo.providerId, duration: 840 }) },
    { label: 'Nuevo Evento Recurrente...', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>', action: () => openRecurrenceModal({ startTime: selectionInfo.startTime, duration: selectionInfo.duration }) },
    { type: 'separator' },
    { label: 'Hoy', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>', action: () => { state.currentDate = new Date(); state.save(); refreshUI(); updateStatusMessage(); } },
    { label: 'Ir a Fecha...', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>', action: () => alert('Use el calendario lateral para navegar') }
  ];

  items.forEach(item => {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
           <span class="icon-placeholder" style="display: flex;">${item.icon}</span>
           <span>${item.label}</span>
        </div>
      `;
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

function showZoomMenu(x, y) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'classic-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const options = [
    { label: '60', value: 60, interval: 60 },
    { label: '30', value: 100, interval: 30 },
    { label: '15', value: 160, interval: 15 },
    { label: '10', value: 240, interval: 10 },
    { label: '6', value: 400, interval: 6 },
    { label: '5', value: 480, interval: 5 }
  ];

  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    const isActive = Math.abs(state.slotHeight - opt.value) < 5;
    if (isActive) item.classList.add('active');
    
    item.innerHTML = `<span style="flex: 1;">${opt.label} Minutos</span>`;
    item.onclick = () => {
      state.slotHeight = opt.value;
      state.slotInterval = opt.interval;
      state.save();
      document.documentElement.style.setProperty('--slot-height', `${opt.value}px`);
      refreshUI();
      closeContextMenu();
    };
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  elements.contextMenu = menu;
}

init();

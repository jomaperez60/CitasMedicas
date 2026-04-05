import { state, APPOINTMENT_TYPES, HONDURAS_INSURANCES } from './state.js';
import { formatDate, formatDateShort, formatTime, getISOStringFromDate, calculatePosition, calculateHeight, getTimeFromPosition, getWeekDates } from './utils.js';
import { supabase } from './supabaseClient.js';
import * as XLSX from 'xlsx';

// Expose state globally for browser console access (e.g. state.forceSyncAll())
window.state = state;

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
  viewMonth: document.getElementById('view-month'),
  navAgenda: document.getElementById('nav-agenda'),
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
  // Sync Data
  btnSyncData: document.getElementById('btn-sync-data'),
  syncModal: document.getElementById('sync-modal'),
  closeSyncModal: document.getElementById('close-sync-modal'),
  tabExportData: document.getElementById('tab-export-data'),
  tabImportData: document.getElementById('tab-import-data'),
  syncExportView: document.getElementById('sync-export-view'),
  syncImportView: document.getElementById('sync-import-view'),
  syncExportStart: document.getElementById('sync-export-start'),
  syncExportEnd: document.getElementById('sync-export-end'),
  syncExportProvider: document.getElementById('sync-export-provider'),
  btnDoExportExcel: document.getElementById('btn-do-export-excel'),
  btnDoExportICal: document.getElementById('btn-do-export-ical'),
  syncFileInput: document.getElementById('sync-file-input'),
  btnDoImportExcel: document.getElementById('btn-do-import-excel'),
  contextMenu: null, // Dynamic
  loginOverlay: document.getElementById('login-overlay'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  btnLogout: document.getElementById('btn-logout'),
  tabHeaderSeguridad: document.getElementById('tab-header-seguridad'),
  ribbonSeguridad: document.getElementById('ribbon-seguridad'),
  btnManageUsers: document.getElementById('btn-manage-users'),
  tabHeaderMantenimiento: document.getElementById('tab-header-mantenimiento'),
  ribbonMantenimiento: document.getElementById('ribbon-mantenimiento'),
  btnArchiveData: document.getElementById('btn-archive-data'),
  usersModal: document.getElementById('users-modal'),
  btnCreateUser: document.getElementById('btn-create-user'),
  newUserEmail: document.getElementById('new-user-email'),
  newUserPassword: document.getElementById('new-user-password'),
  userCreationStatus: document.getElementById('user-creation-status'),
  usersList: document.getElementById('users-list'),
  btnSetupAdmin: document.getElementById('btn-setup-admin'),
  
  // Resource UI
  btnAddRoom: document.getElementById('btn-add-room'),
  btnAddDoctor: document.getElementById('btn-add-doctor'),
  resourceModal: document.getElementById('resource-modal'),
  resourceType: document.getElementById('resource-type'),
  resourceId: document.getElementById('resource-id'),
  resourceName: document.getElementById('resource-name'),
  btnSaveResource: document.getElementById('btn-save-resource'),
  mobileHamburger: document.getElementById('mobile-hamburger'),
  dateNavigatorMobile: document.getElementById('date-navigator-mobile'),
  rightSidebar: document.getElementById('right-sidebar'),
  rightSidebarHandle: document.getElementById('right-sidebar-handle'),
  appointmentDate: document.getElementById('appointment-date'),
  appointmentTime: document.getElementById('appointment-time'),
  appointmentDuration: document.getElementById('appointment-duration')
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

async function init() {
  // Wait for Cloud Sync - Essential for multi-device consistency
  await state.load();
  
  // Apply persisted zoom
  document.documentElement.style.setProperty('--slot-height', `${state.slotHeight}px`);
  populateDropdowns();
  renderTypesSelection();
  updateStatusMessage();
  applyTheme();
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

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  
  const logoA = document.getElementById('ced-logo-agenda');
  if (logoA) {
    logoA.src = state.theme === 'dark' ? './logo-ced-bw.jpg' : './logo-ced.png';
  }

  if (elements.themeToggle) {
    const iconWrap = elements.themeToggle.querySelector('.ribbon-btn-inner');
    const textWrap = elements.themeToggle.querySelector('.ribbon-btn-text');
    if (state.theme === 'dark') {
      if (iconWrap) iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      if (textWrap) textWrap.textContent = 'Modo Claro';
    } else {
      if (iconWrap) iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      if (textWrap) textWrap.textContent = 'Modo Oscuro';
    }
  }
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
    <div class="classic-time-header" style="display: flex; align-items: center; justify-content: center;">
       <img src="${state.theme === 'dark' ? './logo-ced-bw.jpg' : './logo-ced.png'}" id="ced-logo-agenda" alt="CED Logo" style="max-height: 50px; object-fit: contain;">
    </div>
  `];
  for (let h = startHour; h <= endHour; h++) {
    const hourVal = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const ampm = h >= 12 ? 'pm' : 'am';
    
    let subSlots = '';
    for (let m = 0; m < 60; m += interval) {
      if (m === 0) {
        subSlots += `
          <div class="time-sub-slot" style="flex: 1; display: flex; border-top: 1px solid var(--grid-border); position: relative; box-sizing: border-box; background: transparent;">
            <div style="position: absolute; top: 0; right: 4px; padding-top: 2px; display: flex; flex-direction: column; align-items: flex-end; line-height: 1;">
              <div style="display: flex; align-items: flex-start; gap: 2px;">
                <span style="font-size: 16px; font-weight: bold; color: var(--time-digit-color);">${hourVal}</span>
                <span style="font-size: 10px; font-weight: bold; padding-top: 2px; color: var(--time-digit-color);">00</span>
              </div>
              <span style="font-size: 9px; opacity: 0.6; color: var(--time-digit-color); margin-top: 1px;">${ampm}</span>
            </div>
          </div>
        `;
      } else {
        subSlots += `
          <div class="time-sub-slot" style="flex: 1; display: flex; border-top: 1px solid var(--grid-border-faint); position: relative; box-sizing: border-box; background: transparent;">
            <div style="position: absolute; top: 0; right: 4px; padding-top: 2px; font-size: 10px; color: var(--time-digit-color); opacity: 0.7;">
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
  
  const totalHeight = 90 + 15 * (state.slotHeight || 100);
  elements.timeColumn.style.height = `${totalHeight}px`;
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
              <div class="grid-sub-slot" style="flex: 1; display: flex; box-sizing: border-box; border-top: ${i === 0 ? '1px solid var(--grid-border)' : '1px solid var(--grid-border-faint)'};"></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `).join('');
    elements.calendarGrid.style.height = `${90 + 15 * (state.slotHeight || 100)}px`;
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
              <div class="grid-sub-slot" style="flex: 1; display: flex; box-sizing: border-box; border-top: ${i === 0 ? '1px solid var(--grid-border)' : '1px solid var(--grid-border-faint)'};"></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `).join('');
    elements.calendarGrid.style.height = `${90 + 15 * (state.slotHeight || 100)}px`;
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
    
    // Position calc - header is always 90px (matches --header-height CSS variable)
    const HEADER_H = 90;
    const topPx = calculatePosition(app.startTime, HEADER_H, state.slotHeight);
    const heightPx = calculateHeight(app.duration, state.slotHeight);
    const gridHeight = 90 + 15 * state.slotHeight;
    
    // Skip appointments outside the visible grid (before 6am or past end of day)
    if (topPx < HEADER_H || topPx >= gridHeight) return;
    
    div.style.top = `${topPx}px`;
    div.style.height = `${heightPx}px`;
    
    const doctorName = app.doctorId ? (state.doctors.find(d => d.id === app.doctorId)?.name || '') : '';
    
    div.innerHTML = `
      <div class="app-time">${formatTime(app.startTime)} - ${formatTime(new Date(new Date(app.startTime).getTime() + app.duration * 60000))}</div>
      <div class="app-patient">${app.patientName.toUpperCase()} ${app.recurrence ? '🔁' : ''}</div>
      <div style="font-size: 9px; line-height: 1;">
        ${doctorName ? `<span style="color: var(--accent-color); font-weight: bold;">Dr: ${doctorName}</span><br>` : ''}
        ${primaryType.label} ${app.phone ? `| T: ${app.phone}` : ''}
      </div>
      ${app.clinicalNotes ? `<div class="app-details" style="font-weight:bold; margin-top: 2px;">Nota: ${app.clinicalNotes.substring(0, 100)}</div>` : ''}
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
      <div class="classic-physician-item" style="padding: 5px; border: 1px solid transparent; display: flex; align-items: center; gap: 8px; font-size: 11px;">
        <input type="checkbox" data-id="${p.id}" ${p.visible ? 'checked' : ''} style="width: 14px; height: 14px; cursor: pointer; margin:0;">
        <div class="sidebar-icon-wrap" style="transform: scale(0.85);">${p.type === 'doctor' ? ICON_DOCTOR : ICON_ROOM}</div>
        <span style="font-weight: 500; font-size: 0.8rem; color: var(--text-main); flex: 1;">${p.name}</span>
        <button class="admin-only edit-resource-btn" data-id="${p.id}" data-type="${p.type}" data-name="${p.name}" style="color:var(--accent-color); background:none; border:none; cursor:pointer; font-size:16px; padding:2px; display:flex; align-items:center;" title="Editar Nombre">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="admin-only delete-resource-btn" data-id="${p.id}" data-type="${p.type}" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:16px; padding:2px; display:flex; align-items:center;" title="Eliminar ${p.type === 'doctor' ? 'Médico' : 'Sala'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `).join('');
  };
  
  render(state.rooms, elements.roomsFilter);
  render(state.doctors, elements.doctorsFilter);

  // Attach delete events
  document.querySelectorAll('.delete-resource-btn').forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const type = e.currentTarget.getAttribute('data-type');
      if (confirm(`¿Está seguro que desea eliminar este ${type === 'doctor' ? 'médico' : 'sala'}? Esta acción eliminará su columna.`)) {
        const result = state.deleteResource(id, type);
        if (result.success) {
          refreshUI();
        } else {
          alert(result.message);
        }
      }
    };
  });

  // Attach edit events
  document.querySelectorAll('.edit-resource-btn').forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const type = e.currentTarget.getAttribute('data-type');
      const name = e.currentTarget.getAttribute('data-name');
      elements.resourceType.value = type;
      elements.resourceId.value = id;
      elements.resourceName.value = name;
      elements.resourceModal.style.display = 'flex';
      elements.resourceName.focus();
    };
  });
}

function renderDateNavigatorRight() {
  const container = elements.dateNavigatorContainer;
  const containerMobile = elements.dateNavigatorMobile;
  if (!container && !containerMobile) return;

  const current = new Date(state.navigatorBaseDate);
  const next = new Date(current);
  next.setMonth(current.getMonth() + 1);
  
  const navHeader = `
    <div class="navigator-nav-bar">
      <button id="nav-prev-month" class="nav-arrow-btn">◀</button>
      <div class="nav-current-view">Calendario</div>
      <button id="nav-next-month" class="nav-arrow-btn">▶</button>
    </div>
  `;

  const monthsHtml = [current, next].map(m => `
    <div class="mini-month-navigator">
      <div class="month-title">${new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(m)}</div>
      <div class="days-grid">
         ${['D','L','M','M','J','V','S'].map(d => `<div style="text-align:center; font-size: 8px; opacity: 0.5;">${d}</div>`).join('')}
         ${renderMiniMonthDays(m)}
      </div>
    </div>
  `).join('');

  const fullHtml = navHeader + monthsHtml;

  if (container) container.innerHTML = fullHtml;
  if (containerMobile) containerMobile.innerHTML = fullHtml;

  // Listeners (Desktop & Mobile share IDs, but usually only one is visible/active)
  const bindEvents = (doc) => {
    const prev = doc.getElementById('nav-prev-month');
    const next = doc.getElementById('nav-next-month');
    if (prev) prev.onclick = (e) => {
       e.stopPropagation();
       state.navigatorBaseDate.setMonth(state.navigatorBaseDate.getMonth() - 1);
       refreshUI();
    };
    if (next) next.onclick = (e) => {
       e.stopPropagation();
       state.navigatorBaseDate.setMonth(state.navigatorBaseDate.getMonth() + 1);
       refreshUI();
    };
    doc.querySelectorAll('.day-box').forEach(box => {
      box.onclick = () => {
        state.currentDate = new Date(box.dataset.date);
        state.save();
        updateStatusMessage();
        refreshUI();
      };
    });
  };

  bindEvents(document);
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
  if (elements.themeToggle) {
    elements.themeToggle.onclick = () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      state.save();
      applyTheme();
    };
  }

  elements.tabButtons.forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.dataset.tab;
      state.activeTab = tabId;
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      elements.tabContents.forEach(tc => tc.classList.remove('active'));
      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');
      if (tabId === 'calendario') renderDateNavigatorRight();
      
      // Handle mobile menu closing
      const mobileMenu = document.querySelector('.mobile-nav-menu');
      if (mobileMenu) mobileMenu.classList.remove('active');
      
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
  elements.viewMonth.onclick = () => { state.viewMode = 'month'; refreshUI(); };
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

  elements.form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      patientName: elements.patientName.value.trim(),
      phone: elements.patientPhone.value.trim(),
      insurance: elements.insuranceSelect.value,
      providerId: elements.providerSelect.value,
      doctorId: elements.doctorAssignmentArea.style.display !== 'none' ? elements.doctorIdSelect.value : null,
      duration: parseInt(elements.appointmentDuration.value),
      // Convert local time to UTC ISO string for correct timezone storage in Supabase
      startTime: new Date(`${elements.appointmentDate.value}T${elements.appointmentTime.value}:00`).toISOString(),
      clinicalNotes: elements.clinicalNotes.value,
      types: Array.from(document.querySelectorAll('input[name="appointment-type"]:checked')).map(cb => cb.value)
    };

    if (state.hasConflict(data, state.selectedAppointment?.id)) {
      elements.conflictWarning.style.display = 'block';
      return;
    }

    try {
      if (state.selectedAppointment) {
        await state.updateAppointment(state.selectedAppointment.id, data);
      } else {
        await state.addAppointment({ ...data, recurrence: state.currentRecurrence });
      }
      elements.modal.style.display = 'none';
      state.currentRecurrence = null;
      clearSelection();
      refreshUI();
    } catch (err) {
      console.error('Error guardando cita:', err);
      alert(`Error al guardar la cita: ${err.message || err}. Revise la consola.`);
    }
  };
}

function openModal(defs = {}) {
  elements.form.reset();
  state.selectedAppointment = null;
  elements.deleteBtn.style.display = 'none';
  elements.conflictWarning.style.display = 'none';
  
  elements.appointmentDate.value = state.currentDate.toISOString().split('T')[0];
  if (defs.startTime) elements.appointmentTime.value = defs.startTime;
  if (defs.providerId) elements.providerSelect.value = defs.providerId;
  
  if (defs.duration) {
    elements.appointmentDuration.value = defs.duration;
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
  
  const d = new Date(app.startTime);
  elements.appointmentDate.value = d.toISOString().split('T')[0];
  elements.appointmentTime.value = d.toTimeString().substring(0, 5);
  elements.appointmentDuration.value = app.duration;
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

      const HEADER_H = 90;
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y < HEADER_H) return; // Ignore click on header

      selectionInfo.isDragging = true;
      selectionInfo.active = true;
      selectionInfo.providerId = col.dataset.providerId;
      
      // Snap start position (Step = 15m)
      const snapStep = state.slotHeight / 4;
      selectionInfo.startY = Math.floor((y - HEADER_H) / snapStep) * snapStep + HEADER_H;
      
      if (selectionInfo.selectionEl) selectionInfo.selectionEl.remove();
      selectionInfo.selectionEl = document.createElement('div');
      selectionInfo.selectionEl.className = 'drag-selection';
      selectionInfo.selectionEl.style.top = `${selectionInfo.startY}px`;
      selectionInfo.selectionEl.style.height = `0px`;
      col.appendChild(selectionInfo.selectionEl);
    };

    col.onmousemove = (e) => {
      if (!selectionInfo.isDragging) return;

      const HEADER_H = 90;
      const rect = col.getBoundingClientRect();
      const currentRawY = e.clientY - rect.top;
      
      // Snap current position
      const snapStep = state.slotHeight / 4;
      const snappedCurrentY = Math.ceil((currentRawY - HEADER_H) / snapStep) * snapStep + HEADER_H;
      
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

      const HEADER_H = 90;
      const snappedEndY = Math.ceil((endRawY - HEADER_H) / snapStep) * snapStep + HEADER_H;

      const top = Math.min(selectionInfo.startY, snappedEndY);
      const bottom = Math.max(selectionInfo.startY, snappedEndY);
      const height = bottom - top;

      selectionInfo.startTime = getTimeFromPosition(top, HEADER_H, state.slotHeight);
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
        <div style="display: flex; align-items: flex-start; gap: 8px;">
           <span style="display: flex; flex-shrink: 0; width: 14px; margin-top: 2px;">${item.icon}</span>
           <span style="flex: 1; white-space: nowrap;">${item.label}</span>
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

// ==========================================
// DATA IMPORT/EXPORT (XLSX, ICAL)
// ==========================================
function getFilteredAppointmentsForExport() {
  const startDateStr = elements.syncExportStart.value;
  const endDateStr = elements.syncExportEnd.value;
  const providerId = elements.syncExportProvider.value;
  
  let validAppointments = state.appointments;
  
  if (startDateStr) {
    const startObj = new Date(startDateStr + 'T00:00:00');
    validAppointments = validAppointments.filter(app => new Date(app.startTime) >= startObj);
  }
  if (endDateStr) {
    const endObj = new Date(endDateStr + 'T23:59:59');
    validAppointments = validAppointments.filter(app => new Date(app.startTime) <= endObj);
  }
  if (providerId) {
    validAppointments = validAppointments.filter(app => app.providerId === providerId || app.doctorId === providerId);
  }
  return validAppointments;
}

function handleExport(format) {
  const apps = getFilteredAppointmentsForExport();
  if (apps.length === 0) {
    alert("No hay citas que coincidan con estos filtros.");
    return;
  }
  
  if (format === 'excel') {
    const exportData = apps.map(app => {
      const doc = state.doctors.find(d => d.id === app.doctorId) || {name: ''};
      const room = state.rooms.find(r => r.id === app.providerId) || {name: ''};
      return {
        'Paciente': app.patientName,
        'Teléfono': app.phone || '',
        'Seguro': app.insurance || '',
        'Fecha y Hora': new Date(app.startTime).toLocaleString('es-HN'),
        'Duración (Minutos)': app.duration,
        'Médico': doc.name,
        'Sala': room.name,
        'Notas Clínicas': app.clinicalNotes || ''
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda");
    XLSX.writeFile(wb, `Agenda_CED_${formatDateShort(new Date()).replace(/\//g, '-')}.xlsx`);
  } else if (format === 'ical') {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CED//Agenda Medica//ES\n";
    apps.forEach(app => {
      const doc = state.doctors.find(d => d.id === app.doctorId) || {name: ''};
      const room = state.rooms.find(r => r.id === app.providerId) || {name: ''};
      
      const start = new Date(app.startTime);
      const end = new Date(start.getTime() + app.duration * 60000);
      
      const formatICSDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
      
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `DTSTART:${formatICSDate(start)}\n`;
      icsContent += `DTEND:${formatICSDate(end)}\n`;
      icsContent += `SUMMARY:Cita: ${app.patientName}\n`;
      icsContent += `DESCRIPTION:Médico: ${doc.name}\\nTel: ${app.phone || ''}\\nSeguro: ${app.insurance || ''}\\nNotas: ${app.clinicalNotes ? app.clinicalNotes.replace(/\n/g, '\\n') : ''}\n`;
      icsContent += `LOCATION:${room.name}\n`;
      icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Agenda_CED_${formatDateShort(new Date()).replace(/\//g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

async function handleImport() {
  const file = elements.syncFileInput.files[0];
  if (!file) {
    alert("Por favor selecciona un archivo de Excel (.xlsx)");
    return;
  }
  
  elements.btnDoImportExcel.disabled = true;
  elements.btnDoImportExcel.textContent = "Procesando...";
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, {raw: false});
      
      let importedCount = 0;
      let conflictCount = 0;
      
      for (const row of json) {
        const patientName = row['Paciente'] || row['Nombre'] || row['Patient'];
        if (!patientName) continue;
        
        let startTime;
        const dateRaw = row['Fecha'] || row['Fecha y Hora'] || row['Date'];
        if (!dateRaw) continue;
        
        startTime = new Date(dateRaw);
        if (isNaN(startTime.getTime())) {
            const hourStr = row['HoraInicial'] || row['Hora Inicial'] || row['Time'];
            if (hourStr) {
               startTime = new Date(`${dateRaw} ${hourStr}`);
            }
        }
        
        if (isNaN(startTime.getTime())) continue;
        
        const duration = parseInt(row['Duración'] || row['Duracion'] || row['Duración (Minutos)']) || 30;
        const endTime = new Date(startTime.getTime() + duration * 60000);
        
        const docName = row['Médico'] || row['Medico'] || row['Doctor'];
        const doc = state.doctors.find(d => d.name.toLowerCase().includes((docName||'').toLowerCase())) || state.doctors[0];
        
        const roomName = row['Sala'] || row['Room'];
        const room = state.rooms.find(r => r.name.toLowerCase().includes((roomName||'').toLowerCase())) || state.rooms[0];
        
        const hasConflict = state.appointments.some(app => {
          if (app.providerId !== room.id && app.doctorId !== doc.id) return false;
          const exStart = new Date(app.startTime).getTime();
          const exEnd = exStart + app.duration * 60000;
          const newStart = startTime.getTime();
          const newEnd = endTime.getTime();
          return (newStart < exEnd && newEnd > exStart);
        });
        
        if (hasConflict) {
          conflictCount++;
          const doImport = confirm(`Alerta: La cita para ${patientName} en ${room.name} empalma con una cita existente.\n\n¿Deseas sobreescribir / guardarla de todas formas?`);
          if (!doImport) continue;
        }
        
        const newApp = {
          id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          patientName: patientName,
          phone: row['Teléfono'] || row['Telefono'] || '',
          insurance: row['Seguro'] || row['Insurance'] || 'Privado / Sin Seguro',
          providerId: room.id,
          doctorId: doc.id,
          startTime: startTime.toISOString(),
          duration: duration,
          clinicalNotes: row['Notas'] || row['Notas Clínicas'] || '',
          types: ['consulta'],
          status: 'scheduled'
        };
        
        try {
          await state.addAppointment(newApp);
          importedCount++;
        } catch (err) {
          console.error("Error inserting imported appointment:", err);
        }
      }
      
      alert(`Importación finalizada.\n\nAsignadas exitosamente: ${importedCount}\nConflictos detectados: ${conflictCount}`);
      elements.syncModal.style.display = 'none';
      renderApp();
    } catch (err) {
      console.error(err);
      alert("Hubo un error procesando el archivo de Excel.");
    } finally {
      elements.btnDoImportExcel.disabled = false;
      elements.btnDoImportExcel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Comenzar Importación
      `;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  await state.load();
  handleSession(session);

  supabase.auth.onAuthStateChange((event, session) => {
    handleSession(session);
  });

  // Login Form Submission
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.loginError.textContent = 'Autenticando...';
    elements.loginError.style.color = '#1a73e8';
    
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value.trim();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      elements.loginError.textContent = error.message.includes('Invalid login') 
        ? 'Credenciales incorrectas o el usuario no existe.' : error.message;
      elements.loginError.style.color = '#dc2626';
      
      // If no admin exists yet conceptually, expose the setup button if they typed admin
      if (email.startsWith('admin')) {
        elements.btnSetupAdmin.style.display = 'block';
      }
    } else {
      elements.loginError.textContent = '';
      elements.btnSetupAdmin.style.display = 'none';
      elements.loginForm.reset();
    }
  });

  elements.btnSetupAdmin.addEventListener('click', async () => {
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value.trim();
    if (!email || !password) return;
    
    elements.loginError.textContent = 'Creando Administrador... (Nota: Desactiva "Confirm Email" en Supabase si falla)';
    elements.loginError.style.color = '#059669';

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { role: 'admin' }
      }
    });

    if (error) {
      elements.loginError.textContent = error.message;
      elements.loginError.style.color = '#dc2626';
    } else {
      elements.loginError.textContent = 'Administrador Creado. Ahora puedes iniciar sesión.';
      elements.btnSetupAdmin.style.display = 'none';
    }
  });

  // Logout Button
  elements.btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // User Management Admin Setup (Front-End Only / Simulado si no es superadmin)
  elements.tabHeaderSeguridad.addEventListener('click', () => {
    if (state.currentUser?.role === 'admin') {
      elements.usersModal.style.display = 'flex';
      renderUsersList();
    } else {
      alert('Se requieren privilegios de Administrador.');
    }
  });

  elements.btnCreateUser.addEventListener('click', async () => {
    const el = elements.newUserEmail.value.trim();
    const pw = elements.newUserPassword.value.trim();
    if (!el || !pw) return;
    elements.userCreationStatus.textContent = 'Creando usuario...';
    
    // Create Standard User
    const { data, error } = await supabase.auth.signUp({
      email: el,
      password: pw,
      options: {
        data: { role: 'standard' }
      }
    });
    
    if (error) {
      elements.userCreationStatus.textContent = `Error: ${error.message}`;
      elements.userCreationStatus.style.color = '#dc2626';
    } else {
      elements.userCreationStatus.textContent = 'Usuario creado y registrado exitosamente.';
      elements.userCreationStatus.style.color = '#059669';
      elements.newUserEmail.value = '';
      elements.newUserPassword.value = '';
      renderUsersList();
    }
  });

  // Resource Creation Bindings
  elements.btnAddRoom.addEventListener('click', () => {
    elements.resourceType.value = 'room';
    elements.resourceId.value = '';
    elements.resourceName.value = '';
    elements.resourceModal.style.display = 'flex';
    elements.resourceName.focus();
  });

  elements.btnAddDoctor.addEventListener('click', () => {
    elements.resourceType.value = 'doctor';
    elements.resourceId.value = '';
    elements.resourceName.value = '';
    elements.resourceModal.style.display = 'flex';
    elements.resourceName.focus();
  });

  elements.btnSaveResource.addEventListener('click', () => {
    const name = elements.resourceName.value.trim();
    if (!name) {
      alert("Por favor, introduzca un nombre.");
      return;
    }
    const type = elements.resourceType.value;
    const id = elements.resourceId.value;
    
    if (id) {
       // Edit Mode
       state.editResource(id, type, name);
    } else {
       // Create Mode
       state.addResource(type, name);
    }
    
    elements.resourceModal.style.display = 'none';
    refreshUI();
  });
}

function handleSession(session) {
  if (session) {
    // Determine admin status by checking custom metadata or hardcoded user emails.
    // For this deployment, we define the administrator via their email, e.g. "admin@ced.com"
    // However, if we invent any email, we can assume the FIRST user ever created is admin, or hardcode it.
    // We will assume "admin@ced" or anything starting with "admin" or just any specified string is admin.
    let role = session.user.user_metadata?.role || 'standard';
    
    // Fallback: If no role is found in metadata, but it's the admin email:
    if (session.user.email.includes('admin')) {
      role = 'admin';
    }

    state.currentUser = { id: session.user.id, email: session.user.email, role: role };
    elements.loginOverlay.style.display = 'none';
    
    // Configure Interface restrictions
    const tabAjustes = document.querySelector('[data-ribbon="ajustes"]');
    const ribbonAjustes = document.getElementById('ribbon-ajustes');
    
    if (role === 'admin') {
      document.body.classList.add('is-admin');
      elements.tabHeaderSeguridad.style.display = 'block';
      if (elements.tabHeaderMantenimiento) elements.tabHeaderMantenimiento.style.display = 'block';
      if (tabAjustes) tabAjustes.style.display = 'block';
    } else {
      document.body.classList.remove('is-admin');
      elements.tabHeaderSeguridad.style.display = 'none';
      if (elements.tabHeaderMantenimiento) elements.tabHeaderMantenimiento.style.display = 'none';
      if (tabAjustes) {
        tabAjustes.style.display = 'none';
        ribbonAjustes.style.display = 'none';
      }
    }

    // Ribbon Tab Nav Logic (Simplified selector to catch all)
    document.querySelectorAll('.tab-header-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-header-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ribbon-group-container').forEach(c => c.style.display = 'none');
        e.currentTarget.classList.add('active');
        const targetId = 'ribbon-' + e.currentTarget.getAttribute('data-ribbon');
        const targetContainer = document.getElementById(targetId);
        if (targetContainer) targetContainer.style.display = 'flex';
      });
    });

    // Mantenimiento Logic
    if (elements.btnArchiveData) {
      elements.btnArchiveData.onclick = () => {
        state.archiveOldAppointments(6); // Default 6 months
      };
    }
    
    init(); // Run the rest of the application
  } else {
    state.currentUser = null;
    elements.loginOverlay.style.display = 'flex';
  }
}

function renderUsersList() {
  // Con la llave ANON de Supabase no hay forma directa de listar *todos* los usuarios (requiere backend service_role).
  // Por lo tanto, el panel mostrará los datos de sesión activa y guía al administrador.
  elements.usersList.innerHTML = `
    <div style="padding:10px; background:#f0f5ff; border:1px solid #cce0ff; border-radius:4px; font-size:13px; color:#1e3a5f;">
      <strong>Usuario Actual Sesionado:</strong> ${state.currentUser.email} <br>
      <strong>Rol del Sistema:</strong> ${state.currentUser.role.toUpperCase()} <br><br>
      <em>Nota:</em> Por las regulaciones de seguridad HIPAA, su sistema no permite listar masivamente los perfiles de todos los médicos desde el portal frontal. Para auditoría, debe consultar su consola maestra de Supabase.
    </div>
  `;
}

// Sidebar Resizing Logic
let isResizing = false;

elements.sidebarHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = 'col-resize';
  elements.leftSidebar.style.transition = 'none'; // Prevent lag while dragging
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const newWidth = Math.max(200, Math.min(e.clientX, 800)); // Min 200px, Max 800px width limit
  elements.leftSidebar.style.width = `${newWidth}px`;
  elements.leftSidebar.classList.remove('collapsed');
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = 'default';
    elements.leftSidebar.style.transition = 'width 0.3s ease'; // Restore smooth transition for the handle toggle
    refreshUI(); // Re-render grid lines
  }
});

// Sidebar Handle Click (Toggle Collapse)
elements.sidebarHandle.addEventListener('click', (e) => {
  // Only toggle if we didn't just resize
  if (isResizing) return;
  elements.leftSidebar.classList.toggle('collapsed');
  if(elements.leftSidebar.classList.contains('collapsed')) {
    elements.leftSidebar.style.width = ''; // Let CSS take over
  } else {
    elements.leftSidebar.style.width = '300px'; // Default open width
  }
  setTimeout(refreshUI, 350); // Wait for transition
});

// Mobile Hamburger Toggle
  elements.mobileHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.leftSidebar.classList.toggle('mobile-open');
  });

  // Sync data modal listeners
  if (elements.btnSyncData) {
    elements.btnSyncData.addEventListener('click', () => {
      elements.syncModal.style.display = 'flex';
      elements.tabExportData.classList.add('active-tab');
      elements.tabImportData.classList.remove('active-tab');
      elements.syncExportView.style.display = 'block';
      elements.syncImportView.style.display = 'none';
      
      // Populate providers dynamically
      elements.syncExportProvider.innerHTML = '<option value="">Todas las citas (Sin Filtro)</option>';
      const allProviders = [...state.rooms, ...state.doctors];
      allProviders.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        elements.syncExportProvider.appendChild(option);
      });
      // Default to today
      elements.syncExportStart.value = formatDate(new Date());
    });
  }

  if (elements.closeSyncModal) {
    elements.closeSyncModal.addEventListener('click', () => {
      elements.syncModal.style.display = 'none';
    });
  }

  if (elements.tabExportData) {
    elements.tabExportData.addEventListener('click', () => {
      elements.tabExportData.classList.add('active-tab');
      elements.tabImportData.classList.remove('active-tab');
      elements.syncExportView.style.display = 'block';
      elements.syncImportView.style.display = 'none';
    });
  }

  if (elements.tabImportData) {
    elements.tabImportData.addEventListener('click', () => {
      elements.tabImportData.classList.add('active-tab');
      elements.tabExportData.classList.remove('active-tab');
      elements.syncImportView.style.display = 'block';
      elements.syncExportView.style.display = 'none';
    });
  }

  if (elements.btnDoExportExcel) {
    elements.btnDoExportExcel.addEventListener('click', () => handleExport('excel'));
  }
  if (elements.btnDoExportICal) {
    elements.btnDoExportICal.addEventListener('click', () => handleExport('ical'));
  }
  if (elements.btnDoImportExcel) {
    elements.btnDoImportExcel.addEventListener('click', handleImport);
  }

// Right Sidebar Toggle (Tablet/iPad)
if (elements.rightSidebarHandle) {
  elements.rightSidebarHandle.addEventListener('click', () => {
    elements.rightSidebar.classList.toggle('collapsed');
    setTimeout(refreshUI, 350); 
  });
}

// Close mobile sidebar when clicking outside (on the overlay)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && 
      !elements.leftSidebar.contains(e.target) && 
      elements.leftSidebar.classList.contains('mobile-open') &&
      e.target !== elements.mobileHamburger) {
    elements.leftSidebar.classList.remove('mobile-open');
    document.body.classList.remove('mobile-overlay-active');
  }
});

// Intercept Standard App Init
initAuth();

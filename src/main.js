import { state, INITIAL_DOCTORS, INITIAL_ROOMS } from './state.js';
import { formatDate, formatTime, getISOStringFromDate, calculatePosition, calculateHeight } from './utils.js';

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
  stats: document.getElementById('quick-stats')
};

function init() {
  updateDateDisplay();
  renderFilters();
  renderTimeSlots();
  renderGrid();
  renderAppointments();
  populateProviders();
  attachEventListeners();
}

function updateDateDisplay() {
  elements.dateDisplay.textContent = formatDate(state.currentDate);
}

function renderFilters() {
  elements.doctorsFilter.innerHTML = state.doctors.map(d => `
    <label style="display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
      <input type="checkbox" data-id="${d.id}" ${d.visible ? 'checked' : ''} style="margin-right: 0.5rem;">
      <span style="color: ${d.color}; font-weight: 500;">${d.name}</span>
    </label>
  `).join('');

  elements.roomsFilter.innerHTML = state.rooms.map(r => `
    <label style="display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
      <input type="checkbox" data-id="${r.id}" ${r.visible ? 'checked' : ''} style="margin-right: 0.5rem;">
      <span style="color: #666;">${r.name}</span>
    </label>
  `).join('');
}

function renderTimeSlots() {
  const slots = [];
  for (let h = 8; h <= 18; h++) {
    slots.push(`<div class="time-slot">${h}:00</div>`);
  }
  elements.timeColumn.innerHTML = `<div style="height: 60px;"></div>` + slots.join('');
}

function renderGrid() {
  const visibleProviders = [...state.doctors, ...state.rooms].filter(p => p.visible);
  elements.calendarGrid.innerHTML = visibleProviders.map(p => `
    <div class="provider-column" data-provider-id="${p.id}">
      <div class="column-header">
        <span style="font-size: 0.85rem;">${p.name}</span>
      </div>
      ${Array.from({ length: 11 }).map(() => '<div class="time-slot"></div>').join('')}
    </div>
  `).join('');
}

function renderAppointments() {
  // Clear any existing appointments before rendering
  document.querySelectorAll('.appointment').forEach(el => el.remove());

  const currentAppointments = state.getAppointmentsForDate(state.currentDate);
  elements.stats.textContent = `${currentAppointments.length} Citas`;

  currentAppointments.forEach(app => {
    const column = document.querySelector(`.provider-column[data-provider-id="${app.providerId}"]`);
    if (!column) return;

    const div = document.createElement('div');
    div.className = `appointment ${app.type} status-${app.status}`;
    div.innerHTML = `
      <div style="font-weight: 700;">${app.patientName}</div>
      <div style="font-size: 0.7rem;">${formatTime(app.startTime)} (${app.duration} min)</div>
      <div style="margin-top: auto; font-size: 0.65rem; opacity: 0.8; text-transform: uppercase;">${app.type === 'endoscopy' ? 'Sala' : 'Consulta'}</div>
    `;

    const top = calculatePosition(app.startTime);
    const height = calculateHeight(app.duration);

    div.style.top = `${top}px`;
    div.style.height = `${height}px`;

    div.addEventListener('click', () => editAppointment(app));
    column.appendChild(div);
  });
}

function populateProviders() {
  const all = [...state.doctors, ...state.rooms];
  elements.providerSelect.innerHTML = all.map(p => `
    <option value="${p.id}">${p.name}</option>
  `).join('');
}

function attachEventListeners() {
  elements.prevDay.addEventListener('click', () => {
    state.currentDate.setDate(state.currentDate.getDate() - 1);
    updateDateDisplay();
    renderAppointments();
  });

  elements.nextDay.addEventListener('click', () => {
    state.currentDate.setDate(state.currentDate.getDate() + 1);
    updateDateDisplay();
    renderAppointments();
  });

  elements.doctorsFilter.addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-id');
    state.toggleVisibility(id);
    renderGrid();
    renderAppointments();
  });

  elements.roomsFilter.addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-id');
    state.toggleVisibility(id);
    renderGrid();
    renderAppointments();
  });

  elements.addBtn.addEventListener('click', () => {
    elements.form.reset();
    state.selectedAppointment = null;
    document.getElementById('modal-title').textContent = 'Agendar Cita';
    document.getElementById('status-group').style.display = 'none';
    elements.modal.style.display = 'flex';
  });

  elements.cancelModal.addEventListener('click', () => {
    elements.modal.style.display = 'none';
  });

  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      patientName: document.getElementById('patient-name').value,
      providerId: document.getElementById('provider-id').value,
      type: document.getElementById('appointment-type').value,
      duration: parseInt(document.getElementById('duration').value),
      startTime: getISOStringFromDate(state.currentDate, document.getElementById('start-time').value),
      status: state.selectedAppointment?.status || 'scheduled'
    };

    if (state.selectedAppointment) {
      state.updateAppointment(state.selectedAppointment.id, data);
    } else {
      state.addAppointment(data);
    }

    elements.modal.style.display = 'none';
    renderAppointments();
  });

  // Status buttons
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

function editAppointment(appointment) {
  state.selectedAppointment = appointment;
  document.getElementById('modal-title').textContent = 'Editar Cita';
  document.getElementById('patient-name').value = appointment.patientName;
  document.getElementById('provider-id').value = appointment.providerId;
  document.getElementById('appointment-type').value = appointment.type;
  document.getElementById('duration').value = appointment.duration;
  document.getElementById('start-time').value = new Date(appointment.startTime).toTimeString().substring(0, 5);
  document.getElementById('status-group').style.display = 'block';
  elements.modal.style.display = 'flex';
}

init();

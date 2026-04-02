export const INITIAL_ROOMS = [
  { id: 'sala-a', name: 'Sala Endoscopía A', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-b', name: 'Sala Endoscopía B', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-c', name: 'Sala Endoscopía C', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-d', name: 'Sala Endoscopía D', color: '#dc2626', visible: true, type: 'room' }
];

export const INITIAL_DOCTORS = [
  { id: 'dr1', name: 'Dr. Alejandro Soto', color: '#2563eb', visible: true, type: 'doctor' },
  { id: 'dr2', name: 'Dra. Elena Rivas', color: '#7c3aed', visible: true, type: 'doctor' },
  { id: 'dr3', name: 'Dr. Roberto Méndez', color: '#059669', visible: true, type: 'doctor' }
];

export const APPOINTMENT_TYPES = [
  { id: 'consulta', label: 'Consulta' },
  { id: 'endoscopia-alta', label: 'Endoscopia Alta' },
  { id: 'colonoscopia', label: 'Colonoscopia' },
  { id: 'cpre', label: 'CPRE' },
  { id: 'manometria-esofagica', label: 'Manometría Esofágica' },
  { id: 'manometria-anorectal', label: 'Manometría Anorectal' },
  { id: 'phmetria', label: 'pHmetría' },
  { id: 'fibroscan', label: 'Fibroscan' }
];

class AppState {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'day'; // 'day' or 'week'
    this.selectedProviderId = null; // Used for week view
    this.doctors = JSON.parse(localStorage.getItem('ced_doctors')) || INITIAL_DOCTORS;
    this.rooms = JSON.parse(localStorage.getItem('ced_rooms')) || INITIAL_ROOMS;
    this.appointments = JSON.parse(localStorage.getItem('ced_appointments')) || [];
    this.selectedAppointment = null;
  }

  save() {
    localStorage.setItem('ced_doctors', JSON.stringify(this.doctors));
    localStorage.setItem('ced_rooms', JSON.stringify(this.rooms));
    localStorage.setItem('ced_appointments', JSON.stringify(this.appointments));
  }

  toggleVisibility(id) {
    const provider = [...this.doctors, ...this.rooms].find(p => p.id === id);
    if (provider) {
      provider.visible = !provider.visible;
      this.save();
    }
  }

  addAppointment(appointment) {
    this.appointments.push({
      ...appointment,
      id: Date.now().toString(),
      status: 'scheduled',
      types: appointment.types || [],
      phone: appointment.phone || '',
      notes: appointment.notes || ''
    });
    this.save();
  }

  updateAppointment(id, updates) {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index !== -1) {
      this.appointments[index] = { ...this.appointments[index], ...updates };
      this.save();
    }
  }

  deleteAppointment(id) {
    this.appointments = this.appointments.filter(a => a.id !== id);
    this.save();
  }

  getAppointmentsForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDatePrefix = `${year}-${month}-${day}`;
    
    return this.appointments.filter(a => a.startTime.startsWith(localDatePrefix));
  }
}

export const state = new AppState();


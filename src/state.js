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

export const HONDURAS_INSURANCES = [
  'Privado / Sin Seguro',
  'Seguros Atlántida',
  'Seguros Ficohsa',
  'Seguros Bolívar',
  'Seguros Continental',
  'Seguros del País',
  'Seguros Lafise',
  'Mapfre Honduras',
  'PALIC (Pan-American Life)',
  'Seguros Crefisa',
  'Seguros Banrural',
  'ASSA Compañía de Seguros',
  'Interamericana de Seguros'
];

export const APPOINTMENT_TYPES = [
  { id: 'consulta', label: 'Consulta', color: '#2563eb' },
  { id: 'endoscopia-alta', label: 'Endoscopia Alta', color: '#dc2626' },
  { id: 'colonoscopia', label: 'Colonoscopia', color: '#991b1b' },
  { id: 'cpre', label: 'CPRE', color: '#7c3aed' },
  { id: 'manometria-esofagica', label: 'Manometría Esofágica', color: '#059669' },
  { id: 'manometria-anorectal', label: 'Manometría Anorectal', color: '#0891b2' },
  { id: 'phmetria', label: 'pHmetría', color: '#d97706' },
  { id: 'fibroscan', label: 'Fibroscan', color: '#4f46e5' }
];

class AppState {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'day'; // 'day' or 'week'
    this.activeTab = 'agenda'; // 'agenda', 'lista', 'pacientes'
    this.timeFormat = localStorage.getItem('ced_time_format') || '24h';
    this.theme = localStorage.getItem('ced_theme') || 'light';
    this.selectedProviderId = null;
    this.doctors = JSON.parse(localStorage.getItem('ced_doctors')) || INITIAL_DOCTORS;
    this.rooms = JSON.parse(localStorage.getItem('ced_rooms')) || INITIAL_ROOMS;
    this.appointments = JSON.parse(localStorage.getItem('ced_appointments')) || [];
    this.patients = JSON.parse(localStorage.getItem('ced_patients')) || [];
    this.selectedAppointment = null;
    this.searchTerm = '';
  }

  save() {
    localStorage.setItem('ced_doctors', JSON.stringify(this.doctors));
    localStorage.setItem('ced_rooms', JSON.stringify(this.rooms));
    localStorage.setItem('ced_appointments', JSON.stringify(this.appointments));
    localStorage.setItem('ced_patients', JSON.stringify(this.patients));
    localStorage.setItem('ced_theme', this.theme);
    localStorage.setItem('ced_time_format', this.timeFormat);
  }

  // --- Patients Logic ---
  getPatient(name) {
    return this.patients.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  addOrUpdatePatient(patientData) {
    const index = this.patients.findIndex(p => p.name.toLowerCase() === patientData.name.toLowerCase());
    if (index >= 0) {
      this.patients[index] = { ...this.patients[index], ...patientData };
    } else {
      this.patients.push({ id: Date.now().toString(), ...patientData });
    }
    this.save();
  }

  // --- Appointment Logic ---
  hasConflict(newApp, excludeId = null) {
    const start = new Date(newApp.startTime).getTime();
    const end = start + newApp.duration * 60000;

    return this.appointments.some(app => {
      if (app.id === excludeId) return false;
      if (app.providerId !== newApp.providerId) return false;

      const appStart = new Date(app.startTime).getTime();
      const appEnd = appStart + app.duration * 60000;

      return start < appEnd && end > appStart;
    });
  }

  addAppointment(data) {
    const app = { 
      id: Date.now().toString(), 
      ...data, 
      status: 'scheduled',
      types: data.types || []
    };
    this.appointments.push(app);
    // Auto-guardar paciente
    this.addOrUpdatePatient({
      name: data.patientName,
      phone: data.phone,
      insurance: data.insurance,
      dob: data.dob
    });
    this.save();
    return app;
  }

  updateAppointment(id, data) {
    const index = this.appointments.findIndex(app => app.id === id);
    if (index >= 0) {
      this.appointments[index] = { ...this.appointments[index], ...data };
      // Auto-actualizar paciente
      this.addOrUpdatePatient({
        name: data.patientName,
        phone: data.phone,
        insurance: data.insurance,
        dob: data.dob
      });
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

  toggleVisibility(id) {
    const doctor = this.doctors.find(d => d.id === id);
    if (doctor) {
      doctor.visible = !doctor.visible;
    } else {
      const room = this.rooms.find(r => r.id === id);
      if (room) {
        room.visible = !room.visible;
      }
    }
    this.save();
  }
}

export const state = new AppState();


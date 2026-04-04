import { supabase } from './supabaseClient.js';

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
    this.slotHeight = parseInt(localStorage.getItem('ced_slot_height')) || 100; // Pixels per hour (Zoom)
    this.slotInterval = parseInt(localStorage.getItem('ced_slot_interval')) || 30;
    this.selectedProviderId = null;
    this.doctors = JSON.parse(localStorage.getItem('ced_doctors')) || INITIAL_DOCTORS;
    this.rooms = JSON.parse(localStorage.getItem('ced_rooms')) || INITIAL_ROOMS;
    this.appointments = JSON.parse(localStorage.getItem('ced_appointments')) || [];
    this.patients = JSON.parse(localStorage.getItem('ced_patients')) || [];
    this.selectedAppointment = null;
    this.currentUser = null;
    this.searchTerm = '';
    this.navigatorBaseDate = new Date(this.currentDate);
  }

  async load() {
    // Load from Cloud (Supabase)
    try {
      const { data: resData, error: resError } = await supabase.from('ced_resources').select('*');
      if (!resError && resData && resData.length > 0) {
        this.doctors = resData.filter(r => r.type === 'doctor');
        this.rooms = resData.filter(r => r.type === 'room');
      } else if (!resError) {
        // Auto-migrate resources if Cloud is empty
        await supabase.from('ced_resources').upsert([...this.doctors, ...this.rooms]);
      }

      // Load patients FIRST (appointments reference them via FK)
      const { data: patData, error: patError } = await supabase.from('ced_patients').select('*');
      if (!patError && patData && patData.length > 0) {
        this.patients = patData;
      } else if (!patError && this.patients.length > 0) {
        // Auto-migrate patients - only valid DB columns (no 'id', no 'dob')
        for (const p of this.patients) {
          const dbPatient = { name: p.name, phone: p.phone || '', insurance: p.insurance || '' };
          await supabase.from('ced_patients').upsert([dbPatient]).catch(e => console.warn('Patient migration error:', e));
        }
      }

      const { data: appData, error: appError } = await supabase.from('ced_appointments').select('*');
      if (!appError && appData && appData.length > 0) {
        this.appointments = appData;
      } else if (!appError && this.appointments.length > 0) {
        // Auto-migrate appointments - send only valid DB columns
        for (const app of this.appointments) {
          // Ensure patient exists first
          if (app.patientName) {
            const dbPat = { name: app.patientName, phone: app.phone || '', insurance: app.insurance || '' };
            await supabase.from('ced_patients').upsert([dbPat]).catch(() => {});
          }
          const dbApp = {
            id: app.id,
            patientName: app.patientName,
            phone: app.phone || null,
            insurance: app.insurance || null,
            providerId: app.providerId,
            doctorId: app.doctorId || null,
            startTime: app.startTime,
            duration: app.duration,
            status: app.status || 'scheduled',
            clinicalNotes: app.clinicalNotes || null,
            types: app.types || [],
            recurrence: app.recurrence || null
          };
          await supabase.from('ced_appointments').upsert([dbApp]).catch(e => console.warn('Appointment migration error:', app.id, e.message));
        }
      }
    } catch (e) {
      console.error("Error loading/migrating to Supabase:", e);
    }
  }

  async save() {
    // We will save individual items in their respective methods for real-time sync.
    // LocalStorage remains as a local cache for offline/snappy start.
    localStorage.setItem('ced_doctors', JSON.stringify(this.doctors));
    localStorage.setItem('ced_rooms', JSON.stringify(this.rooms));
    localStorage.setItem('ced_appointments', JSON.stringify(this.appointments));
    localStorage.setItem('ced_patients', JSON.stringify(this.patients));
    localStorage.setItem('ced_theme', this.theme);
    localStorage.setItem('ced_time_format', this.timeFormat);
    localStorage.setItem('ced_slot_height', this.slotHeight);
    localStorage.setItem('ced_slot_interval', this.slotInterval);
  }

  // --- Patients Logic ---
  getPatient(name) {
    return this.patients.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  async addOrUpdatePatient(patientData) {
    const index = this.patients.findIndex(p => p.name.toLowerCase() === patientData.name.toLowerCase());
    // Only send valid columns to Supabase (name, phone, insurance — no id, no dob)
    const dbPatient = {
      name: patientData.name,
      phone: patientData.phone || '',
      insurance: patientData.insurance || ''
    };
    if (index >= 0) {
      const updated = { ...this.patients[index], ...patientData };
      await supabase.from('ced_patients').upsert([dbPatient]).catch(e => console.warn('Patient update error:', e));
      this.patients[index] = updated;
    } else {
      const newPat = { name: patientData.name, phone: patientData.phone || '', insurance: patientData.insurance || '' };
      await supabase.from('ced_patients').upsert([dbPatient]).catch(e => console.warn('Patient insert error:', e));
      this.patients.push(newPat);
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

  async addAppointment(data) {
    // Build the app object with all fields
    const app = { 
      id: Date.now().toString(), 
      ...data, 
      status: 'scheduled',
      types: data.types || []
    };
    
    // Send only the valid DB columns (no extra localStorage-only fields)
    const dbApp = {
      id: app.id,
      patientName: app.patientName,
      phone: app.phone || null,
      insurance: app.insurance || null,
      providerId: app.providerId,
      doctorId: app.doctorId || null,
      startTime: app.startTime,
      duration: app.duration,
      status: app.status,
      clinicalNotes: app.clinicalNotes || null,
      types: app.types,
      recurrence: app.recurrence || null
    };
    const { error } = await supabase.from('ced_appointments').upsert([dbApp]);
    if (error) throw error;

    this.appointments.push(app);
    // Auto-save patient (without dob)
    await this.addOrUpdatePatient({
      name: data.patientName,
      phone: data.phone,
      insurance: data.insurance
    });
    this.save();
    return app;
  }

  async updateAppointment(id, data) {
    const index = this.appointments.findIndex(app => app.id === id);
    if (index >= 0) {
      const updated = { ...this.appointments[index], ...data };
      // Send only valid DB columns
      const dbApp = {
        patientName: data.patientName,
        phone: data.phone || null,
        insurance: data.insurance || null,
        providerId: data.providerId,
        doctorId: data.doctorId || null,
        startTime: data.startTime,
        duration: data.duration,
        status: data.status || updated.status,
        clinicalNotes: data.clinicalNotes || null,
        types: data.types || [],
        recurrence: data.recurrence || null
      };
      const { error } = await supabase.from('ced_appointments').update(dbApp).eq('id', id);
      if (error) throw error;

      this.appointments[index] = updated;
      // Auto-update patient (without dob)
      await this.addOrUpdatePatient({
        name: data.patientName,
        phone: data.phone,
        insurance: data.insurance
      });
      this.save();
    }
  }

  async deleteAppointment(id) {
    const { error } = await supabase.from('ced_appointments').delete().eq('id', id);
    if (error) throw error;
    this.appointments = this.appointments.filter(a => a.id !== id);
    this.save();
  }

  async updateResource(id, data) {
    const isDoctor = data.type === 'doctor';
    const list = isDoctor ? this.doctors : this.rooms;
    const index = list.findIndex(p => p.id === id);
    if (index >= 0) {
      const updated = { ...list[index], ...data };
      const { error } = await supabase.from('ced_resources').update(data).eq('id', id);
      if (error) throw error;
      list[index] = updated;
      this.save();
    }
  }

  async addResource(type, name) {
    const isDoctor = type === 'doctor';
    const list = isDoctor ? this.doctors : this.rooms;
    const newId = `${type}-${Date.now()}`;
    const color = isDoctor ? '#2563eb' : '#dc2626'; // Default colors
    
    const resource = {
      id: newId,
      name: name,
      color: color,
      visible: true,
      type: type
    };

    const { error } = await supabase.from('ced_resources').insert([resource]);
    if (error) throw error;

    list.push(resource);
    this.save();
    return newId;
  }

  async editResource(id, type, name) {
    const list = type === 'doctor' ? this.doctors : this.rooms;
    const target = list.find(r => r.id === id);
    if (target) {
      const { error } = await supabase.from('ced_resources').update({ name }).eq('id', id);
      if (error) throw error;
      target.name = name;
      this.save();
      return true;
    }
    return false;
  }

  async deleteResource(id, type) {
    // Validation: Check for future/current appointments
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const hasFutureAppointments = this.appointments.some(app => {
      const isMatch = app.providerId === id || app.doctorId === id;
      if (!isMatch) return false;
      const appDate = new Date(app.startTime);
      appDate.setHours(0, 0, 0, 0);
      return appDate.getTime() >= now.getTime();
    });

    if (hasFutureAppointments) {
      return { success: false, message: "No puedes borrar este recurso porque aún tiene citas programadas hoy o en el futuro." };
    }

    const { error } = await supabase.from('ced_resources').delete().eq('id', id);
    if (error) throw error;
    
    if (type === 'doctor') {
      this.doctors = this.doctors.filter(d => d.id !== id);
    } else {
      this.rooms = this.rooms.filter(r => r.id !== id);
    }
    
    this.save();
    return { success: true };
  }

  getAppointmentsForDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return this.appointments.filter(app => this.isAppointmentActiveOnDate(app, d));
  }

  isAppointmentActiveOnDate(app, targetDate) {
    const appStart = new Date(app.startTime);
    appStart.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    if (target < appStart) return false;

    if (!app.recurrence) {
      return target.getTime() === appStart.getTime();
    }

    const { pattern, interval, days, endType, endValue } = app.recurrence;

    // Check End Conditions (Date-based)
    if (endType === 'on' && endValue) {
      const endD = new Date(endValue);
      endD.setHours(0, 0, 0, 0);
      if (target > endD) return false;
    }

    // Check Pattern Match
    const diffDays = Math.floor((target.getTime() - appStart.getTime()) / (1000 * 60 * 60 * 24));
    let isActive = false;

    if (pattern === 'Diario') {
      isActive = diffDays % (parseInt(interval) || 1) === 0;
    } else if (pattern === 'Semanal') {
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const targetDayName = dayNames[target.getDay()];
      if (!(days || []).includes(targetDayName)) return false;

      const appStartCopy = new Date(appStart);
      appStartCopy.setDate(appStartCopy.getDate() - appStartCopy.getDay());
      const targetCopy = new Date(target);
      targetCopy.setDate(targetCopy.getDate() - targetCopy.getDay());
      
      const weekDiff = Math.round((targetCopy.getTime() - appStartCopy.getTime()) / (1000 * 60 * 60 * 24 * 7));
      isActive = weekDiff % (parseInt(interval) || 1) === 0;
    } else if (pattern === 'Mensual') {
      if (target.getDate() !== appStart.getDate()) return false;
      const monthDiff = (target.getFullYear() - appStart.getFullYear()) * 12 + (target.getMonth() - appStart.getMonth());
      isActive = monthDiff % (parseInt(interval) || 1) === 0;
    }

    if (!isActive) return false;

    // Check Occurrence Limit (if applicable)
    if (endType === 'after' && endValue) {
      const totalOccurrences = this.countOccurrencesUpTo(app, target);
      if (totalOccurrences > parseInt(endValue)) return false;
    }

    return true;
  }

  countOccurrencesUpTo(app, targetDate) {
    const appStart = new Date(app.startTime);
    appStart.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const { pattern, interval, days } = app.recurrence;
    let count = 0;

    // We only need to iterate over the dates for now.
    // For large ranges, this can be mathematically optimized.
    // Given the context of medical scheduling (weeks/months), this is fine.
    let current = new Date(appStart);
    while (current <= target) {
      if (this.isMatchingPatternSimple(app, current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  isMatchingPatternSimple(app, date) {
    const appStart = new Date(app.startTime);
    appStart.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    
    const { pattern, interval, days } = app.recurrence;
    const diffDays = Math.floor((target.getTime() - appStart.getTime()) / (1000 * 60 * 60 * 24));

    if (pattern === 'Diario') {
      return diffDays % (parseInt(interval) || 1) === 0;
    }

    if (pattern === 'Semanal') {
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      if (!(days || []).includes(dayNames[target.getDay()])) return false;
      const appStartCopy = new Date(appStart);
      appStartCopy.setDate(appStartCopy.getDate() - appStartCopy.getDay());
      const targetCopy = new Date(target);
      targetCopy.setDate(targetCopy.getDate() - targetCopy.getDay());
      const weekDiff = Math.round((targetCopy.getTime() - appStartCopy.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return weekDiff % (parseInt(interval) || 1) === 0;
    }

    if (pattern === 'Mensual') {
      if (target.getDate() !== appStart.getDate()) return false;
      const monthDiff = (target.getFullYear() - appStart.getFullYear()) * 12 + (target.getMonth() - appStart.getMonth());
      return monthDiff % (parseInt(interval) || 1) === 0;
    }
    return false;
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


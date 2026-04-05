import { supabase } from './supabaseClient.js';

export const INITIAL_ROOMS = [
  { id: 'sala-a', name: 'Sala Endoscopía A', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-b', name: 'Sala Endoscopía B', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-c', name: 'Sala Endoscopía C', color: '#dc2626', visible: true, type: 'room' },
  { id: 'sala-d', name: 'Sala Endoscopía D', color: '#dc2626', visible: true, type: 'room' }
];

export const INITIAL_DOCTORS = [
  { id: 'dr-jorge-suazo', name: 'Dr. Jorge Suazo', color: '#2563eb', visible: true, type: 'doctor' },
  { id: 'dr1', name: 'Dr. Alejandro Soto', color: '#7c3aed', visible: true, type: 'doctor' },
  { id: 'dr2', name: 'Dra. Elena Rivas', color: '#059669', visible: true, type: 'doctor' },
  { id: 'dr3', name: 'Dr. Roberto Méndez', color: '#d97706', visible: true, type: 'doctor' }
];

export const RESOURCE_PALETTE = [
  '#2563eb', // Blue
  '#059669', // Green
  '#7c3aed', // Purple
  '#d97706', // Orange
  '#dc2626', // Red
  '#eab308', // Yellow
  '#0891b2', // Teal
  '#db2777', // Pink
  '#475569'  // Slate/Gray
];

export const DOCTOR_ORDER = [
  'Silvia Portillo',
  'Ruth Banegas',
  'Luis Ramirez',
  'Jorge Suazo',
  'Raúl Zelaya',
  'Josué Umaña',
  'Vilma Portillo',
  'Celenia Godoy'
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

// ─── DB Column Mappers ────────────────────────────────────────────────────────
// IMPORTANT: Supabase/PostgreSQL stores all column names in lowercase.
// DB columns: patientname, providerid, doctorid, starttime, clinicalnotes
// JS uses:    patientName, providerId, doctorId, startTime, clinicalNotes

/** JS camelCase → DB lowercase (for writing to Supabase) */
function mapAppToDB(app) {
  return {
    id: app.id,
    patientname: app.patientName || null,
    phone: app.phone || null,
    insurance: app.insurance || null,
    providerid: app.providerId || null,
    doctorid: app.doctorId || null,
    starttime: app.startTime || null,
    duration: app.duration || 0,
    status: app.status || 'scheduled',
    clinicalnotes: app.clinicalNotes || null,
    types: app.types || [],
    recurrence: app.recurrence || null,
    label: app.label || null
  };
}

/** DB lowercase → JS camelCase (for reading from Supabase) */
function mapAppFromDB(row) {
  return {
    id: row.id,
    patientName: row.patientname,
    phone: row.phone,
    insurance: row.insurance,
    providerId: row.providerid,
    doctorId: row.doctorid,
    startTime: row.starttime,
    duration: row.duration,
    status: row.status,
    clinicalNotes: row.clinicalnotes,
    types: row.types || [],
    recurrence: row.recurrence || null,
    label: row.label || null
  };
}
// ─────────────────────────────────────────────────────────────────────────────

/** Safe helper: upsert a patient row without throwing.
 *  The Supabase JS client returns a PostgrestBuilder, NOT a native Promise,
 *  so .catch() does NOT work on it. Always use: const { error } = await ... */
async function safeUpsertPatient(name, phone, insurance) {
  const { error } = await supabase
    .from('ced_patients')
    .upsert([{ name, phone: phone || '', insurance: insurance || '' }]);
  if (error) console.error('[DB] Patient upsert failed:', name, error.message, error.code);
  return !error;
}

class AppState {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'day';
    this.activeTab = 'agenda';
    this.timeFormat = localStorage.getItem('ced_time_format') || '24h';
    this.theme = localStorage.getItem('ced_theme') || 'light';
    this.slotHeight = parseInt(localStorage.getItem('ced_slot_height')) || 100;
    this.slotInterval = parseInt(localStorage.getItem('ced_slot_interval')) || 30;
    this.selectedProviderId = null;
    this.doctors = JSON.parse(localStorage.getItem('ced_doctors')) || INITIAL_DOCTORS;
    this.rooms = JSON.parse(localStorage.getItem('ced_rooms')) || INITIAL_ROOMS;
    this.appointments = JSON.parse(localStorage.getItem('ced_appointments')) || [];
    this.patients = JSON.parse(localStorage.getItem('ced_patients')) || [];
    this.selectedAppointment = null;
    this.currentUser = null;
    this.searchTerm = '';
    this.selectedWeekResources = []; 
    this.navigatorBaseDate = new Date(this.currentDate);
  }

  async load() {
    try {
      // 1. Resources - Explicit order by ID (which contains Date.now() for custom resources) 
      // to ensure columns always appear in the same order
      const { data: resData, error: resError } = await supabase.from('ced_resources').select('*').order('id', { ascending: true });
      console.log('[DB] ced_resources:', resData?.length ?? 0, resError ? '❌ ' + resError.message : '✅');
      if (!resError && resData && resData.length > 0) {
        this.doctors = resData.filter(r => r.type === 'doctor').sort((a, b) => {
          const idxA = DOCTOR_ORDER.findIndex(name => a.name.toLowerCase().includes(name.toLowerCase()));
          const idxB = DOCTOR_ORDER.findIndex(name => b.name.toLowerCase().includes(name.toLowerCase()));
          if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        this.rooms = resData.filter(r => r.type === 'room').sort((a, b) => a.name.localeCompare(b.name));
      } else if (!resError) {
        const { error: upErr } = await supabase.from('ced_resources').upsert([...this.doctors, ...this.rooms]);
        if (upErr) console.error('[DB] Resources migration failed:', upErr.message);
      }

      // 2. Patients FIRST (FK constraint: appointments → patients)
      const { data: patData, error: patError } = await supabase.from('ced_patients').select('*');
      console.log('[DB] ced_patients:', patData?.length ?? 0, patError ? '❌ ' + patError.message : '✅');
      if (!patError && patData && patData.length > 0) {
        this.patients = patData;
      } else if (!patError && this.patients.length > 0) {
        console.log('[DB] Migrating', this.patients.length, 'patients...');
        for (const p of this.patients) {
          await safeUpsertPatient(p.name, p.phone, p.insurance);
        }
      }

      // 3. Appointments (Optimized for Egress: last 60 days to +365 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const oneYearAhead = new Date();
      oneYearAhead.setDate(oneYearAhead.getDate() + 365);

      const { data: appData, error: appError } = await supabase.from('ced_appointments')
        .select('*')
        .gte('starttime', sixtyDaysAgo.toISOString())
        .lte('starttime', oneYearAhead.toISOString());

      console.log('[DB] ced_appointments:', appData?.length ?? 0, appError ? '❌ ' + appError.message : '✅');
      if (!appError && appData && appData.length > 0) {
        this.appointments = appData.map(mapAppFromDB);
        console.log('[DB] Loaded', this.appointments.length, 'appointments from cloud (last 60d to +1y) ✅');
      } else if (!appError && this.appointments.length > 0) {
        console.log('[DB] Migrating', this.appointments.length, 'local appointments...');
        for (const app of this.appointments) {
          if (app.patientName) {
            await safeUpsertPatient(app.patientName, app.phone, app.insurance);
          }
          const { error: aErr } = await supabase.from('ced_appointments').upsert([mapAppToDB(app)]);
          if (aErr) console.error('[DB] Appt migration FAILED:', app.id, aErr.message, aErr.code);
          else console.log('[DB] Appt migrated OK:', app.id, app.patientName);
        }
      }
    } catch (e) {
      console.error('[DB] Critical load error:', e);
    }
  }

  /** Call from browser console to force-push all local appointments: state.forceSyncAll() */
  async forceSyncAll() {
    console.log('[ForceSync] Pushing', this.appointments.length, 'appointments...');
    let ok = 0, fail = 0;
    for (const app of this.appointments) {
      if (app.patientName) {
        await safeUpsertPatient(app.patientName, app.phone, app.insurance);
      }
      const { error } = await supabase.from('ced_appointments').upsert([mapAppToDB(app)]);
      if (error) { fail++; console.error('[ForceSync] FAILED:', app.id, error.message, error.code); }
      else { ok++; console.log('[ForceSync] OK:', app.id, app.patientName); }
    }
    alert(`Sincronización: ${ok} citas enviadas ✅, ${fail} fallidas ❌`);
  }

  /**
   * Backs up appointments older than X months to a JSON file and deletes them from Supabase.
   */
  async archiveOldAppointments(monthsThreshold = 6) {
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - monthsThreshold);
    const dateStr = thresholdDate.toISOString();

    console.log('[Archive] Searching for appointments older than:', dateStr);

    // 1. Fetch old appointments
    const { data: oldApps, error: fetchErr } = await supabase
      .from('ced_appointments')
      .select('*')
      .lt('starttime', dateStr);

    if (fetchErr) {
      alert('Error al buscar citas antiguas: ' + fetchErr.message);
      return;
    }

    if (!oldApps || oldApps.length === 0) {
      alert('No se encontraron citas anteriores a ' + monthsThreshold + ' meses para archivar.');
      return;
    }

    // 2. Download as JSON
    const fileName = `archivo_citas_ced_${new Date().toISOString().split('T')[0]}.json`;
    const dataStr = JSON.stringify(oldApps, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 3. Ask for confirmation before deleting
    const confirmDelete = confirm(`Se han descargado ${oldApps.length} citas antiguas en el archivo "${fileName}".\n\n¿Desea ELIMINARLAS de la base de datos de la nube para liberar espacio ahora? Esta acción no se puede deshacer.`);
    
    if (confirmDelete) {
      const idsToDelete = oldApps.map(a => a.id);
      
      // Supabase delete with .in() filter
      const { error: delErr } = await supabase
        .from('ced_appointments')
        .delete()
        .in('id', idsToDelete);

      if (delErr) {
        alert('Respaldo descargado, pero hubo un error al borrar de la nube: ' + delErr.message);
      } else {
        alert(`Éxito: ${oldApps.length} citas archivadas y eliminadas de la nube.`);
        // Refresh local state to remove archived items
        this.appointments = this.appointments.filter(a => !idsToDelete.includes(a.id));
        this.save();
      }
    } else {
      alert('Respaldo descargado. Las citas NO fueron eliminadas de la nube.');
    }
  }

  async save() {
    localStorage.setItem('ced_doctors', JSON.stringify(this.doctors));
    localStorage.setItem('ced_rooms', JSON.stringify(this.rooms));
    localStorage.setItem('ced_appointments', JSON.stringify(this.appointments));
    localStorage.setItem('ced_patients', JSON.stringify(this.patients));
    localStorage.setItem('ced_theme', this.theme);
    localStorage.setItem('ced_time_format', this.timeFormat);
    localStorage.setItem('ced_slot_height', this.slotHeight);
    localStorage.setItem('ced_slot_interval', this.slotInterval);
  }

  // --- Patients ---
  getPatient(name) {
    return this.patients.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  async addOrUpdatePatient(patientData) {
    const index = this.patients.findIndex(p => p.name.toLowerCase() === patientData.name.toLowerCase());
    // Use safeUpsertPatient — it uses const { error } = await, NOT .catch()
    await safeUpsertPatient(patientData.name, patientData.phone, patientData.insurance);
    if (index >= 0) {
      this.patients[index] = { ...this.patients[index], ...patientData };
    } else {
      this.patients.push({ name: patientData.name, phone: patientData.phone || '', insurance: patientData.insurance || '' });
    }
    this.save();
  }

  // --- Appointments ---
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
    const app = {
      id: Date.now().toString(),
      ...data,
      status: 'scheduled',
      types: data.types || []
    };

    // STEP 1: patient first (FK constraint)
    await safeUpsertPatient(data.patientName, data.phone, data.insurance);

    // STEP 2: appointment with lowercase DB columns
    const { error } = await supabase.from('ced_appointments').upsert([mapAppToDB(app)]);
    if (error) throw new Error(error.message);

    this.appointments.push(app);
    this.save();
    return app;
  }

  async updateAppointment(id, data) {
    const index = this.appointments.findIndex(app => app.id === id);
    if (index >= 0) {
      const updated = { ...this.appointments[index], ...data };

      // Update patient first (FK)
      await safeUpsertPatient(data.patientName, data.phone, data.insurance);

      // Update appointment with lowercase columns (exclude id from update payload)
      const dbUpdate = mapAppToDB({ ...updated });
      delete dbUpdate.id;
      const { error } = await supabase.from('ced_appointments').update(dbUpdate).eq('id', id);
      if (error) throw new Error(error.message);

      this.appointments[index] = updated;
      this.save();
    }
  }

  async deleteAppointment(id) {
    const { error } = await supabase.from('ced_appointments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.appointments = this.appointments.filter(a => a.id !== id);
    this.save();
  }

  async updateResource(id, data) {
    const isDoctor = data.type === 'doctor';
    const list = isDoctor ? this.doctors : this.rooms;
    const index = list.findIndex(p => p.id === id);
    if (index >= 0) {
      const { error } = await supabase.from('ced_resources').update(data).eq('id', id);
      if (error) throw new Error(error.message);
      list[index] = { ...list[index], ...data };
      this.save();
    }
  }

  async addResource(type, name, color = null) {
    const list = type === 'doctor' ? this.doctors : this.rooms;
    const newId = `${type}-${Date.now()}`;
    // If no color provided, pick one from the palette based on index
    const assignedColor = color || (type === 'doctor' ? RESOURCE_PALETTE[list.length % RESOURCE_PALETTE.length] : '#475569');
    
    const resource = { id: newId, name, color: assignedColor, visible: true, type };
    const { error } = await supabase.from('ced_resources').insert([resource]);
    if (error) throw new Error(error.message);
    list.push(resource);
    this.save();
    return newId;
  }

  async editResource(id, type, name, color) {
    const list = type === 'doctor' ? this.doctors : this.rooms;
    const target = list.find(r => r.id === id);
    if (target) {
      const { error } = await supabase.from('ced_resources').update({ name, color }).eq('id', id);
      if (error) throw new Error(error.message);
      target.name = name;
      target.color = color;
      this.save();
      return true;
    }
    return false;
  }

  async deleteResource(id, type) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const hasFuture = this.appointments.some(app => {
      if (app.providerId !== id && app.doctorId !== id) return false;
      const d = new Date(app.startTime);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= now.getTime();
    });
    if (hasFuture) return { success: false, message: 'No puedes borrar este recurso porque tiene citas programadas.' };
    const { error } = await supabase.from('ced_resources').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    if (type === 'doctor') this.doctors = this.doctors.filter(d => d.id !== id);
    else this.rooms = this.rooms.filter(r => r.id !== id);
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
    if (!app.recurrence) return target.getTime() === appStart.getTime();

    const { pattern, interval, days, endType, endValue } = app.recurrence;
    if (endType === 'on' && endValue) {
      const endD = new Date(endValue);
      endD.setHours(0, 0, 0, 0);
      if (target > endD) return false;
    }

    const diffDays = Math.floor((target.getTime() - appStart.getTime()) / 86400000);
    let isActive = false;
    if (pattern === 'Diario') {
      isActive = diffDays % (parseInt(interval) || 1) === 0;
    } else if (pattern === 'Semanal') {
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      if (!(days || []).includes(dayNames[target.getDay()])) return false;
      const a = new Date(appStart); a.setDate(a.getDate() - a.getDay());
      const b = new Date(target);   b.setDate(b.getDate() - b.getDay());
      const weekDiff = Math.round((b - a) / 604800000);
      isActive = weekDiff % (parseInt(interval) || 1) === 0;
    } else if (pattern === 'Mensual') {
      if (target.getDate() !== appStart.getDate()) return false;
      const monthDiff = (target.getFullYear() - appStart.getFullYear()) * 12 + (target.getMonth() - appStart.getMonth());
      isActive = monthDiff % (parseInt(interval) || 1) === 0;
    }

    if (!isActive) return false;
    if (endType === 'after' && endValue) {
      if (this.countOccurrencesUpTo(app, target) > parseInt(endValue)) return false;
    }
    return true;
  }

  countOccurrencesUpTo(app, targetDate) {
    const start = new Date(app.startTime); start.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);   target.setHours(0, 0, 0, 0);
    let count = 0;
    let cur = new Date(start);
    while (cur <= target) {
      if (this.isMatchingPatternSimple(app, cur)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  isMatchingPatternSimple(app, date) {
    const appStart = new Date(app.startTime); appStart.setHours(0, 0, 0, 0);
    const target = new Date(date);            target.setHours(0, 0, 0, 0);
    const { pattern, interval, days } = app.recurrence;
    const diffDays = Math.floor((target - appStart) / 86400000);
    if (pattern === 'Diario') return diffDays % (parseInt(interval) || 1) === 0;
    if (pattern === 'Semanal') {
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      if (!(days || []).includes(dayNames[target.getDay()])) return false;
      const a = new Date(appStart); a.setDate(a.getDate() - a.getDay());
      const b = new Date(target);   b.setDate(b.getDate() - b.getDay());
      return Math.round((b - a) / 604800000) % (parseInt(interval) || 1) === 0;
    }
    if (pattern === 'Mensual') {
      if (target.getDate() !== appStart.getDate()) return false;
      const m = (target.getFullYear() - appStart.getFullYear()) * 12 + (target.getMonth() - appStart.getMonth());
      return m % (parseInt(interval) || 1) === 0;
    }
    return false;
  }

  toggleVisibility(id) {
    const d = this.doctors.find(x => x.id === id);
    if (d) { d.visible = !d.visible; }
    else { const r = this.rooms.find(x => x.id === id); if (r) r.visible = !r.visible; }
    this.save();
  }
}

export const state = new AppState();

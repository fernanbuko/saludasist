import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { fetchEvents, fetchPatient } from './cloud';
import { normalizeMed } from './dose';
import { notifyMissed, notifyNewEvents } from './family';
import { auth } from './firebase';
import { rescheduleAll } from './notifications';
import { loadCache, loadDevice, saveCache, saveDevice, type DeviceState } from './storage';
import type { AppState, PatientDoc } from './types';

/**
 * Tarea periódica (Android la ejecuta cada ~15-30 min, según batería):
 *  - en el teléfono de quien toma la medicación: renueva los recordatorios de los próximos días;
 *  - en el teléfono del familiar: consulta la nube y avisa de tomas, fotos no verificadas y dosis olvidadas.
 */
export const TASK = 'saludasist-revision';

const toState = (p: PatientDoc, d: DeviceState): AppState => ({
  v: 1,
  welcomed: true,
  createdAt: p.createdAt,
  meds: (p.meds ?? []).map((m) => normalizeMed(m, p.createdAt)),
  log: p.log ?? {},
  alerted: d.alerted,
  snooze: d.snooze,
  settings: { patientName: p.patientName, voice: d.voice },
});

TaskManager.defineTask(TASK, async () => {
  try {
    const cache = await loadCache();
    if (!cache) return BackgroundTask.BackgroundTaskResult.Success;
    let dev = await loadDevice();
    if (cache.patient.ownerUid === cache.uid) {
      await rescheduleAll(toState(cache.patient, dev));
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    // Familiar: hace falta la sesión de Firebase para leer los datos actualizados.
    await auth.authStateReady();
    if (auth.currentUser?.uid !== cache.uid) return BackgroundTask.BackgroundTaskResult.Success;
    const fresh = await fetchPatient(cache.patientId);
    if (!fresh) return BackgroundTask.BackgroundTaskResult.Success;
    await saveCache({ ...cache, patient: fresh });
    const who = fresh.patientName || 'Tu familiar';
    dev = await notifyNewEvents(await fetchEvents(cache.patientId), dev, cache.uid, who);
    dev = await notifyMissed(toState(fresh, dev), dev, who);
    await saveDevice(dev);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackground() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {}
}

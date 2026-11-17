import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
// La versión de @firebase/auth para React Native (la que carga Metro) incluye la persistencia en AsyncStorage,
// pero sus tipos públicos no la declaran.
import * as FirebaseAuthRN from '@firebase/auth';
const { getReactNativePersistence } = FirebaseAuthRN as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => Persistence };
import { getFirestore } from 'firebase/firestore';
import googleServices from '../../google-services.json';

/**
 * Configuración de Firebase tomada de google-services.json (proyecto saludasist-c89d5).
 * Estos valores identifican el proyecto; no son secretos: la seguridad la dan las reglas de Firestore.
 */
const client = googleServices.client[0];
const projectId = googleServices.project_info.project_id;

export const firebaseConfig = {
  apiKey: client.api_key[0].current_key,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: googleServices.project_info.storage_bucket,
  messagingSenderId: googleServices.project_info.project_number,
  appId: client.client_info.mobilesdk_app_id,
};

/** Cliente "web" de OAuth que pide Google Sign-In para emitir el idToken que acepta Firebase Auth. */
export const WEB_CLIENT_ID = client.oauth_client.find((o) => o.client_type === 3)?.client_id ?? '';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function makeAuth(): Auth {
  try {
    // La sesión se guarda en el teléfono para no tener que volver a entrar cada vez.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

export const auth = makeAuth();
export const db = getFirestore(app);

import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { WEB_CLIENT_ID, auth } from './firebase';

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

export class SignInError extends Error {
  constructor(message: string, public cancelled = false) {
    super(message);
  }
}

/** Abre la ventana de cuentas de Google y entra en Firebase con la cuenta elegida. */
export async function signInWithGoogle() {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) throw new SignInError('Inicio de sesión cancelado.', true);
    const idToken = res.data.idToken;
    if (!idToken) throw new SignInError('Google no devolvió los datos de la cuenta. Inténtalo de nuevo.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (e: unknown) {
    if (e instanceof SignInError) throw e;
    const code = (e as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) throw new SignInError('Inicio de sesión cancelado.', true);
    if (code === statusCodes.IN_PROGRESS) throw new SignInError('Ya hay un inicio de sesión en curso.');
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new SignInError('Este teléfono necesita los servicios de Google Play actualizados.');
    if (code === 'auth/network-request-failed') throw new SignInError('Sin conexión a internet. Inténtalo cuando tengas señal.');
    throw new SignInError(`No se pudo iniciar sesión con Google (${code ?? 'error desconocido'}).`);
  }
}

export async function signOutAll() {
  configure();
  try {
    await GoogleSignin.signOut();
  } catch {}
  await signOut(auth);
}

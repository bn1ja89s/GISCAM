import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbFjwgG3t6gGLdZdGqy9w8RBwMDinz9Ds",
  authDomain: "giscam2-8b91b.firebaseapp.com",
  projectId: "giscam2-8b91b",
  storageBucket: "giscam2-8b91b.firebasestorage.app",
  messagingSenderId: "632723441007",
  appId: "1:632723441007:web:035730bb14ac90b37bd49a",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

let currentUser = null;
const FIRESTORE_TIMEOUT_MS = 12000;

function withFirestoreTimeout(promise, action = "consultar Firestore") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`No se pudo ${action}. Verifica que Firestore Database exista como base "(default)" en Firebase.`));
      }, FIRESTORE_TIMEOUT_MS);
    }),
  ]);
}

function normalizeFirestoreError(error) {
  const message = String(error?.message || "");
  if (error?.code === "not-found" || message.includes("database (default) does not exist")) {
    return new Error('Firestore Database no existe. En Firebase Console crea la base de datos "(default)" para el proyecto giscam2-8b91b.');
  }

  if (error?.code === "permission-denied") {
    return new Error("Firestore rechazo el acceso. Revisa que las reglas permitan usuarios/{uid} al usuario autenticado.");
  }

  return error;
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)]),
    );
  }

  return value;
}

export function getCurrentUser() {
  return currentUser;
}

export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    if (user) {
      onLogin(user);
      return;
    }

    onLogout();
  });
}

export async function registrar(email, password, nombre) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nombre) {
    await updateProfile(cred.user, { displayName: nombre });
  }

  await setDoc(doc(db, "usuarios", cred.user.uid), {
    nombre,
    email,
    uid: cred.user.uid,
    creadoEn: new Date().toISOString(),
  });

  return cred.user;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function cerrarSesion() {
  await signOut(auth);
}

export async function guardarDocumento(coleccion, id, datos) {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    throw new Error("Sin sesion");
  }

  const docId = String(id || datos.uuid || datos.id || datos.id_local || crypto.randomUUID());
  try {
    await withFirestoreTimeout(
      setDoc(
        doc(db, "usuarios", uid, coleccion, docId),
        removeUndefined({ ...datos, uid, _actualizadoEn: new Date().toISOString() }),
        { merge: true },
      ),
      "guardar datos en Firestore",
    );
  } catch (error) {
    throw normalizeFirestoreError(error);
  }

  return { ...datos, id: docId };
}

export async function obtenerDocumentos(coleccion) {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    return [];
  }

  try {
    const snap = await withFirestoreTimeout(
      getDocs(collection(db, "usuarios", uid, coleccion)),
      "cargar datos desde Firestore",
    );
    return snap.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

export async function obtenerDocumento(coleccion, id) {
  const uid = getCurrentUser()?.uid;
  if (!uid || !id) {
    return null;
  }

  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, "usuarios", uid, coleccion, String(id))),
      "cargar documento desde Firestore",
    );
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

export async function eliminarDocumento(coleccion, id) {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    throw new Error("Sin sesion");
  }

  if (!id) {
    return;
  }

  try {
    await withFirestoreTimeout(
      deleteDoc(doc(db, "usuarios", uid, coleccion, String(id))),
      "eliminar documento en Firestore",
    );
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

export function traducirErrorFirebase(code) {
  const errores = {
    "auth/email-already-in-use": "Este correo ya esta registrado",
    "auth/invalid-email": "Correo invalido",
    "auth/weak-password": "La contrasena debe tener al menos 6 caracteres",
    "auth/user-not-found": "Usuario no encontrado",
    "auth/wrong-password": "Contrasena incorrecta",
    "auth/invalid-credential": "Correo o contrasena incorrectos",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos",
    "auth/network-request-failed": "Sin conexion a internet",
    "auth/operation-not-allowed": "El acceso con correo y contrasena no esta activado en Firebase",
    "auth/configuration-not-found": "Firebase Authentication no esta configurado. Activa Email/Password en Firebase Console",
    "auth/unauthorized-domain": "Este dominio no esta autorizado en Firebase Authentication",
    "auth/missing-email": "Ingresa tu correo electronico",
    "auth/missing-password": "Ingresa tu contrasena",
    "auth/invalid-api-key": "La API key de Firebase no es valida",
    "auth/app-deleted": "La app de Firebase no esta disponible",
  };

  return errores[code] || `Error al autenticar (${code || "sin codigo"}). Intenta de nuevo`;
}

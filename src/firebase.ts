import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';
import { UserRole } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = initializeApp(firebaseConfig);

// Messaging instance (lazy initialized and safe)
export const getFCM = async () => {
  try {
    if (typeof window !== 'undefined' && await isSupported()) {
      return getMessaging(app);
    }
  } catch (err) {
    console.warn('FCM not supported or failed to initialize:', err);
  }
  return null;
};

// Use initializeFirestore with long-polling to be more resilient in iframe/restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

/**
 * Creates a system notification
 */
export async function createNotification(
  title: string,
  description: string,
  recipientRoles: UserRole[],
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  link?: string
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title,
      description,
      type,
      recipientRoles,
      link: link || '',
      readBy: [],
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// Enable offline persistence for better UX on unstable connections
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence is not supported by this browser');
    }
  });
}

// Use initializeAuth with a list of persistence options for better reliability across different browser environments
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});

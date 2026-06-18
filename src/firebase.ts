import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, collection, addDoc, serverTimestamp, doc, getDocFromServer, memoryLocalCache } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
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

export const auth = getAuth(app);

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

// Use initializeFirestore with long-polling to be highly resilient in iframe/restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  useFetchStreams: false,
  localCache: memoryLocalCache(),
} as any, firebaseConfig.firestoreDatabaseId);

/**
 * Tests the Firestore connection
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("Firestore connection verified.");
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('backend'))) {
      console.warn("Firestore connection check: Backend unreachable or client is offline.");
    }
    return false;
  }
}

export const storage = getStorage(app);

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

// Offline persistence disabled to prevent "Unexpected state" crashes inside the iframe sandbox environment.

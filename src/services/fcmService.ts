import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, createNotification } from '../firebase';
import { UserRole } from '../types';

/**
 * Sends a system notification to multiple roles
 */
export const notifyAllRoles = async (roles: UserRole[], title: string, body: string, link?: string) => {
  try {
    // 1. Create System Notification in Firestore for all target roles
    await createNotification(title, body, roles, 'info', link);

    // 2. Logic for FCM tokens (optional/future)
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', roles));
    const querySnapshot = await getDocs(q);
    
    const tokens: string[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length > 0) {
      console.log(`Sending FCM to ${tokens.length} users with roles ${roles.join(', ')}: ${title}`);
    }
  } catch (error) {
    console.error('Error in notifyAllRoles:', error);
  }
};

/**
 * Compatibility wrapper for single role notification
 */
export const notifyUserByRole = (role: UserRole, title: string, body: string, link?: string) => {
  return notifyAllRoles([role], title, body, link);
};

export const notifyUserById = async (userId: string, title: string, body: string) => {
  // Similar logic but for a specific user ID
};

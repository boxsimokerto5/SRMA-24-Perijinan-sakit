import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const notifyUserByRole = async (role: string, title: string, body: string) => {
  try {
    // Find users with the target role
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    
    const tokens: string[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      console.log(`No FCM tokens found for role: ${role}`);
      return;
    }

    console.log(`Sending notification to ${tokens.length} users with role ${role}: ${title}`);
    
    // NOTE: Sending FCM directly from the client is NOT recommended for production
    // because it requires a server key or OAuth token which should be kept secret.
    // In a real app, you would call a Cloud Function or your own backend.
    
    // For this demo, we'll log the intention. 
    // If you have a Cloud Function set up, it would listen to a 'notifications' collection.
    
    /*
    // Example of what the Cloud Function would do:
    await admin.messaging().sendMulticast({
      tokens: tokens,
      notification: {
        title: title,
        body: body,
      },
    });
    */
  } catch (error) {
    console.error('Error in notifyUserByRole:', error);
  }
};

export const notifyUserById = async (userId: string, title: string, body: string) => {
  // Similar logic but for a specific user ID
};

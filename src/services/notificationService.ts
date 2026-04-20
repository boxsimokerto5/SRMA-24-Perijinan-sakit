import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const setupPushNotifications = async (userId: string) => {
  try {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Wrap registration in its own try-catch
    const registerWithRetry = async () => {
      try {
        console.log('Requesting push permissions...');
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('User denied push notification permissions');
          return;
        }

        console.log('Registering for push...');
        // This is often where the force close / crash happens if google-services.json is missing
        await PushNotifications.register();
      } catch (regErr) {
        console.error('Push Registration native crash prevention:', regErr);
        // Silently fail to prevent app crash
      }
    };

    // Delay registration slightly to ensure native bridge is stable
    setTimeout(registerWithRetry, 2000);

    // Listeners should be added regardless of registration success to prevent null ref errors
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmToken: token.value
        });
      } catch (error) {
        console.error('Error saving FCM token to Firestore:', error);
      }
    });

    // Some error occurred
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on push registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
    });
  } catch (err) {
    console.error('General Push Notification Error:', err);
    // We don't throw here to avoid crashing the main app flow
  }
};

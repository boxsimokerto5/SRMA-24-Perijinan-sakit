import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const setupPushNotifications = async (userId: string) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms.');
    return;
  }

  // Request permission to use push notifications
  // iOS will prompt a system dialog, Android will just return 'granted' if already allowed
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.error('User denied permissions!');
    return;
  }

  // Register with Apple / Google to receive push notifications
  await PushNotifications.register();

  // On success, we should be able to receive notifications
  PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token: ' + token.value);
    
    // Save the token to the user's profile in Firestore
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token.value
      });
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  });

  // Some error occurred
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Error on registration: ' + JSON.stringify(error));
  });

  // Show us the notification payload if the app is open on our device
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
  });

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed: ' + JSON.stringify(notification));
  });
};

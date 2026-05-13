import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import { AppUser } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ uid: firebaseUser.uid, ...userDoc.data() } as AppUser);
          } else {
            // New user or role not assigned yet
            setUser({ 
              uid: firebaseUser.uid, 
              email: firebaseUser.email || '', 
              name: firebaseUser.displayName || 'User',
              role: 'wali_asuh' // Default role for now or trigger setup
            } as AppUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
      }
      
      // Keep splash for at least 2sec for flair
      setTimeout(() => setInitializing(false), 2000);
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Auth />;
  }

  return <Layout user={user} />;
};

export default App;

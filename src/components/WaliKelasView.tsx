import React from 'react';
import { AppUser } from '../types';

const WaliKelasView: React.FC<{ user: AppUser }> = ({ user }) => {
  return (
    <div className="text-stone-400 font-bold italic">
      Wali Kelas Dashboard Placeholder for {user.name}
    </div>
  );
};

export default WaliKelasView;

import React from 'react';
import { AppUser } from '../types';

const GuruMapelView: React.FC<{ user: AppUser }> = ({ user }) => {
  return (
    <div className="text-stone-400 font-bold italic">
      Guru Mapel Dashboard Placeholder for {user.name}
    </div>
  );
};

export default GuruMapelView;

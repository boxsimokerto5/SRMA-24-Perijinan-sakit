import React from 'react';
import { AppUser } from '../types';

const KepalaSekolahView: React.FC<{ user: AppUser }> = ({ user }) => {
  return (
    <div className="text-stone-400 font-bold italic">
      Kepala Sekolah Dashboard Placeholder for {user.name}
    </div>
  );
};

export default KepalaSekolahView;

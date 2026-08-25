import React from 'react';
import AIChatBot from '../components/AIChatBot';

function Dashboard({ user, setUser, onLogout }) {
  return (
    <AIChatBot 
      user={user} 
      setUser={setUser}
      onLogout={onLogout} 
    />
  );
}

export default Dashboard;

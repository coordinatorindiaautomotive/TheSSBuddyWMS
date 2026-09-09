import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const { activeWarehouse } = useAuth();

  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected to backend server:', newSocket.id);
      if (activeWarehouse) {
        newSocket.emit('joinWarehouse', activeWarehouse.id);
      }
    });

    newSocket.on('slaAlert', (alert) => {
      setNotifications(prev => [
        { id: Date.now(), message: alert.message, type: 'Warning', time: new Date().toLocaleTimeString() },
        ...prev
      ]);
    });

    return () => newSocket.close();
  }, [activeWarehouse]);

  return (
    <SocketContext.Provider value={{ socket, notifications, setNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const { activeWarehouse } = useAuth();

  useEffect(() => {
    const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin;

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (activeWarehouse) {
        newSocket.emit('joinWarehouse', activeWarehouse.id);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('slaAlert', (alert) => {
      setNotifications(prev => [
        { id: Date.now(), message: alert.message, type: 'Warning', time: new Date().toLocaleTimeString() },
        ...prev
      ]);
    });

    return () => {
      newSocket.close();
    };
  }, [activeWarehouse]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, notifications, setNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

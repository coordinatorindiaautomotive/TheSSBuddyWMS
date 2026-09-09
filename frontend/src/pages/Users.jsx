import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, UserCheck } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/masters/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="glass-panel p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Username</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Warehouse Context</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-indigo-400">{u.username}</td>
                  <td className="p-3 font-semibold text-white">{u.full_name}</td>
                  <td className="p-3 text-slate-400">{u.email || 'N/A'}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{u.warehouse_name || 'All Warehouses'}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

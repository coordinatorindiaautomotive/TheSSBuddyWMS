import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Plus, Building } from 'lucide-react';

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [credit, setCredit] = useState('500000');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const res = await axios.get('/api/parties');
      setParties(res.data);
    } catch (err) {
      console.error('Error loading parties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/parties', {
        party_name: name,
        address,
        phone,
        gstin,
        credit_limit: credit
      });
      setShowModal(false);
      setName('');
      fetchParties();
    } catch (err) {
      console.error('Error creating party customer:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          Add Customer Party
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Party Code</th>
                <th className="p-3">Party Name</th>
                <th className="p-3">Address & City</th>
                <th className="p-3">Phone</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Credit Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {parties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-indigo-400">{p.party_code}</td>
                  <td className="p-3 font-semibold text-white">{p.party_name}</td>
                  <td className="p-3 text-slate-400">{p.address}, {p.city}</td>
                  <td className="p-3 font-medium">{p.phone}</td>
                  <td className="p-3 text-slate-400">{p.gstin || 'URP'}</td>
                  <td className="p-3 font-bold text-emerald-400">₹{p.credit_limit?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-slate-700 space-y-4">
            <h3 className="text-base font-bold text-white">Add Customer Party</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Party Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Apex Electronics Pvt Ltd"
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Address & City</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Sector 62, Noida"
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="07AAAAA0000A1Z5"
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

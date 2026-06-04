// frontend/src/pages/AdminUsers.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const AdminUsers = () => {
  const { userInfo } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserRegistry = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const { data } = await axios.get('/api/admin/users', config);
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(err.response && err.response.data.message ? err.response.data.message : err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval;
    if (userInfo) {
      fetchUserRegistry(true);
      interval = setInterval(() => {
        fetchUserRegistry(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [userInfo]);

  if (loading) return <p className="text-center py-12 text-sm font-semibold text-gray-600 animate-pulse">Loading registered customers...</p>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold max-w-4xl mx-auto mt-6">⚠️ {error}</div>;

  return (
    <div className="max-w-[1400px] mx-auto py-6 space-y-6 font-sans text-gray-800">
      
      {/* Animation for table rows */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-row { animation: fadeInRow 0.4s ease-out forwards; }
      `}</style>

      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Registered Customers</h1>
        <p className="text-xs text-gray-700 font-semibold mt-1">Audit customer profile records and access permission levels.</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-300 text-gray-900 font-bold uppercase tracking-wider bg-gray-100 text-[11px]">
                <th className="p-4">Customer ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Account Role</th>
                <th className="p-4">Registration Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
              {users.map((user, index) => (
                <tr key={user._id} className="hover:bg-emerald-50/50 transition-colors animate-row" style={{ animationDelay: `${index * 50}ms` }}>
                  <td className="p-4 font-mono text-gray-900 text-[11px]">{user._id.slice(-8)}</td>
                  <td className="p-4 font-bold text-gray-950">{user.name}</td>
                  <td className="p-4 text-emerald-700 font-semibold">{user.email}</td>
                  <td className="p-4">
                    {user.isAdmin ? (
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-amber-300">
                        Admin
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-gray-300">
                        User
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-700">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden p-4 space-y-4">
          {users.length === 0 ? (
            <p className="text-center text-xs font-bold text-gray-500 py-6">No users found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((user, index) => {
                const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
                return (
                  <div 
                    key={user._id} 
                    className="bg-gray-50 border border-gray-250 rounded-xl p-4 space-y-3 shadow-2xs hover:shadow-xs transition-shadow animate-row"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3 border-b border-gray-200 pb-2.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center font-black text-emerald-700 text-xs flex-shrink-0">
                        {initials}
                      </div>
                      <div className="text-left min-w-0 flex-grow">
                        <h4 className="font-bold text-gray-900 text-xs truncate">{user.name}</h4>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {user._id.slice(-8)}</span>
                      </div>
                      <div className="flex-shrink-0">
                        {user.isAdmin ? (
                          <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-amber-300">
                            Admin
                          </span>
                        ) : (
                          <span className="bg-gray-200 text-gray-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-gray-300">
                            User
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-left pt-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email:</span>
                        <span className="text-emerald-700 font-semibold truncate max-w-[200px]" title={user.email}>{user.email}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Registered:</span>
                        <span className="text-gray-700 font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
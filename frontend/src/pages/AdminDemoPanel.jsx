// frontend/src/pages/AdminDemoPanel.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const AdminDemoPanel = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(180); // 3 minutes simulated timer

  // Simulated countdown timer for visual interest
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const handleRestrictedAction = () => {
    alert('🔒 Restricted in Demo Mode');
  };

  // Mock Overview Metrics
  const metrics = [
    { title: 'Simulated Active Workflows', value: '3', change: 'Stable', icon: '⚡' },
    { title: 'Total Simulated Orders', value: '142', change: '+12 today', icon: '📦' },
    { title: 'Mock Customer Feedback Rate', value: '96.2%', change: '+0.5% this week', icon: '⭐' },
    { title: 'Active Observation Timers', value: '1', change: 'Running', icon: '⏱️' },
  ];

  // Mock Feedback Data
  const mockFeedbackList = [
    {
      id: 'FB-001',
      user: 'Demo User 1',
      email: 'demouser1@example.com',
      type: 'like',
      reason: 'The automated dispatch simulator and email signatures are extremely responsive and secure!',
      caseNum: 'CASE 2',
      rating: 'Outstanding (Rank 1)',
      date: '6/6/2026, 10:45:12 AM',
      elapsed: '0 minutes 25 seconds',
    },
    {
      id: 'FB-002',
      user: 'Demo User 2',
      email: 'demouser2@example.com',
      type: 'like',
      reason: 'Brilliant frontend-only administrative demonstration workspace.',
      caseNum: 'CASE 6',
      rating: 'Excellent (Rank 2)',
      date: '6/6/2026, 10:22:40 AM',
      elapsed: '1 minute 12 seconds',
    },
    {
      id: 'FB-003',
      user: 'Demo User 3',
      email: 'demouser3@example.com',
      type: 'dislike',
      reason: 'The checkout maps took a few extra seconds to geocode during simulated checkout.',
      caseNum: 'CASE 5',
      rating: 'Good / Fair (Rank 4)',
      date: '6/5/2026, 8:12:19 PM',
      elapsed: '5 minutes 34 seconds',
    },
  ];

  // Mock Workflow Orders
  const mockWorkflowOrders = [
    {
      id: 'DEMO-ORDER-001',
      user: 'Demo User 1',
      status: 'DISPATCHED (SIMULATED)',
      stage: 'Observed',
      timer: formatTimer(timerSeconds),
      updatedAt: '6/6/2026, 10:42:20 AM',
    },
    {
      id: 'DEMO-ORDER-002',
      user: 'Demo User 2',
      status: 'DELIVERED (SIMULATED)',
      stage: 'Finalized',
      timer: 'N/A',
      updatedAt: '6/6/2026, 10:20:05 AM',
    },
    {
      id: 'DEMO-ORDER-003',
      user: 'Demo User 3',
      status: 'CANCELLED (SIMULATED)',
      stage: 'Finalized',
      timer: 'N/A',
      updatedAt: '6/5/2026, 8:15:30 PM',
    },
  ];

  // Mock Emails Logs
  const mockEmailLogs = [
    {
      id: 'EML-101',
      orderId: 'DEMO-ORDER-001',
      recipient: 'demouser1@example.com',
      subject: '🧠 Demo Order Dispatched – System Alert',
      date: '6/6/2026, 10:42:21 AM',
      body: `
        <h3>🧠 Demo Order Dispatched – System Alert</h3>
        <p><strong>User Name:</strong> 1. "Demo User 1"</p>
        <p><strong>User Email:</strong> demouser1@example.com</p>
        <p><strong>Order ID:</strong> #DEMO-ORDER-001</p>
        <p><strong>Current Status:</strong> OUT FOR DELIVERY (SIMULATION)</p>
        <hr style="border: 1px solid #eee; margin: 15px 0;"/>
        <p>This email notifies the administrator that the simulated order has entered the active delivery lifecycle. A 90-second developer insight fallback timer is running.</p>
      `,
    },
    {
      id: 'EML-102',
      orderId: 'DEMO-ORDER-001',
      recipient: 'demouser1@example.com',
      subject: '👨💻 Developer Insight – DailyMart Demo System',
      date: '6/6/2026, 10:43:51 AM',
      body: `
        <h3>👨💻 Developer Insight – DailyMart Demo System</h3>
        <p>Hello,</p>
        <p>Thank you for exploring this demo showcase! The simulation has delivered this developer portfolio notification automatically.</p>
        <p>Explore the developer's credentials and leave rating feedback in your profile settings panel.</p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="background-color: #10b981; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin: 5px; display: inline-block;">👍 Like</span>
          <span style="background-color: #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin: 5px; display: inline-block;">👎 Dislike</span>
        </div>
      `,
    },
    {
      id: 'EML-103',
      orderId: 'DEMO-ORDER-001',
      recipient: 'dailymartadmin@gmail.com',
      subject: '👨💻 1. Demo User 1 - Developer Feedback Received',
      date: '6/6/2026, 10:45:12 AM',
      body: `
        <h3>👨💻 1. Demo User 1 - Developer Feedback Received</h3>
        <p><strong>User Name:</strong> 1. "Demo User 1"</p>
        <p><strong>Feedback Type:</strong> LIKE</p>
        <p><strong>Optional Feedback Reason:</strong> The automated dispatch simulator and email signatures are extremely responsive and secure!</p>
        <p><strong>Response Duration:</strong> 0 minutes 25 seconds</p>
        <p><strong>Engagement Case:</strong> CASE 2 (Outstanding)</p>
      `,
    },
    {
      id: 'EML-104',
      orderId: 'DEMO-ORDER-002',
      recipient: 'dailymartadmin@gmail.com',
      subject: '👨💻 1. System Daily Mart - Developer Feedback Received',
      date: '6/6/2026, 10:20:05 AM',
      body: `
        <h3>👨💻 1. System Daily Mart - Developer Feedback Received</h3>
        <p><strong>Case Status:</strong> CASE 4 (No Feedback Received)</p>
        <p><strong>Observation Duration:</strong> 5 minutes 0 seconds</p>
        <p style="color: #b91c1c; font-weight: bold;">No user feedback was received during the 5-minute observation period.</p>
      `,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* ⚠️ TOP BANNER (MANDATORY WARNING) */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs flex items-start gap-3">
        <span className="text-xl pt-0.5">⚠️</span>
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Demo Mode Experience</h4>
          <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
            This is a Demo Admin Experience Panel. This is for UI/UX demonstration only. No real backend data is used or modified.
          </p>
        </div>
      </div>

      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="space-y-1 text-left">
          <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold tracking-widest px-2 py-0.5 rounded uppercase inline-block">
            View Only Panel
          </span>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight uppercase flex items-center gap-1.5">
            📊 Frontend Admin Dashboard
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Explore layout simulation, mockup ledger metrics, and visual workflows.
          </p>
        </div>

        {/* Action Button locked */}
        <button
          type="button"
          onClick={handleRestrictedAction}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
        >
          🔒 Clear Demo Database
        </button>
      </div>

      {/* Overview Analytics Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-2 text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{m.title}</span>
              <h3 className="text-2xl font-black text-gray-800 tracking-tight">{m.value}</h3>
              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{m.change}</span>
            </div>
            <span className="text-2xl bg-gray-50 w-12 h-12 rounded-xl flex items-center justify-center border border-gray-100 shadow-2xs">{m.icon}</span>
          </div>
        ))}
      </div>

      {/* Tab selection */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'overview' ? 'border-indigo-650 text-indigo-650' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📋 Active Workflow Queue
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'emails' ? 'border-indigo-650 text-indigo-650' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📧 Email Dispatch Logs
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'feedback' ? 'border-indigo-650 text-indigo-650' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📊 Feedback Ledger
        </button>
      </div>

      {/* Active Workflows Panel */}
      {activeTab === 'overview' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h4 className="font-extrabold text-xs uppercase text-gray-700 text-left">Workflow Execution Queue</h4>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold tracking-wider px-2 py-0.5 rounded">Mock Queue</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/50 text-gray-400 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4">Order Code</th>
                  <th className="p-4">Simulated User</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Timeline Stage</th>
                  <th className="p-4">Feedback Timer</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-semibold text-gray-700">
                {mockWorkflowOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-indigo-650">{o.id}</td>
                    <td className="p-4">{o.user}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${o.status.includes('DISPATCHED') ? 'bg-amber-100 text-amber-800' : o.status.includes('DELIVERED') ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4">{o.stage}</td>
                    <td className="p-4">
                      {o.timer !== 'N/A' ? (
                        <span className="text-red-600 bg-red-50 font-black border border-red-100 px-2 py-0.5 rounded animate-pulse">
                          ⏱️ {o.timer}
                        </span>
                      ) : (
                        <span className="text-gray-400">Expired</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={handleRestrictedAction}
                        className="bg-gray-100 text-gray-400 hover:text-gray-600 text-[10px] font-bold uppercase py-1 px-3 rounded-lg border border-gray-200 cursor-pointer"
                      >
                        🔒 Force Reschedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simulated Email Logs Panel */}
      {activeTab === 'emails' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h4 className="font-extrabold text-xs uppercase text-gray-700 text-left">Simulated SMTP Dispatches</h4>
            <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 font-extrabold tracking-wider px-2 py-0.5 rounded text-left">Mailbox Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/50 text-gray-400 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4">Time</th>
                  <th className="p-4">Order Code</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-semibold text-gray-700">
                {mockEmailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-400 font-mono">{log.date.split(', ')[1]}</td>
                    <td className="p-4 font-mono text-indigo-650">{log.orderId}</td>
                    <td className="p-4">{log.recipient}</td>
                    <td className="p-4 font-bold text-gray-900">{log.subject}</td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedEmail(log)}
                        className="bg-indigo-550 text-white hover:bg-indigo-650 text-[10px] font-bold uppercase py-1 px-3.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                      >
                        👁️ Preview Body
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedback Ledger Panel */}
      {activeTab === 'feedback' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h4 className="font-extrabold text-xs uppercase text-gray-700 text-left">Customer Ratings Ledger</h4>
            <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 font-extrabold tracking-wider px-2 py-0.5 rounded text-left">Audit Log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/50 text-gray-400 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">User Label</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Optional Reason</th>
                  <th className="p-4">Case / Score</th>
                  <th className="p-4">Response Duration</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-semibold text-gray-700">
                {mockFeedbackList.map((fb) => (
                  <tr key={fb.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-400 font-mono">{fb.date}</td>
                    <td className="p-4">{fb.user}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${fb.type === 'like' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {fb.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 italic max-w-xs truncate text-gray-600">"{fb.reason}"</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{fb.caseNum}</div>
                      <div className="text-[10px] text-gray-400">{fb.rating}</div>
                    </td>
                    <td className="p-4 font-mono">{fb.elapsed}</td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={handleRestrictedAction}
                        className="bg-gray-100 text-gray-400 hover:text-gray-600 text-[10px] font-bold uppercase py-1 px-3 rounded-lg border border-gray-200 cursor-pointer"
                      >
                        🔒 Purge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 📧 EMAIL PREVIEW MODAL */}
      {selectedEmail && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="bg-white border border-gray-250 shadow-2xl rounded-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-500">📧 SMTP Simulation Body</h4>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Recipient: {selectedEmail.recipient}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-white font-black text-sm cursor-pointer"
              >
                Close ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-gray-700 bg-gray-50/50" style={{ maxHeight: '60vh' }}>
              <div 
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-100/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs uppercase font-extrabold tracking-wider py-2 px-5 rounded-lg transition-colors cursor-pointer"
              >
                Done Previewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDemoPanel;

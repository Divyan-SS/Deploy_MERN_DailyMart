// frontend/src/pages/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1 = Request Code, 2 = Reset Password
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  const navigate = useNavigate();



  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  const requestCodeHandler = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');



    try {
      setLoading(true);
      const config = { headers: { 'Content-Type': 'application/json' } };
      const { data } = await axios.post('/api/users/forgot-password', { email: email.trim().toLowerCase() }, config);
      
      // If code was returned in response (local fallback print), alert or show it, otherwise standard message
      if (data.code) {
        setMessage(`${data.message} (Fallback Code: ${data.code})`);
      } else {
        setMessage(data.message);
      }
      
      setStep(2);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.response && err.response.data.message ? err.response.data.message : err.message);
    }
  };

  const resetPasswordHandler = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const config = { headers: { 'Content-Type': 'application/json' } };
      const { data } = await axios.post('/api/users/reset-password', { 
        email: email.trim().toLowerCase(), 
        token: token.trim(), 
        password 
      }, config);

      setMessage(data.message);
      setLoading(false);
      
      // Navigate to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setLoading(false);
      setError(err.response && err.response.data.message ? err.response.data.message : err.message);
    }
  };

  return (
    <div
      className={`max-w-md mx-auto my-16 bg-white border border-gray-300 rounded-2xl p-8 flex flex-col font-sans text-gray-700 shadow-xs transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } hover:shadow-md`}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight uppercase">
          🔒 Recover Password
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-1">
          {step === 1 
            ? 'Enter your whitelisted email address to receive a secure recovery code.' 
            : 'Enter the 6-digit code sent to your inbox and choose a new password.'
          }
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3 rounded-xl mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Success Message */}
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium p-3 rounded-xl mb-4">
          ✅ {message}
        </div>
      )}

      {step === 1 ? (
        /* Step 1 Form: Request Code */
        <form onSubmit={requestCodeHandler} className="space-y-4">
          <div>
            <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-medium">
              📧 Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dailymartadmin@gmail.com"
              className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-800 transition-all hover:border-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-medium py-2 rounded-lg mt-2 uppercase tracking-widest text-xs transition-all shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Requesting Code...' : '🚀 Send Reset Code'}
          </button>
        </form>
      ) : (
        /* Step 2 Form: Enter Code & Password */
        <form onSubmit={resetPasswordHandler} className="space-y-4">
          <div>
            <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-medium">
              🔑 6-Digit Verification Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-800 transition-all hover:border-gray-400 text-center tracking-widest font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-medium">
              🔒 New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border border-gray-300 p-2 pr-10 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-800 transition-all hover:border-gray-400 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 focus:outline-none transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3a9.74 9.74 0 0 0 2.323-3.475m-4.905-2.77a3 3 0 0 0-3.413-3.412m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-medium">
              🔒 Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border border-gray-300 p-2 pr-10 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white text-gray-800 transition-all hover:border-gray-400 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 focus:outline-none transition-colors"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3a9.74 9.74 0 0 0 2.323-3.475m-4.905-2.77a3 3 0 0 0-3.413-3.412m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-medium py-2 rounded-lg mt-2 uppercase tracking-widest text-xs transition-all shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Resetting Password...' : '🔒 Reset Password'}
          </button>
        </form>
      )}

      {/* Footer / Go Back to Login */}
      <div className="mt-6 pt-5 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-500 font-medium">
          Remembered your password?{' '}
          <Link
            to="/login"
            className="text-emerald-600 hover:text-emerald-700 font-medium tracking-wide ml-0.5 underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;

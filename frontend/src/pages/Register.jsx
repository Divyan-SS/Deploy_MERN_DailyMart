// frontend/src/pages/Register.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const tokenClientRef = useRef(null);

  const { userInfo, loading, error, register, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (userInfo) {
      navigate(redirect, { replace: true });
    }
  }, [userInfo, navigate, redirect]);

  useEffect(() => {
    const initGoogleOAuth = () => {
      if (window.google && window.google.accounts) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '542648623708-dte6iq0t02u1qr18esrvfmfnvqvirr2o.apps.googleusercontent.com',
          scope: 'email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                setGoogleLoading(true);
                setGoogleError('');
                await googleLogin(tokenResponse.access_token);
                setGoogleLoading(false);
              } catch (err) {
                setGoogleLoading(false);
                setGoogleError(err.message);
              }
            }
          },
        });
      } else {
        setTimeout(initGoogleOAuth, 150);
      }
    };
    initGoogleOAuth();
  }, [googleLogin]);

  const handleGoogleSignInClick = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    } else {
      setGoogleError('Google Sign-In is initializing. Please wait a moment.');
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setValidationError('');
    setGoogleError('');



    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      await register(name, email, password);
    } catch (err) {
      // handled in context
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white border border-gray-300 rounded-2xl p-8 flex flex-col font-sans text-gray-700 shadow-xs relative overflow-hidden">

      {/* Animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      <div className="text-center mb-6 animate-up">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight uppercase">
          Create Account
        </h2>
        <p className="text-xs text-gray-400 font-medium mt-1">
          Join DailyMart to track orders and subscriptions easily.
        </p>
      </div>

      {(validationError || googleError || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-3 rounded-xl mb-4 animate-up">
          ⚠️ {validationError || googleError || error}
        </div>
      )}

      <form onSubmit={submitHandler} className="space-y-4 animate-up">

        <div>
          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-normal text-gray-800"
          />
        </div>

        <div>
          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="yourname@example.com"
            className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-normal text-gray-800"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium underline"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full border border-gray-300 p-2 pr-10 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-normal text-gray-800 font-sans"
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
          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full border border-gray-300 p-2 pr-10 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-normal text-gray-800 font-sans"
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
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 rounded-lg mt-2 uppercase tracking-widest text-xs transition-all shadow-xs disabled:bg-gray-200 disabled:text-gray-400"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex py-2 items-center animate-up">
        <div className="flex-grow border-t border-gray-200"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-wider">or</span>
        <div className="flex-grow border-t border-gray-200"></div>
      </div>

      {/* Google Login Button */}
      <button
        type="button"
        disabled={loading || googleLoading}
        onClick={handleGoogleSignInClick}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:border-gray-900 active:scale-95 text-gray-700 font-bold py-2.5 px-4 rounded-lg uppercase tracking-wider text-[11px] transition-all shadow-xs cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 animate-up"
      >
        {googleLoading ? (
          <>
            <span className="animate-spin text-sm">⏳</span>
            Connecting Google account...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </>
        )}
      </button>

      <div className="mt-6 pt-5 border-t border-gray-100 text-center animate-up">
        <p className="text-xs text-gray-400 font-medium">
          Already have an account?{' '}
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

export default Register;
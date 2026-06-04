// frontend/src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-white text-gray-700 mt-auto border-t border-gray-200 font-sans">

      <style>{`
        .footer-link {
          transition: all 0.2s ease-in-out;
        }
        .footer-link:hover {
          color: #059669;
          transform: translateY(-1px);
        }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-4 py-4 md:py-8 text-xs animate-fade">
        <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 text-center md:text-left">
          
          {/* Brand & Copy */}
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <Link to="/" className="text-sm font-bold text-emerald-600 tracking-tight flex items-center">
              Daily<span className="text-red-500">Mart</span>
            </Link>
            <p className="text-[10px] text-gray-500 hidden md:block font-bold">
              Your neighborhood online supermarket for fresh groceries. 🛒
            </p>
            <p className="text-[10px] text-gray-500 md:hidden font-bold">
              © 2026 DailyMart. All rights reserved.
            </p>
          </div>

          {/* Links Section */}
          <div className="flex flex-wrap justify-center gap-4 text-[10px] uppercase font-bold text-gray-600">
            <span className="footer-link cursor-pointer">🔒 Privacy</span>
            <span className="footer-link cursor-pointer">📄 Terms</span>
            <span className="footer-link cursor-pointer">📞 Support</span>
            <span className="footer-link cursor-pointer">🛍️ Browse</span>
          </div>

          {/* Stay Connected */}
          <div className="text-center md:text-right text-[10px] text-gray-400 hidden md:block">
            © 2026 DailyMart. All rights reserved.
          </div>
        </div>

        {/* Bottom Note */}
        <div className="mt-4 border-t border-gray-100 pt-2 text-center text-[8px] md:text-[9px] text-gray-400 tracking-widest uppercase">
          Made with care for better daily shopping experience
        </div>
      </div>
    </footer>
  );
};

export default Footer;
import React, { useState } from 'react';
import { Shield, Menu, X } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="h-8 w-8 text-cyan-400" />
              <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-sm"></div>
            </div>
            <h1 className="text-xl font-bold text-white">PhantomWall</h1>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <a href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
              Dashboard
            </a>
            <a href="/alerts" className="text-slate-300 hover:text-white transition-colors">
              Alerts
            </a>
            <a href="/analytics" className="text-slate-300 hover:text-white transition-colors">
              Analytics
            </a>
            <a href="/settings" className="text-slate-300 hover:text-white transition-colors">
              Settings
            </a>
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-700/50">
            <nav className="flex flex-col space-y-3">
              <a href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Dashboard
              </a>
              <a href="/alerts" className="text-slate-300 hover:text-white transition-colors">
                Alerts
              </a>
              <a href="/analytics" className="text-slate-300 hover:text-white transition-colors">
                Analytics
              </a>
              <a href="/settings" className="text-slate-300 hover:text-white transition-colors">
                Settings
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
import React from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">PhantomWall</h3>
            <p className="text-slate-400 text-sm">
              Advanced cybersecurity monitoring and threat detection platform.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-4">Legal</h4>
            <div className="space-y-2">
              <a href="/privacy" className="text-slate-400 hover:text-white transition-colors text-sm block">
                Privacy Policy
              </a>
              <a href="/terms" className="text-slate-400 hover:text-white transition-colors text-sm block">
                Terms of Service
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-4">Connect</h4>
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-700/50 mt-8 pt-8 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 PhantomWall. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
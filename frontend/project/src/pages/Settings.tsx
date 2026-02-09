import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="text-center py-16">
          <h1 className="text-3xl font-bold text-white mb-4">Settings</h1>
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-8">
            <p className="text-slate-400 mb-4">Coming soon</p>
            <p className="text-sm text-slate-500">Use Meku to generate content for this page</p>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
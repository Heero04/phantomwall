import React from 'react';
import Header from '../components/Header';
import HoneypotStatusCard from '../components/HoneypotStatusCard';
import ThreatStatsGrid from '../components/ThreatStatsGrid';
import LiveAlertFeed from '../components/LiveAlertFeed';
import QuickActions from '../components/QuickActions';
import TopAttackOrigins from '../components/TopAttackOrigins';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <section>
            <HoneypotStatusCard />
          </section>
          
          <section>
            <ThreatStatsGrid />
          </section>
          
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <LiveAlertFeed />
            <TopAttackOrigins />
          </section>
          
          <section>
            <QuickActions />
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
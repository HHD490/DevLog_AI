import React from 'react';
import { LayoutDashboard, History, BrainCircuit, PenTool, TreePine, Settings, Plus } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onChangeView: (view: any) => void;
  onOpenInput: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onChangeView, onOpenInput }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'timeline', icon: History, label: 'Timeline' },
    { id: 'brain', icon: BrainCircuit, label: 'Ask Brain' },
    { id: 'blog', icon: PenTool, label: 'Auto-Blog' },
    { id: 'skills', icon: TreePine, label: 'Skill Tree' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between z-20 shadow-sm">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-0 lg:mr-3 shadow-indigo-200 shadow-lg">
              D
            </div>
            <span className="hidden lg:block font-bold text-lg text-slate-800 tracking-tight">DevLog AI</span>
          </div>

          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all duration-200 ${activeView === item.id
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <item.icon className="w-6 h-6 lg:w-5 lg:h-5 lg:mr-3" strokeWidth={2} />
                <span className="hidden lg:block">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-10 sticky top-0">
          <h1 className="text-xl font-semibold capitalize text-slate-800">
            {activeView.replace('-', ' ')}
          </h1>
          <button
            onClick={onOpenInput}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Entry</span>
          </button>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

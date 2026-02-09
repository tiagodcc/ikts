import { useState } from 'react';
import { InventoryProvider } from './context/InventoryContext';
import { PlansProvider } from './context/PlansContext';
import { Inventory } from './components/Inventory';
import { PlanManager } from './components/PlanManager';
import { MaterialOptimizer } from './components/MaterialOptimizer';
import './App.css';

type Tab = 'inventory' | 'plans' | 'optimizer';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'plans', label: 'Plans', icon: '📋' },
    { id: 'optimizer', label: 'Work Order', icon: '📝' },
  ];

  return (
    <InventoryProvider>
      <PlansProvider>
        <div className="app">
          <nav className="app-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          <main className="app-main">
            {activeTab === 'inventory' && <Inventory />}
            {activeTab === 'plans' && <PlanManager />}
            {activeTab === 'optimizer' && <MaterialOptimizer />}
          </main>

          <footer className="app-footer">
            <p>
              💡 Tip: Use remainders from the inventory to minimize waste and improve sustainability
            </p>
          </footer>
        </div>
      </PlansProvider>
    </InventoryProvider>
  );
}

export default App;

import { useState } from 'react';
import { InventoryProvider } from './context/InventoryContext';
import { PlansProvider } from './context/PlansContext';
import { WorkOrderProvider, useWorkOrders } from './context/WorkOrderContext';
import { Inventory } from './components/Inventory';
import { PlanManager } from './components/PlanManager';
import { WorkOrderExecution } from './components/WorkOrderExecution';
import { WorkOrderList } from './components/WorkOrderList';
import type { WorkOrder } from './types';
import './App.css';

type Tab = 'inventory' | 'plans' | 'work-orders';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('work-orders');
  const [activeWorkOrder, setActiveWorkOrder] = useState<WorkOrder | null>(null);
  const { workOrders } = useWorkOrders();

  // Update active work order from context when it changes
  const currentWorkOrder = activeWorkOrder 
    ? workOrders.find(wo => wo.id === activeWorkOrder.id) || null
    : null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'inventory', label: 'Inventory', icon: '' },
    { id: 'plans', label: 'Plans', icon: '' },
    { id: 'work-orders', label: 'Work Orders', icon: '' },
  ];

  const handleSelectWorkOrder = (workOrder: WorkOrder) => {
    setActiveWorkOrder(workOrder);
  };

  const handleBackToList = () => {
    setActiveWorkOrder(null);
  };

  return (
    <div className="app">
      <nav className="app-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'work-orders') {
                setActiveWorkOrder(null);
              }
            }}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'plans' && <PlanManager />}
        {activeTab === 'work-orders' && (
          currentWorkOrder ? (
            <WorkOrderExecution 
              workOrder={currentWorkOrder} 
              onBack={handleBackToList} 
            />
          ) : (
            <WorkOrderList onSelectWorkOrder={handleSelectWorkOrder} />
          )
        )}
      </main>

    </div>
  );
}

function App() {
  return (
    <InventoryProvider>
      <PlansProvider>
        <WorkOrderProvider>
          <AppContent />
        </WorkOrderProvider>
      </PlansProvider>
    </InventoryProvider>
  );
}

export default App;

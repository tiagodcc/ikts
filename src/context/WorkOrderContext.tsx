import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { WorkOrder, WorkOrderStatus, ExecutedCut, FusionBoxPlan, CopperRail } from '../types';
import { generateId } from '../utils/helpers';
import { generateMaterialPlan } from '../utils/optimizer';

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  currentWorkOrder: WorkOrder | null;
  createWorkOrder: (plan: FusionBoxPlan, rails: CopperRail[], notes?: string) => WorkOrder;
  selectWorkOrder: (id: string | null) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  startWorkOrder: (id: string) => void;
  completeWorkOrder: (id: string) => void;
  cancelWorkOrder: (id: string) => void;
  recordCut: (workOrderId: string, cut: Omit<ExecutedCut, 'id' | 'executedAt'>) => void;
  deleteWorkOrder: (id: string) => void;
  getWorkOrdersForPlan: (planId: string) => WorkOrder[];
  updateWorkOrderNotes: (id: string, notes: string) => void;
}

const WorkOrderContext = createContext<WorkOrderContextType | null>(null);

const STORAGE_KEY = 'work-orders';

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((wo: WorkOrder) => ({
          ...wo,
          createdAt: new Date(wo.createdAt),
          startedAt: wo.startedAt ? new Date(wo.startedAt) : undefined,
          completedAt: wo.completedAt ? new Date(wo.completedAt) : undefined,
          executedCuts: wo.executedCuts.map((cut: ExecutedCut) => ({
            ...cut,
            executedAt: new Date(cut.executedAt),
          })),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [currentWorkOrderId, setCurrentWorkOrderId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workOrders));
  }, [workOrders]);

  const currentWorkOrder = currentWorkOrderId
    ? workOrders.find((wo) => wo.id === currentWorkOrderId) || null
    : null;

  const createWorkOrder = (plan: FusionBoxPlan, rails: CopperRail[], notes?: string): WorkOrder => {
    // Generate and snapshot the material plan at creation time
    const materialPlanSnapshot = generateMaterialPlan(plan, rails);

    const newWorkOrder: WorkOrder = {
      id: generateId(),
      planId: plan.id,
      planName: plan.name,
      status: 'draft',
      createdAt: new Date(),
      executedCuts: [],
      notes,
      materialPlanSnapshot,
    };
    setWorkOrders((prev) => [...prev, newWorkOrder]);
    return newWorkOrder;
  };

  const selectWorkOrder = (id: string | null) => {
    setCurrentWorkOrderId(id);
  };

  const updateWorkOrderStatus = (id: string, status: WorkOrderStatus) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== id) return wo;
        
        const updates: Partial<WorkOrder> = { status };
        
        if (status === 'in-progress' && !wo.startedAt) {
          updates.startedAt = new Date();
        }
        if (status === 'completed' || status === 'cancelled') {
          updates.completedAt = new Date();
        }
        
        return { ...wo, ...updates };
      })
    );
  };

  const startWorkOrder = (id: string) => {
    updateWorkOrderStatus(id, 'in-progress');
  };

  const completeWorkOrder = (id: string) => {
    updateWorkOrderStatus(id, 'completed');
  };

  const cancelWorkOrder = (id: string) => {
    updateWorkOrderStatus(id, 'cancelled');
  };

  const recordCut = (workOrderId: string, cut: Omit<ExecutedCut, 'id' | 'executedAt'>) => {
    const newCut: ExecutedCut = {
      ...cut,
      id: generateId(),
      executedAt: new Date(),
    };

    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === workOrderId
          ? {
              ...wo,
              executedCuts: [...wo.executedCuts, newCut],
              status: wo.status === 'draft' ? 'in-progress' : wo.status,
              startedAt: wo.startedAt || new Date(),
            }
          : wo
      )
    );
  };

  const deleteWorkOrder = (id: string) => {
    setWorkOrders((prev) => prev.filter((wo) => wo.id !== id));
    if (currentWorkOrderId === id) {
      setCurrentWorkOrderId(null);
    }
  };

  const getWorkOrdersForPlan = (planId: string): WorkOrder[] => {
    return workOrders.filter((wo) => wo.planId === planId);
  };

  const updateWorkOrderNotes = (id: string, notes: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) => (wo.id === id ? { ...wo, notes } : wo))
    );
  };

  return (
    <WorkOrderContext.Provider
      value={{
        workOrders,
        currentWorkOrder,
        createWorkOrder,
        selectWorkOrder,
        updateWorkOrderStatus,
        startWorkOrder,
        completeWorkOrder,
        cancelWorkOrder,
        recordCut,
        deleteWorkOrder,
        getWorkOrdersForPlan,
        updateWorkOrderNotes,
      }}
    >
      {children}
    </WorkOrderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkOrders() {
  const context = useContext(WorkOrderContext);
  if (!context) {
    throw new Error('useWorkOrders must be used within a WorkOrderProvider');
  }
  return context;
}

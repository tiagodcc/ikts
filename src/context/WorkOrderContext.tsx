import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { 
  WorkOrder, 
  WorkOrderStatus, 
  WorkOrderPhase,
  ExecutedCut, 
  FusionBoxPlan, 
  CopperRail,
  GatheringStep,
  CuttingStep,
  MaterialPlan
} from '../types';
import { generateId } from '../utils/helpers';
import { generateMaterialPlan } from '../utils/optimizer';

// Helper to generate gathering steps from material plan
function generateGatheringSteps(materialPlan: MaterialPlan): GatheringStep[] {
  // Group by source rail to avoid duplicates
  const railMap = new Map<string, GatheringStep>();
  
  for (const suggestion of materialPlan.suggestions) {
    const key = suggestion.sourceRail.id;
    if (!railMap.has(key)) {
      railMap.set(key, {
        id: generateId(),
        railType: suggestion.piece.railType,
        sourceRailId: suggestion.sourceRail.id,
        length: suggestion.sourceRail.length,
        isRemainder: suggestion.sourceRail.isRemainder,
        isFromNewStock: !suggestion.sourceRail.isRemainder && !suggestion.sourceRail.id.includes('inventory'),
        confirmed: false,
      });
    }
  }
  
  // Sort: new rails first, then remainders, grouped by type
  return Array.from(railMap.values()).sort((a, b) => {
    // First by isRemainder (new rails first)
    if (a.isRemainder !== b.isRemainder) return a.isRemainder ? 1 : -1;
    // Then by rail type label
    return a.railType.label.localeCompare(b.railType.label);
  });
}

// Helper to generate cutting steps from material plan
function generateCuttingSteps(materialPlan: MaterialPlan): CuttingStep[] {
  return materialPlan.suggestions.map((suggestion, index) => ({
    id: generateId(),
    suggestionIndex: index,
    sourceRailId: suggestion.sourceRail.id,
    pieceId: suggestion.piece.id,
    railType: suggestion.piece.railType,
    sourceLength: suggestion.sourceRail.length,
    cutLength: suggestion.piece.length,
    remainderLength: suggestion.remainderLength,
    wasteLength: suggestion.waste,
    purpose: suggestion.piece.purpose,
    confirmed: false,
  }));
}

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  currentWorkOrder: WorkOrder | null;
  createWorkOrder: (plan: FusionBoxPlan, rails: CopperRail[], notes?: string) => WorkOrder;
  selectWorkOrder: (id: string | null) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  startWorkOrder: (id: string) => void;
  completeWorkOrder: (id: string) => void;
  cancelWorkOrder: (id: string) => void;
  deleteWorkOrder: (id: string) => void;
  getWorkOrdersForPlan: (planId: string) => WorkOrder[];
  updateWorkOrderNotes: (id: string, notes: string) => void;
  
  // Phase management
  confirmGatheringStep: (workOrderId: string, stepId: string) => void;
  confirmCuttingStep: (workOrderId: string, stepId: string) => void;
  confirmReturn: (workOrderId: string, notes?: string) => void;
  advancePhase: (workOrderId: string) => void;
  canAdvancePhase: (workOrder: WorkOrder) => boolean;
  
  // Legacy
  recordCut: (workOrderId: string, cut: Omit<ExecutedCut, 'id' | 'executedAt'>) => void;
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
          phase: wo.phase || 'gathering',
          gatheringSteps: wo.gatheringSteps || [],
          cuttingSteps: wo.cuttingSteps || [],
          returnConfirmation: wo.returnConfirmation || { confirmed: false },
          createdAt: new Date(wo.createdAt),
          startedAt: wo.startedAt ? new Date(wo.startedAt) : undefined,
          completedAt: wo.completedAt ? new Date(wo.completedAt) : undefined,
          executedCuts: (wo.executedCuts || []).map((cut: ExecutedCut) => ({
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
    
    // Generate steps for each phase
    const gatheringSteps = generateGatheringSteps(materialPlanSnapshot);
    const cuttingSteps = generateCuttingSteps(materialPlanSnapshot);

    const newWorkOrder: WorkOrder = {
      id: generateId(),
      planId: plan.id,
      planName: plan.name,
      status: 'draft',
      phase: 'gathering',
      createdAt: new Date(),
      gatheringSteps,
      cuttingSteps,
      returnConfirmation: { confirmed: false },
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
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== id) return wo;
        return {
          ...wo,
          status: 'completed' as WorkOrderStatus,
          phase: 'completed' as WorkOrderPhase,
          completedAt: new Date(),
        };
      })
    );
  };

  const cancelWorkOrder = (id: string) => {
    updateWorkOrderStatus(id, 'cancelled');
  };

  // Phase management functions
  const confirmGatheringStep = (workOrderId: string, stepId: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== workOrderId) return wo;
        return {
          ...wo,
          status: wo.status === 'draft' ? 'in-progress' as WorkOrderStatus : wo.status,
          startedAt: wo.startedAt || new Date(),
          gatheringSteps: wo.gatheringSteps.map((step) =>
            step.id === stepId
              ? { ...step, confirmed: true, confirmedAt: new Date() }
              : step
          ),
        };
      })
    );
  };

  const confirmCuttingStep = (workOrderId: string, stepId: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== workOrderId) return wo;
        
        const updatedCuttingSteps = wo.cuttingSteps.map((step) =>
          step.id === stepId
            ? { ...step, confirmed: true, confirmedAt: new Date() }
            : step
        );
        
        // Also record the cut for legacy compatibility
        const step = wo.cuttingSteps.find(s => s.id === stepId);
        const newExecutedCut: ExecutedCut | null = step ? {
          id: generateId(),
          suggestionIndex: step.suggestionIndex,
          pieceId: step.pieceId,
          sourceRailId: step.sourceRailId,
          cutLength: step.cutLength,
          executedAt: new Date(),
        } : null;
        
        return {
          ...wo,
          cuttingSteps: updatedCuttingSteps,
          executedCuts: newExecutedCut 
            ? [...wo.executedCuts, newExecutedCut]
            : wo.executedCuts,
        };
      })
    );
  };

  const confirmReturn = (workOrderId: string, notes?: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== workOrderId) return wo;
        return {
          ...wo,
          returnConfirmation: {
            confirmed: true,
            confirmedAt: new Date(),
            notes,
          },
        };
      })
    );
  };

  const canAdvancePhase = (workOrder: WorkOrder): boolean => {
    switch (workOrder.phase) {
      case 'gathering':
        return workOrder.gatheringSteps.every((step) => step.confirmed);
      case 'cutting':
        return workOrder.cuttingSteps.every((step) => step.confirmed);
      case 'returning':
        return workOrder.returnConfirmation.confirmed;
      default:
        return false;
    }
  };

  const advancePhase = (workOrderId: string) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== workOrderId) return wo;
        if (!canAdvancePhase(wo)) return wo;
        
        const phaseOrder: WorkOrderPhase[] = ['gathering', 'cutting', 'returning', 'completed'];
        const currentIndex = phaseOrder.indexOf(wo.phase);
        const nextPhase = phaseOrder[currentIndex + 1];
        
        if (!nextPhase) return wo;
        
        const updates: Partial<WorkOrder> = {
          phase: nextPhase,
        };
        
        if (nextPhase === 'completed') {
          updates.status = 'completed';
          updates.completedAt = new Date();
        }
        
        return { ...wo, ...updates };
      })
    );
  };

  // Legacy function
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
              status: wo.status === 'draft' ? 'in-progress' as WorkOrderStatus : wo.status,
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
        deleteWorkOrder,
        getWorkOrdersForPlan,
        updateWorkOrderNotes,
        confirmGatheringStep,
        confirmCuttingStep,
        confirmReturn,
        advancePhase,
        canAdvancePhase,
        recordCut,
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

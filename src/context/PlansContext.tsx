import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { FusionBoxPlan, CutPiece } from '../types';
import { generateId } from '../utils/helpers';

interface PlansContextType {
  plans: FusionBoxPlan[];
  currentPlan: FusionBoxPlan | null;
  addPlan: (plan: Omit<FusionBoxPlan, 'id' | 'createdAt' | 'updatedAt'>) => FusionBoxPlan;
  removePlan: (id: string) => void;
  updatePlan: (id: string, updates: Partial<FusionBoxPlan>) => void;
  selectPlan: (id: string | null) => void;
  addPieceToPlan: (planId: string, piece: Omit<CutPiece, 'id'>) => void;
  removePieceFromPlan: (planId: string, pieceId: string) => void;
  updatePieceInPlan: (planId: string, pieceId: string, updates: Partial<CutPiece>) => void;
  importPlan: (plan: FusionBoxPlan) => void;
  duplicatePlan: (id: string) => FusionBoxPlan | null;
  addExamplePlan: () => void;
}

const PlansContext = createContext<PlansContextType | null>(null);

const STORAGE_KEY = 'fusion-box-plans';

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<FusionBoxPlan[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((p: FusionBoxPlan) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const currentPlan = currentPlanId
    ? plans.find((p) => p.id === currentPlanId) || null
    : null;

  const addPlan = (plan: Omit<FusionBoxPlan, 'id' | 'createdAt' | 'updatedAt'>): FusionBoxPlan => {
    const newPlan: FusionBoxPlan = {
      ...plan,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPlans((prev) => [...prev, newPlan]);
    return newPlan;
  };

  const removePlan = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (currentPlanId === id) {
      setCurrentPlanId(null);
    }
  };

  const updatePlan = (id: string, updates: Partial<FusionBoxPlan>) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
      )
    );
  };

  const selectPlan = (id: string | null) => {
    setCurrentPlanId(id);
  };

  const addPieceToPlan = (planId: string, piece: Omit<CutPiece, 'id'>) => {
    const newPiece: CutPiece = {
      ...piece,
      id: generateId(),
    };
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              requiredPieces: [...p.requiredPieces, newPiece],
              updatedAt: new Date(),
            }
          : p
      )
    );
  };

  const removePieceFromPlan = (planId: string, pieceId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              requiredPieces: p.requiredPieces.filter((pc) => pc.id !== pieceId),
              updatedAt: new Date(),
            }
          : p
      )
    );
  };

  const updatePieceInPlan = (
    planId: string,
    pieceId: string,
    updates: Partial<CutPiece>
  ) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              requiredPieces: p.requiredPieces.map((pc) =>
                pc.id === pieceId ? { ...pc, ...updates } : pc
              ),
              updatedAt: new Date(),
            }
          : p
      )
    );
  };

  const importPlan = (plan: FusionBoxPlan) => {
    const importedPlan: FusionBoxPlan = {
      ...plan,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      requiredPieces: plan.requiredPieces.map((p) => ({
        ...p,
        id: generateId(),
      })),
    };
    setPlans((prev) => [...prev, importedPlan]);
  };

  const duplicatePlan = (id: string): FusionBoxPlan | null => {
    const original = plans.find((p) => p.id === id);
    if (!original) return null;

    const duplicate: FusionBoxPlan = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      requiredPieces: original.requiredPieces.map((p) => ({
        ...p,
        id: generateId(),
      })),
    };
    setPlans((prev) => [...prev, duplicate]);
    return duplicate;
  };

  const addExamplePlan = () => {
    const examplePlan: FusionBoxPlan = {
      id: generateId(),
      name: 'Distribution Cabinet Type A',
      description: 'Standard 3-phase distribution cabinet with main bus bars and branch connections',
      createdAt: new Date(),
      updatedAt: new Date(),
      requiredPieces: [
        { id: generateId(), length: 500, quantity: 3, purpose: 'Main bus bar (L1, L2, L3)', railType: { width: 30, thickness: 10, label: '30×10mm' } },
        { id: generateId(), length: 400, quantity: 1, purpose: 'Neutral bus bar', railType: { width: 20, thickness: 5, label: '20×5mm' } },
        { id: generateId(), length: 300, quantity: 1, purpose: 'PE ground bar', railType: { width: 20, thickness: 5, label: '20×5mm' } },
        { id: generateId(), length: 150, quantity: 6, purpose: 'Branch connections', railType: { width: 12, thickness: 5, label: '12×5mm' } },
        { id: generateId(), length: 100, quantity: 12, purpose: 'Circuit breaker links', railType: { width: 12, thickness: 5, label: '12×5mm' } },
        { id: generateId(), length: 80, quantity: 8, purpose: 'Cross connectors', railType: { width: 10, thickness: 3, label: '10×3mm' } },
      ],
    };
    setPlans((prev) => [...prev, examplePlan]);
    setCurrentPlanId(examplePlan.id);
  };

  return (
    <PlansContext.Provider
      value={{
        plans,
        currentPlan,
        addPlan,
        removePlan,
        updatePlan,
        selectPlan,
        addPieceToPlan,
        removePieceFromPlan,
        updatePieceInPlan,
        importPlan,
        duplicatePlan,
        addExamplePlan,
      }}
    >
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans() {
  const context = useContext(PlansContext);
  if (!context) {
    throw new Error('usePlans must be used within PlansProvider');
  }
  return context;
}

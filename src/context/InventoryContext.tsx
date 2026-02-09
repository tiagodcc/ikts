import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CopperRail, InventoryStats, RailType } from '../types';
import { generateId } from '../utils/helpers';

interface InventoryContextType {
  rails: CopperRail[];
  addRail: (rail: Omit<CopperRail, 'id' | 'createdAt'>) => void;
  removeRail: (id: string) => void;
  updateRail: (id: string, updates: Partial<CopperRail>) => void;
  cutRail: (railId: string, cutLength: number, purpose?: string) => CopperRail | null;
  getStats: () => InventoryStats;
  getRailsByType: (type: RailType) => CopperRail[];
  clearInventory: () => void;
  importInventory: (rails: CopperRail[]) => void;
  exportInventory: () => CopperRail[];
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const STORAGE_KEY = 'copper-rail-inventory';

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [rails, setRails] = useState<CopperRail[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((r: CopperRail) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rails));
  }, [rails]);

  const addRail = (rail: Omit<CopperRail, 'id' | 'createdAt'>) => {
    const newRail: CopperRail = {
      ...rail,
      id: generateId(),
      createdAt: new Date(),
    };
    setRails((prev) => [...prev, newRail]);
  };

  const removeRail = (id: string) => {
    setRails((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRail = (id: string, updates: Partial<CopperRail>) => {
    setRails((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const cutRail = (railId: string, cutLength: number, purpose?: string): CopperRail | null => {
    const rail = rails.find((r) => r.id === railId);
    if (!rail || rail.length < cutLength) {
      return null;
    }

    const remainderLength = rail.length - cutLength;
    
    if (remainderLength > 0) {
      // Create remainder piece
      const remainder: CopperRail = {
        id: generateId(),
        length: remainderLength,
        width: rail.width,
        thickness: rail.thickness,
        isRemainder: true,
        originalRailId: rail.id,
        createdAt: new Date(),
        notes: `Remainder from cutting ${cutLength}mm${purpose ? ` for ${purpose}` : ''}`,
      };

      // Remove original rail and add remainder
      setRails((prev) => [
        ...prev.filter((r) => r.id !== railId),
        remainder,
      ]);

      return remainder;
    } else {
      // Rail completely used, just remove it
      removeRail(railId);
      return null;
    }
  };

  const getStats = (): InventoryStats => {
    const stats: InventoryStats = {
      totalRails: rails.length,
      totalLength: rails.reduce((sum, r) => sum + r.length, 0),
      remainderCount: rails.filter((r) => r.isRemainder).length,
      remainderLength: rails
        .filter((r) => r.isRemainder)
        .reduce((sum, r) => sum + r.length, 0),
      byType: {},
    };

    for (const rail of rails) {
      const typeKey = `${rail.width}×${rail.thickness}mm`;
      if (!stats.byType[typeKey]) {
        stats.byType[typeKey] = { count: 0, totalLength: 0 };
      }
      stats.byType[typeKey].count++;
      stats.byType[typeKey].totalLength += rail.length;
    }

    return stats;
  };

  const getRailsByType = (type: RailType): CopperRail[] => {
    return rails.filter(
      (r) => r.width === type.width && r.thickness === type.thickness
    );
  };

  const clearInventory = () => {
    setRails([]);
  };

  const importInventory = (newRails: CopperRail[]) => {
    const processedRails = newRails.map((r) => ({
      ...r,
      id: generateId(),
      createdAt: new Date(r.createdAt),
    }));
    setRails((prev) => [...prev, ...processedRails]);
  };

  const exportInventory = (): CopperRail[] => {
    return rails;
  };

  return (
    <InventoryContext.Provider
      value={{
        rails,
        addRail,
        removeRail,
        updateRail,
        cutRail,
        getStats,
        getRailsByType,
        clearInventory,
        importInventory,
        exportInventory,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}

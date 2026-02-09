import type {
  CopperRail,
  CutPiece,
  CutSuggestion,
  MaterialPlan,
  FusionBoxPlan,
} from '../types';
import {
  MIN_USABLE_LENGTH,
  STANDARD_RAIL_LENGTHS,
} from '../types';
import { generateId } from './helpers';

/**
 * Find the best rail from inventory to cut a specific piece
 * Prioritizes:
 * 1. Remainders over new rails (sustainability)
 * 2. Shortest rail that fits (minimize waste)
 * 3. Exact matches first
 */
export function findBestRailForPiece(
  inventory: CopperRail[],
  piece: CutPiece
): CutSuggestion | null {
  // Filter rails that match the type and have sufficient length
  const compatibleRails = inventory.filter(
    (rail) =>
      rail.width === piece.railType.width &&
      rail.thickness === piece.railType.thickness &&
      rail.length >= piece.length
  );

  if (compatibleRails.length === 0) {
    return null;
  }

  // Sort by preference: remainders first, then by length (shortest first)
  const sortedRails = compatibleRails.sort((a, b) => {
    // Prioritize remainders
    if (a.isRemainder !== b.isRemainder) {
      return a.isRemainder ? -1 : 1;
    }
    // Then sort by length (shortest first to minimize waste)
    return a.length - b.length;
  });

  const bestRail = sortedRails[0];
  const remainderLength = bestRail.length - piece.length;
  const waste = remainderLength < MIN_USABLE_LENGTH ? remainderLength : 0;

  return {
    sourceRail: bestRail,
    piece,
    remainderLength: remainderLength >= MIN_USABLE_LENGTH ? remainderLength : 0,
    waste,
    isOptimal: bestRail.isRemainder || remainderLength < MIN_USABLE_LENGTH,
  };
}

/**
 * Generate a complete material plan for a fusion box
 * Uses First Fit Decreasing algorithm for bin packing optimization
 */
export function generateMaterialPlan(
  plan: FusionBoxPlan,
  inventory: CopperRail[]
): MaterialPlan {
  const suggestions: CutSuggestion[] = [];
  let totalWaste = 0;
  let usedRemainders = 0;
  let newRailsNeeded = 0;

  // Expand pieces by quantity and sort by length (longest first - FFD algorithm)
  const expandedPieces: CutPiece[] = [];
  for (const piece of plan.requiredPieces) {
    for (let i = 0; i < piece.quantity; i++) {
      expandedPieces.push({ ...piece, quantity: 1, id: generateId() });
    }
  }
  expandedPieces.sort((a, b) => b.length - a.length);

  // Create a working copy of inventory
  const workingInventory = inventory.map((rail) => ({ ...rail }));

  for (const piece of expandedPieces) {
    const suggestion = findBestRailForPiece(workingInventory, piece);

    if (suggestion) {
      // Update working inventory
      const railIndex = workingInventory.findIndex(
        (r) => r.id === suggestion.sourceRail.id
      );
      
      if (railIndex !== -1) {
        if (suggestion.remainderLength >= MIN_USABLE_LENGTH) {
          // Replace with remainder
          workingInventory[railIndex] = {
            ...workingInventory[railIndex],
            length: suggestion.remainderLength,
            isRemainder: true,
            originalRailId: suggestion.sourceRail.id,
          };
        } else {
          // Remove rail completely
          workingInventory.splice(railIndex, 1);
        }
      }

      if (suggestion.sourceRail.isRemainder) {
        usedRemainders++;
      }
      totalWaste += suggestion.waste;
      suggestions.push(suggestion);
    } else {
      // Need to get a new rail from stock
      const standardLength = findSmallestSufficientStandardRail(piece.length);
      const newRail: CopperRail = {
        id: generateId(),
        length: standardLength,
        width: piece.railType.width,
        thickness: piece.railType.thickness,
        isRemainder: false,
        createdAt: new Date(),
      };

      const remainderLength = standardLength - piece.length;
      const waste = remainderLength < MIN_USABLE_LENGTH ? remainderLength : 0;

      suggestions.push({
        sourceRail: newRail,
        piece,
        remainderLength: remainderLength >= MIN_USABLE_LENGTH ? remainderLength : 0,
        waste,
        isOptimal: false,
      });

      // Add remainder to working inventory if usable
      if (remainderLength >= MIN_USABLE_LENGTH) {
        workingInventory.push({
          ...newRail,
          length: remainderLength,
          isRemainder: true,
          originalRailId: newRail.id,
        });
      }

      newRailsNeeded++;
      totalWaste += waste;
    }
  }

  return {
    plan,
    suggestions,
    totalWaste,
    usedRemainders,
    newRailsNeeded,
  };
}

/**
 * Find the smallest standard rail length that can accommodate the required length
 */
function findSmallestSufficientStandardRail(requiredLength: number): number {
  for (const standardLength of STANDARD_RAIL_LENGTHS) {
    if (standardLength >= requiredLength) {
      return standardLength;
    }
  }
  return STANDARD_RAIL_LENGTHS[STANDARD_RAIL_LENGTHS.length - 1];
}

/**
 * Calculate cutting optimization score (0-100)
 * Higher is better
 */
export function calculateOptimizationScore(plan: MaterialPlan): number {
  const totalMaterialUsed = plan.suggestions.reduce(
    (sum, s) => sum + s.sourceRail.length,
    0
  );
  const totalRequired = plan.suggestions.reduce(
    (sum, s) => sum + s.piece.length,
    0
  );

  if (totalMaterialUsed === 0) return 100;

  const efficiency = (totalRequired / totalMaterialUsed) * 100;
  const remainderBonus = plan.usedRemainders * 5; // Bonus for using remainders

  return Math.min(100, Math.round(efficiency + remainderBonus));
}

/**
 * Group cut suggestions by rail type for display
 */
export function groupSuggestionsByType(
  suggestions: CutSuggestion[]
): Map<string, CutSuggestion[]> {
  const groups = new Map<string, CutSuggestion[]>();

  for (const suggestion of suggestions) {
    const key = suggestion.piece.railType.label;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(suggestion);
  }

  return groups;
}

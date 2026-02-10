// Types for copper rail inventory management system

export interface CopperRail {
  id: string;
  length: number; // in mm
  width: number; // in mm (cross-section width)
  thickness: number; // in mm (cross-section thickness)
  isRemainder: boolean; // true if this is a leftover piece from a cut
  originalRailId?: string; // reference to the original rail if this is a remainder
  createdAt: Date;
  notes?: string;
}

export interface RailType {
  width: number;
  thickness: number;
  label: string; // e.g., "10x3mm", "12x5mm"
}

export interface CutPiece {
  id: string;
  length: number;
  quantity: number;
  purpose: string; // description of what this piece is for
  railType: RailType;
}

export interface FusionBoxPlan {
  id: string;
  name: string;
  description?: string;
  requiredPieces: CutPiece[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CutSuggestion {
  sourceRail: CopperRail;
  piece: CutPiece;
  remainderLength: number;
  waste: number; // length that would be too small to use
  isOptimal: boolean;
}

export interface MaterialPlan {
  plan: FusionBoxPlan;
  suggestions: CutSuggestion[];
  totalWaste: number;
  usedRemainders: number;
  newRailsNeeded: number;
}

export interface InventoryStats {
  totalRails: number;
  totalLength: number;
  remainderCount: number;
  remainderLength: number;
  byType: Record<string, { count: number; totalLength: number }>;
}

// Standard copper rail lengths available for purchase (in mm)
export const STANDARD_RAIL_LENGTHS = [1000, 2000, 3000, 6000];

// Common rail types (width x thickness in mm)
export const COMMON_RAIL_TYPES: RailType[] = [
  { width: 10, thickness: 3, label: '10×3mm' },
  { width: 12, thickness: 5, label: '12×5mm' },
  { width: 15, thickness: 5, label: '15×5mm' },
  { width: 20, thickness: 5, label: '20×5mm' },
  { width: 20, thickness: 10, label: '20×10mm' },
  { width: 25, thickness: 5, label: '25×5mm' },
  { width: 30, thickness: 5, label: '30×5mm' },
  { width: 30, thickness: 10, label: '30×10mm' },
  { width: 40, thickness: 5, label: '40×5mm' },
  { width: 40, thickness: 10, label: '40×10mm' },
];

// Minimum usable remainder length (in mm)
export const MIN_USABLE_LENGTH = 50;

// Work Order Phases - strict sequential flow
export type WorkOrderPhase = 
  | 'gathering'    // Engineer gathers parts from boxes
  | 'cutting'      // Engineer cuts parts according to plan
  | 'returning'    // Engineer returns remainders and disposes waste
  | 'completed';   // Work order finished

// Work Order Status
export type WorkOrderStatus = 'draft' | 'in-progress' | 'completed' | 'cancelled';

// Gathering Step - tracks each part that needs to be gathered
export interface GatheringStep {
  id: string;
  railType: RailType;
  sourceRailId: string;
  length: number;
  isRemainder: boolean;
  isFromNewStock: boolean; // true if this needs to be taken from new stock
  confirmed: boolean;
  confirmedAt?: Date;
}

// Cutting Step - tracks each cut that needs to be made
export interface CuttingStep {
  id: string;
  suggestionIndex: number;
  sourceRailId: string;
  pieceId: string;
  railType: RailType;
  sourceLength: number;
  cutLength: number;
  remainderLength: number;
  wasteLength: number;
  purpose: string;
  confirmed: boolean;
  confirmedAt?: Date;
}

// Return Step - confirmation that parts were returned
export interface ReturnConfirmation {
  confirmed: boolean;
  confirmedAt?: Date;
  notes?: string;
}

// Executed Cut - tracks actual cuts made during work order execution
export interface ExecutedCut {
  id: string;
  suggestionIndex: number; // reference to the original suggestion
  pieceId: string;
  sourceRailId: string;
  cutLength: number;
  executedAt: Date;
  executedBy?: string;
}

// Work Order - represents a single execution instance of a plan
export interface WorkOrder {
  id: string;
  planId: string;
  planName: string; // snapshot of plan name at creation
  status: WorkOrderStatus;
  phase: WorkOrderPhase;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Phase tracking
  gatheringSteps: GatheringStep[];
  cuttingSteps: CuttingStep[];
  returnConfirmation: ReturnConfirmation;
  
  // Legacy field for compatibility
  executedCuts: ExecutedCut[];
  notes?: string;
  
  // Snapshot of the material plan at work order creation
  materialPlanSnapshot?: MaterialPlan;
}

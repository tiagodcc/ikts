import { useState, useMemo } from 'react';
import { usePlans } from '../context/PlansContext';
import { useInventory } from '../context/InventoryContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { generateMaterialPlan, groupSuggestionsByType } from '../utils/optimizer';
import { formatLength } from '../utils/helpers';
import type { MaterialPlan, CutSuggestion, WorkOrder } from '../types';
import fusionBoxImage from '../assets/fusion-box.png';
import './MaterialOptimizer.css';

interface MaterialOptimizerProps {
  workOrder?: WorkOrder | null;
  onBack?: () => void;
}

export function MaterialOptimizer({ workOrder, onBack }: MaterialOptimizerProps) {
  const { currentPlan, plans, selectPlan } = usePlans();
  const { rails, cutRail, addRail } = useInventory();
  const { recordCut, completeWorkOrder, startWorkOrder } = useWorkOrders();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [executedCuts, setExecutedCuts] = useState<Set<string>>(() => {
    // Initialize with already executed cuts from work order
    if (workOrder) {
      return new Set(workOrder.executedCuts.map(c => c.pieceId));
    }
    return new Set();
  });

  // Use work order's plan or selected plan
  const planToOptimize = workOrder 
    ? plans.find(p => p.id === workOrder.planId) 
    : selectedPlanId 
      ? plans.find(p => p.id === selectedPlanId) 
      : currentPlan;

  // Use work order's snapshot if available, otherwise generate fresh
  const materialPlan: MaterialPlan | null = useMemo(() => {
    if (workOrder?.materialPlanSnapshot) {
      return workOrder.materialPlanSnapshot;
    }
    if (!planToOptimize || planToOptimize.requiredPieces.length === 0) {
      return null;
    }
    return generateMaterialPlan(planToOptimize, rails);
  }, [workOrder, planToOptimize, rails]);

  const suggestionGroups = materialPlan 
    ? groupSuggestionsByType(materialPlan.suggestions)
    : new Map();

  const handleExecuteCut = (suggestion: CutSuggestion, suggestionIndex: number) => {
    const railInInventory = rails.find(r => r.id === suggestion.sourceRail.id);
    
    if (railInInventory) {
      // Rail exists in inventory, perform the cut
      cutRail(railInInventory.id, suggestion.piece.length, suggestion.piece.purpose);
    } else {
      // Need to add a new rail and then cut it
      addRail({
        length: suggestion.sourceRail.length,
        width: suggestion.sourceRail.width,
        thickness: suggestion.sourceRail.thickness,
        isRemainder: false,
        notes: 'Added for cutting',
      });
    }

    // Record cut in work order if one is active
    if (workOrder) {
      recordCut(workOrder.id, {
        suggestionIndex,
        pieceId: suggestion.piece.id,
        sourceRailId: suggestion.sourceRail.id,
        cutLength: suggestion.piece.length,
      });
      
      // Start work order if it was in draft
      if (workOrder.status === 'draft') {
        startWorkOrder(workOrder.id);
      }
    }

    setExecutedCuts(prev => new Set([...prev, suggestion.piece.id]));
  };

  const handleExecuteAll = () => {
    if (!materialPlan) return;
    
    if (!confirm('Execute all cuts? This will modify your inventory.')) return;

    materialPlan.suggestions.forEach((suggestion, index) => {
      if (!executedCuts.has(suggestion.piece.id)) {
        handleExecuteCut(suggestion, index);
      }
    });
  };

  const handleCompleteWorkOrder = () => {
    if (!workOrder) return;
    if (confirm('Mark this work order as completed?')) {
      completeWorkOrder(workOrder.id);
      onBack?.();
    }
  };

  // Calculate parts to fetch from storage
  const partsToFetch = useMemo(() => {
    if (!materialPlan) return [];
    
    const railUsage = new Map<string, { railType: string; length: number; isRemainder: boolean; count: number }>();
    
    for (const suggestion of materialPlan.suggestions) {
      const key = `${suggestion.sourceRail.id}`;
      const existing = railUsage.get(key);
      if (existing) {
        existing.count++;
      } else {
        railUsage.set(key, {
          railType: suggestion.piece.railType.label,
          length: suggestion.sourceRail.length,
          isRemainder: suggestion.sourceRail.isRemainder,
          count: 1
        });
      }
    }
    
    // Group by type and length
    const grouped = new Map<string, { railType: string; length: number; quantity: number; isRemainder: boolean }>(); 
    for (const [, info] of railUsage.entries()) {
      const groupKey = `${info.railType}-${info.length}-${info.isRemainder}`;
      const existing = grouped.get(groupKey);
      if (existing) {
        existing.quantity++;
      } else {
        grouped.set(groupKey, {
          railType: info.railType,
          length: info.length,
          quantity: 1,
          isRemainder: info.isRemainder
        });
      }
    }
    
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isRemainder !== b.isRemainder) return a.isRemainder ? 1 : -1;
      return a.railType.localeCompare(b.railType);
    });
  }, [materialPlan]);

  return (
    <div className="material-optimizer">
      <div className="optimizer-header">
        {workOrder ? (
          <>
            <button className="btn btn-secondary" onClick={onBack}>
              ← Back to Work Orders
            </button>
            <div className="work-order-title">
              <h2>{workOrder.planName}</h2>
              <span className={`wo-status-badge wo-status-${workOrder.status}`}>
                {workOrder.status === 'draft' && 'Draft'}
                {workOrder.status === 'in-progress' && 'In Progress'}
                {workOrder.status === 'completed' && 'Completed'}
                {workOrder.status === 'cancelled' && 'Cancelled'}
              </span>
            </div>
          </>
        ) : (
          <>
            <h2>Work Order</h2>
            <div className="plan-selector">
              <label>Select Plan:</label>
              <select
                value={selectedPlanId || currentPlan?.id || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPlanId(id || null);
                  if (id) selectPlan(id);
                  setExecutedCuts(new Set());
                }}
              >
                <option value="">-- Select a plan --</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.requiredPieces.reduce((s, p) => s + p.quantity, 0)} pieces)
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {!planToOptimize && !workOrder ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <h3>No Plan Selected</h3>
          <p>Select a fusion box plan to generate optimized cutting suggestions</p>
        </div>
      ) : !materialPlan ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <h3>Empty Plan</h3>
          <p>The selected plan has no required pieces. Add materials to the plan first.</p>
        </div>
      ) : (
        <>
          {/* Fusion Box Reference Image */}
          <div className="plan-reference">
            <div className="reference-image-container">
              <h3>Fusion Box Reference</h3>
              <img src={fusionBoxImage} alt="Fusion Box Diagram" className="reference-image" />
            </div>
            <div className="plan-info">
              <h3>{workOrder?.planName || planToOptimize?.name}</h3>
              {planToOptimize?.description && <p className="plan-description">{planToOptimize.description}</p>}
            </div>
          </div>

          {/* Parts to Fetch from Storage */}
          <div className="fetch-section">
            <h3>Parts to Fetch</h3>
            <div className="fetch-grid">
              {partsToFetch.filter(p => !p.isRemainder).length > 0 && (
                <div className="fetch-category">
                  <h4>New Rails from Stock</h4>
                  <div className="fetch-items">
                    {partsToFetch.filter(p => !p.isRemainder).map((part, i) => (
                      <div key={i} className="fetch-item new-rail">
                        <span className="fetch-qty">{part.quantity}×</span>
                        <span className="fetch-type">{part.railType}</span>
                        <span className="fetch-length">{formatLength(part.length)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {partsToFetch.filter(p => p.isRemainder).length > 0 && (
                <div className="fetch-category">
                  <h4>Remainder Pieces</h4>
                  <div className="fetch-items">
                    {partsToFetch.filter(p => p.isRemainder).map((part, i) => (
                      <div key={i} className="fetch-item remainder-rail">
                        <span className="fetch-qty">{part.quantity}×</span>
                        <span className="fetch-type">{part.railType}</span>
                        <span className="fetch-length">{formatLength(part.length)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {partsToFetch.length === 0 && (
                <div className="fetch-empty">No parts needed from storage</div>
              )}
            </div>
            <div className="fetch-total">
              <strong>Total items to fetch:</strong> {partsToFetch.reduce((sum, p) => sum + p.quantity, 0)} rails
            </div>
          </div>

          {/* Execute All Button */}
          <div className="execute-section">
            <button
              className="btn btn-primary btn-large"
              onClick={handleExecuteAll}
              disabled={executedCuts.size === materialPlan.suggestions.length || workOrder?.status === 'completed' || workOrder?.status === 'cancelled'}
            >
              Execute All Cuts ({materialPlan.suggestions.length - executedCuts.size} remaining)
            </button>
            {executedCuts.size > 0 && !workOrder && (
              <button
                className="btn btn-secondary"
                onClick={() => setExecutedCuts(new Set())}
              >
                Reset
              </button>
            )}
            {workOrder && executedCuts.size === materialPlan.suggestions.length && workOrder.status !== 'completed' && (
              <button
                className="btn btn-primary btn-large"
                onClick={handleCompleteWorkOrder}
              >
                Complete Work Order
              </button>
            )}
          </div>

          {/* Cut Suggestions by Type */}
          <div className="suggestions-section">
            <h3>Cutting Plan</h3>
            {Array.from(suggestionGroups.entries()).map(([type, suggestions]) => (
              <div key={type} className="type-group">
                <h4 className="type-header">
                  {type}
                  <span className="type-count">{suggestions.length} cuts</span>
                </h4>
                <div className="suggestions-list">
                  {suggestions.map((suggestion: CutSuggestion, index: number) => (
                    <div 
                      key={`${suggestion.piece.id}-${index}`}
                      className={`suggestion-card ${executedCuts.has(suggestion.piece.id) ? 'executed' : ''} ${suggestion.isOptimal ? 'optimal' : ''}`}
                    >
                      <div className="suggestion-source">
                        <div className="source-info">
                          {suggestion.sourceRail.isRemainder ? (
                            <span className="source-badge remainder">From Remainder</span>
                          ) : rails.find(r => r.id === suggestion.sourceRail.id) ? (
                            <span className="source-badge inventory">From Inventory</span>
                          ) : (
                            <span className="source-badge new">New Rail Needed</span>
                          )}
                          <span className="source-length">
                            Source: {formatLength(suggestion.sourceRail.length)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="suggestion-cut">
                        {suggestion.sourceRail.isRemainder ? (
                          // Stacked bar chart for remainder usage - shows original rail with used portions
                          <div className="stacked-bar-container">
                            <div className="stacked-bar-header">
                              <span className="stacked-bar-source">Available: {formatLength(suggestion.sourceRail.length)}</span>
                            </div>
                            <div className="stacked-bar">
                              <div 
                                className="stacked-segment current-cut"
                                style={{ 
                                  width: `${(suggestion.piece.length / suggestion.sourceRail.length) * 100}%` 
                                }}
                                title={`Cut this piece: ${formatLength(suggestion.piece.length)}`}
                              >
                                <span className="segment-label">{formatLength(suggestion.piece.length)}</span>
                              </div>
                              {suggestion.remainderLength > 0 && (
                                <div 
                                  className="stacked-segment new-remainder"
                                  style={{ 
                                    width: `${(suggestion.remainderLength / suggestion.sourceRail.length) * 100}%` 
                                  }}
                                  title={`Leftover for future use: ${formatLength(suggestion.remainderLength)}`}
                                >
                                  <span className="segment-label">{formatLength(suggestion.remainderLength)}</span>
                                </div>
                              )}
                              {suggestion.waste > 0 && (
                                <div 
                                  className="stacked-segment waste-segment"
                                  style={{ 
                                    width: `${(suggestion.waste / suggestion.sourceRail.length) * 100}%` 
                                  }}
                                  title={`Too small to reuse: ${formatLength(suggestion.waste)}`}
                                >
                                  <span className="segment-label">waste</span>
                                </div>
                              )}
                            </div>
                            <div className="stacked-bar-legend">
                              <span className="legend-entry"><span className="legend-dot current-cut"></span> Cut piece: {formatLength(suggestion.piece.length)}</span>
                              {suggestion.remainderLength > 0 && (
                                <span className="legend-entry"><span className="legend-dot new-remainder"></span> New remainder: {formatLength(suggestion.remainderLength)}</span>
                              )}
                              {suggestion.waste > 0 && (
                                <span className="legend-entry"><span className="legend-dot waste-segment"></span> Waste: {formatLength(suggestion.waste)}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          // Regular bar for new rails
                          <>
                            <div className="cut-visual">
                              <div 
                                className="cut-piece"
                                style={{ 
                                  width: `${(suggestion.piece.length / suggestion.sourceRail.length) * 100}%` 
                                }}
                              />
                              {suggestion.remainderLength > 0 && (
                                <div 
                                  className="cut-remainder"
                                  style={{ 
                                    width: `${(suggestion.remainderLength / suggestion.sourceRail.length) * 100}%` 
                                  }}
                                />
                              )}
                              {suggestion.waste > 0 && (
                                <div 
                                  className="cut-waste"
                                  style={{ 
                                    width: `${(suggestion.waste / suggestion.sourceRail.length) * 100}%` 
                                  }}
                                />
                              )}
                            </div>
                            <div className="cut-legend">
                              <span className="legend-item piece">
                                Cut: {formatLength(suggestion.piece.length)}
                              </span>
                              {suggestion.remainderLength > 0 && (
                                <span className="legend-item remainder">
                                  Remainder: {formatLength(suggestion.remainderLength)}
                                </span>
                              )}
                              {suggestion.waste > 0 && (
                                <span className="legend-item waste">
                                  Waste: {formatLength(suggestion.waste)}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="suggestion-details">
                        <span className="detail-purpose">{suggestion.piece.purpose}</span>
                      </div>

                      <div className="suggestion-actions">
                        {executedCuts.has(suggestion.piece.id) ? (
                          <span className="executed-badge">Executed</span>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              // Find the actual index in the full suggestions array
                              const actualIndex = materialPlan.suggestions.findIndex(
                                s => s.piece.id === suggestion.piece.id
                              );
                              handleExecuteCut(suggestion, actualIndex);
                            }}
                            disabled={workOrder?.status === 'completed' || workOrder?.status === 'cancelled'}
                          >
                            Execute Cut
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>


        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useInventory } from '../context/InventoryContext';
import { formatLength } from '../utils/helpers';
import type { WorkOrder, GatheringStep, CuttingStep } from '../types';
import fusionBoxImage from '../assets/fusion-box.png';
import './WorkOrderExecution.css';

interface WorkOrderExecutionProps {
  workOrder: WorkOrder;
  onBack: () => void;
}

// Group cutting steps by source rail
interface RailCuttingGroup {
  sourceRailId: string;
  railType: { width: number; thickness: number; label: string };
  sourceLength: number;
  cuts: CuttingStep[];
  allConfirmed: boolean;
  isRemainder: boolean;
}

export function WorkOrderExecution({ workOrder, onBack }: WorkOrderExecutionProps) {
  const { 
    confirmGatheringStep, 
    confirmCuttingStep, 
    confirmReturn, 
    advancePhase,
    cancelWorkOrder 
  } = useWorkOrders();
  const { addRail, removeRail, rails } = useInventory();
  const [returnNotes, setReturnNotes] = useState('');

  const phaseLabels = {
    gathering: 'Part Gathering',
    cutting: 'Cutting',
    returning: 'Return Parts',
    completed: 'Completed',
  };

  const phaseDescriptions = {
    gathering: 'Gather all required parts from the storage boxes. Confirm each item as you collect it.',
    cutting: 'Process one raw part at a time. Make all cuts on the part, then confirm to move to the next.',
    returning: 'Return all remainder pieces to storage and dispose of waste. Confirm when done.',
    completed: 'This work order has been completed.',
  };

  // Find the next unconfirmed gathering step
  const currentGatheringStep = workOrder.gatheringSteps.find(step => !step.confirmed);
  const gatheringProgress = workOrder.gatheringSteps.filter(s => s.confirmed).length;
  const totalGatheringSteps = workOrder.gatheringSteps.length;

  // Group cutting steps by source rail
  const railGroups: RailCuttingGroup[] = [];
  const railGroupMap = new Map<string, RailCuttingGroup>();
  
  for (const step of workOrder.cuttingSteps) {
    const existing = railGroupMap.get(step.sourceRailId);
    if (existing) {
      existing.cuts.push(step);
      existing.allConfirmed = existing.allConfirmed && step.confirmed;
    } else {
      // Check if this is from a remainder (from gathering step info)
      const gatheringStep = workOrder.gatheringSteps.find(g => g.sourceRailId === step.sourceRailId);
      const group: RailCuttingGroup = {
        sourceRailId: step.sourceRailId,
        railType: step.railType,
        sourceLength: step.sourceLength,
        cuts: [step],
        allConfirmed: step.confirmed,
        isRemainder: gatheringStep?.isRemainder || false,
      };
      railGroupMap.set(step.sourceRailId, group);
      railGroups.push(group);
    }
  }

  // Find the current rail group (first one not fully confirmed)
  const currentRailGroup = railGroups.find(g => !g.allConfirmed);
  const railGroupProgress = railGroups.filter(g => g.allConfirmed).length;
  const totalRailGroups = railGroups.length;
  const totalCuttingSteps = workOrder.cuttingSteps.length;
  const cuttingProgress = workOrder.cuttingSteps.filter(s => s.confirmed).length;

  const handleConfirmGathering = (step: GatheringStep) => {
    confirmGatheringStep(workOrder.id, step.id);
  };

  // Confirm all cuts for a rail group at once - handles inventory correctly
  const handleConfirmRailGroup = (group: RailCuttingGroup) => {
    // Calculate total cut length for this rail
    const totalCutLength = group.cuts.reduce((sum, cut) => sum + cut.cutLength, 0);
    const remainderLength = group.sourceLength - totalCutLength;
    
    // Find the rail in inventory (might be by ID or we need to find a matching one)
    let railInInventory = rails.find(r => r.id === group.sourceRailId);
    
    if (!railInInventory) {
      // Try to find a matching rail by type and length
      railInInventory = rails.find(r => 
        r.width === group.railType.width &&
        r.thickness === group.railType.thickness &&
        r.length >= group.sourceLength
      );
    }
    
    if (railInInventory) {
      // Remove the source rail from inventory
      removeRail(railInInventory.id);
      
      // Add remainder if it's usable (>= 100mm)
      if (remainderLength >= 100) {
        addRail({
          length: remainderLength,
          width: group.railType.width,
          thickness: group.railType.thickness,
          isRemainder: true,
          originalRailId: railInInventory.id,
          notes: `Remainder from cutting ${group.cuts.length} pieces`,
        });
      }
    }
    
    // Mark all cuts as confirmed in the work order
    for (const cut of group.cuts) {
      if (!cut.confirmed) {
        confirmCuttingStep(workOrder.id, cut.id);
      }
    }
  };

  const handleConfirmReturn = () => {
    confirmReturn(workOrder.id, returnNotes || undefined);
  };

  const handleAdvancePhase = () => {
    advancePhase(workOrder.id);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this work order? Progress will be lost.')) {
      cancelWorkOrder(workOrder.id);
      onBack();
    }
  };

  const renderPhaseIndicator = () => {
    const phases = ['gathering', 'cutting', 'returning', 'completed'] as const;
    const currentIndex = phases.indexOf(workOrder.phase);

    return (
      <div className="phase-indicator">
        {phases.map((phase, index) => (
          <div 
            key={phase} 
            className={`phase-step ${index <= currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
          >
            <div className="phase-circle">
              {index < currentIndex ? '✓' : index + 1}
            </div>
            <span className="phase-label">{phaseLabels[phase]}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderGatheringPhase = () => {
    if (!currentGatheringStep && gatheringProgress === totalGatheringSteps) {
      return (
        <div className="phase-complete-message">
          <h3>All parts gathered!</h3>
          <p>You have collected all {totalGatheringSteps} required items.</p>
          <button 
            className="btn btn-primary btn-large"
            onClick={handleAdvancePhase}
          >
            Proceed to Cutting Phase
          </button>
        </div>
      );
    }

    return (
      <div className="gathering-phase">
        <div className="progress-info">
          <span>Progress: {gatheringProgress} / {totalGatheringSteps} items collected</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(gatheringProgress / totalGatheringSteps) * 100}%` }}
            />
          </div>
        </div>

        {currentGatheringStep && (
          <div className="current-step-card">
            <div className="step-header">
              <span className="step-number">Step {gatheringProgress + 1} of {totalGatheringSteps}</span>
              <span className={`step-type ${currentGatheringStep.isRemainder ? 'remainder' : 'new-stock'}`}>
                {currentGatheringStep.isRemainder ? 'From Remainder Box' : 'From New Stock'}
              </span>
            </div>
            
            <div className="step-content">
              <div className="step-icon">
                {currentGatheringStep.isRemainder ? '♻' : '📦'}
              </div>
              <div className="step-details">
                <h4>Collect: {currentGatheringStep.railType.label} Rail</h4>
                <p className="step-length">Length: {formatLength(currentGatheringStep.length)}</p>
                <p className="step-instruction">
                  {currentGatheringStep.isRemainder 
                    ? `Go to the ${currentGatheringStep.railType.label} remainder box and get a piece of ${formatLength(currentGatheringStep.length)}.`
                    : `Go to the ${currentGatheringStep.railType.label} new stock and get a rail of ${formatLength(currentGatheringStep.length)}.`
                  }
                </p>
              </div>
            </div>

            <button 
              className="btn btn-primary btn-large confirm-btn"
              onClick={() => handleConfirmGathering(currentGatheringStep)}
            >
              Confirm Part Collected
            </button>
          </div>
        )}

        <div className="completed-steps">
          <h4>Collected Items ({gatheringProgress})</h4>
          {workOrder.gatheringSteps.filter(s => s.confirmed).map((step) => (
            <div key={step.id} className="completed-step">
              <span className="check-mark">✓</span>
              <span>{step.railType.label} - {formatLength(step.length)}</span>
              <span className="step-source">{step.isRemainder ? 'Remainder' : 'New Stock'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCuttingPhase = () => {
    if (!currentRailGroup && railGroupProgress === totalRailGroups) {
      return (
        <div className="phase-complete-message">
          <h3>All cuts completed!</h3>
          <p>You have processed all {totalRailGroups} raw parts ({totalCuttingSteps} total cuts).</p>
          <button 
            className="btn btn-primary btn-large"
            onClick={handleAdvancePhase}
          >
            Proceed to Return Phase
          </button>
        </div>
      );
    }

    // Calculate remainder and waste for current rail group
    const calculateRailOutcome = (group: RailCuttingGroup) => {
      const totalCutLength = group.cuts.reduce((sum, cut) => sum + cut.cutLength, 0);
      const remainingLength = group.sourceLength - totalCutLength;
      const MIN_USABLE = 100;
      
      return {
        totalCutLength,
        remainder: remainingLength >= MIN_USABLE ? remainingLength : 0,
        waste: remainingLength > 0 && remainingLength < MIN_USABLE ? remainingLength : 0,
      };
    };

    return (
      <div className="cutting-phase">
        <div className="progress-info">
          <span>Progress: {railGroupProgress} / {totalRailGroups} raw parts processed ({cuttingProgress} / {totalCuttingSteps} cuts)</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(railGroupProgress / totalRailGroups) * 100}%` }}
            />
          </div>
        </div>

        {currentRailGroup && (() => {
          const outcome = calculateRailOutcome(currentRailGroup);
          
          return (
            <div className="current-step-card cutting-card rail-group-card">
              <div className="step-header">
                <span className="step-number">Raw Part {railGroupProgress + 1} of {totalRailGroups}</span>
                <span className="step-type">{currentRailGroup.railType.label}</span>
                <span className={`step-source-badge ${currentRailGroup.isRemainder ? 'remainder' : 'new-stock'}`}>
                  {currentRailGroup.isRemainder ? 'Remainder' : 'New Stock'}
                </span>
              </div>
              
              <div className="rail-group-content">
                {/* Stacked Bar Chart - Visual representation of all cuts */}
                <div className="cutting-visualization">
                  <div className="rail-header">
                    <span className="rail-label">Source Rail</span>
                    <span className="rail-total">{formatLength(currentRailGroup.sourceLength)}</span>
                  </div>
                  
                  <div className="stacked-bar-container">
                    <div className="stacked-bar">
                      {currentRailGroup.cuts.map((cut, index) => {
                        const widthPercent = (cut.cutLength / currentRailGroup.sourceLength) * 100;
                        // Use different colors for each cut
                        const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
                        const color = colors[index % colors.length];
                        
                        return (
                          <div 
                            key={cut.id}
                            className="bar-segment cut-segment"
                            style={{ 
                              width: `${widthPercent}%`,
                              backgroundColor: color,
                            }}
                            title={`Cut ${index + 1}: ${formatLength(cut.cutLength)} - ${cut.purpose}`}
                          >
                            <div className="segment-content">
                              <span className="segment-number">{index + 1}</span>
                              <span className="segment-length">{formatLength(cut.cutLength)}</span>
                            </div>
                          </div>
                        );
                      })}
                      
                      {outcome.remainder > 0 && (
                        <div 
                          className="bar-segment remainder-segment"
                          style={{ width: `${(outcome.remainder / currentRailGroup.sourceLength) * 100}%` }}
                          title={`Remainder: ${formatLength(outcome.remainder)}`}
                        >
                          <div className="segment-content">
                            <span className="segment-label">R</span>
                            <span className="segment-length">{formatLength(outcome.remainder)}</span>
                          </div>
                        </div>
                      )}
                      
                      {outcome.waste > 0 && (
                        <div 
                          className="bar-segment waste-segment"
                          style={{ width: `${(outcome.waste / currentRailGroup.sourceLength) * 100}%` }}
                          title={`Waste: ${formatLength(outcome.waste)}`}
                        >
                          <div className="segment-content">
                            <span className="segment-label">W</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Scale markers */}
                    <div className="bar-scale">
                      <span>0</span>
                      <span>{formatLength(currentRailGroup.sourceLength / 2)}</span>
                      <span>{formatLength(currentRailGroup.sourceLength)}</span>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="bar-legend">
                    {currentRailGroup.cuts.map((cut, index) => {
                      const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
                      const color = colors[index % colors.length];
                      return (
                        <div key={cut.id} className="legend-item">
                          <span className="legend-color" style={{ backgroundColor: color }}>{index + 1}</span>
                          <span className="legend-text">{formatLength(cut.cutLength)} - {cut.purpose}</span>
                        </div>
                      );
                    })}
                    {outcome.remainder > 0 && (
                      <div className="legend-item">
                        <span className="legend-color remainder-color">R</span>
                        <span className="legend-text">{formatLength(outcome.remainder)} - Remainder (keep)</span>
                      </div>
                    )}
                    {outcome.waste > 0 && (
                      <div className="legend-item">
                        <span className="legend-color waste-color">W</span>
                        <span className="legend-text">{formatLength(outcome.waste)} - Waste (dispose)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cuts table */}
                <div className="cuts-list">
                  <h4>Cuts to make on this part:</h4>
                  <table className="cuts-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Length</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRailGroup.cuts.map((cut, index) => (
                        <tr key={cut.id}>
                          <td>
                            <span className="cut-number-badge" style={{ 
                              backgroundColor: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'][index % 6] 
                            }}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="cut-length">{formatLength(cut.cutLength)}</td>
                          <td>{cut.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td>Total</td>
                        <td className="cut-length">{formatLength(outcome.totalCutLength)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Outcome summary */}
                <div className="rail-outcome">
                  <div className="outcome-summary">
                    <div className="outcome-item">
                      <span className="outcome-label">Source:</span>
                      <span className="outcome-value">{formatLength(currentRailGroup.sourceLength)}</span>
                    </div>
                    <div className="outcome-item">
                      <span className="outcome-label">Cuts:</span>
                      <span className="outcome-value">-{formatLength(outcome.totalCutLength)}</span>
                    </div>
                    <div className="outcome-divider"></div>
                    {outcome.remainder > 0 && (
                      <div className="outcome-item remainder-info">
                        <span className="outcome-label">Remainder:</span>
                        <span className="outcome-value">{formatLength(outcome.remainder)}</span>
                      </div>
                    )}
                    {outcome.waste > 0 && (
                      <div className="outcome-item waste-info">
                        <span className="outcome-label">Waste:</span>
                        <span className="outcome-value">{formatLength(outcome.waste)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-large confirm-btn"
                onClick={() => handleConfirmRailGroup(currentRailGroup)}
              >
                Confirm All Cuts on This Part
              </button>
            </div>
          );
        })()}

        {/* Completed rail groups */}
        {railGroupProgress > 0 && (
          <div className="completed-steps">
            <h4>Completed Parts ({railGroupProgress})</h4>
            {railGroups.filter(g => g.allConfirmed).map((group) => (
              <div key={group.sourceRailId} className="completed-step">
                <span className="check-mark">✓</span>
                <span>{group.railType.label} - {formatLength(group.sourceLength)}</span>
                <span className="step-purpose">{group.cuts.length} cut{group.cuts.length > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderReturnPhase = () => {
    // Calculate what needs to be returned
    // For each rail group, the remainder is: source length - sum of all cut lengths
    // (if above MIN_USABLE_LENGTH, otherwise it's waste)
    const MIN_USABLE_LENGTH = 100; // mm
    
    const remaindersByRail: { railType: { label: string }; length: number; sourceRailId: string }[] = [];
    let totalWaste = 0;
    
    for (const group of railGroups) {
      const totalCutLength = group.cuts.reduce((sum, cut) => sum + cut.cutLength, 0);
      const remainingLength = group.sourceLength - totalCutLength;
      
      if (remainingLength >= MIN_USABLE_LENGTH) {
        remaindersByRail.push({
          railType: group.railType,
          length: remainingLength,
          sourceRailId: group.sourceRailId,
        });
      } else if (remainingLength > 0) {
        totalWaste += remainingLength;
      }
    }

    return (
      <div className="returning-phase">
        <div className="return-instructions">
          <h3>Return Parts to Storage</h3>
          <p>Please return all remainder pieces to their appropriate boxes and dispose of waste material.</p>
        </div>

        {remaindersByRail.length > 0 && (
          <div className="return-section">
            <h4>Remainders to Return ({remaindersByRail.length})</h4>
            <p className="return-hint">Place these in the appropriate remainder boxes for future use.</p>
            <div className="return-list">
              {remaindersByRail.map((item, index) => (
                <div key={index} className="return-item remainder">
                  <span className="return-icon">♻</span>
                  <span className="return-type">{item.railType.label}</span>
                  <span className="return-length">{formatLength(item.length)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalWaste > 0 && (
          <div className="return-section">
            <h4>Waste to Dispose</h4>
            <p className="return-hint">These pieces are too small to reuse ({`<${MIN_USABLE_LENGTH}mm`}). Dispose of them properly.</p>
            <div className="return-list">
              <div className="return-item waste">
                <span className="return-icon">X</span>
                <span>Total waste material</span>
                <span className="return-length">{formatLength(totalWaste)}</span>
              </div>
            </div>
          </div>
        )}

        {remaindersByRail.length === 0 && totalWaste === 0 && (
          <div className="return-section">
            <p className="no-returns">No materials to return or dispose. All material was used efficiently!</p>
          </div>
        )}

        <div className="return-confirmation">
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Any notes about the return process..."
              rows={3}
            />
          </div>

          {!workOrder.returnConfirmation.confirmed ? (
            <button 
              className="btn btn-primary btn-large confirm-btn"
              onClick={handleConfirmReturn}
            >
              Confirm All Parts Returned
            </button>
          ) : (
            <div className="phase-complete-message">
              <h3>Return Confirmed!</h3>
              <button 
                className="btn btn-primary btn-large"
                onClick={handleAdvancePhase}
              >
                Complete Work Order
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompletedPhase = () => {
    return (
      <div className="completed-phase">
        <div className="completion-message">
          <div className="completion-icon">✓</div>
          <h2>Work Order Completed</h2>
          <p>All tasks have been completed successfully.</p>
        </div>

        <div className="completion-summary">
          <h3>Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{workOrder.gatheringSteps.length}</span>
              <span className="stat-label">Parts Gathered</span>
            </div>
            <div className="stat">
              <span className="stat-value">{workOrder.cuttingSteps.length}</span>
              <span className="stat-label">Cuts Made</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {workOrder.cuttingSteps.filter(s => s.remainderLength > 0).length}
              </span>
              <span className="stat-label">Remainders Stored</span>
            </div>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={onBack}>
          Back to Work Orders
        </button>
      </div>
    );
  };

  return (
    <div className="work-order-execution">
      <div className="execution-header">
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="header-info">
          <h2>{workOrder.planName}</h2>
          <span className={`status-badge status-${workOrder.status}`}>
            {workOrder.status}
          </span>
        </div>
        {workOrder.phase !== 'completed' && (
          <button className="btn btn-danger cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>

      {renderPhaseIndicator()}

      {/* Reference image above the phase content */}
      {workOrder.phase !== 'completed' && (
        <div className="reference-section">
          <img src={fusionBoxImage} alt="Fusion Box Reference" className="reference-image" />
        </div>
      )}

      {/* Main phase content */}
      <div className="phase-content">
        <div className="phase-header">
          <h3>{phaseLabels[workOrder.phase]}</h3>
          <p>{phaseDescriptions[workOrder.phase]}</p>
        </div>

        {workOrder.phase === 'gathering' && renderGatheringPhase()}
        {workOrder.phase === 'cutting' && renderCuttingPhase()}
        {workOrder.phase === 'returning' && renderReturnPhase()}
        {workOrder.phase === 'completed' && renderCompletedPhase()}
      </div>
    </div>
  );
}

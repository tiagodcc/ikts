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

export function WorkOrderExecution({ workOrder, onBack }: WorkOrderExecutionProps) {
  const { 
    confirmGatheringStep, 
    confirmCuttingStep, 
    confirmReturn, 
    advancePhase,
    cancelWorkOrder 
  } = useWorkOrders();
  const { cutRail, addRail, rails } = useInventory();
  const [returnNotes, setReturnNotes] = useState('');

  const phaseLabels = {
    gathering: 'Part Gathering',
    cutting: 'Cutting',
    returning: 'Return Parts',
    completed: 'Completed',
  };

  const phaseDescriptions = {
    gathering: 'Gather all required parts from the storage boxes. Confirm each item as you collect it.',
    cutting: 'Cut each piece according to the specifications. Confirm each cut as you complete it.',
    returning: 'Return all remainder pieces to storage and dispose of waste. Confirm when done.',
    completed: 'This work order has been completed.',
  };

  // Find the next unconfirmed gathering step
  const currentGatheringStep = workOrder.gatheringSteps.find(step => !step.confirmed);
  const gatheringProgress = workOrder.gatheringSteps.filter(s => s.confirmed).length;
  const totalGatheringSteps = workOrder.gatheringSteps.length;

  // Find the next unconfirmed cutting step
  const currentCuttingStep = workOrder.cuttingSteps.find(step => !step.confirmed);
  const cuttingProgress = workOrder.cuttingSteps.filter(s => s.confirmed).length;
  const totalCuttingSteps = workOrder.cuttingSteps.length;

  const handleConfirmGathering = (step: GatheringStep) => {
    confirmGatheringStep(workOrder.id, step.id);
  };

  const handleConfirmCutting = (step: CuttingStep) => {
    // Find the rail in inventory
    const railInInventory = rails.find(r => r.id === step.sourceRailId);
    
    if (railInInventory) {
      // Perform the actual cut in inventory
      cutRail(railInInventory.id, step.cutLength, step.purpose);
    } else if (!step.sourceRailId.includes('new-')) {
      // It's a remainder or inventory rail that should exist
      // Try to add it first (edge case handling)
      addRail({
        length: step.sourceLength,
        width: step.railType.width,
        thickness: step.railType.thickness,
        isRemainder: false,
        notes: 'Added during work order execution',
      });
    }
    
    confirmCuttingStep(workOrder.id, step.id);
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
    if (!currentCuttingStep && cuttingProgress === totalCuttingSteps) {
      return (
        <div className="phase-complete-message">
          <h3>All cuts completed!</h3>
          <p>You have made all {totalCuttingSteps} required cuts.</p>
          <button 
            className="btn btn-primary btn-large"
            onClick={handleAdvancePhase}
          >
            Proceed to Return Phase
          </button>
        </div>
      );
    }

    return (
      <div className="cutting-phase">
        <div className="progress-info">
          <span>Progress: {cuttingProgress} / {totalCuttingSteps} cuts completed</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(cuttingProgress / totalCuttingSteps) * 100}%` }}
            />
          </div>
        </div>

        {currentCuttingStep && (
          <div className="current-step-card cutting-card">
            <div className="step-header">
              <span className="step-number">Cut {cuttingProgress + 1} of {totalCuttingSteps}</span>
              <span className="step-type">{currentCuttingStep.railType.label}</span>
            </div>
            
            <div className="step-content">
              <div className="cut-visualization">
                <div className="rail-diagram">
                  <div className="rail-source">
                    <span>Source: {formatLength(currentCuttingStep.sourceLength)}</span>
                  </div>
                  <div className="rail-bar">
                    <div 
                      className="cut-section"
                      style={{ width: `${(currentCuttingStep.cutLength / currentCuttingStep.sourceLength) * 100}%` }}
                    >
                      {formatLength(currentCuttingStep.cutLength)}
                    </div>
                    {currentCuttingStep.remainderLength > 0 && (
                      <div 
                        className="remainder-section"
                        style={{ width: `${(currentCuttingStep.remainderLength / currentCuttingStep.sourceLength) * 100}%` }}
                      >
                        {formatLength(currentCuttingStep.remainderLength)}
                      </div>
                    )}
                    {currentCuttingStep.wasteLength > 0 && (
                      <div 
                        className="waste-section"
                        style={{ width: `${(currentCuttingStep.wasteLength / currentCuttingStep.sourceLength) * 100}%` }}
                      >
                        waste
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="cut-details">
                <div className="cut-info">
                  <strong>Cut Length:</strong> {formatLength(currentCuttingStep.cutLength)}
                </div>
                <div className="cut-info">
                  <strong>Purpose:</strong> {currentCuttingStep.purpose}
                </div>
                {currentCuttingStep.remainderLength > 0 && (
                  <div className="cut-info remainder-info">
                    <strong>Remainder:</strong> {formatLength(currentCuttingStep.remainderLength)} (keep for later)
                  </div>
                )}
                {currentCuttingStep.wasteLength > 0 && (
                  <div className="cut-info waste-info">
                    <strong>Waste:</strong> {formatLength(currentCuttingStep.wasteLength)} (dispose)
                  </div>
                )}
              </div>
            </div>

            <button 
              className="btn btn-primary btn-large confirm-btn"
              onClick={() => handleConfirmCutting(currentCuttingStep)}
            >
              Confirm Cut Completed
            </button>
          </div>
        )}

        <div className="completed-steps">
          <h4>Completed Cuts ({cuttingProgress})</h4>
          {workOrder.cuttingSteps.filter(s => s.confirmed).map((step) => (
            <div key={step.id} className="completed-step">
              <span className="check-mark">✓</span>
              <span>{step.railType.label} - {formatLength(step.cutLength)}</span>
              <span className="step-purpose">{step.purpose}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReturnPhase = () => {
    // Calculate what needs to be returned
    const remainders = workOrder.cuttingSteps
      .filter(step => step.remainderLength > 0)
      .map(step => ({
        railType: step.railType,
        length: step.remainderLength,
      }));

    const waste = workOrder.cuttingSteps
      .filter(step => step.wasteLength > 0)
      .reduce((total, step) => total + step.wasteLength, 0);

    return (
      <div className="returning-phase">
        <div className="return-instructions">
          <h3>Return Parts to Storage</h3>
          <p>Please return all remainder pieces to their appropriate boxes and dispose of waste material.</p>
        </div>

        {remainders.length > 0 && (
          <div className="return-section">
            <h4>Remainders to Return</h4>
            <p className="return-hint">Place these in the appropriate remainder boxes for future use.</p>
            <div className="return-list">
              {remainders.map((item, index) => (
                <div key={index} className="return-item remainder">
                  <span className="return-icon">♻</span>
                  <span className="return-type">{item.railType.label}</span>
                  <span className="return-length">{formatLength(item.length)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {waste > 0 && (
          <div className="return-section">
            <h4>Waste to Dispose</h4>
            <p className="return-hint">These pieces are too small to reuse. Dispose of them properly.</p>
            <div className="return-list">
              <div className="return-item waste">
                <span className="return-icon">🗑</span>
                <span>Total waste material</span>
                <span className="return-length">{formatLength(waste)}</span>
              </div>
            </div>
          </div>
        )}

        {remainders.length === 0 && waste === 0 && (
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

      <div className="phase-content">
        <div className="phase-header">
          <h3>{phaseLabels[workOrder.phase]}</h3>
          <p>{phaseDescriptions[workOrder.phase]}</p>
        </div>

        {workOrder.phase !== 'completed' && (
          <div className="reference-section">
            <img src={fusionBoxImage} alt="Fusion Box Reference" className="reference-image" />
          </div>
        )}

        {workOrder.phase === 'gathering' && renderGatheringPhase()}
        {workOrder.phase === 'cutting' && renderCuttingPhase()}
        {workOrder.phase === 'returning' && renderReturnPhase()}
        {workOrder.phase === 'completed' && renderCompletedPhase()}
      </div>
    </div>
  );
}

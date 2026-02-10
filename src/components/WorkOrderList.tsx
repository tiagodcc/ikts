import { useState } from 'react';
import { useWorkOrders } from '../context/WorkOrderContext';
import { usePlans } from '../context/PlansContext';
import { useInventory } from '../context/InventoryContext';
import { formatDate } from '../utils/helpers';
import type { WorkOrder, WorkOrderStatus, WorkOrderPhase } from '../types';
import './WorkOrderList.css';

interface WorkOrderListProps {
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
}

export function WorkOrderList({ onSelectWorkOrder }: WorkOrderListProps) {
  const { workOrders, createWorkOrder, deleteWorkOrder, updateWorkOrderStatus } = useWorkOrders();
  const { plans } = usePlans();
  const { rails } = useInventory();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'all'>('all');

  const handleCreateWorkOrder = () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    const workOrder = createWorkOrder(plan, rails);
    onSelectWorkOrder(workOrder);
    setSelectedPlanId('');
  };

  const filteredWorkOrders = workOrders.filter(wo => 
    filterStatus === 'all' || wo.status === filterStatus
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusBadge = (status: WorkOrderStatus) => {
    const badges: Record<WorkOrderStatus, { icon: string; label: string; className: string }> = {
      'draft': { icon: '', label: 'Draft', className: 'status-draft' },
      'in-progress': { icon: '', label: 'In Progress', className: 'status-in-progress' },
      'completed': { icon: '', label: 'Completed', className: 'status-completed' },
      'cancelled': { icon: '', label: 'Cancelled', className: 'status-cancelled' },
    };
    return badges[status];
  };

  const getPhaseLabel = (phase: WorkOrderPhase): string => {
    const labels: Record<WorkOrderPhase, string> = {
      'gathering': 'Gathering Parts',
      'cutting': 'Cutting',
      'returning': 'Returning Parts',
      'completed': 'Completed',
    };
    return labels[phase];
  };

  const getPhaseProgress = (workOrder: WorkOrder): { current: number; total: number } => {
    const phase = workOrder.phase;
    if (phase === 'gathering') {
      const confirmed = workOrder.gatheringSteps.filter(s => s.confirmed).length;
      return { current: confirmed, total: workOrder.gatheringSteps.length };
    } else if (phase === 'cutting') {
      const confirmed = workOrder.cuttingSteps.filter(s => s.confirmed).length;
      return { current: confirmed, total: workOrder.cuttingSteps.length };
    } else if (phase === 'returning') {
      return { current: workOrder.returnConfirmation.confirmed ? 1 : 0, total: 1 };
    }
    return { current: 1, total: 1 };
  };

  return (
    <div className="work-order-list">
      <div className="work-order-header">
        <h2>Work Orders</h2>
        <p className="subtitle">Create and manage work orders from your plans</p>
      </div>

      {/* Create New Work Order */}
      <div className="create-work-order">
        <h3>Create New Work Order</h3>
        <div className="create-form">
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="plan-select"
          >
            <option value="">-- Select a plan --</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.requiredPieces.reduce((s, p) => s + p.quantity, 0)} pieces)
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleCreateWorkOrder}
            disabled={!selectedPlanId}
          >
            + Create Work Order
          </button>
        </div>
        {plans.length === 0 && (
          <p className="no-plans-hint">No plans available. Create a plan first in the Plans tab.</p>
        )}
      </div>

      {/* Filter */}
      <div className="work-order-filter">
        <label>Filter by status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as WorkOrderStatus | 'all')}
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Work Order List */}
      <div className="work-orders-grid">
        {filteredWorkOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <h3>No Work Orders</h3>
            <p>Create a work order from a plan to get started</p>
          </div>
        ) : (
          filteredWorkOrders.map((workOrder) => {
            const badge = getStatusBadge(workOrder.status);
            const phaseProgress = getPhaseProgress(workOrder);
            const progressPercent = phaseProgress.total > 0 
              ? Math.round((phaseProgress.current / phaseProgress.total) * 100) 
              : 0;

            return (
              <div key={workOrder.id} className="work-order-card">
                <div className="card-header">
                  <h4>{workOrder.planName}</h4>
                  <span className={`status-badge ${badge.className}`}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="card-meta">
                  <span>Created: {formatDate(workOrder.createdAt)}</span>
                  {workOrder.startedAt && (
                    <span>Started: {formatDate(workOrder.startedAt)}</span>
                  )}
                  {workOrder.completedAt && (
                    <span>Completed: {formatDate(workOrder.completedAt)}</span>
                  )}
                </div>

                {workOrder.status === 'in-progress' && (
                  <div className="card-progress">
                    <div className="phase-info">
                      <span className="phase-label">Phase: {getPhaseLabel(workOrder.phase)}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {phaseProgress.current} / {phaseProgress.total} ({progressPercent}%)
                    </span>
                  </div>
                )}

                {workOrder.notes && (
                  <p className="card-notes">{workOrder.notes}</p>
                )}

                <div className="card-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSelectWorkOrder(workOrder)}
                  >
                    {workOrder.status === 'draft' ? 'Start' : 
                     workOrder.status === 'in-progress' ? 'Continue' : 'View'} Work Order
                  </button>
                  
                  {(workOrder.status === 'draft' || workOrder.status === 'in-progress') && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (confirm('Cancel this work order?')) {
                          updateWorkOrderStatus(workOrder.id, 'cancelled');
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  
                  {(workOrder.status === 'completed' || workOrder.status === 'cancelled') && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (confirm('Delete this work order permanently?')) {
                          deleteWorkOrder(workOrder.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

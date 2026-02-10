import { useState } from 'react';
import { usePlans } from '../context/PlansContext';
import type { FusionBoxPlan, CutPiece, RailType } from '../types';
import { COMMON_RAIL_TYPES } from '../types';
import { formatLength, formatDate, downloadJson, readJsonFile } from '../utils/helpers';
import './PlanManager.css';

export function PlanManager() {
  const {
    plans,
    currentPlan,
    addPlan,
    removePlan,
    selectPlan,
    addPieceToPlan,
    removePieceFromPlan,
    updatePieceInPlan,
    importPlan,
    duplicatePlan,
    addExamplePlan,
  } = usePlans();

  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showAddPieceModal, setShowAddPieceModal] = useState(false);
  const [editingPiece, setEditingPiece] = useState<CutPiece | null>(null);

  // New plan form
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');

  // Add piece form
  const [pieceLength, setPieceLength] = useState('');
  const [pieceQuantity, setPieceQuantity] = useState(1);
  const [piecePurpose, setPiecePurpose] = useState('');
  const [pieceRailType, setPieceRailType] = useState<RailType>(COMMON_RAIL_TYPES[0]);

  const handleCreatePlan = () => {
    if (newPlanName.trim()) {
      const plan = addPlan({
        name: newPlanName.trim(),
        description: newPlanDescription.trim() || undefined,
        requiredPieces: [],
      });
      selectPlan(plan.id);
      setShowNewPlanModal(false);
      setNewPlanName('');
      setNewPlanDescription('');
    }
  };

  const handleAddPiece = () => {
    if (currentPlan && pieceLength && piecePurpose) {
      addPieceToPlan(currentPlan.id, {
        length: parseInt(pieceLength),
        quantity: pieceQuantity,
        purpose: piecePurpose,
        railType: pieceRailType,
      });
      setShowAddPieceModal(false);
      resetPieceForm();
    }
  };

  const handleUpdatePiece = () => {
    if (currentPlan && editingPiece && pieceLength && piecePurpose) {
      updatePieceInPlan(currentPlan.id, editingPiece.id, {
        length: parseInt(pieceLength),
        quantity: pieceQuantity,
        purpose: piecePurpose,
        railType: pieceRailType,
      });
      setEditingPiece(null);
      resetPieceForm();
    }
  };

  const resetPieceForm = () => {
    setPieceLength('');
    setPieceQuantity(1);
    setPiecePurpose('');
    setPieceRailType(COMMON_RAIL_TYPES[0]);
  };

  const openEditPiece = (piece: CutPiece) => {
    setEditingPiece(piece);
    setPieceLength(piece.length.toString());
    setPieceQuantity(piece.quantity);
    setPiecePurpose(piece.purpose);
    setPieceRailType(piece.railType);
  };

  const handleExportPlan = (plan: FusionBoxPlan) => {
    downloadJson(plan, `fusion-box-plan-${plan.name.replace(/\s+/g, '-')}.json`);
  };

  const handleImportPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const plan = await readJsonFile<FusionBoxPlan>(file);
        if (plan.name && plan.requiredPieces) {
          importPlan(plan);
        } else {
          alert('Invalid plan file format');
        }
      } catch (error) {
        alert('Failed to import plan. Please check the file format.');
      }
    }
    e.target.value = '';
  };

  const getTotalPieces = (plan: FusionBoxPlan) => {
    return plan.requiredPieces.reduce((sum, p) => sum + p.quantity, 0);
  };

  const getTotalLength = (plan: FusionBoxPlan) => {
    return plan.requiredPieces.reduce((sum, p) => sum + p.length * p.quantity, 0);
  };

  const groupPiecesByType = (pieces: CutPiece[]) => {
    const groups: Record<string, CutPiece[]> = {};
    for (const piece of pieces) {
      const key = piece.railType.label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(piece);
    }
    return groups;
  };

  return (
    <div className="plan-manager">
      <div className="plan-sidebar">
        <div className="sidebar-header">
          <h3>Plans</h3>
          <div className="sidebar-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewPlanModal(true)}
            >
              + New
            </button>
            <label className="btn btn-secondary btn-sm">
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportPlan}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="plans-list">
          {plans.length === 0 ? (
            <div className="empty-state">
              <p>No plans yet</p>
              <p>Create a new plan or import one</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={addExamplePlan}
                style={{ marginTop: '0.5rem' }}
              >
                Add Example Plan
              </button>
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={`plan-item ${currentPlan?.id === plan.id ? 'active' : ''}`}
                onClick={() => selectPlan(plan.id)}
              >
                <div className="plan-item-header">
                  <span className="plan-name">{plan.name}</span>
                  <span className="plan-badge">{getTotalPieces(plan)} pieces</span>
                </div>
                <div className="plan-item-meta">
                  {formatDate(plan.updatedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="plan-content">
        {currentPlan ? (
          <>
            <div className="plan-header">
              <div className="plan-title">
                <h2>{currentPlan.name}</h2>
                {currentPlan.description && (
                  <p className="plan-description">{currentPlan.description}</p>
                )}
              </div>
              <div className="plan-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddPieceModal(true)}
                >
                  + Add Piece
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleExportPlan(currentPlan)}
                >
                  Export
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => duplicatePlan(currentPlan.id)}
                >
                  Duplicate
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm(`Delete plan "${currentPlan.name}"?`)) {
                      removePlan(currentPlan.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Plan Summary */}
            <div className="plan-summary">
              <div className="summary-card">
                <span className="summary-value">{getTotalPieces(currentPlan)}</span>
                <span className="summary-label">Total Pieces</span>
              </div>
              <div className="summary-card">
                <span className="summary-value">{currentPlan.requiredPieces.length}</span>
                <span className="summary-label">Unique Sizes</span>
              </div>
              <div className="summary-card">
                <span className="summary-value">
                  {formatLength(getTotalLength(currentPlan))}
                </span>
                <span className="summary-label">Total Length</span>
              </div>
            </div>

            {/* Pieces by Type */}
            <div className="pieces-section">
              <h3>Required Materials</h3>
              {currentPlan.requiredPieces.length === 0 ? (
                <div className="empty-state">
                  <p>No pieces added yet</p>
                  <p>Click "Add Piece" to define the required materials</p>
                </div>
              ) : (
                Object.entries(groupPiecesByType(currentPlan.requiredPieces)).map(
                  ([type, pieces]) => (
                    <div key={type} className="type-group">
                      <h4 className="type-header">
                        {type}
                        <span className="type-count">
                          {pieces.reduce((sum, p) => sum + p.quantity, 0)} pieces
                        </span>
                      </h4>
                      <div className="pieces-list">
                        {pieces.map((piece) => (
                          <div key={piece.id} className="piece-card">
                            <div className="piece-visual">
                              <div
                                className="piece-bar"
                                style={{
                                  width: `${Math.min(100, (piece.length / 1000) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="piece-info">
                              <div className="piece-main">
                                <span className="piece-length">
                                  {formatLength(piece.length)}
                                </span>
                                <span className="piece-quantity">×{piece.quantity}</span>
                              </div>
                              <div className="piece-purpose">{piece.purpose}</div>
                            </div>
                            <div className="piece-actions">
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => openEditPiece(piece)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() =>
                                  removePieceFromPlan(currentPlan.id, piece.id)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </>
        ) : (
          <div className="no-plan-selected">
            <div className="empty-icon"></div>
            <h3>No Plan Selected</h3>
            <p>Select a plan from the sidebar or create a new one</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowNewPlanModal(true)}
            >
              + Create New Plan
            </button>
          </div>
        )}
      </div>

      {/* New Plan Modal */}
      {showNewPlanModal && (
        <div className="modal-overlay" onClick={() => setShowNewPlanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Plan</h3>
            <div className="form-group">
              <label>Plan Name *</label>
              <input
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g., Distribution Cabinet Type A"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newPlanDescription}
                onChange={(e) => setNewPlanDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNewPlanModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim()}
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Piece Modal */}
      {(showAddPieceModal || editingPiece) && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowAddPieceModal(false);
            setEditingPiece(null);
            resetPieceForm();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingPiece ? 'Edit Piece' : 'Add Piece'}</h3>
            <div className="form-group">
              <label>Rail Type *</label>
              <select
                value={`${pieceRailType.width}×${pieceRailType.thickness}`}
                onChange={(e) => {
                  const [w, t] = e.target.value.split('×').map(Number);
                  const type = COMMON_RAIL_TYPES.find(
                    (rt) => rt.width === w && rt.thickness === t
                  );
                  if (type) setPieceRailType(type);
                }}
              >
                {COMMON_RAIL_TYPES.map((type) => (
                  <option key={type.label} value={`${type.width}×${type.thickness}`}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Length (mm) *</label>
              <input
                type="number"
                value={pieceLength}
                onChange={(e) => setPieceLength(e.target.value)}
                placeholder="e.g., 250"
              />
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={pieceQuantity}
                onChange={(e) => setPieceQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Purpose/Description *</label>
              <input
                type="text"
                value={piecePurpose}
                onChange={(e) => setPiecePurpose(e.target.value)}
                placeholder="e.g., Main bus bar"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddPieceModal(false);
                  setEditingPiece(null);
                  resetPieceForm();
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={editingPiece ? handleUpdatePiece : handleAddPiece}
                disabled={!pieceLength || !piecePurpose}
              >
                {editingPiece ? 'Update' : 'Add'} Piece
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

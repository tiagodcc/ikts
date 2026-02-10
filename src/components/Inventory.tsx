import { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import type { CopperRail } from '../types';
import { COMMON_RAIL_TYPES, STANDARD_RAIL_LENGTHS } from '../types';
import { formatLength, formatDate, downloadJson, readJsonFile } from '../utils/helpers';
import './Inventory.css';

export function Inventory() {
  const {
    rails,
    addRail,
    removeRail,
    cutRail,
    getStats,
    clearInventory,
    importInventory,
    exportInventory,
  } = useInventory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showCutModal, setShowCutModal] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'remainder'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Add form state
  const [newRailType, setNewRailType] = useState(COMMON_RAIL_TYPES[0]);
  const [newRailLength, setNewRailLength] = useState(STANDARD_RAIL_LENGTHS[0]);
  const [customLength, setCustomLength] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // Cut modal state
  const [cutLength, setCutLength] = useState('');
  const [cutPurpose, setCutPurpose] = useState('');

  const stats = getStats();

  const filteredRails = rails
    .filter((r) => {
      if (filter === 'new') return !r.isRemainder;
      if (filter === 'remainder') return r.isRemainder;
      return true;
    })
    .filter((r) => {
      if (typeFilter === 'all') return true;
      return `${r.width}×${r.thickness}mm` === typeFilter;
    })
    .sort((a, b) => a.length - b.length);

  const handleAddRail = () => {
    const length = customLength ? parseInt(customLength) : newRailLength;
    for (let i = 0; i < quantity; i++) {
      addRail({
        length,
        width: newRailType.width,
        thickness: newRailType.thickness,
        isRemainder: false,
        notes: notes || undefined,
      });
    }
    setShowAddForm(false);
    setCustomLength('');
    setQuantity(1);
    setNotes('');
  };

  const handleCut = (railId: string) => {
    const length = parseInt(cutLength);
    if (length > 0) {
      cutRail(railId, length, cutPurpose || undefined);
      setShowCutModal(null);
      setCutLength('');
      setCutPurpose('');
    }
  };

  const handleExport = () => {
    downloadJson(exportInventory(), 'copper-rail-inventory.json');
  };

  const handleAddInitialStock = () => {
    if (rails.length > 0 && !confirm('This will add initial stock to your existing inventory. Continue?')) {
      return;
    }
    // Add a variety of standard copper rails as initial stock
    const initialStock = [
      { length: 2000, width: 12, thickness: 5, qty: 5 },
      { length: 2000, width: 20, thickness: 5, qty: 4 },
      { length: 1000, width: 12, thickness: 5, qty: 3 },
      { length: 1000, width: 20, thickness: 5, qty: 3 },
      { length: 3000, width: 30, thickness: 10, qty: 2 },
      { length: 2000, width: 30, thickness: 10, qty: 2 },
      { length: 1000, width: 10, thickness: 3, qty: 4 },
      { length: 2000, width: 25, thickness: 5, qty: 3 },
    ];
    
    for (const item of initialStock) {
      for (let i = 0; i < item.qty; i++) {
        addRail({
          length: item.length,
          width: item.width,
          thickness: item.thickness,
          isRemainder: false,
          notes: 'Initial stock',
        });
      }
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await readJsonFile<CopperRail[]>(file);
        importInventory(data);
      } catch (error) {
        alert('Failed to import inventory. Please check the file format.');
      }
    }
    e.target.value = '';
  };

  const uniqueTypes = [...new Set(rails.map((r) => `${r.width}×${r.thickness}mm`))];

  return (
    <div className="inventory">
      <div className="inventory-header">
        <h2>Copper Rail Inventory</h2>
        <div className="inventory-actions">
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Rail
          </button>
          <button className="btn btn-secondary" onClick={handleAddInitialStock}>
            Add Initial Stock
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            Export
          </button>
          <label className="btn btn-secondary">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          {rails.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Clear all inventory?')) clearInventory();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="inventory-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.totalRails}</span>
          <span className="stat-label">Total Rails</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatLength(stats.totalLength)}</span>
          <span className="stat-label">Total Length</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-value">{stats.remainderCount}</span>
          <span className="stat-label">Remainders</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-value">{formatLength(stats.remainderLength)}</span>
          <span className="stat-label">Remainder Length</span>
        </div>
      </div>

      {/* Filters */}
      <div className="inventory-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="new">New Rails</option>
            <option value="remainder">Remainders</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Type:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rails List */}
      <div className="rails-list">
        {filteredRails.length === 0 ? (
          <div className="empty-state">
            <p>No rails in inventory</p>
            <p>Add new rails or import an existing inventory</p>
          </div>
        ) : (
          filteredRails.map((rail) => (
            <div
              key={rail.id}
              className={`rail-card ${rail.isRemainder ? 'remainder' : ''}`}
            >
              <div className="rail-visual">
                <div
                  className="rail-bar"
                  style={{
                    width: `${Math.min(100, (rail.length / 2000) * 100)}%`,
                  }}
                />
              </div>
              <div className="rail-info">
                <div className="rail-main">
                  <span className="rail-length">{formatLength(rail.length)}</span>
                  <span className="rail-type">
                    {rail.width}×{rail.thickness}mm
                  </span>
                  {rail.isRemainder && (
                    <span className="badge remainder-badge">Remainder</span>
                  )}
                </div>
                <div className="rail-meta">
                  <span>Added: {formatDate(rail.createdAt)}</span>
                  {rail.notes && <span className="rail-notes">{rail.notes}</span>}
                </div>
              </div>
              <div className="rail-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowCutModal(rail.id)}
                >
                  Cut
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (confirm('Remove this rail?')) removeRail(rail.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Rail Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Rail</h3>
            <div className="form-group">
              <label>Rail Type (W×T)</label>
              <select
                value={`${newRailType.width}×${newRailType.thickness}`}
                onChange={(e) => {
                  const [w, t] = e.target.value.split('×').map(Number);
                  const type = COMMON_RAIL_TYPES.find(
                    (rt) => rt.width === w && rt.thickness === t
                  );
                  if (type) setNewRailType(type);
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
              <label>Standard Length</label>
              <select
                value={newRailLength}
                onChange={(e) => {
                  setNewRailLength(parseInt(e.target.value));
                  setCustomLength('');
                }}
              >
                {STANDARD_RAIL_LENGTHS.map((len) => (
                  <option key={len} value={len}>
                    {formatLength(len)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Or Custom Length (mm)</label>
              <input
                type="number"
                value={customLength}
                onChange={(e) => setCustomLength(e.target.value)}
                placeholder="Enter custom length"
              />
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Batch #123"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddRail}>
                Add {quantity > 1 ? `${quantity} Rails` : 'Rail'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cut Modal */}
      {showCutModal && (
        <div className="modal-overlay" onClick={() => setShowCutModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Cut Rail</h3>
            {(() => {
              const rail = rails.find((r) => r.id === showCutModal);
              if (!rail) return null;
              return (
                <>
                  <p>
                    Current length: <strong>{formatLength(rail.length)}</strong>
                  </p>
                  <div className="form-group">
                    <label>Cut Length (mm)</label>
                    <input
                      type="number"
                      value={cutLength}
                      onChange={(e) => setCutLength(e.target.value)}
                      max={rail.length}
                      placeholder="Enter cut length"
                    />
                  </div>
                  <div className="form-group">
                    <label>Purpose (optional)</label>
                    <input
                      type="text"
                      value={cutPurpose}
                      onChange={(e) => setCutPurpose(e.target.value)}
                      placeholder="e.g., Cabinet XYZ"
                    />
                  </div>
                  {cutLength && parseInt(cutLength) <= rail.length && (
                    <p className="cut-preview">
                      Remainder: <strong>{formatLength(rail.length - parseInt(cutLength))}</strong>
                    </p>
                  )}
                  <div className="modal-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowCutModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleCut(showCutModal)}
                      disabled={
                        !cutLength ||
                        parseInt(cutLength) <= 0 ||
                        parseInt(cutLength) > rail.length
                      }
                    >
                      Cut
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

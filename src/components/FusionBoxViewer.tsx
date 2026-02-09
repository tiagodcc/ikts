import { useMemo } from 'react';
import { usePlans } from '../context/PlansContext';
import type { CutPiece } from '../types';
import { formatLength } from '../utils/helpers';
import './FusionBoxViewer.css';

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
  isHorizontal: boolean;
}

export function FusionBoxViewer() {
  const { currentPlan } = usePlans();

  // Generate a visual layout for the fusion box
  const layout = useMemo(() => {
    if (!currentPlan || currentPlan.requiredPieces.length === 0) {
      return { positions: [], cabinetWidth: 400, cabinetHeight: 600 };
    }

    const positions: { piece: CutPiece; position: Position }[] = [];
    
    // Simple layout algorithm - arrange pieces in a grid-like pattern
    // Horizontal bus bars at top and bottom
    // Vertical rails on sides
    // Smaller pieces in the middle
    
    const cabinetWidth = 400;
    const cabinetHeight = 600;
    const margin = 20;
    const railThickness = 8;
    
    // Sort pieces by length (longest first)
    const sortedPieces = [...currentPlan.requiredPieces].sort(
      (a, b) => b.length - a.length
    );
    
    let currentY = margin;
    let currentX = margin;
    let row = 0;
    
    for (const piece of sortedPieces) {
      for (let i = 0; i < piece.quantity; i++) {
        const isLongPiece = piece.length > 300;
        const isHorizontal = row % 2 === 0 || isLongPiece;
        
        // Scale the piece length to fit in the cabinet visualization
        const scaledLength = Math.min(
          (piece.length / 1000) * (isHorizontal ? cabinetWidth - margin * 2 : cabinetHeight - margin * 2),
          isHorizontal ? cabinetWidth - margin * 2 : cabinetHeight - margin * 2
        );
        
        const position: Position = {
          x: isHorizontal ? currentX : currentX,
          y: currentY,
          width: isHorizontal ? scaledLength : railThickness,
          height: isHorizontal ? railThickness : scaledLength,
          isHorizontal,
        };
        
        positions.push({ piece, position });
        
        if (isHorizontal) {
          currentY += railThickness + 15;
        } else {
          currentX += railThickness + 20;
          if (currentX > cabinetWidth - margin - 50) {
            currentX = margin;
            currentY += 80;
          }
        }
        
        if (currentY > cabinetHeight - margin - 50) {
          currentY = margin;
          currentX = margin + 30;
          row++;
        }
      }
    }
    
    return { positions, cabinetWidth, cabinetHeight };
  }, [currentPlan]);

  if (!currentPlan) {
    return (
      <div className="fusion-box-viewer">
        <div className="viewer-header">
          <h2>🔌 Fusion Box Viewer</h2>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔌</div>
          <h3>No Plan Selected</h3>
          <p>Select a fusion box plan to see its visual representation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fusion-box-viewer">
      <div className="viewer-header">
        <h2>🔌 Fusion Box Viewer</h2>
        <span className="viewer-subtitle">{currentPlan.name}</span>
      </div>

      <div className="viewer-content">
        <div className="cabinet-container">
          <svg
            width={layout.cabinetWidth}
            height={layout.cabinetHeight}
            className="cabinet-svg"
            viewBox={`0 0 ${layout.cabinetWidth} ${layout.cabinetHeight}`}
          >
            {/* Cabinet outline */}
            <rect
              x="5"
              y="5"
              width={layout.cabinetWidth - 10}
              height={layout.cabinetHeight - 10}
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="2"
              rx="8"
            />
            
            {/* DIN rails placeholder */}
            <rect
              x="15"
              y="50"
              width={layout.cabinetWidth - 30}
              height="12"
              fill="var(--visual-bg)"
              rx="2"
            />
            <rect
              x="15"
              y={layout.cabinetHeight - 62}
              width={layout.cabinetWidth - 30}
              height="12"
              fill="var(--visual-bg)"
              rx="2"
            />

            {/* Copper rails */}
            {layout.positions.map(({ piece, position }, index) => (
              <g key={`${piece.id}-${index}`} className="rail-group">
                <rect
                  x={position.x}
                  y={position.y}
                  width={position.width}
                  height={position.height}
                  fill="url(#copperGradient)"
                  rx="1"
                  className="rail-rect"
                />
                <title>
                  {piece.purpose}: {formatLength(piece.length)} ({piece.railType.label})
                </title>
              </g>
            ))}

            {/* Gradient definition */}
            <defs>
              <linearGradient id="copperGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#b87333" />
                <stop offset="50%" stopColor="#da8a4a" />
                <stop offset="100%" stopColor="#b87333" />
              </linearGradient>
            </defs>
          </svg>

          <div className="cabinet-label">
            <span>Cabinet Preview</span>
            <span className="cabinet-note">Simplified visualization</span>
          </div>
        </div>

        <div className="materials-legend">
          <h3>📋 Materials List</h3>
          <div className="legend-list">
            {Object.entries(
              currentPlan.requiredPieces.reduce((acc, piece) => {
                const key = piece.railType.label;
                if (!acc[key]) acc[key] = [];
                acc[key].push(piece);
                return acc;
              }, {} as Record<string, CutPiece[]>)
            ).map(([type, pieces]) => (
              <div key={type} className="legend-group">
                <h4>🔩 {type}</h4>
                <ul>
                  {pieces.map((piece) => (
                    <li key={piece.id}>
                      <span className="legend-color" />
                      <span className="legend-text">
                        {formatLength(piece.length)} × {piece.quantity}
                      </span>
                      <span className="legend-purpose">{piece.purpose}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="legend-totals">
            <div className="total-row">
              <span>Total Pieces:</span>
              <strong>
                {currentPlan.requiredPieces.reduce((sum, p) => sum + p.quantity, 0)}
              </strong>
            </div>
            <div className="total-row">
              <span>Total Length:</span>
              <strong>
                {formatLength(
                  currentPlan.requiredPieces.reduce(
                    (sum, p) => sum + p.length * p.quantity,
                    0
                  )
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

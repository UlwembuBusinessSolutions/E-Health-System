import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, Loader } from 'lucide-react';
import { getExpiryWarnings, writeOffStock } from '../shared/api/pharmacy';
import type { StockBatch, WriteOffPayload } from '../shared/api/pharmacy';
import { Button } from '../shared/components/Button';
import { Card } from '../shared/components/Card';
import { PageHeader } from '../shared/components/PageHeader';
import './ExpiryWarningPage.css';

interface ExpiryWarningPageProps {
  facilityId: string;
}

export function ExpiryWarningPage({ facilityId }: ExpiryWarningPageProps) {
  const [warnings, setWarnings] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffQuantity, setWriteOffQuantity] = useState<number>(1);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writingOff, setWritingOff] = useState(false);

  useEffect(() => {
    loadWarnings();
  }, [facilityId]);

  async function loadWarnings() {
    try {
      setLoading(true);
      setError(null);
      const data = await getExpiryWarnings(facilityId);
      setWarnings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expiry warnings');
    } finally {
      setLoading(false);
    }
  }

  async function handleWriteOff() {
    if (!selectedBatch || writeOffQuantity <= 0 || !writeOffReason.trim()) {
      setError('Please enter valid quantity and reason');
      return;
    }

    try {
      setWritingOff(true);
      setError(null);

      const payload: WriteOffPayload = {
        quantity: writeOffQuantity,
        reason: writeOffReason.trim()
      };

      await writeOffStock(selectedBatch.id, payload);

      // Remove from warnings if quantity was 0 after write-off
      setWarnings(warnings.filter(b => b.id !== selectedBatch.id));
      setShowWriteOffModal(false);
      setSelectedBatch(null);
      setWriteOffQuantity(1);
      setWriteOffReason('');

      // Reload to get updated data
      loadWarnings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write off stock');
    } finally {
      setWritingOff(false);
    }
  }

  function getDaysUntilExpiry(expiryDate: string): number {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getWarningLevel(daysUntilExpiry: number): 'critical' | 'warning' | 'alert' {
    if (daysUntilExpiry < 0) return 'critical'; // Already expired
    if (daysUntilExpiry <= 7) return 'critical'; // Expiring very soon
    if (daysUntilExpiry <= 30) return 'warning';
    return 'alert';
  }

  return (
    <div className="expiry-warning-page">
      <PageHeader 
        title="Stock Expiry Warnings" 
        description="Monitor and manage stock approaching expiry date"
      />

      {error && (
        <Card className="error-card">
          <div className="error-content">
            <AlertTriangle className="error-icon" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="loading-card">
          <Loader className="spinner" />
          <p>Loading expiry warnings...</p>
        </Card>
      ) : warnings.length === 0 ? (
        <Card className="empty-card">
          <p>No stock expiring within the warning window</p>
        </Card>
      ) : (
        <div className="warnings-container">
          <div className="warnings-summary">
            <p className="total-warnings">
              {warnings.length} batch{warnings.length === 1 ? '' : 'es'} expiring soon
            </p>
          </div>

          <div className="warnings-list">
            {warnings.map((batch) => {
              const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
              const warningLevel = getWarningLevel(daysUntilExpiry);

              return (
                <Card key={batch.id} className={`warning-card warning-${warningLevel}`}>
                  <div className="warning-header">
                    <div className="warning-title">
                      <AlertTriangle className={`warning-icon warning-${warningLevel}`} />
                      <div className="drug-info">
                        <h3>{batch.drugName}</h3>
                        <p className="batch-details">
                          Batch: {batch.batchNumber} • Barcode: {batch.barcode}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="danger-button"
                      size="sm"
                      onClick={() => {
                        setSelectedBatch(batch);
                        setWriteOffQuantity(Math.min(5, batch.quantityOnHand));
                        setShowWriteOffModal(true);
                      }}
                    >
                      <Trash2 size={16} />
                      Write Off
                    </Button>
                  </div>

                  <div className="warning-details">
                    <div className="detail-row">
                      <span className="detail-label">Expiry Date:</span>
                      <span className={`detail-value expiry-date expiry-${warningLevel}`}>
                        {new Date(batch.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Days Until Expiry:</span>
                      <span className={`detail-value days-${warningLevel}`}>
                        {daysUntilExpiry < 0 ? '⚠️ EXPIRED' : `${daysUntilExpiry} days`}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Quantity on Hand:</span>
                      <span className="detail-value">{batch.quantityOnHand} units</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Write-off Modal */}
      {showWriteOffModal && selectedBatch && (
        <div className="modal-overlay" onClick={() => setShowWriteOffModal(false)}>
          <Card className="write-off-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Write Off Stock</h2>
            <p className="modal-subtitle">
              {selectedBatch.drugName} ({selectedBatch.batchNumber})
            </p>

            <div className="form-group">
              <label htmlFor="quantity">Quantity to Write Off:</label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={selectedBatch.quantityOnHand}
                value={writeOffQuantity}
                onChange={(e) => setWriteOffQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="form-input"
              />
              <p className="form-hint">Maximum: {selectedBatch.quantityOnHand} units</p>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Write-off:</label>
              <textarea
                id="reason"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                placeholder="e.g., Stock expired, damaged, recall"
                className="form-textarea"
                rows={3}
              />
            </div>

            {error && (
              <div className="form-error">{error}</div>
            )}

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowWriteOffModal(false);
                  setError(null);
                }}
                disabled={writingOff}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="danger-button"
                onClick={handleWriteOff}
                disabled={writingOff || writeOffQuantity <= 0 || !writeOffReason.trim()}
              >
                {writingOff ? 'Processing...' : 'Confirm Write-off'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

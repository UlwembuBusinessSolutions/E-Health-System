import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { receiveStock } from '../shared/api/pharmacy';
import type { StockBatch, ReceiveStockPayload } from '../shared/api/pharmacy';
import { Button } from '../shared/components/Button';
import { Card } from '../shared/components/Card';
import { PageHeader } from '../shared/components/PageHeader';
import { Input } from '../shared/components/Input';
import './ReceiveStockScreen.css';

interface ReceiveStockScreenProps {
  facilityId: string;
  onSuccess?: (batch: StockBatch) => void;
}

export function ReceiveStockScreen({ facilityId, onSuccess }: ReceiveStockScreenProps) {
  const [formData, setFormData] = useState<ReceiveStockPayload>({
    facilityId,
    drugName: '',
    batchNumber: '',
    barcode: '',
    expiryDate: '',
    quantity: 1
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!formData.drugName.trim()) {
      setError('Drug name is required');
      return;
    }
    if (!formData.batchNumber.trim()) {
      setError('Batch number is required');
      return;
    }
    if (!formData.barcode.trim()) {
      setError('Barcode is required');
      return;
    }
    if (!formData.expiryDate) {
      setError('Expiry date is required');
      return;
    }
    if (formData.quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    // Validate expiry date is in the future
    const expiryDate = new Date(formData.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiryDate <= today) {
      setError('Expiry date must be in the future');
      return;
    }

    try {
      setLoading(true);
      const batch = await receiveStock(formData);
      setSuccess(`Stock received successfully! Batch ID: ${batch.id}`);
      
      // Reset form
      setFormData({
        facilityId,
        drugName: '',
        batchNumber: '',
        barcode: '',
        expiryDate: '',
        quantity: 1
      });

      if (onSuccess) {
        onSuccess(batch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive stock');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(field: keyof ReceiveStockPayload, value: any) {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }

  return (
    <div className="receive-stock-screen">
      <PageHeader 
        title="Receive Stock" 
        description="Add new medication batches to inventory"
      />

      <Card className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Stock Details</h2>
            
            <div className="form-row">
              <div className="form-group">
                <Input
                  id="drugName"
                  label="Drug Name"
                  type="text"
                  placeholder="e.g., Aspirin 500mg"
                  value={formData.drugName}
                  onChange={(e) => handleInputChange('drugName', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="form-group">
                <Input
                  id="batchNumber"
                  label="Batch Number"
                  type="text"
                  placeholder="e.g., B12345"
                  value={formData.batchNumber}
                  onChange={(e) => handleInputChange('batchNumber', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <Input
                  id="barcode"
                  label="Barcode"
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={formData.barcode}
                  onChange={(e) => handleInputChange('barcode', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="form-group">
                <Input
                  id="expiryDate"
                  label="Expiry Date"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <Input
                  id="quantity"
                  label="Quantity (Units)"
                  type="number"
                  min="1"
                  placeholder="Number of units"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <CheckCircle size={20} />
              <p>{success}</p>
            </div>
          )}

          <div className="form-actions">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader size={18} className="spinner" />
                  Processing...
                </>
              ) : (
                'Receive Stock'
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="info-card">
        <h3>Important Information</h3>
        <ul className="info-list">
          <li>
            <strong>Expiry Date:</strong> Must be in the future. Stock cannot be received with a past expiry date.
          </li>
          <li>
            <strong>Barcode:</strong> Must be unique within the facility. Use the barcode scanner for accuracy.
          </li>
          <li>
            <strong>Quantity:</strong> This is the initial quantity on hand for this batch.
          </li>
          <li>
            <strong>Audit Trail:</strong> All stock received is logged for compliance and traceability.
          </li>
          <li>
            <strong>Expiry Warnings:</strong> Stock expiring within 90 days will appear in the Expiry Warnings report.
          </li>
        </ul>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import axios from 'axios';

function ReportButton({ messageId }) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      await axios.post('/api/report', {
        description: `Message ID ${messageId}: ${description}`,
      });
      setSuccess(true);
      setDescription('');
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-button-container" style={{ display: 'inline-block', marginLeft: '8px' }}>
      <button
        onClick={() => setShowModal(true)}
        className="report-trigger-btn"
        title="Report Message"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          opacity: 0.6,
          transition: 'opacity 0.2s, transform 0.2s',
          padding: '2px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'scale(1.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        🚩
      </button>

      {showModal && (
        <div
          className="report-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="report-modal-content"
            style={{
              background: '#1e272e',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              color: '#fff',
              fontFamily: 'inherit',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4757' }}>
              🚩 Report Message
            </h3>
            
            {success ? (
              <div style={{ color: '#2ed573', textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                Report submitted successfully!
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p style={{ fontSize: '13px', color: '#a4b0be', margin: '0 0 16px 0' }}>
                  Please describe what is wrong with this message (e.g., harassment, spam, bug, word filter bypass).
                </p>
                
                {error && (
                  <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid #ff4757', color: '#ff4757', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
                    {error}
                  </div>
                )}

                <textarea
                  required
                  placeholder="Enter details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '90%',
                    height: '100px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'none',
                    outline: 'none',
                    marginBottom: '16px',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    style={{
                      background: '#ff4757',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      opacity: submitting || !description.trim() ? 0.5 : 1,
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportButton;

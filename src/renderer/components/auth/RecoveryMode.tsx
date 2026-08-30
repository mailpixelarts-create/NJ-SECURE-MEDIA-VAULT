import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export const RecoveryMode: React.FC = () => {
  const [phraseWords, setPhraseWords] = useState<string[]>(Array(24).fill(''));
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPhrase, setNewPhrase] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...phraseWords];
    newWords[index] = value;
    setPhraseWords(newWords);
  };

  const handlePasteFullPhrase = async () => {
    const clipboardText = await navigator.clipboard.readText();
    const words = clipboardText.trim().split(/\s+/);
    
    if (words.length === 24) {
      setPhraseWords(words);
    } else {
      setError('Invalid phrase format. Expected 24 words.');
    }
  };

  const handleRecover = async () => {
    setIsRecovering(true);
    setError(null);
    setSuccess(null);
    
    const phrase = phraseWords.join(' ').trim();
    
    if (phraseWords.some(word => !word)) {
      setError('Please enter all 24 words');
      setIsRecovering(false);
      return;
    }
    
    try {
      const result = await window.electronAPI.recovery.recover(phrase);
      
      if (result.success) {
        setSuccess(result.message);
        setNewPhrase(result.newPhrase);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="recovery-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="recovery-container"
      >
        <div className="recovery-header">
          <h1>🔑 Recovery Mode</h1>
          <p className="subtitle">
            Enter your 24-word recovery phrase to regain access
          </p>
        </div>
        
        {!success ? (
          <>
            <div className="warning-box">
              <p className="warning-text">
                ⚠️ Security Notice:
                <br />
                • Recovery phrase can only be used once
                <br />
                • A new phrase will be generated after recovery
                <br />
                • All vault data remains encrypted
                <br />
                • Failed attempts are logged and rate-limited
              </p>
            </div>
            
            <div className="phrase-input-grid">
              {phraseWords.map((word, index) => (
                <div key={index} className="phrase-input-item">
                  <span className="phrase-number">{index + 1}</span>
                  <input
                    className="phrase-word-input"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    placeholder={`Word ${index + 1}`}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={handlePasteFullPhrase}
              icon="📋"
            >
              Paste Full Phrase
            </Button>
            
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}
            
            <div className="recovery-actions">
              <Button variant="ghost" onClick={() => navigate('/login')}>
                ← Back to Login
              </Button>
              
              <Button
                variant="primary"
                onClick={handleRecover}
                loading={isRecovering}
                disabled={phraseWords.some(word => !word)}
                icon="🔓"
              >
                {isRecovering ? 'Recovering...' : 'Recover Access'}
              </Button>
            </div>
          </>
        ) : (
          <div className="recovery-success">
            <div className="success-icon">✅</div>
            <h2>Recovery Successful!</h2>
            <p>{success}</p>
            
            {newPhrase && (
              <div className="new-phrase-section">
                <h3>Your New Recovery Phrase:</h3>
                <div className="phrase-grid">
                  {newPhrase.split(' ').map((word, index) => (
                    <div key={index} className="phrase-word">
                      <span className="word-number">{index + 1}</span>
                      <span className="word-text">{word}</span>
                    </div>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  icon="📋"
                  onClick={() => navigator.clipboard.writeText(newPhrase)}
                >
                  Copy New Phrase
                </Button>
              </div>
            )}
            
            <p className="redirect-message">
              Redirecting to login in 3 seconds...
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

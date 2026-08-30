import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface Template {
  id: string;
  name: string;
  description: string;
  domain: string;
  authType: string;
  mediaTypes: string[];
  settings: any;
  isBuiltIn: boolean;
}

interface TemplateSelectorProps {
  selectedTemplateId?: string;
  onSelect: (template: Template | null) => void;
  onClose: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  onSelect,
  onClose
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const all = await window.electronAPI.templates.getAll();
      setTemplates(all);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
    setLoading(false);
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAuthBadge = (authType: string) => {
    switch (authType) {
      case 'cookies': return { label: '🍪 Cookies', color: 'var(--accent-warning)' };
      case 'username': return { label: '🔑 Login', color: 'var(--accent-danger)' };
      case 'oauth': return { label: '🔐 OAuth', color: 'var(--accent-info)' };
      default: return { label: '🌐 No Auth', color: 'var(--accent-secondary)' };
    }
  };

  const getMediaIcons = (types: string[]) => {
    return types.map(t => {
      switch (t) {
        case 'image': return '🖼';
        case 'video': return '🎥';
        case 'audio': return '🎵';
        default: return '📄';
      }
    }).join(' ');
  };

  return (
    <div className="template-selector">
      <div className="browser-toolbar">
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search templates..."
          icon="🔍"
        />
        <Button variant="ghost" size="sm" onClick={onClose}>✕ Close</Button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading templates...
        </div>
      ) : (
        <div className="template-grid">
          {filteredTemplates.map(template => {
            const authBadge = getAuthBadge(template.authType);
            const isSelected = template.id === selectedTemplateId;

            return (
              <motion.div
                key={template.id}
                className={`template-card ${isSelected ? 'selected' : ''}`}
                whileHover={{ scale: 1.02 }}
                onClick={() => onSelect(isSelected ? null : template)}
              >
                <div className="template-header">
                  <span className="template-name">{template.name}</span>
                  {template.isBuiltIn && <span className="template-badge built-in">Built-in</span>}
                </div>
                <p className="template-description">{template.description}</p>
                <div className="template-meta">
                  <span className="template-domain">🌐 {template.domain}</span>
                  <span className="template-auth" style={{ color: authBadge.color }}>
                    {authBadge.label}
                  </span>
                </div>
                <div className="template-media">
                  {getMediaIcons(template.mediaTypes)}
                </div>
                {isSelected && (
                  <div className="template-selected-indicator">✓</div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No templates found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
};

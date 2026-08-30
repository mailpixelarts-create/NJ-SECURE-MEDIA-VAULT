import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';

interface Project {
  id: string;
  name: string;
  description: string;
  urls: string[];
  templateId?: string;
  settings: any;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: Project) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  onClose,
  onLoadProject
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', tags: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) loadProjects();
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      const all = await window.electronAPI.projects.getAll();
      setProjects(all);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
    setLoading(false);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      await window.electronAPI.projects.create({
        name: newProject.name,
        description: newProject.description,
        urls: [],
        settings: {},
        tags: newProject.tags.split(',').map(t => t.trim()).filter(Boolean)
      });
      setNewProject({ name: '', description: '', tags: '' });
      setShowCreate(false);
      loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    try {
      await window.electronAPI.projects.delete(id);
      loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleLoad = (project: Project) => {
    onLoadProject(project);
    onClose();
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📂 Projects"
      size="lg"
    >
      <div className="project-manager">
        <div className="browser-toolbar">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search projects..."
            icon="🔍"
          />
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            ➕ New Project
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading projects...
          </div>
        ) : (
          <div className="project-list">
            {filteredProjects.map(project => (
              <motion.div
                key={project.id}
                className="project-card"
                whileHover={{ scale: 1.01 }}
              >
                <div className="project-info">
                  <h3 className="project-name">{project.name}</h3>
                  <p className="project-description">{project.description || 'No description'}</p>
                  <div className="project-meta">
                    <span>📄 {project.urls.length} URLs</span>
                    <span>📅 {formatDate(project.updatedAt)}</span>
                    {project.tags.length > 0 && (
                      <span className="project-tags">
                        {project.tags.map(t => `#${t}`).join(' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="project-actions">
                  <Button variant="primary" size="sm" onClick={() => handleLoad(project)}>
                    📂 Load
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                    🗑
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredProjects.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {projects.length === 0 ? 'No projects yet. Create one to get started!' : 'No projects match your search.'}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Project"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newProject.name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="new-folder-form">
          <Input
            label="Project Name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            placeholder="My Download Project"
            autoFocus
          />
          <Input
            label="Description"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            placeholder="What this project is for..."
          />
          <Input
            label="Tags (comma-separated)"
            value={newProject.tags}
            onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
            placeholder="instagram, gallery, 2024"
          />
        </div>
      </Modal>
    </Modal>
  );
};

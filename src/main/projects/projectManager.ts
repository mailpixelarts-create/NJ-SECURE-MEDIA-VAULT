/**
 * Project Manager for saving and loading download projects.
 * Projects contain URL lists, settings, and template references.
 */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface DownloadProject {
  id: string;
  name: string;
  description: string;
  urls: string[];
  templateId?: string;
  settings: {
    quality?: string;
    format?: string;
    destination?: string;
    scrubMetadata?: boolean;
    useCookies?: boolean;
    concurrency?: number;
  };
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export class ProjectManager {
  private static instance: ProjectManager;
  private projectsPath: string;
  private projects: DownloadProject[] = [];

  private constructor() {
    this.projectsPath = path.join(app.getPath('userData'), 'projects.json');
    this.loadProjects();
  }

  static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  private loadProjects(): void {
    try {
      if (fs.existsSync(this.projectsPath)) {
        this.projects = JSON.parse(fs.readFileSync(this.projectsPath, 'utf-8'));
      }
    } catch {
      this.projects = [];
    }
  }

  private saveProjects(): void {
    try {
      fs.writeFileSync(this.projectsPath, JSON.stringify(this.projects, null, 2));
    } catch (err) {
      console.error('Failed to save projects:', err);
    }
  }

  getAll(): DownloadProject[] {
    return [...this.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getById(id: string): DownloadProject | undefined {
    return this.projects.find(p => p.id === id);
  }

  search(query: string): DownloadProject[] {
    const q = query.toLowerCase();
    return this.projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  create(data: Omit<DownloadProject, 'id' | 'createdAt' | 'updatedAt'>): DownloadProject {
    const project: DownloadProject = {
      ...data,
      id: `project_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.projects.push(project);
    this.saveProjects();
    return project;
  }

  update(id: string, updates: Partial<DownloadProject>): boolean {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.projects[index] = {
      ...this.projects[index],
      ...updates,
      updatedAt: Date.now()
    };
    this.saveProjects();
    return true;
  }

  delete(id: string): boolean {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.projects.splice(index, 1);
    this.saveProjects();
    return true;
  }

  addUrls(id: string, urls: string[]): boolean {
    const project = this.projects.find(p => p.id === id);
    if (!project) return false;

    const newUrls = [...new Set([...project.urls, ...urls])];
    project.urls = newUrls;
    project.updatedAt = Date.now();
    this.saveProjects();
    return true;
  }

  removeUrl(id: string, url: string): boolean {
    const project = this.projects.find(p => p.id === id);
    if (!project) return false;

    project.urls = project.urls.filter(u => u !== url);
    project.updatedAt = Date.now();
    this.saveProjects();
    return true;
  }

  exportProject(id: string): string | null {
    const project = this.projects.find(p => p.id === id);
    if (!project) return null;
    return JSON.stringify(project, null, 2);
  }

  importProject(json: string): DownloadProject | null {
    try {
      const data = JSON.parse(json) as DownloadProject;
      return this.create({
        name: data.name + ' (imported)',
        description: data.description,
        urls: data.urls,
        templateId: data.templateId,
        settings: data.settings,
        tags: [...data.tags, 'imported']
      });
    } catch {
      return null;
    }
  }
}

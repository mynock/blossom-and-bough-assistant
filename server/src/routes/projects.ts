import { Router } from 'express';
import { ProjectService } from '../services/ProjectService';

const router = Router();
const projectService = new ProjectService();

// GET /api/projects - Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, clientId, search } = req.query;
    
    let projects;
    
    if (status) {
      projects = await projectService.getProjectsByStatus(status as string);
    } else if (clientId) {
      const clientIdNum = parseInt(clientId as string);
      if (isNaN(clientIdNum)) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }
      projects = await projectService.getProjectsByClientId(clientIdNum);
    } else if (search) {
      projects = await projectService.searchProjects(search as string);
    } else {
      projects = await projectService.getAllProjects();
    }
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await projectService.getProjectById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', async (req, res) => {
  try {
    const projectData = req.body;
    
    // Validate required fields
    if (!projectData.name || !projectData.clientId || !projectData.status) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, clientId, and status are required' 
      });
    }

    const newProject = await projectService.createProject(projectData);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const projectData = req.body;
    const updatedProject = await projectService.updateProject(id, projectData);
    
    if (!updatedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const success = await projectService.deleteProject(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(204).send(); // No content response for successful delete
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router; 
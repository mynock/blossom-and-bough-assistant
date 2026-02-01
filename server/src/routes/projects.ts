import { Router } from 'express';
import { services } from '../services/container';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const projectService = services.projectService;

// GET /api/projects - Get all projects
router.get('/', asyncHandler(async (req, res) => {
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
}));

// GET /api/projects/:id - Get project by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const project = await projectService.getProjectById(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
}));

// POST /api/projects - Create new project
router.post('/', asyncHandler(async (req, res) => {
  const projectData = req.body;

  // Validate required fields
  if (!projectData.name || !projectData.clientId || !projectData.status) {
    return res.status(400).json({
      error: 'Missing required fields: name, clientId, and status are required'
    });
  }

  const newProject = await projectService.createProject(projectData);
  res.status(201).json(newProject);
}));

// PUT /api/projects/:id - Update project
router.put('/:id', asyncHandler(async (req, res) => {
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
}));

// DELETE /api/projects/:id - Delete project
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const success = await projectService.deleteProject(id);

  if (!success) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.status(204).send(); // No content response for successful delete
}));

export default router; 
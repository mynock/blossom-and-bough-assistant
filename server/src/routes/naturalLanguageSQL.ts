import express from 'express';
import { requireAuth } from '../middleware/auth';
import { NaturalLanguageSQLService, NaturalLanguageQueryRequest } from '../services/NaturalLanguageSQLService';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Initialize the service
const nlSQLService = new NaturalLanguageSQLService();

// POST /api/natural-language-sql/query
// Process a natural language question and return SQL results
router.post('/query', async (req, res) => {
  try {
    const { question, includeChartConfig = true }: NaturalLanguageQueryRequest = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required and must be a non-empty string'
      });
    }

    console.log(`🔍 Natural language SQL query request from user: ${req.user?.email}`);
    console.log(`📝 Question: ${question}`);

    const result = await nlSQLService.processNaturalLanguageQuery({
      question: question.trim(),
      includeChartConfig
    });

    console.log(`✅ Query processed successfully, returning ${result.rowCount} rows`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Natural language SQL query error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API client not initialized')) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'The AI service is not properly configured. Please contact support.'
        });
      }

      if (error.message.includes('SQL execution failed')) {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'The generated SQL query was invalid. Please try rephrasing your question.'
        });
      }

      if (error.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your question.'
    });
  }
});

// GET /api/natural-language-sql/examples
// Return example questions users can ask
router.get('/examples', async (req, res) => {
  try {
    const examples = [
      {
        category: 'Business Overview',
        questions: [
          'How many clients do we have?',
          'What are our top 5 clients by revenue this year?',
          'How many employees are currently active?'
        ]
      },
      {
        category: 'Work Activities',
        questions: [
          'Show me work activities from this month',
          'What type of work do we do most often?',
          'How many hours of work did we complete last week?',
          'Which employees worked the most hours this month?'
        ]
      },
      {
        category: 'Financial Analysis',
        questions: [
          'What is our total billable hours for this year?',
          'Show me our revenue by month',
          'Which clients generated the most revenue?',
          'What are our most expensive projects?'
        ]
      },
      {
        category: 'Client Analysis',
        questions: [
          'Which clients are on maintenance schedules?',
          'Show me clients by geographical zone',
          'Which clients have the most work activities?',
          'What are the average hours per maintenance visit?'
        ]
      },
      {
        category: 'Operational Insights',
        questions: [
          'How much travel time do we spend per week?',
          'What is our average break time per work activity?',
          'Show me work activities by status',
          'Which projects are still active?'
        ]
      }
    ];

    res.json({
      success: true,
      data: examples
    });

  } catch (error) {
    console.error('❌ Error fetching examples:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch example questions.'
    });
  }
});

// GET /api/natural-language-sql/schema
// Return database schema information for advanced users
router.get('/schema', async (req, res) => {
  try {
    const schema = {
      tables: [
        {
          name: 'clients',
          description: 'Customer information and maintenance settings',
          columns: [
            { name: 'id', type: 'serial', description: 'Primary key' },
            { name: 'name', type: 'text', description: 'Client name' },
            { name: 'address', type: 'text', description: 'Client address' },
            { name: 'geo_zone', type: 'text', description: 'Geographical zone' },
            { name: 'is_recurring_maintenance', type: 'boolean', description: 'Has recurring maintenance' },
            { name: 'active_status', type: 'text', description: 'Active status' }
          ]
        },
        {
          name: 'employees',
          description: 'Employee information and work settings',
          columns: [
            { name: 'id', type: 'serial', description: 'Primary key' },
            { name: 'name', type: 'text', description: 'Employee name' },
            { name: 'hourly_rate', type: 'real', description: 'Hourly rate' },
            { name: 'capability_level', type: 'real', description: 'Skill level' },
            { name: 'active_status', type: 'text', description: 'Active status' }
          ]
        },
        {
          name: 'work_activities',
          description: 'Individual work sessions and job records',
          columns: [
            { name: 'id', type: 'serial', description: 'Primary key' },
            { name: 'work_type', type: 'text', description: 'Type of work (maintenance, install, etc.)' },
            { name: 'date', type: 'text', description: 'Work date (ISO format)' },
            { name: 'billable_hours', type: 'real', description: 'Billable hours' },
            { name: 'total_hours', type: 'real', description: 'Total hours worked' },
            { name: 'client_id', type: 'integer', description: 'Reference to client' },
            { name: 'status', type: 'text', description: 'Work status' }
          ]
        },
        {
          name: 'projects',
          description: 'Client projects and jobs',
          columns: [
            { name: 'id', type: 'serial', description: 'Primary key' },
            { name: 'name', type: 'text', description: 'Project name' },
            { name: 'client_id', type: 'integer', description: 'Reference to client' },
            { name: 'status', type: 'text', description: 'Project status' }
          ]
        },
        {
          name: 'invoices',
          description: 'Customer invoices and billing',
          columns: [
            { name: 'id', type: 'serial', description: 'Primary key' },
            { name: 'client_id', type: 'integer', description: 'Reference to client' },
            { name: 'total_amount', type: 'real', description: 'Invoice total' },
            { name: 'status', type: 'text', description: 'Invoice status' },
            { name: 'invoice_date', type: 'text', description: 'Invoice date' }
          ]
        }
      ],
      commonJoins: [
        'JOIN clients c ON wa.client_id = c.id',
        'JOIN employees e ON wae.employee_id = e.id',
        'JOIN work_activity_employees wae ON wa.id = wae.work_activity_id',
        'JOIN projects p ON wa.project_id = p.id'
      ],
      tips: [
        'Use proper JOINs to get meaningful names instead of IDs',
        'Date fields are stored as text in ISO format (YYYY-MM-DD)',
        'Consider filtering by active_status where relevant',
        'Use GROUP BY for aggregations like SUM, COUNT, AVG'
      ]
    };

    res.json({
      success: true,
      data: schema
    });

  } catch (error) {
    console.error('❌ Error fetching schema:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch database schema.'
    });
  }
});

export default router;
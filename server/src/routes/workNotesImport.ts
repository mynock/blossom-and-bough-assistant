import express from 'express';
import multer from 'multer';
import { WorkNotesParserService } from '../services/WorkNotesParserService';
import { AnthropicService } from '../services/AnthropicService';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024, // 32MB limit (Anthropic's limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept PDFs and text files
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'));
    }
  }
});

// Create a factory function that accepts the anthropicService
export function createWorkNotesImportRouter(anthropicService: AnthropicService) {
  const router = express.Router();
  const workNotesParserService = new WorkNotesParserService(anthropicService);

  /**
   * POST /api/work-notes/parse
   * Parse work notes text and return preview with validation
   */
  router.post('/parse', async (req, res) => {
    try {
      const { workNotesText } = req.body;

      if (!workNotesText || typeof workNotesText !== 'string') {
        return res.status(400).json({ 
          error: 'workNotesText is required and must be a string' 
        });
      }

      if (workNotesText.length > 50000) {
        return res.status(400).json({ 
          error: 'Work notes text is too long (max 50,000 characters)' 
        });
      }

      console.log(`📝 Parsing work notes (${workNotesText.length} characters)...`);
      
      const preview = await workNotesParserService.parseAndPreview(workNotesText);
      
      console.log(`✅ Parsed ${preview.summary.totalActivities} activities (${preview.summary.validActivities} valid)`);
      
      res.json(preview);
    } catch (error) {
      console.error('Error parsing work notes:', error);
      res.status(500).json({ 
        error: 'Failed to parse work notes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/work-notes/upload
   * Upload and parse work notes from file (PDF or text)
   */
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded' 
        });
      }

      const { file } = req;
      console.log(`📁 Processing uploaded file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

      let preview;

      if (file.mimetype === 'application/pdf') {
        // Handle PDF files using Anthropic's native PDF support
        console.log(`📄 Processing PDF file with AI...`);
        const aiResult = await anthropicService.parseWorkNotesFromPDF(file.buffer, file.originalname);
        preview = await workNotesParserService.validateAndPreview(aiResult);
      } else if (file.mimetype === 'text/plain') {
        // Handle text files
        const workNotesText = file.buffer.toString('utf-8');
        preview = await workNotesParserService.parseAndPreview(workNotesText);
      } else {
        return res.status(400).json({
          error: 'Unsupported file type. Only PDF and text files are supported.'
        });
      }

      if (preview.activities.length === 0) {
        return res.status(400).json({ 
          error: 'No work activities could be extracted from the file. Please check the file format and content.' 
        });
      }

      console.log(`✅ Parsed ${preview.summary.totalActivities} activities (${preview.summary.validActivities} valid)`);
      
      res.json({
        ...preview,
        sourceFile: {
          name: file.originalname,
          size: file.size,
          type: file.mimetype
        }
      });
    } catch (error) {
      console.error('Error processing uploaded file:', error);
      res.status(500).json({ 
        error: 'Failed to process uploaded file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/work-notes/import
   * Import validated activities to database
   */
  router.post('/import', async (req, res) => {
    try {
      const { activities } = req.body;

      if (!Array.isArray(activities)) {
        return res.status(400).json({ 
          error: 'activities must be an array' 
        });
      }

      if (activities.length === 0) {
        return res.status(400).json({ 
          error: 'No activities provided for import' 
        });
      }

      console.log(`💾 Importing ${activities.length} activities...`);
      
      const results = await workNotesParserService.importActivities(activities);
      
      console.log(`✅ Import complete: ${results.imported} imported, ${results.failed} failed`);
      
      res.json(results);
    } catch (error) {
      console.error('Error importing activities:', error);
      res.status(500).json({ 
        error: 'Failed to import activities',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/work-notes/templates
   * Get example templates and formatting tips
   */
  router.get('/templates', async (req, res) => {
    try {
      const templates = {
        examples: [
          {
            title: "Basic Daily Entry",
            description: "Simple single-day work log with time tracking",
            text: `6/3
Time: 8:45-3:10 w V inc 22x2 min drive
Lunch: 12:35-2
Stoller
Work Completed:
- Misc clean up/weeds
- Deadhead brunnera
- Prune choisya (n side)`
          },
          {
            title: "Multiple Clients",
            description: "Multiple clients worked on the same day",
            text: `5/13
Time: 8:30-4:15 w R
Nadler - 8:30-11:45
- Weeding front beds
- Pruning roses
- Charge: 2 debris bags

Kurzweil - 1:00-4:15
- Installation: 3 hostas, 2 ferns
- Mulching new plantings
- Charge: Plants $120, mulch 3 yards`
          },
          {
            title: "With Charges",
            description: "Work entry including material charges",
            text: `6/15
Solo work - 9:00-2:30
Silver
Work Completed:
- Spring cleanup
- Deadheading perennials
- Applied fertilizer
Charges:
- Sluggo application
- Fertilizer treatment
- 3 debris bags removal`
          }
        ],
        patterns: {
          timeFormats: [
            "8:45-3:10 w V (with Virginia)",
            "R 8:30-4:15, Me 9:40-5 (Rebecca and Me different times)",
            "solo 9:00-2:30 (working alone)",
            "on site 9/9:25-11:45 inc lil break (complex timing)"
          ],
          employeeCodes: {
            "V": "Virginia",
            "R": "Rebecca", 
            "A": "Anne",
            "M": "Megan",
            "solo": "Andrea (working alone)"
          },
          chargeFormats: [
            "charge 1 debris bag",
            "Charge: Sluggo, fert, 2-3 bags debris",
            "Plants $120, mulch 3 yards",
            "3 aspidistra (60 pdxn)"
          ]
        },
        tips: [
          "Start each entry with the date (e.g., '6/3', '5/13')",
          "Include time ranges and employee codes (e.g., '8:45-3:10 w V')",
          "List client names clearly on their own line",
          "Use bullet points for work completed",
          "Include charges and materials used",
          "Note drive time if significant (e.g., 'inc 22x2 min drive')",
          "Mention lunch breaks for accurate time tracking"
        ]
      };
      
      res.json(templates);
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({ 
        error: 'Failed to get templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/work-notes/stats
   * Get import statistics and history
   */
  router.get('/stats', async (req, res) => {
    try {
      // For now, return basic stats
      // In the future, this could query the database for actual statistics
      const stats = {
        totalImports: 0,
        totalActivities: 0,
        lastImport: null,
        averageActivitiesPerImport: 0,
        topClients: [],
        recentImports: []
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ 
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
} 
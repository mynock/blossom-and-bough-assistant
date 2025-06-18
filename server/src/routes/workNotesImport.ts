import express from 'express';
import { WorkNotesParserService } from '../services/WorkNotesParserService';
import { AnthropicService } from '../services/AnthropicService';

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
   * POST /api/work-notes/import
   * Import validated work activities to the database
   */
  router.post('/import', async (req, res) => {
    try {
      const { activities } = req.body;

      if (!activities || !Array.isArray(activities)) {
        return res.status(400).json({ 
          error: 'activities array is required' 
        });
      }

      if (activities.length === 0) {
        return res.status(400).json({ 
          error: 'No activities to import' 
        });
      }

      console.log(`📥 Importing ${activities.length} work activities...`);
      
      const results = await workNotesParserService.importActivities(activities);
      
      console.log(`✅ Import complete: ${results.imported} imported, ${results.failed} failed`);
      
      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      console.error('Error importing work activities:', error);
      res.status(500).json({ 
        error: 'Failed to import work activities',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/work-notes/templates
   * Get parsing templates and examples
   */
  router.get('/templates', async (req, res) => {
    try {
      const templates = {
        examples: [
          {
            title: "Single Client Entry",
            description: "Basic work entry for one client",
            text: `6/3
Time: 8:45-3:10 w V inc 22x2 min drive
Lunch: 12:35-2
Work Completed:
- Misc clean up/weeds
- Deadhead brunnera
- Prune choisya (n side)
- Take photos for design drawing`
          },
          {
            title: "Multi-Client Day",
            description: "Multiple clients in one day",
            text: `6/10 w Anne & V
Silver
Kabeiseman on site 1:30-3:50 (V stayed extra 10 min) charge 1 debris bag
Kurzweil me & Anne til 5:10 - light weeds, debris, deadheading, sluggo`
          },
          {
            title: "Solo Work",
            description: "Solo work with charges",
            text: `5/29 solo
Stassi on site 9/9:25-11:45 inc lil break, add .5 drive
Weeds, debris clean up, pruning hinokis, sluggo
Charge: Sluggo, fert, 2-3 bags debris`
          }
        ],
        patterns: {
          timeFormats: [
            "8:45-3:10",
            "on site 9/9:25-11:45",
            "R 8:30-4:15, Me 9:40-5"
          ],
          employeeCodes: {
            "V": "Virginia",
            "R": "Rebecca", 
            "A": "Anne",
            "M": "Megan",
            "solo": "Solo work",
            "w V": "With Virginia"
          },
          chargeFormats: [
            "charge 1 debris bag",
            "Charge: Sluggo, fert, 2-3 bags debris",
            "3 aspidistra (60 pdxn)"
          ]
        },
        tips: [
          "Use consistent date formats (6/3, 5/29, etc.)",
          "Include employee codes (w V, w R, solo)",
          "List work tasks as bullet points",
          "Mention charges and materials used",
          "Include drive time and lunch breaks for accurate hour calculations"
        ]
      };

      res.json(templates);
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({ 
        error: 'Failed to get templates' 
      });
    }
  });

  /**
   * GET /api/work-notes/stats
   * Get import statistics and history
   */
  router.get('/stats', async (req, res) => {
    try {
      // TODO: Implement import history tracking
      const stats = {
        totalImports: 0,
        totalActivities: 0,
        averageParsingAccuracy: 0,
        lastImportDate: null,
        commonIssues: [
          "Client name matching",
          "Employee code recognition", 
          "Date format parsing",
          "Hour calculation accuracy"
        ]
      };

      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ 
        error: 'Failed to get stats' 
      });
    }
  });

  return router;
} 
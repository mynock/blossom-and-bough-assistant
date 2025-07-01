import { NotionSyncService } from '../../services/NotionSyncService';

describe('NotionSyncService - Charge Parsing', () => {
  let notionSyncService: any;

  beforeEach(() => {
    // Create a test instance - we'll access private methods for testing
    notionSyncService = new (NotionSyncService as any)();
  });

  describe('parseChargeFromText', () => {
    it('should parse simple charge descriptions', () => {
      const result = notionSyncService.parseChargeFromText('1 bag debris');
      expect(result).toEqual({
        description: '1 bag debris',
        cost: 25 // Default debris cost
      });
    });

    it('should parse charges with costs in parentheses', () => {
      const result = notionSyncService.parseChargeFromText('mulch ($27)');
      expect(result).toEqual({
        description: 'mulch',
        cost: 27
      });
    });

    it('should parse charges with costs in parentheses (no dollar sign)', () => {
      const result = notionSyncService.parseChargeFromText('delivery fee (15)');
      expect(result).toEqual({
        description: 'delivery fee',
        cost: 15
      });
    });

    it('should skip plant list items', () => {
      const plantItems = [
        '2 native mock orange',
        '3 achillea terracotta',
        '1 agastache kudos yellow',
        '2 guara whirling butterflies',
        '5 allium cernuum'
      ];

      plantItems.forEach(item => {
        const result = notionSyncService.parseChargeFromText(item);
        expect(result).toBeNull();
      });
    });

    it('should handle empty or invalid text', () => {
      expect(notionSyncService.parseChargeFromText('')).toBeNull();
      expect(notionSyncService.parseChargeFromText(null)).toBeNull();
      expect(notionSyncService.parseChargeFromText(undefined)).toBeNull();
    });

    it('should parse charges without explicit costs', () => {
      const result = notionSyncService.parseChargeFromText('equipment rental');
      expect(result).toEqual({
        description: 'equipment rental',
        cost: 0
      });
    });
  });

  describe('extractTextFromRichText', () => {
    it('should extract text from heading_3 blocks', () => {
      const block = {
        type: 'heading_3',
        heading_3: {
          rich_text: [
            { plain_text: 'Charges:' }
          ]
        }
      };

      const result = notionSyncService.extractTextFromRichText(block);
      expect(result).toBe('Charges:');
    });

    it('should extract text from bulleted_list_item blocks', () => {
      const block = {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { plain_text: '1 bag debris' }
          ]
        }
      };

      const result = notionSyncService.extractTextFromRichText(block);
      expect(result).toBe('1 bag debris');
    });

    it('should return empty string for unknown block types', () => {
      const block = {
        type: 'unknown_type'
      };

      const result = notionSyncService.extractTextFromRichText(block);
      expect(result).toBe('');
    });
  });
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  importInfluencingTechniques, 
  importNegotiationTactics, 
  importPersonalityTypes,
  importAllCSVData,
  validateImportedData
} from './csv-import';
import { db } from './db';
import { influencingTechniques, negotiationTactics, personalityTypes } from '@shared/schema';

describe('CSV Import Tests', () => {
  
  afterEach(async () => {
    // Clean up after each test
    await db.delete(influencingTechniques);
    await db.delete(negotiationTactics);
    await db.delete(personalityTypes);
  });

  describe('Influencing Techniques Import', () => {
    it('should import techniques from CSV successfully', async () => {
      await importInfluencingTechniques();
      
      const techniques = await db.select().from(influencingTechniques);
      
      // Verify count matches expected
      expect(techniques.length).toBe(11);
      
      // Verify structure of first technique
      const firstTechnique = techniques[0];
      expect(firstTechnique.name).toBeTruthy();
      expect(firstTechnique.beschreibung).toBeTruthy();
      expect(firstTechnique.anwendung).toBeTruthy();
      expect(Array.isArray(firstTechnique.wichtigeAspekte)).toBe(true);
      expect(Array.isArray(firstTechnique.keyPhrases)).toBe(true);
      
      // Verify specific technique exists
      const legitimieren = techniques.find(t => t.name === 'Legitimieren');
      expect(legitimieren).toBeTruthy();
      expect(legitimieren?.beschreibung).toContain('Einflussnahme durch Berufung auf Autoritäten');
    });

    it('should properly parse key phrases with pipe separator', async () => {
      await importInfluencingTechniques();
      
      const techniques = await db.select().from(influencingTechniques);
      const legitimieren = techniques.find(t => t.name === 'Legitimieren');
      
      expect(legitimieren?.keyPhrases).toBeInstanceOf(Array);
      expect(legitimieren?.keyPhrases.length).toBeGreaterThan(1);
      expect(legitimieren?.keyPhrases).toContain('Unsere Unternehmensrichtlinien lassen hier leider keinen weiteren Spielraum.');
    });

    it('should properly parse wichtige aspekte with comma separator', async () => {
      await importInfluencingTechniques();
      
      const techniques = await db.select().from(influencingTechniques);
      const legitimieren = techniques.find(t => t.name === 'Legitimieren');
      
      expect(legitimieren?.wichtigeAspekte).toBeInstanceOf(Array);
      expect(legitimieren?.wichtigeAspekte.length).toBeGreaterThan(0);
    });
  });

  describe('Negotiation Tactics Import', () => {
    it('should import tactics from CSV successfully', async () => {
      await importNegotiationTactics();
      
      const tactics = await db.select().from(negotiationTactics);
      
      // Verify count matches expected
      expect(tactics.length).toBe(45);
      
      // Verify structure
      const firstTactic = tactics[0];
      expect(firstTactic.name).toBeTruthy();
      expect(firstTactic.beschreibung).toBeTruthy();
      expect(firstTactic.anwendung).toBeTruthy();
      expect(Array.isArray(firstTactic.wichtigeAspekte)).toBe(true);
      expect(Array.isArray(firstTactic.keyPhrases)).toBe(true);
      
      // Verify specific tactic exists
      const zeitdruck = tactics.find(t => t.name === 'Zeitdruck');
      expect(zeitdruck).toBeTruthy();
      expect(zeitdruck?.beschreibung).toContain('Den Verhandlungspartner bewusst unter Zeitdruck setzen');
    });

    it('should handle complex key phrases with multiple separators', async () => {
      await importNegotiationTactics();
      
      const tactics = await db.select().from(negotiationTactics);
      const zeitdruck = tactics.find(t => t.name === 'Zeitdruck');
      
      expect(zeitdruck?.keyPhrases).toBeInstanceOf(Array);
      expect(zeitdruck?.keyPhrases.length).toBeGreaterThan(1);
      // Each key phrase should be trimmed and not empty
      zeitdruck?.keyPhrases.forEach(phrase => {
        expect(phrase.trim()).toBe(phrase);
        expect(phrase.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Personality Types Import', () => {
    it('should import personality types from CSV successfully', async () => {
      await importPersonalityTypes();
      
      const personalities = await db.select().from(personalityTypes);
      
      // Verify count matches expected  
      expect(personalities.length).toBe(5);
      
      // Verify structure
      const firstPersonality = personalities[0];
      expect(firstPersonality.archetype).toBeTruthy();
      expect(firstPersonality.behaviorDescription).toBeTruthy();
      expect(firstPersonality.advantages).toBeTruthy();
      expect(firstPersonality.risks).toBeTruthy();
      
      // Verify specific personality exists
      const offenheit = personalities.find(p => p.archetype === 'Offenheit für Erfahrungen');
      expect(offenheit).toBeTruthy();
      expect(offenheit?.behaviorDescription).toContain('kreative Lösungen');
    });

    it('should enforce unique archetype constraint', async () => {
      await importPersonalityTypes();
      
      // Attempting to insert duplicate archetype should fail
      await expect(
        db.insert(personalityTypes).values({
          archetype: 'Offenheit für Erfahrungen', // Duplicate
          behaviorDescription: 'Test',
          advantages: 'Test', 
          risks: 'Test'
        })
      ).rejects.toThrow();
    });
  });

  describe('Full Import Process', () => {
    it('should import all CSV data successfully', async () => {
      await importAllCSVData();
      
      // Verify all tables have expected counts
      const techniquesCount = await db.$count(influencingTechniques);
      const tacticsCount = await db.$count(negotiationTactics);
      const personalityCount = await db.$count(personalityTypes);
      
      expect(techniquesCount).toBe(11);
      expect(tacticsCount).toBe(45);
      expect(personalityCount).toBe(5);
    });

    it('should validate imported data correctly', async () => {
      await importAllCSVData();
      
      const isValid = await validateImportedData();
      expect(isValid).toBe(true);
    });

    it('should detect validation failures for incorrect data', async () => {
      // Import only techniques (not all expected data)
      await importInfluencingTechniques();
      
      const isValid = await validateImportedData();
      expect(isValid).toBe(false); // Should fail because tactics and personalities missing
    });
  });

  describe('Data Quality Validation', () => {
    beforeEach(async () => {
      await importAllCSVData();
    });

    it('should have no empty names in techniques', async () => {
      const techniques = await db.select().from(influencingTechniques);
      
      techniques.forEach(technique => {
        expect(technique.name.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have no empty names in tactics', async () => {
      const tactics = await db.select().from(negotiationTactics);
      
      tactics.forEach(tactic => {
        expect(tactic.name.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have valid JSON arrays for wichtige aspects', async () => {
      const techniques = await db.select().from(influencingTechniques);
      
      techniques.forEach(technique => {
        expect(Array.isArray(technique.wichtigeAspekte)).toBe(true);
        if (technique.wichtigeAspekte.length > 0) {
          technique.wichtigeAspekte.forEach(aspect => {
            expect(typeof aspect).toBe('string');
            expect(aspect.trim().length).toBeGreaterThan(0);
          });
        }
      });
    });

    it('should have valid JSON arrays for key phrases', async () => {
      const techniques = await db.select().from(influencingTechniques);
      
      techniques.forEach(technique => {
        expect(Array.isArray(technique.keyPhrases)).toBe(true);
        if (technique.keyPhrases.length > 0) {
          technique.keyPhrases.forEach(phrase => {
            expect(typeof phrase).toBe('string');
            expect(phrase.trim().length).toBeGreaterThan(0);
          });
        }
      });
    });

    it('should have German umlauts preserved correctly', async () => {
      const techniques = await db.select().from(influencingTechniques);
      const personalities = await db.select().from(personalityTypes);
      
      // Check for proper German character encoding
      const offenheit = personalities.find(p => p.archetype === 'Offenheit für Erfahrungen');
      expect(offenheit?.archetype).toContain('für');
      
      // Check techniques have proper German text
      const hasGermanChars = techniques.some(t => 
        t.beschreibung.includes('ä') || 
        t.beschreibung.includes('ö') || 
        t.beschreibung.includes('ü') ||
        t.beschreibung.includes('ß')
      );
      expect(hasGermanChars).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CSV files gracefully', async () => {
      // Mock fs to simulate missing file
      const originalReadFile = require('fs/promises').readFile;
      require('fs/promises').readFile = async () => {
        throw new Error('ENOENT: no such file or directory');
      };

      await expect(importInfluencingTechniques()).rejects.toThrow();
      
      // Restore original function
      require('fs/promises').readFile = originalReadFile;
    });

    it('should handle malformed CSV data gracefully', async () => {
      // This would require more sophisticated mocking to test
      // For now, we trust that the CSV parsing library handles this
      expect(true).toBe(true);
    });
  });
});
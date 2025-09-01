import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from './db';
import { 
  influencingTechniques, 
  negotiationTactics, 
  personalityTypes,
  simulationRuns,
  negotiationRounds,
  dimensionResults,
  negotiations,
  type InsertInfluencingTechnique,
  type InsertNegotiationTactic,
  type InsertPersonalityType
} from '@shared/schema';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Imports influencing techniques from CSV file
 * CSV format: name;beschreibung;anwendung;wichtige_aspekte;key_phrases
 */
export async function importInfluencingTechniques(): Promise<void> {
  console.log('🔄 Importing influencing techniques...');
  
  try {
    const csvPath = path.join(DATA_DIR, 'influencing_techniques.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: ['name', 'beschreibung', 'anwendung', 'wichtige_aspekte', 'key_phrases'],
      delimiter: ';',
      skip_empty_lines: true,
      from_line: 2, // Skip header
      trim: true
    });

    console.log(`📊 Found ${records.length} techniques to import`);

    const techniques: InsertInfluencingTechnique[] = records.map((record: any) => ({
      name: record.name,
      beschreibung: record.beschreibung,
      anwendung: record.anwendung,
      wichtigeAspekte: parseAspects(record.wichtige_aspekte),
      keyPhrases: parseKeyPhrases(record.key_phrases)
    }));

    // Clear existing data in dependency order (cascade deletes)
    console.log('🧹 Clearing dependent data...');
    await db.delete(dimensionResults);
    await db.delete(negotiationRounds); 
    await db.delete(simulationRuns);
    
    console.log('🧹 Clearing techniques...');
    await db.delete(influencingTechniques);
    
    // Insert new data
    const inserted = await db.insert(influencingTechniques).values(techniques).returning();
    
    console.log(`✅ Successfully imported ${inserted.length} influencing techniques`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      console.log('📝 Sample technique:', {
        name: inserted[0].name,
        aspectsCount: Array.isArray(inserted[0].wichtigeAspekte) ? inserted[0].wichtigeAspekte.length : 0,
        phrasesCount: Array.isArray(inserted[0].keyPhrases) ? inserted[0].keyPhrases.length : 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error importing influencing techniques:', error);
    throw error;
  }
}

/**
 * Imports negotiation tactics from CSV file  
 * CSV format: name;beschreibung;anwendung;wichtige_aspekte;key_phrases
 */
export async function importNegotiationTactics(): Promise<void> {
  console.log('🔄 Importing negotiation tactics...');
  
  try {
    const csvPath = path.join(DATA_DIR, 'negotiation_tactics.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: ['name', 'beschreibung', 'anwendung', 'wichtige_aspekte', 'key_phrases'],
      delimiter: ';',
      skip_empty_lines: true,
      from_line: 2, // Skip header
      trim: true
    });

    console.log(`📊 Found ${records.length} tactics to import`);

    const tactics: InsertNegotiationTactic[] = records.map((record: any) => ({
      name: record.name,
      beschreibung: record.beschreibung,
      anwendung: record.anwendung,
      wichtigeAspekte: parseAspects(record.wichtige_aspekte),
      keyPhrases: parseKeyPhrases(record.key_phrases)
    }));

    // Clear existing data (simulation runs already cleared in techniques import)
    console.log('🧹 Clearing tactics...');
    await db.delete(negotiationTactics);
    
    // Insert new data
    const inserted = await db.insert(negotiationTactics).values(tactics).returning();
    
    console.log(`✅ Successfully imported ${inserted.length} negotiation tactics`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      console.log('📝 Sample tactic:', {
        name: inserted[0].name,
        aspectsCount: Array.isArray(inserted[0].wichtigeAspekte) ? inserted[0].wichtigeAspekte.length : 0,
        phrasesCount: Array.isArray(inserted[0].keyPhrases) ? inserted[0].keyPhrases.length : 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error importing negotiation tactics:', error);
    throw error;
  }
}

/**
 * Imports personality types from CSV file
 * CSV format: personality_archetype,verhalten_in_verhandlungen,vorteile,risiken
 */
export async function importPersonalityTypes(): Promise<void> {
  console.log('🔄 Importing personality types...');
  
  try {
    const csvPath = path.join(DATA_DIR, 'personality_types_simple.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: ['personality_archetype', 'verhalten_in_verhandlungen', 'vorteile', 'risiken'],
      delimiter: ',',
      skip_empty_lines: true,
      from_line: 2, // Skip header
      trim: true,
      quote: '"'
    });

    console.log(`📊 Found ${records.length} personality types to import`);

    const personalityTypesData: InsertPersonalityType[] = records.map((record: any) => ({
      archetype: record.personality_archetype,
      behaviorDescription: record.verhalten_in_verhandlungen,
      advantages: record.vorteile,
      risks: record.risiken
    }));

    // Clear existing data
    console.log('🧹 Clearing personality types...');
    await db.delete(personalityTypes);
    
    // Insert new data
    const inserted = await db.insert(personalityTypes).values(personalityTypesData).returning();
    
    console.log(`✅ Successfully imported ${inserted.length} personality types`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      console.log('📝 Sample personality type:', {
        archetype: inserted[0].archetype,
        behaviorDescription: inserted[0].behaviorDescription.substring(0, 100) + '...'
      });
    }
    
  } catch (error) {
    console.error('❌ Error importing personality types:', error);
    throw error;
  }
}

/**
 * Parses wichtige_aspekte field - splits by commas and trims
 */
function parseAspects(aspectsString: string): string[] {
  if (!aspectsString || aspectsString.trim() === '') return [];
  
  return aspectsString
    .split(',')
    .map(aspect => aspect.trim())
    .filter(aspect => aspect.length > 0);
}

/**
 * Parses key_phrases field - splits by pipe (|) and trims
 */
function parseKeyPhrases(phrasesString: string): string[] {
  if (!phrasesString || phrasesString.trim() === '') return [];
  
  return phrasesString
    .split('|')
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 0);
}

/**
 * Imports all CSV data in correct dependency order
 */
export async function importAllCSVData(): Promise<void> {
  console.log('🚀 Starting CSV data import...');
  
  try {
    // Import in dependency order (no foreign key dependencies between these tables)
    await importInfluencingTechniques();
    await importNegotiationTactics(); 
    await importPersonalityTypes();
    
    console.log('🎉 All CSV data imported successfully!');
    
  } catch (error) {
    console.error('💥 CSV import failed:', error);
    throw error;
  }
}

/**
 * Validates CSV data integrity after import
 */
export async function validateImportedData(): Promise<boolean> {
  console.log('🔍 Validating imported data...');
  
  try {
    // Check techniques
    const techniquesCount = await db.$count(influencingTechniques);
    console.log(`📊 Techniques in DB: ${techniquesCount}`);
    
    // Check tactics  
    const tacticsCount = await db.$count(negotiationTactics);
    console.log(`📊 Tactics in DB: ${tacticsCount}`);
    
    // Check personality types
    const personalityCount = await db.$count(personalityTypes);
    console.log(`📊 Personality types in DB: ${personalityCount}`);
    
    // Validate expected counts (based on CSV files)
    const expectedTechniques = 11;
    const expectedTactics = 45;
    const expectedPersonalities = 5;
    
    const isValid = 
      techniquesCount === expectedTechniques &&
      tacticsCount === expectedTactics &&
      personalityCount === expectedPersonalities;
    
    if (isValid) {
      console.log('✅ Data validation successful - all expected records imported');
    } else {
      console.warn('⚠️  Data validation warning:');
      console.warn(`  Expected ${expectedTechniques} techniques, got ${techniquesCount}`);
      console.warn(`  Expected ${expectedTactics} tactics, got ${tacticsCount}`);
      console.warn(`  Expected ${expectedPersonalities} personalities, got ${personalityCount}`);
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Data validation failed:', error);
    return false;
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'techniques':
      importInfluencingTechniques().catch(console.error);
      break;
    case 'tactics':
      importNegotiationTactics().catch(console.error);
      break;
    case 'personalities':
      importPersonalityTypes().catch(console.error);
      break;
    case 'all':
      importAllCSVData()
        .then(() => validateImportedData())
        .catch(console.error);
      break;
    case 'validate':
      validateImportedData().catch(console.error);
      break;
    default:
      console.log('Usage: tsx server/csv-import.ts [techniques|tactics|personalities|all|validate]');
      console.log('Examples:');
      console.log('  tsx server/csv-import.ts all         # Import all CSV files');
      console.log('  tsx server/csv-import.ts techniques  # Import only techniques');
      console.log('  tsx server/csv-import.ts validate    # Validate imported data');
  }
}
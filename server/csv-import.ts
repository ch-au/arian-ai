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
  dimensionResults,
  negotiations,
  type InsertInfluencingTechnique,
  type InsertNegotiationTactic,
  type InsertPersonalityType
} from '@shared/schema';
import { createRequestLogger } from './services/logger';

const log = createRequestLogger('script:csv-import');

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Imports influencing techniques from CSV file
 * CSV format: name;beschreibung;anwendung;wichtige_aspekte;key_phrases
 */
export async function importInfluencingTechniques(): Promise<void> {
  log.info('🔄 Importing influencing techniques...');
  
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

    log.info(`📊 Found ${records.length} techniques to import`);

    const techniques: InsertInfluencingTechnique[] = records.map((record: any) => ({
      name: record.name,
      beschreibung: record.beschreibung,
      anwendung: record.anwendung,
      wichtigeAspekte: parseAspects(record.wichtige_aspekte),
      keyPhrases: parseKeyPhrases(record.key_phrases)
    }));

    // Clear existing data in dependency order (cascade deletes)
    log.info('🧹 Clearing dependent data...');
    await db.delete(dimensionResults);
    await db.delete(simulationRuns);
    
    log.info('🧹 Clearing techniques...');
    await db.delete(influencingTechniques);
    
    // Insert new data
    const inserted = await db.insert(influencingTechniques).values(techniques).returning();
    
    log.info(`✅ Successfully imported ${inserted.length} influencing techniques`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      log.info({ 
        name: inserted[0].name,
        aspectsCount: Array.isArray(inserted[0].wichtigeAspekte) ? inserted[0].wichtigeAspekte.length : 0,
        phrasesCount: Array.isArray(inserted[0].keyPhrases) ? inserted[0].keyPhrases.length : 0
      }, '📝 Sample technique');
    }
    
  } catch (error) {
    log.error({ err: error }, '❌ Error importing influencing techniques');
    throw error;
  }
}

/**
 * Imports negotiation tactics from CSV file  
 * CSV format: name;beschreibung;anwendung;wichtige_aspekte;key_phrases
 */
export async function importNegotiationTactics(): Promise<void> {
  log.info('🔄 Importing negotiation tactics...');
  
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

    log.info(`📊 Found ${records.length} tactics to import`);

    const tactics: InsertNegotiationTactic[] = records.map((record: any) => ({
      name: record.name,
      beschreibung: record.beschreibung,
      anwendung: record.anwendung,
      wichtigeAspekte: parseAspects(record.wichtige_aspekte),
      keyPhrases: parseKeyPhrases(record.key_phrases)
    }));

    // Clear existing data (simulation runs already cleared in techniques import)
    log.info('🧹 Clearing tactics...');
    await db.delete(negotiationTactics);
    
    // Insert new data
    const inserted = await db.insert(negotiationTactics).values(tactics).returning();
    
    log.info(`✅ Successfully imported ${inserted.length} negotiation tactics`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      log.info({
        name: inserted[0].name,
        aspectsCount: Array.isArray(inserted[0].wichtigeAspekte) ? inserted[0].wichtigeAspekte.length : 0,
        phrasesCount: Array.isArray(inserted[0].keyPhrases) ? inserted[0].keyPhrases.length : 0
      }, '📝 Sample tactic:');
    }

  } catch (error) {
    log.error({ err: error }, '❌ Error importing negotiation tactics:');
    throw error;
  }
}

/**
 * Imports personality types from CSV file
 * CSV format: personality_archetype,verhalten_in_verhandlungen,vorteile,risiken
 */
export async function importPersonalityTypes(): Promise<void> {
  log.info('🔄 Importing personality types...');
  
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

    log.info(`📊 Found ${records.length} personality types to import`);

    const personalityTypesData: InsertPersonalityType[] = records.map((record: any) => ({
      archetype: record.personality_archetype,
      behaviorDescription: record.verhalten_in_verhandlungen,
      advantages: record.vorteile,
      risks: record.risiken
    }));

    // Clear existing data
    log.info('🧹 Clearing personality types...');
    await db.delete(personalityTypes);
    
    // Insert new data
    const inserted = await db.insert(personalityTypes).values(personalityTypesData).returning();
    
    log.info(`✅ Successfully imported ${inserted.length} personality types`);
    
    // Log sample for verification
    if (inserted.length > 0) {
      log.info({
        archetype: inserted[0].archetype,
        behaviorDescription: inserted[0].behaviorDescription.substring(0, 100) + '...'
      }, '📝 Sample personality type:');
    }

  } catch (error) {
    log.error({ err: error }, '❌ Error importing personality types:');
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
  log.info('🚀 Starting CSV data import...');
  
  try {
    // Import in dependency order (no foreign key dependencies between these tables)
    await importInfluencingTechniques();
    await importNegotiationTactics(); 
    await importPersonalityTypes();
    
    log.info('🎉 All CSV data imported successfully!');
    
  } catch (error) {
    log.error({ err: error }, '💥 CSV import failed:');
    throw error;
  }
}

/**
 * Validates CSV data integrity after import
 */
export async function validateImportedData(): Promise<boolean> {
  log.info('🔍 Validating imported data...');
  
  try {
    // Check techniques
    const techniquesCount = await db.$count(influencingTechniques);
    log.info(`📊 Techniques in DB: ${techniquesCount}`);
    
    // Check tactics  
    const tacticsCount = await db.$count(negotiationTactics);
    log.info(`📊 Tactics in DB: ${tacticsCount}`);
    
    // Check personality types
    const personalityCount = await db.$count(personalityTypes);
    log.info(`📊 Personality types in DB: ${personalityCount}`);
    
    // Validate expected counts (based on CSV files)
    // Expected counts based on current CSV files
    const expectedTechniques = 10;
    const expectedTactics = 44;
    const expectedPersonalities = 5;
    
    const isValid = 
      techniquesCount === expectedTechniques &&
      tacticsCount === expectedTactics &&
      personalityCount === expectedPersonalities;
    
    if (isValid) {
      log.info('✅ Data validation successful - all expected records imported');
    } else {
      log.warn('⚠️  Data validation warning:');
      log.warn(`  Expected ${expectedTechniques} techniques, got ${techniquesCount}`);
      log.warn(`  Expected ${expectedTactics} tactics, got ${tacticsCount}`);
      log.warn(`  Expected ${expectedPersonalities} personalities, got ${personalityCount}`);
    }
    
    return isValid;
    
  } catch (error) {
    log.error({ err: error }, '❌ Data validation failed');
    return false;
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'techniques':
      importInfluencingTechniques().catch((err) => log.error({ err }, 'Failed to import techniques'));
      break;
    case 'tactics':
      importNegotiationTactics().catch((err) => log.error({ err }, 'Failed to import tactics'));
      break;
    case 'personalities':
      importPersonalityTypes().catch((err) => log.error({ err }, 'Failed to import personalities'));
      break;
    case 'all':
      importAllCSVData()
        .then(() => validateImportedData())
        .catch((err) => log.error({ err }, 'Failed to import all datasets'));
      break;
    case 'validate':
      validateImportedData().catch((err) => log.error({ err }, 'Validation failed'));
      break;
    default:
      log.info('Usage: tsx server/csv-import.ts [techniques|tactics|personalities|all|validate]');
      log.info('Examples:');
      log.info('  tsx server/csv-import.ts all         # Import all CSV files');
      log.info('  tsx server/csv-import.ts techniques  # Import only techniques');
      log.info('  tsx server/csv-import.ts validate    # Validate imported data');
  }
}

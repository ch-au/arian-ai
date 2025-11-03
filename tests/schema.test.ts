import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  negotiations,
  negotiationDimensions,
  simulationRuns,
  dimensionResults,
  personalityTypes,
  influencingTechniques,
  negotiationTactics,
  type InsertNegotiation,
  type InsertNegotiationDimension,
  type InsertDimensionResult,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const runDbTests = Boolean(connectionString) && process.env.RUN_DB_TESTS === 'true';

if (!runDbTests) {
  describe.skip('Enhanced Schema Tests', () => {
    it('skipped because RUN_DB_TESTS is not enabled', () => {
      expect(true).toBe(true);
    });
  });
} else {
  const sql = neon(connectionString!);
  const db = drizzle(sql);

  describe('Enhanced Schema Tests', () => {
  let testNegotiationId: string;
  let testTechniqueId: string;
  let testTacticId: string;
  let testPersonalityId: string;

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanup();
    
    // Create test data
    await setupTestData();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function setupTestData() {
    // Create test negotiation
    const [negotiation] = await db.insert(negotiations).values({
      title: 'Test Negotiation Schema',
      negotiationType: 'one-shot',
      relationshipType: 'first',
      userRole: 'buyer',
      productMarketDescription: 'Test product for schema validation',
      additionalComments: 'Schema test data',
      selectedTechniques: [],
      selectedTactics: []
    }).returning();
    testNegotiationId = negotiation.id;

    // Create test technique
    const [technique] = await db.insert(influencingTechniques).values({
      name: 'Test Technique',
      beschreibung: 'Test technique description',
      anwendung: 'Test application',
      wichtigeAspekte: ['Important aspect 1', 'Important aspect 2'],
      keyPhrases: ['Key phrase 1', 'Key phrase 2']
    }).returning();
    testTechniqueId = technique.id;

    // Create test tactic
    const [tactic] = await db.insert(negotiationTactics).values({
      name: 'Test Tactic',
      beschreibung: 'Test tactic description',
      anwendung: 'Test application',
      wichtigeAspekte: ['Important aspect 1'],
      keyPhrases: ['Key phrase 1']
    }).returning();
    testTacticId = tactic.id;

    // Create test personality type
    const [personality] = await db.insert(personalityTypes).values({
      archetype: 'Test Archetype',
      behaviorDescription: 'Test behavior',
      advantages: 'Test advantages',
      risks: 'Test risks'
    }).returning();
    testPersonalityId = personality.id;
  }

  async function cleanup() {
    // Clean up in dependency order
    await db.delete(dimensionResults);
    await db.delete(simulationRuns);
    await db.delete(negotiationDimensions);
    await db.delete(negotiations);
    await db.delete(influencingTechniques);
    await db.delete(negotiationTactics);
    await db.delete(personalityTypes);
  }

  describe('Negotiation Enhancements', () => {
    it('should create negotiation with new business context fields', async () => {
      const negotiation = await db.query.negotiations.findFirst({
        where: eq(negotiations.id, testNegotiationId)
      });

      expect(negotiation).toBeTruthy();
      expect(negotiation?.title).toBe('Test Negotiation Schema');
      expect(negotiation?.negotiationType).toBe('one-shot');
      expect(negotiation?.relationshipType).toBe('first');
      expect(negotiation?.productMarketDescription).toBe('Test product for schema validation');
      expect(negotiation?.additionalComments).toBe('Schema test data');
    });

    it('should validate enum constraints for negotiationType', async () => {
      const validTypes = ['one-shot', 'multi-year'];
      
      for (const type of validTypes) {
        const [result] = await db.insert(negotiations).values({
          title: `Test ${type}`,
          negotiationType: type as 'one-shot' | 'multi-year',
          relationshipType: 'first',
          userRole: 'buyer'
        }).returning();
        
        expect(result.negotiationType).toBe(type);
      }
    });

    it('should validate enum constraints for relationshipType', async () => {
      const validTypes = ['first', 'long-standing'];
      
      for (const type of validTypes) {
        const [result] = await db.insert(negotiations).values({
          title: `Test ${type}`,
          negotiationType: 'one-shot',
          relationshipType: type as 'first' | 'long-standing',
          userRole: 'buyer'
        }).returning();
        
        expect(result.relationshipType).toBe(type);
      }
    });
  });

  describe('Flexible Dimensions System', () => {
    it('should create and manage flexible dimensions', async () => {
      const dimensionsToCreate = [
        { name: 'price', minValue: '10.00', maxValue: '100.00', targetValue: '50.00', priority: 1, unit: 'EUR' },
        { name: 'volume', minValue: '100', maxValue: '1000', targetValue: '500', priority: 1, unit: 'pieces' },
        { name: 'delivery_time', minValue: '1', maxValue: '30', targetValue: '14', priority: 2, unit: 'days' },
        { name: 'quality_grade', minValue: '1', maxValue: '5', targetValue: '4', priority: 3, unit: 'stars' }
      ];

      const createdDimensions = await db.insert(negotiationDimensions).values(
        dimensionsToCreate.map(dim => ({
          negotiationId: testNegotiationId,
          ...dim
        }))
      ).returning();

      expect(createdDimensions).toHaveLength(4);
      
      // Test priority levels
      const mustHaveDimensions = createdDimensions.filter(d => d.priority === 1);
      const importantDimensions = createdDimensions.filter(d => d.priority === 2);
      const flexibleDimensions = createdDimensions.filter(d => d.priority === 3);
      
      expect(mustHaveDimensions).toHaveLength(2); // price, volume
      expect(importantDimensions).toHaveLength(1); // delivery_time
      expect(flexibleDimensions).toHaveLength(1); // quality_grade
    });

    it('should enforce unique dimension names per negotiation', async () => {
      // Create first dimension
      await db.insert(negotiationDimensions).values({
        negotiationId: testNegotiationId,
        name: 'price',
        minValue: '10.00',
        maxValue: '100.00',
        targetValue: '50.00',
        priority: 1,
        unit: 'EUR'
      });

      // Attempting to create duplicate should throw/fail
      await expect(db.insert(negotiationDimensions).values({
        negotiationId: testNegotiationId,
        name: 'price', // Duplicate name for same negotiation
        minValue: '20.00',
        maxValue: '200.00',
        targetValue: '100.00',
        priority: 2,
        unit: 'EUR'
      })).rejects.toThrow();
    });

    it('should allow same dimension names across different negotiations', async () => {
      // Create second test negotiation
      const [negotiation2] = await db.insert(negotiations).values({
        title: 'Test Negotiation 2',
        negotiationType: 'multi-year',
        relationshipType: 'long-standing',
        userRole: 'seller'
      }).returning();

      // Create price dimension for first negotiation
      await db.insert(negotiationDimensions).values({
        negotiationId: testNegotiationId,
        name: 'price',
        minValue: '10.00',
        maxValue: '100.00',
        targetValue: '50.00',
        priority: 1
      });

      // Create price dimension for second negotiation (should succeed)
      const [dimension2] = await db.insert(negotiationDimensions).values({
        negotiationId: negotiation2.id,
        name: 'price',
        minValue: '20.00',
        maxValue: '200.00',
        targetValue: '100.00',
        priority: 2
      }).returning();

      expect(dimension2.name).toBe('price');
      expect(dimension2.negotiationId).toBe(negotiation2.id);
    });
  });

  describe('Simulation Runs Enhancement', () => {
    it('should store conversation logs and dimension results', async () => {
      const [simulationRun] = await db.insert(simulationRuns).values({
        negotiationId: testNegotiationId,
        runNumber: 1,
        techniqueId: testTechniqueId,
        tacticId: testTacticId,
        personalityArchetype: 'Test Archetype',
        conversationLog: [
          {
            round: 1,
            agentId: 'agent-1',
            agentRole: 'buyer',
            message: 'I would like to negotiate the price.',
            proposal: { price: 45.0 },
            timestamp: new Date().toISOString()
          },
          {
            round: 1,
            agentId: 'agent-2',
            agentRole: 'seller',
            message: 'The minimum I can accept is 55.',
            proposal: { price: 55.0 },
            timestamp: new Date().toISOString()
          }
        ],
        dimensionResults: {
          price: {
            finalValue: 50.0,
            achievedTarget: true,
            priorityScore: 1
          },
          volume: {
            finalValue: 600,
            achievedTarget: true,
            priorityScore: 1
          }
        }
      }).returning();

      expect(simulationRun.conversationLog).toHaveLength(2);
      expect(simulationRun.dimensionResults).toHaveProperty('price');
      expect(simulationRun.dimensionResults).toHaveProperty('volume');
      expect(simulationRun.personalityArchetype).toBe('Test Archetype');
    });
  });

  describe('Dimension Results Table', () => {
    it('should store normalized dimension results for efficient querying', async () => {
      // Create test simulation run
      const [simulationRun] = await db.insert(simulationRuns).values({
        negotiationId: testNegotiationId,
        runNumber: 1,
        techniqueId: testTechniqueId,
        tacticId: testTacticId,
        status: 'completed'
      }).returning();

      // Create dimension results
      const results = [
        {
          simulationRunId: simulationRun.id,
          dimensionName: 'price',
          finalValue: '47.50',
          targetValue: '50.00',
          achievedTarget: false,
          priorityScore: 1,
          improvementOverBatna: '2.50'
        },
        {
          simulationRunId: simulationRun.id,
          dimensionName: 'volume',
          finalValue: '750',
          targetValue: '500',
          achievedTarget: true,
          priorityScore: 1,
          improvementOverBatna: '250'
        }
      ];

      const createdResults = await db.insert(dimensionResults).values(results).returning();
      
      expect(createdResults).toHaveLength(2);
      
      // Test querying by dimension name (critical for analysis features)
      const priceResults = await db.select()
        .from(dimensionResults)
        .where(eq(dimensionResults.dimensionName, 'price'));
      
      expect(priceResults).toHaveLength(1);
      expect(priceResults[0].finalValue).toBe('47.50');
      expect(priceResults[0].achievedTarget).toBe(false);
    });

    it('should enforce unique dimension results per simulation run', async () => {
      // Create test simulation run
      const [simulationRun] = await db.insert(simulationRuns).values({
        negotiationId: testNegotiationId,
        runNumber: 1,
        techniqueId: testTechniqueId,
        tacticId: testTacticId
      }).returning();

      // Create first result
      await db.insert(dimensionResults).values({
        simulationRunId: simulationRun.id,
        dimensionName: 'price',
        finalValue: '50.00',
        targetValue: '50.00',
        achievedTarget: true,
        priorityScore: 1
      });

      // Attempt to create duplicate should fail
      await expect(db.insert(dimensionResults).values({
        simulationRunId: simulationRun.id,
        dimensionName: 'price', // Duplicate dimension for same run
        finalValue: '45.00',
        targetValue: '50.00',
        achievedTarget: false,
        priorityScore: 1
      })).rejects.toThrow();
    });
  });

  describe('Personality Types Table', () => {
    it('should store personality archetypes from CSV data', async () => {
      const personality = await db.query.personalityTypes.findFirst({
        where: eq(personalityTypes.id, testPersonalityId)
      });

      expect(personality).toBeTruthy();
      expect(personality?.archetype).toBe('Test Archetype');
      expect(personality?.behaviorDescription).toBe('Test behavior');
      expect(personality?.advantages).toBe('Test advantages');
      expect(personality?.risks).toBe('Test risks');
    });

    it('should enforce unique archetype names', async () => {
      await expect(db.insert(personalityTypes).values({
        archetype: 'Test Archetype', // Duplicate archetype name
        behaviorDescription: 'Different behavior',
        advantages: 'Different advantages',
        risks: 'Different risks'
      })).rejects.toThrow();
    });
  });

  describe('Critical Query Patterns for Analysis', () => {
    beforeEach(async () => {
      // Create test dimensions
      await db.insert(negotiationDimensions).values([
        {
          negotiationId: testNegotiationId,
          name: 'price',
          minValue: '10.00',
          maxValue: '100.00',
          targetValue: '50.00',
          priority: 1,
          unit: 'EUR'
        },
        {
          negotiationId: testNegotiationId,
          name: 'volume',
          minValue: '100',
          maxValue: '1000',
          targetValue: '500',
          priority: 1,
          unit: 'pieces'
        }
      ]);

      // Create test simulation runs with results
      for (let i = 1; i <= 3; i++) {
        const [simulationRun] = await db.insert(simulationRuns).values({
          negotiationId: testNegotiationId,
          runNumber: i,
          techniqueId: testTechniqueId,
          tacticId: testTacticId,
          status: 'completed'
        }).returning();

        await db.insert(dimensionResults).values([
          {
            simulationRunId: simulationRun.id,
            dimensionName: 'price',
            finalValue: (40 + i * 5).toString(), // 45, 50, 55
            targetValue: '50.00',
            achievedTarget: i >= 2, // Only runs 2 and 3 achieve target
            priorityScore: 1
          },
          {
            simulationRunId: simulationRun.id,
            dimensionName: 'volume',
            finalValue: (400 + i * 100).toString(), // 500, 600, 700
            targetValue: '500.00',
            achievedTarget: true,
            priorityScore: 1
          }
        ]);
      }
    });

    it('should efficiently query dimension-specific results', async () => {
      // Test the critical query pattern: get all results for a specific dimension
      const priceResults = await db.select({
        simulationRunId: dimensionResults.simulationRunId,
        finalValue: dimensionResults.finalValue,
        achievedTarget: dimensionResults.achievedTarget,
        runNumber: simulationRuns.runNumber
      })
      .from(dimensionResults)
      .innerJoin(simulationRuns, eq(dimensionResults.simulationRunId, simulationRuns.id))
      .where(and(
        eq(dimensionResults.dimensionName, 'price'),
        eq(simulationRuns.negotiationId, testNegotiationId)
      ))
      .orderBy(dimensionResults.finalValue);

      expect(priceResults).toHaveLength(3);
      expect(priceResults[0].finalValue).toBe('45'); // Lowest price
      expect(priceResults[2].finalValue).toBe('55'); // Highest price
      
      // Test success rate calculation
      const successfulPriceRuns = priceResults.filter(r => r.achievedTarget);
      const successRate = successfulPriceRuns.length / priceResults.length;
      expect(successRate).toBe(2/3); // 2 out of 3 achieved target
    });

    it('should support cross-dimension analysis queries', async () => {
      // Query to analyze performance across multiple dimensions
      const crossDimensionResults = await db.select({
        dimensionName: dimensionResults.dimensionName,
        avgFinalValue: dimensionResults.finalValue, // In real query, would use AVG()
        achievedTarget: dimensionResults.achievedTarget
      })
      .from(dimensionResults)
      .innerJoin(simulationRuns, eq(dimensionResults.simulationRunId, simulationRuns.id))
      .where(eq(simulationRuns.negotiationId, testNegotiationId));

      // Group results by dimension
      const byDimension = crossDimensionResults.reduce((acc, result) => {
        if (!acc[result.dimensionName]) {
          acc[result.dimensionName] = [];
        }
        acc[result.dimensionName].push(result);
        return acc;
      }, {} as Record<string, typeof crossDimensionResults>);

      expect(Object.keys(byDimension)).toContain('price');
      expect(Object.keys(byDimension)).toContain('volume');
      expect(byDimension.price).toHaveLength(3);
      expect(byDimension.volume).toHaveLength(3);
    });
  });

  describe('Relations and Data Integrity', () => {
    it('should cascade delete dimensions when negotiation is deleted', async () => {
      // Create dimensions
      await db.insert(negotiationDimensions).values({
        negotiationId: testNegotiationId,
        name: 'price',
        minValue: '10.00',
        maxValue: '100.00',
        targetValue: '50.00',
        priority: 1
      });

      // Verify dimension exists
      let dimensions = await db.select()
        .from(negotiationDimensions)
        .where(eq(negotiationDimensions.negotiationId, testNegotiationId));
      expect(dimensions).toHaveLength(1);

      // Delete negotiation
      await db.delete(negotiations).where(eq(negotiations.id, testNegotiationId));

      // Verify dimensions are cascaded deleted
      dimensions = await db.select()
        .from(negotiationDimensions)
        .where(eq(negotiationDimensions.negotiationId, testNegotiationId));
      expect(dimensions).toHaveLength(0);
    });

    it('should cascade delete dimension results when simulation run is deleted', async () => {
      // Create simulation run
      const [simulationRun] = await db.insert(simulationRuns).values({
        negotiationId: testNegotiationId,
        runNumber: 1,
        techniqueId: testTechniqueId,
        tacticId: testTacticId
      }).returning();

      // Create dimension result
      await db.insert(dimensionResults).values({
        simulationRunId: simulationRun.id,
        dimensionName: 'price',
        finalValue: '50.00',
        targetValue: '50.00',
        achievedTarget: true,
        priorityScore: 1
      });

      // Verify result exists
      let results = await db.select()
        .from(dimensionResults)
        .where(eq(dimensionResults.simulationRunId, simulationRun.id));
      expect(results).toHaveLength(1);

      // Delete simulation run
      await db.delete(simulationRuns).where(eq(simulationRuns.id, simulationRun.id));

      // Verify results are cascaded deleted
      results = await db.select()
        .from(dimensionResults)
        .where(eq(dimensionResults.simulationRunId, simulationRun.id));
      expect(results).toHaveLength(0);
    });
  });
  });
}

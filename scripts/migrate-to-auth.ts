import { db } from "../server/db";
import { users, negotiations } from "@shared/schema";
import { AuthService } from "../server/services/auth";
import { sql } from "drizzle-orm";

/**
 * Migration script to add authentication support
 *
 * This script:
 * 1. Creates a default user if one doesn't exist
 * 2. Migrates all existing negotiations to the default user
 * 3. Updates the userId column to use integer type with foreign key
 */
async function migrate() {
  console.log("Starting authentication migration...");

  try {
    // Step 1: Check if default user exists, create if not
    console.log("\n1. Creating default user...");
    let defaultUser;
    try {
      defaultUser = await AuthService.register("admin", "admin123");
      console.log(`✓ Created default user: ${defaultUser.username} (ID: ${defaultUser.id})`);
    } catch (error: any) {
      if (error.message === "Username already exists") {
        // Get the existing user
        const [existingUser] = await db.select().from(users).limit(1);
        defaultUser = existingUser;
        console.log(`✓ Using existing user: ${defaultUser.username} (ID: ${defaultUser.id})`);
      } else {
        throw error;
      }
    }

    // Step 2: Check current state of negotiations table
    console.log("\n2. Checking negotiations table structure...");
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'negotiations' AND column_name = 'user_id'
    `);

    console.log("Current user_id column:", result.rows[0]);

    // Step 3: Migrate data if user_id is still text
    if (result.rows[0]?.data_type === "text") {
      console.log("\n3. Migrating data...");

      // Add temporary integer column
      await db.execute(sql`ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS user_id_new INTEGER`);

      // Set all existing rows to default user
      await db.execute(sql`UPDATE negotiations SET user_id_new = ${defaultUser.id} WHERE user_id_new IS NULL`);

      // Drop old column
      await db.execute(sql`ALTER TABLE negotiations DROP COLUMN IF EXISTS user_id CASCADE`);

      // Rename new column
      await db.execute(sql`ALTER TABLE negotiations RENAME COLUMN user_id_new TO user_id`);

      // Make it NOT NULL
      await db.execute(sql`ALTER TABLE negotiations ALTER COLUMN user_id SET NOT NULL`);

      // Add foreign key constraint
      await db.execute(sql`
        ALTER TABLE negotiations
        ADD CONSTRAINT negotiations_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);

      console.log(`✓ Migrated all negotiations to user ID: ${defaultUser.id}`);
    } else if (result.rows[0]?.data_type === "integer") {
      console.log("✓ user_id column is already integer type");

      // Just make sure all negotiations have a valid user_id
      const countNull = await db.execute(sql`SELECT COUNT(*) FROM negotiations WHERE user_id IS NULL`);
      if (Number(countNull.rows[0]?.count) > 0) {
        await db.execute(sql`UPDATE negotiations SET user_id = ${defaultUser.id} WHERE user_id IS NULL`);
        console.log(`✓ Updated ${countNull.rows[0]?.count} negotiations with user ID`);
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\nDefault credentials:");
    console.log("  Username: admin");
    console.log("  Password: admin123");
    console.log("\n⚠️  Please change these credentials after first login!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

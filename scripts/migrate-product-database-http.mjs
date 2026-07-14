#!/usr/bin/env node

import migrations from "../api/_productDatabaseMigrations.js";

const result = await migrations.runProductDatabaseMigrations();
console.log(`Product database HTTP migration complete: ${result.appliedCount} migration(s) applied.`);

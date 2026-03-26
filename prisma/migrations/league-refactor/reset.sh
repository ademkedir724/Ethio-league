#!/bin/bash
# Reset script — drops all data and recreates schema from scratch.
# Use only if migrate.sql fails.
echo "Resetting database..."
npx prisma migrate reset --force --skip-seed
npx prisma db push
echo "Done. Database reset to new schema."

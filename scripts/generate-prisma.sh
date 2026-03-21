#!/bin/bash

cd /vercel/share/v0-project

# Generate Prisma client at custom output path
npx prisma generate

echo "Prisma client generated successfully at app/generated/prisma"

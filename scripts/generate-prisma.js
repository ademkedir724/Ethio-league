import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

try {
  console.log('[v0] Generating Prisma client...');
  execSync('npx prisma generate', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  console.log('[v0] Prisma client generated successfully at app/generated/prisma');
} catch (error) {
  console.error('[v0] Error generating Prisma client:', error.message);
  process.exit(1);
}

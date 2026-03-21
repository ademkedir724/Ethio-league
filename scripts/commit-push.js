import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

try {
  console.log('[v0] Starting git commit and push...');
  
  // Change to project directory
  process.chdir(projectRoot);
  
  // Stage all changes
  console.log('[v0] Staging changes...');
  execSync('git add -A', { stdio: 'inherit' });
  
  // Commit with descriptive message
  console.log('[v0] Creating commit...');
  const commitMessage = `feat: build notification page and fix prisma configuration

- Add comprehensive Notifications page with data table, statistics, and CRUD operations
- Fix Prisma client import to use standard @prisma/client package
- Update Prisma schema generator to prisma-client-js provider
- Ensure single source of Prisma imports from /lib/prisma throughout the application`;
  
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  
  // Push to current branch
  console.log('[v0] Pushing to remote...');
  execSync('git push', { stdio: 'inherit' });
  
  console.log('[v0] Successfully committed and pushed to GitHub!');
} catch (error) {
  console.error('[v0] Error during git commit/push:', error.message);
  process.exit(1);
}

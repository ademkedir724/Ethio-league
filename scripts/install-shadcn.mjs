import { execSync } from 'child_process';

const components = [
  'button', 'input', 'label', 'card', 'badge', 'avatar',
  'dropdown-menu', 'separator', 'scroll-area', 'tooltip',
  'dialog', 'select', 'table', 'tabs', 'textarea',
  'skeleton', 'sheet', 'switch', 'sonner'
];

console.log('Installing shadcn/ui components:', components.join(', '));

try {
  execSync(
    `npx shadcn@latest add ${components.join(' ')} -y --overwrite`,
    { cwd: '/vercel/share/v0-project', stdio: 'inherit' }
  );
  console.log('All components installed successfully!');
} catch (error) {
  console.error('Error installing components:', error.message);
}

import { execSync } from 'child_process';

const components = [
  'button', 'input', 'label', 'card', 'badge', 'avatar',
  'dropdown-menu', 'separator', 'scroll-area', 'tooltip',
  'dialog', 'select', 'table', 'tabs', 'textarea',
  'skeleton', 'sheet', 'switch'
];

for (const component of components) {
  try {
    console.log(`Installing ${component}...`);
    execSync(`npx shadcn@latest add ${component} --yes --overwrite`, {
      cwd: '/vercel/share/v0-project',
      stdio: 'inherit'
    });
    console.log(`Installed ${component}`);
  } catch (e) {
    console.error(`Failed to install ${component}: ${e.message}`);
  }
}

console.log('Done installing all components');

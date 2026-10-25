import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  process.stderr.write('Uso: node scripts/with-env.mjs <comando> [...args]\n');
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

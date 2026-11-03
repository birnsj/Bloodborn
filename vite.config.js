import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const weaponsPath = path.join(rootDir, 'public', 'data', 'weapons.json');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Dev-only: POST /api/weapon-pose merges view.pose into public/data/weapons.json */
function weaponPoseSavePlugin() {
  return {
    name: 'weapon-pose-save',
    configureServer(server) {
      server.middlewares.use('/api/weapon-pose', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = await readJsonBody(req);
          const weaponId = body?.weaponId;
          const pose = body?.pose;
          if (!weaponId || !pose?.position || !pose?.rotation) {
            sendJson(res, 400, { error: 'weaponId and pose.position/rotation required' });
            return;
          }

          const data = JSON.parse(fs.readFileSync(weaponsPath, 'utf8'));
          const def = data[weaponId];
          if (!def) {
            sendJson(res, 404, { error: `Unknown weaponId: ${weaponId}` });
            return;
          }

          def.view = def.view ?? {};
          def.view.pose = {
            position: pose.position,
            rotation: pose.rotation,
            scale: pose.scale ?? def.view.pose?.scale ?? 1,
          };

          fs.writeFileSync(weaponsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
          sendJson(res, 200, { ok: true, pose: def.view.pose });
        } catch (err) {
          sendJson(res, 500, { error: err.message ?? String(err) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), weaponPoseSavePlugin()],
  publicDir: 'public',
  server: {
    port: 5173,
    open: false,
  },
});

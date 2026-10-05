import express from 'express';
import { getDatabase } from '../db/database.ts';

const router = express.Router();

export interface PinnedObjectRef {
  instanceId: string;
  resourceUuid: string;
}

export interface UserPreferences {
  hiddenWidgets: string[];
  pinnedObjects: PinnedObjectRef[];
}

export function readPreferences(username: string): UserPreferences {
  const row = getDatabase().prepare('SELECT layout_json FROM user_preferences WHERE username = ?').get(username);
  let stored: any = {};
  try {
    stored = row ? JSON.parse(row.layout_json) : {};
  } catch (err) {
    stored = {};
  }
  return {
    hiddenWidgets: Array.isArray(stored.hiddenWidgets) ? stored.hiddenWidgets.map(String) : [],
    pinnedObjects: Array.isArray(stored.pinnedObjects)
      ? stored.pinnedObjects
          .filter((p: any) => p && p.instanceId && p.resourceUuid)
          .map((p: any) => ({ instanceId: String(p.instanceId), resourceUuid: String(p.resourceUuid) }))
      : []
  };
}

// GET /api/v1/users/preferences
router.get('/preferences', (req, res) => {
  try {
    return res.json(readPreferences(req.user!.username));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/users/preferences - merges the supplied fields into the stored preferences
router.put('/preferences', (req, res) => {
  try {
    const body = req.body || {};
    const current = readPreferences(req.user!.username);
    const next: UserPreferences = {
      hiddenWidgets: Array.isArray(body.hiddenWidgets) ? body.hiddenWidgets.map(String) : current.hiddenWidgets,
      pinnedObjects: Array.isArray(body.pinnedObjects)
        ? body.pinnedObjects
            .filter((p: any) => p && p.instanceId && p.resourceUuid)
            .map((p: any) => ({ instanceId: String(p.instanceId), resourceUuid: String(p.resourceUuid) }))
        : current.pinnedObjects
    };

    getDatabase().prepare(`
      INSERT INTO user_preferences (username, layout_json) VALUES (?, ?)
      ON CONFLICT(username) DO UPDATE SET layout_json = excluded.layout_json
    `).run(req.user!.username, JSON.stringify(next));

    return res.json(next);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

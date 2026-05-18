import { mkdirSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class JsonlEventStore {
  constructor(filePath) {
    this.filePath = resolve(filePath);
  }

  async readAll() {
    let body = "";
    try {
      body = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }

    return body
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line));
  }

  async append(events) {
    if (events.length === 0) {
      return;
    }
    await mkdir(dirname(this.filePath), { recursive: true });
    const lines = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
    await appendFile(this.filePath, lines, "utf8");
  }

  async replace(events) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    const body = events.map((event) => JSON.stringify(event)).join("\n");
    await writeFile(tmpPath, body === "" ? "" : `${body}\n`, "utf8");
    await rename(tmpPath, this.filePath);
  }
}

export class SQLiteEventStore {
  constructor(filePath) {
    this.filePath = resolve(filePath);
    this.db = null;
  }

  open() {
    if (this.db) return this.db;
    mkdirSync(dirname(this.filePath), { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS openclaims_events (
        event_id TEXT PRIMARY KEY,
        claim_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_time TEXT NOT NULL,
        body TEXT NOT NULL
      )
    `);
    return this.db;
  }

  async readAll() {
    const db = this.open();
    return db
      .prepare("SELECT body FROM openclaims_events ORDER BY event_time ASC, event_id ASC")
      .all()
      .map((row) => JSON.parse(row.body));
  }

  async append(events) {
    if (events.length === 0) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    const db = this.open();
    const insert = db.prepare(
      "INSERT INTO openclaims_events (event_id, claim_id, event_type, event_time, body) VALUES (?, ?, ?, ?, ?)"
    );
    db.exec("BEGIN");
    try {
      for (const event of events) {
        insert.run(event.event_id, event.claim?.claim_id ?? event.claim_ref, event.event_type, event.event_time, JSON.stringify(event));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async replace(events) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const db = this.open();
    db.exec("DELETE FROM openclaims_events");
    await this.append(events);
  }
}

export class MemoryEventStore {
  constructor(seed = []) {
    this.events = [...seed];
  }

  async readAll() {
    return [...this.events];
  }

  async append(events) {
    this.events.push(...events);
  }

  async replace(events) {
    this.events = [...events];
  }
}

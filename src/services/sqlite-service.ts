/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let sqlPromise: Promise<SqlJsStatic> | null = null;
let activeDb: Database | null = null;
let dbChunkCount = 0;
let dbErrorCodeCount = 0;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => `/${file}`,
    });
  }
  return sqlPromise;
}

export interface AttachedDbInfo {
  chunkCount: number;
  errorCodeCount: number;
  filename: string;
}

export interface DbChunkRecord {
  chunk_id: string;
  book: string;
  source_page: number;
  section: string;
  text: string;
}

/**
 * Attaches a user-provided kb.db SQLite file
 */
export async function attachKbDatabase(
  buffer: ArrayBuffer,
  filename: string = 'kb.db'
): Promise<AttachedDbInfo> {
  const SQL = await getSqlJs();
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }

  const u8Array = new Uint8Array(buffer);
  const db = new SQL.Database(u8Array);

  // Verify chunks table
  const chunkRes = db.exec('SELECT count(*) as cnt FROM chunks');
  if (!chunkRes.length || !chunkRes[0].values.length) {
    db.close();
    throw new Error('Database does not contain a "chunks" table.');
  }
  const chunkCount = Number(chunkRes[0].values[0][0]);

  // Check error_codes table
  let errorCodeCount = 0;
  try {
    const errRes = db.exec('SELECT count(*) as cnt FROM error_codes');
    if (errRes.length && errRes[0].values.length) {
      errorCodeCount = Number(errRes[0].values[0][0]);
    }
  } catch {
    // optional table
  }

  activeDb = db;
  dbChunkCount = chunkCount;
  dbErrorCodeCount = errorCodeCount;

  return {
    chunkCount,
    errorCodeCount,
    filename,
  };
}

/**
 * Detaches the active database and releases memory
 */
export function detachKbDatabase(): void {
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }
  dbChunkCount = 0;
  dbErrorCodeCount = 0;
}

/**
 * Returns true if user has attached a live kb.db
 */
export function isDatabaseAttached(): boolean {
  return activeDb !== null;
}

/**
 * Returns current chunk count from attached DB
 */
export function getAttachedChunkCount(): number {
  return dbChunkCount;
}

export function getAttachedErrorCodeCount(): number {
  return dbErrorCodeCount;
}

/**
 * Fetches a chunk record by chunk_id from attached DB
 */
export function getAttachedChunk(chunkId: string): DbChunkRecord | null {
  if (!activeDb) return null;

  try {
    const stmt = activeDb.prepare(
      'SELECT chunk_id, book, source_page, section, text FROM chunks WHERE chunk_id = :id LIMIT 1'
    );
    stmt.bind({ ':id': chunkId });

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        chunk_id: String(row.chunk_id),
        book: String(row.book || ''),
        source_page: Number(row.source_page || 0),
        section: String(row.section || ''),
        text: String(row.text || ''),
      };
    }
    stmt.free();
    return null;
  } catch (e) {
    console.error('Error querying attached database:', e);
    return null;
  }
}

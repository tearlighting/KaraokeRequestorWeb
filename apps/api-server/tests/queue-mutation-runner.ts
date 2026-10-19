// Bundled into ignored test tools, mounted only by compose.isolated.yaml.
import { DatabaseSync } from 'node:sqlite';
import { QueueMutationRepository } from '../src/queue-mutations.js';
const database = process.argv[2];
if (!/^yukari-mutation-[a-f0-9-]+\/request\.db$/.test(database || '')) throw new Error('Isolated fixture required');
console.log('waiting');
const start = performance.now();
new QueueMutationRepository('/run/legacy-db').mutate(database!, 1, 'up');
const elapsed = performance.now() - start;
const db = new DatabaseSync('/run/legacy-db/' + database, { readOnly: true });
console.log(JSON.stringify({ elapsed, rows: db.prepare('SELECT id,reqorder FROM requesttable ORDER BY reqorder').all() }));
db.close();

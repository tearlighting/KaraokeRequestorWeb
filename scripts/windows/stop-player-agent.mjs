import net from 'node:net';

const pipe = process.argv[2] || '';
if (!/^\\\\\.\\pipe\\yukari-agent-[A-Za-z0-9_-]{1,50}$/.test(pipe)) {
  process.stderr.write('Invalid local Agent pipe name.\n');
  process.exit(2);
}
const client = net.createConnection(pipe);
const timer = setTimeout(() => { client.destroy(); process.stderr.write('Agent stop acknowledgement timed out.\n'); process.exit(1); }, 5000);
client.setEncoding('utf8');
client.once('connect', () => client.end('stop'));
client.once('data', value => {
  clearTimeout(timer);
  if (String(value).trim() !== 'stopping') { process.stderr.write('Agent rejected the stop command.\n'); process.exit(1); }
  process.stdout.write('stop acknowledged\n');
  client.end();
});
client.once('error', error => { clearTimeout(timer); process.stderr.write(`Agent control pipe unavailable: ${error.message}\n`); process.exit(1); });

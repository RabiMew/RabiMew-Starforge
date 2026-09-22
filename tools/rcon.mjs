// Minimal RCON client: node tools/rcon.mjs <host> <port> <password> <command...>
import net from 'node:net';

const [host, port, password, ...cmd] = process.argv.slice(2);
if (!host || !port || !password || !cmd.length) {
  console.error('usage: node tools/rcon.mjs <host> <port> <password> <command...>');
  process.exit(2);
}
const command = cmd.join(' ');
const sock = net.connect(Number(port), host);
let reqId = 1;
const send = (type, payload) => {
  const body = Buffer.from(payload + '\0\0', 'utf8');
  const head = Buffer.alloc(8);
  head.writeInt32LE(reqId, 0); head.writeInt32LE(type, 4);
  const len = Buffer.alloc(4); len.writeInt32LE(body.length + 8);
  sock.write(Buffer.concat([len, head, body]));
  return reqId++;
};
let authed = false;
sock.on('connect', () => send(3, password));
let buf = Buffer.alloc(0);
sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= 4) {
    const len = buf.readInt32LE(0);
    if (buf.length < 4 + len) break;
    const pkt = buf.subarray(4, 4 + len); buf = buf.subarray(4 + len);
    const id = pkt.readInt32LE(0);
    const payload = pkt.subarray(8, pkt.length - 2).toString('utf8');
    if (!authed) {
      if (id === -1) { console.error('RCON auth failed'); process.exit(1); }
      authed = true;
      send(2, command);
      continue;
    }
    if (payload) console.log(payload);
    sock.end();
  }
});
sock.on('close', () => process.exit(0));
sock.on('error', (e) => { console.error('rcon error:', e.message); process.exit(1); });
setTimeout(() => { console.error('rcon timeout'); sock.destroy(); process.exit(1); }, 15000);

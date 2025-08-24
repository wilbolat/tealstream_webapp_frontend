const b = require('bcryptjs');
const [token, hash] = process.argv.slice(2);
if (!token || !hash) { console.error('Usage: node utils/check-bcrypt.js <token> <hash>'); process.exit(2); }
console.log('TOKLEN', token.length);
console.log('HASHLEN', hash.length);
console.log('MATCH', b.compareSync(token, hash.trim()));

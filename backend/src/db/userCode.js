// Excludes ambiguous characters (0/O, 1/I) so codes are easy to read and write down.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 5;

function randomCode() {
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export async function generateUniqueUserCode(pool) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const result = await pool.query('select 1 from users where user_code = $1', [code]);
    if (result.rowCount === 0) return code;
  }
  throw new Error('Could not generate a unique user code after 10 attempts');
}

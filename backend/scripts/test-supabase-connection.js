const { healthCheck, close } = require('../src/db/postgres');

(async () => {
  try {
    const result = await healthCheck();
    console.log('เชื่อมต่อ Supabase PostgreSQL สำเร็จ:', result.server_time);
  } catch (error) {
    console.error('เชื่อมต่อ Supabase PostgreSQL ไม่สำเร็จ:', error.message);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();

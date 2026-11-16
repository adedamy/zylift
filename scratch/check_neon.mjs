import 'dotenv/config';
import pg from 'pg';

async function main() {
  const p = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const res = await p.query("SELECT data FROM zylift_app_state WHERE id = 'main'");
  const s = res.rows[0]?.data;
  console.log('PG drivers count:', s?.drivers?.length);
  s?.drivers?.forEach(d => console.log('Driver in DB:', d.id, d.name, d.phone, 'isApproved:', d.isApproved, 'isOnline:', d.isOnline));
  console.log('PG applications count:', s?.applications?.length);
  s?.applications?.forEach(a => console.log('Application in DB:', a.id, a.applicantName, a.phone, 'status:', a.status, 'driverId:', a.driverId));
  await p.end();
}

main().catch(console.error);

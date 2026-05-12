

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Wiping database and seeding clean data...\n');

  
  await prisma.notification.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.courseEnrolment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ Database wiped clean');

  const pw = await bcrypt.hash('password123', 12);

  // ── Staff accounts ─────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: { studentId: 'ADMIN/001', name: 'System Admin',       email: 'admin@jkuat.ac.ke',         password: pw, role: 'ADMIN' },
  });

  const lec1 = await prisma.user.create({
    data: { studentId: 'STAFF/001', name: 'Dr. Kamau Njoroge',  email: 'kamau.njoroge@jkuat.ac.ke',  password: pw, role: 'LECTURER' },
  });

  const lec2 = await prisma.user.create({
    data: { studentId: 'STAFF/002', name: 'Prof. Hana Mwangi',  email: 'hana.mwangi@jkuat.ac.ke',   password: pw, role: 'LECTURER' },
  });

  console.log('✓ Staff: ADMIN/001, STAFF/001, STAFF/002  →  password: password123');

  // ── Courses ────────────────────────────────────────────────────────────────
  const mobile   = await prisma.course.create({ data: { name: 'Mobile Computing',  code: 'CS3301', lecturerId: lec1.id } });
  const db       = await prisma.course.create({ data: { name: 'Database Systems',  code: 'CS2201', lecturerId: lec1.id } });
  const networks = await prisma.course.create({ data: { name: 'Computer Networks', code: 'CS2101', lecturerId: lec2.id } });
  const algo     = await prisma.course.create({ data: { name: 'Algorithms & DS',   code: 'CS3101', lecturerId: lec2.id } });

  console.log('✓ 4 courses: CS3301, CS2201, CS2101, CS3101');

  
  const now     = new Date();
  const dayOfWk = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon

  function sessionDate(dayOffset, hour) {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWk + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  const WEEK = 11;
  const sessions = [
    { course: mobile,   day: 0, sh: 8,  eh: 10 },
    { course: algo,     day: 0, sh: 10, eh: 12 },
    { course: db,       day: 1, sh: 14, eh: 16 },
    { course: networks, day: 2, sh: 8,  eh: 10 },
    { course: mobile,   day: 2, sh: 10, eh: 12 },
    { course: db,       day: 3, sh: 8,  eh: 10 },
    { course: algo,     day: 3, sh: 14, eh: 16 },
    { course: networks, day: 4, sh: 10, eh: 12 },
  ];

  for (const s of sessions) {
    await prisma.session.create({
      data: {
        courseId:    s.course.id,
        weekNumber:  WEEK,
        sessionType: 'Lecture',
        startTime:   sessionDate(s.day, s.sh),
        endTime:     sessionDate(s.day, s.eh),
        radiusMeters: 50,
        latitude:    null,  // lecturer sets via app
        longitude:   null,
        isOpen:      false,
      },
    });
  }

  
  const liveStart = new Date(now.getTime() - 10 * 60 * 1000);  
  const liveEnd   = new Date(now.getTime() + 110 * 60 * 1000); 

  const liveSession = await prisma.session.create({
    data: {
      courseId:    mobile.id,
      weekNumber:  WEEK,
      sessionType: 'Lecture',
      startTime:   liveStart,
      endTime:     liveEnd,
      radiusMeters: 50,
      latitude:    null,
      longitude:   null,
      isOpen:      false,
    },
  });

  console.log(`✓ 9 sessions for Week ${WEEK} (8 timetable + 1 live test session)`);
  console.log('\n──────────────────────────────────────────────────────');
  console.log('  CLEAN SEED COMPLETE');
  console.log('');
  console.log('  Staff logins (use Student ID field, NOT email):');
  console.log('    STAFF/001  /  password123  →  Dr. Kamau Njoroge');
  console.log('    STAFF/002  /  password123  →  Prof. Hana Mwangi');
  console.log('    ADMIN/001  /  password123  →  System Admin');
  console.log('');
  console.log('  Students → Create Account in the app with @students.jkuat.ac.ke');
  console.log('  → Auto-enrolled in all 4 courses on signup');
  console.log('');
  console.log(`  Live session: ${liveSession.id}`);
  console.log('  → Login as STAFF/001 → Today tab → Set Location & Open');
  console.log('──────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
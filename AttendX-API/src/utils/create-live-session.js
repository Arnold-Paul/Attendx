

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  // Find the lecturer
  const lecturer = await prisma.user.findUnique({ where: { studentId: 'STAFF/001' } });
  if (!lecturer) {
    console.error('Lecturer STAFF/001 not found. Run npm run db:seed first.');
    process.exit(1);
  }

  // Find Mobile Computing course
  const course = await prisma.course.findUnique({ where: { code: 'CS3301' } });
  if (!course) {
    console.error('Course CS3301 not found. Run npm run db:seed first.');
    process.exit(1);
  }


  const startTime = new Date(now.getTime() - 10 * 60 * 1000);  
  const endTime   = new Date(now.getTime() + 120 * 60 * 1000); 

  const session = await prisma.session.create({
    data: {
      courseId:    course.id,
      weekNumber:  11,
      sessionType: 'Lecture',
      startTime,
      endTime,
      radiusMeters: 50,
      isOpen:       false,   
      latitude:     null,    
      longitude:    null,
    },
    include: { course: true },
  });

  console.log('\n──────────────────────────────────────────────');
  console.log('  Fresh live session created!');
  console.log(`  Course:     ${session.course.name}`);
  console.log(`  Started:    ${startTime.toLocaleTimeString()}`);
  console.log(`  Ends:       ${endTime.toLocaleTimeString()}`);
  console.log(`  Session ID: ${session.id}`);
  console.log('\n  Now log in as STAFF/001 in the app.');
  console.log('  Go to Today tab → tap "Set Location & Open".');
  console.log('  Students will get a notification immediately.');
  console.log('──────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
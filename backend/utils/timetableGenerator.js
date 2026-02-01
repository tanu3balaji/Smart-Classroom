// backend/utils/timetableGenerator.js
import Course from '../models/course.js';
import Faculty from '../models/Faculty.js';
import Room from '../models/Room.js';
import Timetable from '../models/Timetable.js';
import Notification from '../models/Notification.js';

// --- Configuration ---
const WEEKS = 13;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:15', end: '12:15' },
  { start: '14:15', end: '15:15' },
  { start: '15:15', end: '16:15' },
  { start: '16:30', end: '17:30' },
];

/**
 * Calculates the number of weekly 1-hour sessions a course requires.
 */
function getWeeklySessions(course) {
  return Number(course.hoursPerWeek) || 3;
}

/**
 * Checks if a faculty member is available at a specific time slot
 */
function isFacultyAvailable(faculty, day, startTime, endTime) {
  if (!faculty.availability) return true;
  
  const dayAvailability = faculty.availability[day.toLowerCase()];
  if (!dayAvailability || dayAvailability.length === 0) return true;
  
  return dayAvailability.some(slot => 
    slot.start <= startTime && slot.end >= endTime
  );
}

/**
 * Checks if a room is available at a specific time slot
 */
function isRoomAvailable(room, day, startTime, endTime) {
  if (!room.availability) return true;
  
  const dayAvailability = room.availability[day.toLowerCase()];
  if (!dayAvailability || dayAvailability.length === 0) return true;
  
  return dayAvailability.some(slot => 
    slot.start <= startTime && slot.end >= endTime
  );
}

/**
 * Checks if there are any conflicts with existing assignments
 */
function hasConflict(schedule, facultyId, roomId, day, startTime, endTime) {
  return schedule.some(entry => 
    ((entry.facultyId === facultyId) || (entry.roomId === roomId)) &&
    entry.day === day &&
    !(entry.endTime <= startTime || entry.startTime >= endTime)
  );
}

/**
 * Finds the best faculty member for a course (matching specialization if possible)
 */
function findBestFaculty(course, availableFaculty, usedFaculty) {
  const courseNameLower = (course.name || '').toLowerCase();
  
  // Try to find faculty with matching specialization
  for (const faculty of availableFaculty) {
    if (usedFaculty.has(String(faculty._id))) continue;
    
    if (faculty.specialization && faculty.specialization.length > 0) {
      const hasMatch = faculty.specialization.some(spec =>
        courseNameLower.includes(spec.toLowerCase()) || 
        spec.toLowerCase().includes(courseNameLower)
      );
      if (hasMatch) return faculty;
    }
  }
  
  // If no specialization match, return first available faculty
  for (const faculty of availableFaculty) {
    if (!usedFaculty.has(String(faculty._id))) {
      return faculty;
    }
  }
  
  return null;
}

/**
 * Generates a timetable using deterministic, rule-based logic
 */
export async function generateTimetableWithAI(request) {
  console.log('=== STARTING RULE-BASED TIMETABLE GENERATION ===');
  console.log('Request:', request);

  try {
    const { department, semester, academicYear } = request;
    if (!department || !semester || !academicYear) {
      throw new Error('Department, semester, and academic year are required.');
    }

    // 1. Fetch all necessary data from the database
    console.log('Fetching DB data...');
    const allCourses = await Course.find({});
    const allFaculty = await Faculty.find({});
    const allRooms = await Room.find({});

    // Filter data for the specific request
    const relevantCourses = allCourses.filter(c =>
      (c.department || '').toLowerCase() === department.toLowerCase() &&
      Number(c.semester) === Number(semester)
    );

    if (relevantCourses.length === 0) {
      console.warn(`No courses found for ${department}, Semester ${semester}`);
      // Return empty timetable instead of throwing error
      const emptyTimetable = new Timetable({
        name: `${department} - Semester ${semester} ${academicYear}`,
        department,
        semester: String(semester),
        year: parseInt(academicYear),
        schedule: [],
        conflicts: [],
        status: 'draft',
        metadata: {
          totalHours: 0,
          utilizationRate: 0,
          conflictCount: 0
        }
      });
      const saved = await emptyTimetable.save();
      return saved;
    }

    const relevantFaculty = allFaculty.filter(f => 
      (f.department || '').toLowerCase() === department.toLowerCase()
    );

    // 2. Generate timetable using constraint-based logic
    console.log(`Generating timetable for ${relevantCourses.length} courses...`);
    const schedule = [];
    const usedFaculty = new Map(); // Track sessions per faculty
    const courseAssignments = new Map(); // Track which faculty teaches which course
    
    // Assign faculty to courses first
    for (const course of relevantCourses) {
      const faculty = findBestFaculty(course, relevantFaculty, new Set(courseAssignments.values()));
      if (faculty) {
        courseAssignments.set(String(course._id), String(faculty._id));
        console.log(`Assigned ${faculty.name} to ${course.name}`);
      }
    }

    // Schedule each course's sessions
    for (const course of relevantCourses) {
      const facultyId = courseAssignments.get(String(course._id));
      const faculty = relevantFaculty.find(f => String(f._id) === facultyId);
      
      if (!faculty) {
        console.warn(`No faculty assigned for course: ${course.name}`);
        continue;
      }

      const requiredSessions = getWeeklySessions(course);
      let sessionsScheduled = 0;
      let relaxedConstraints = false;

      // Try to schedule required sessions
      outerLoop: for (let attempt = 0; attempt < 2; attempt++) {
        for (const day of DAYS) {
          for (const timeSlot of TIME_SLOTS) {
            if (sessionsScheduled >= requiredSessions) break outerLoop;

            // Check availability
            const facultyAvailable = relaxedConstraints || 
              isFacultyAvailable(faculty, day, timeSlot.start, timeSlot.end);
            
            if (!facultyAvailable) continue;

            // Find available room
            const availableRoom = allRooms.find(room => {
              const roomAvailable = relaxedConstraints || 
                isRoomAvailable(room, day, timeSlot.start, timeSlot.end);
              
              return roomAvailable && 
                !hasConflict(schedule, facultyId, String(room._id), day, timeSlot.start, timeSlot.end);
            });

            if (!availableRoom) continue;

            // Check for conflicts
            if (hasConflict(schedule, facultyId, String(availableRoom._id), day, timeSlot.start, timeSlot.end)) {
              continue;
            }

            // Schedule the session
            schedule.push({
              courseId: String(course._id),
              facultyId: String(faculty._id),
              roomId: String(availableRoom._id),
              day,
              startTime: timeSlot.start,
              endTime: timeSlot.end
            });

            sessionsScheduled++;
            console.log(`Scheduled ${course.name} on ${day} ${timeSlot.start}-${timeSlot.end}`);
          }
        }
        
        // On second attempt, relax constraints
        if (attempt === 0 && sessionsScheduled < requiredSessions) {
          console.log(`Relaxing constraints for ${course.name}`);
          relaxedConstraints = true;
        }
      }

      if (sessionsScheduled < requiredSessions) {
        console.warn(`Could only schedule ${sessionsScheduled}/${requiredSessions} sessions for ${course.name}`);
      }
    }

    // 3. Enrich and Save the Timetable
    const enrichedSchedule = schedule.map(entry => {
      const course = relevantCourses.find(c => String(c._id) === entry.courseId);
      const faculty = relevantFaculty.find(f => String(f._id) === entry.facultyId);
      const room = allRooms.find(r => String(r._id) === entry.roomId);
      return {
        ...entry,
        courseName: course ? course.name : 'Unknown',
        facultyName: faculty ? faculty.name : 'Unknown',
        roomName: room ? room.name : 'Unknown',
        timeSlot: `${entry.startTime}-${entry.endTime}`
      };
    });

    const totalHours = enrichedSchedule.length;
    const availableSlots = DAYS.length * TIME_SLOTS.length;
    const utilizationRate = availableSlots > 0 ? Math.round((totalHours / availableSlots) * 100) : 0;

    const timetableData = {
      name: `${department} - Semester ${semester} ${academicYear}`,
      department,
      semester: String(semester),
      year: parseInt(academicYear),
      schedule: enrichedSchedule,
      conflicts: [],
      status: 'draft',
      metadata: {
        totalHours,
        utilizationRate,
        conflictCount: 0
      }
    };

    const timetable = new Timetable(timetableData);
    const created = await timetable.save();
    console.log(`Timetable saved successfully! ID: ${created._id}`);

    // Create a success notification
    await new Notification({
      title: 'Timetable Generated',
      message: `Generated timetable "${created.name}" with ${totalHours} entries using rule-based scheduling.`,
      type: 'success',
    }).save();

    return created;

  } catch (err) {
    console.error('Error in generateTimetableWithAI:', err);
    // Create an error notification
    await new Notification({
      title: 'Timetable Generation Error',
      message: err.message || 'An unknown error occurred.',
      type: 'error',
    }).save();
    
    // Return minimal timetable even on error
    try {
      const { department, semester, academicYear } = request;
      const fallbackTimetable = new Timetable({
        name: `${department} - Semester ${semester} ${academicYear} (Fallback)`,
        department,
        semester: String(semester),
        year: parseInt(academicYear),
        schedule: [],
        conflicts: [{ type: 'error', message: err.message, entries: [] }],
        status: 'draft',
        metadata: { totalHours: 0, utilizationRate: 0, conflictCount: 1 }
      });
      return await fallbackTimetable.save();
    } catch (fallbackErr) {
      console.error('Fallback timetable creation failed:', fallbackErr);
      throw err;
    }
  }
}

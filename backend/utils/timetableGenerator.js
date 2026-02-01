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

    // Check if we have rooms and faculty
    console.log(`Found ${relevantCourses.length} courses, ${relevantFaculty.length} faculty, ${allRooms.length} rooms`);
    
    if (allRooms.length === 0) {
      console.warn('No rooms available for scheduling');
    }
    if (relevantFaculty.length === 0) {
      console.warn('No faculty available for scheduling');
    }

    // 2. Generate timetable using constraint-based logic
    console.log(`Generating timetable for ${relevantCourses.length} courses...`);
    const schedule = [];
    const courseAssignments = new Map(); // Track which faculty teaches which course
    const usedFacultySlots = new Map(); // Track faculty time occupancy
    
    // Initialize faculty slot tracking
    for (const faculty of relevantFaculty) {
      usedFacultySlots.set(String(faculty._id), []);
    }

    // STEP 1: Assign faculty to courses
    console.log('STEP 1: Assigning faculty to courses...');
    for (const course of relevantCourses) {
      let assignedFaculty = null;
      const courseNameLower = (course.name || '').toLowerCase();
      
      // Try specialization match first
      for (const faculty of relevantFaculty) {
        if (faculty.specialization && faculty.specialization.length > 0) {
          const hasMatch = faculty.specialization.some(spec =>
            courseNameLower.includes(spec.toLowerCase()) || 
            spec.toLowerCase().includes(courseNameLower)
          );
          if (hasMatch && !courseAssignments.values().includes(String(faculty._id))) {
            assignedFaculty = faculty;
            break;
          }
        }
      }
      
      // If no match, assign any available faculty
      if (!assignedFaculty) {
        for (const faculty of relevantFaculty) {
          if (!Array.from(courseAssignments.values()).includes(String(faculty._id))) {
            assignedFaculty = faculty;
            break;
          }
        }
      }
      
      // If all faculty are assigned, allow reuse
      if (!assignedFaculty && relevantFaculty.length > 0) {
        assignedFaculty = relevantFaculty[0];
      }
      
      if (assignedFaculty) {
        courseAssignments.set(String(course._id), String(assignedFaculty._id));
        console.log(`[v0] Assigned "${assignedFaculty.name}" to "${course.name}"`);
      } else {
        console.warn(`[v0] No faculty available for course: ${course.name}`);
      }
    }

    // STEP 2: Schedule each course's sessions
    console.log('STEP 2: Scheduling sessions with rooms and faculty...');
    for (const course of relevantCourses) {
      const facultyId = courseAssignments.get(String(course._id));
      const faculty = relevantFaculty.find(f => String(f._id) === facultyId);
      
      if (!faculty || allRooms.length === 0) {
        console.warn(`[v0] Cannot schedule ${course.name}: faculty="${!!faculty}", rooms=${allRooms.length}`);
        continue;
      }

      const requiredSessions = getWeeklySessions(course);
      let sessionsScheduled = 0;

      // Try to schedule sessions across the week
      for (let sessionNum = 0; sessionNum < requiredSessions; sessionNum++) {
        let scheduled = false;
        
        for (const day of DAYS) {
          if (scheduled) break;
          
          for (const timeSlot of TIME_SLOTS) {
            // Check if faculty is free at this time
            const facultyOccupied = (usedFacultySlots.get(String(faculty._id)) || [])
              .some(slot => slot.day === day && 
                !(slot.end <= timeSlot.start || slot.start >= timeSlot.end));
            
            if (facultyOccupied) continue;

            // Find available room
            const availableRoom = allRooms.find(room => {
              return !hasConflict(schedule, String(faculty._id), String(room._id), day, timeSlot.start, timeSlot.end);
            });

            if (!availableRoom) continue;

            // Schedule the session
            schedule.push({
              courseId: String(course._id),
              facultyId: String(faculty._id),
              roomId: String(availableRoom._id),
              day,
              startTime: timeSlot.start,
              endTime: timeSlot.end
            });

            // Mark faculty slot as used
            usedFacultySlots.get(String(faculty._id)).push({
              day,
              start: timeSlot.start,
              end: timeSlot.end
            });

            sessionsScheduled++;
            console.log(`[v0] Scheduled: ${course.name} → ${faculty.name} @ ${availableRoom.name} on ${day} ${timeSlot.start}`);
            scheduled = true;
            break;
          }
        }
        
        if (!scheduled) {
          console.log(`[v0] Could not find slot for session ${sessionNum + 1}/${requiredSessions} of ${course.name}`);
        }
      }

      console.log(`[v0] Course "${course.name}": scheduled ${sessionsScheduled}/${requiredSessions} sessions`);
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

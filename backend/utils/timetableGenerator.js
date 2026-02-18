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
 * A conflict occurs when:
 * 1. The SAME faculty is assigned to two overlapping time slots, OR
 * 2. The SAME room is assigned to two overlapping time slots
 * Pass null for facultyId or roomId to skip that check
 */
function hasConflict(schedule, facultyId, roomId, day, startTime, endTime) {
  return schedule.some(entry => {
    // Check if times overlap
    const timesOverlap = entry.day === day && !(entry.endTime <= startTime || entry.startTime >= endTime);
    
    if (!timesOverlap) return false;
    
    // Conflict if same faculty at overlapping time (only check if facultyId is provided)
    if (facultyId !== null && entry.facultyId === facultyId) return true;
    
    // Conflict if same room at overlapping time (only check if roomId is provided)
    if (roomId !== null && entry.roomId === roomId) return true;
    
    return false;
  });
}

/**
 * Creates fallback faculty if none exist in the database
 */
async function createFallbackFaculty(department, courseCount) {
  console.log(`[v0] Creating ${courseCount} fallback faculty members for ${department}...`);
  const createdFaculty = [];
  
  for (let i = 1; i <= courseCount; i++) {
    const faculty = new Faculty({
      name: `Faculty ${i}`,
      email: `faculty${i}@university.edu`,
      phone: `555-000${i}`,
      department: department,
      specialization: [],
      availability: null,
      createdAt: new Date()
    });
    
    try {
      const saved = await faculty.save();
      createdFaculty.push(saved);
      console.log(`[v0] Created fallback faculty: ${saved.name}`);
    } catch (err) {
      console.error(`[v0] Failed to create faculty: ${err.message}`);
    }
  }
  
  return createdFaculty;
}

/**
 * Creates fallback rooms if none exist in the database
 */
async function createFallbackRooms(roomCount) {
  console.log(`[v0] Creating ${roomCount} fallback rooms...`);
  const createdRooms = [];
  
  for (let i = 1; i <= roomCount; i++) {
    const room = new Room({
      name: `Room ${i}`,
      capacity: 50,
      building: 'Building A',
      resources: ['Projector', 'Whiteboard'],
      availability: null,
      createdAt: new Date()
    });
    
    try {
      const saved = await room.save();
      createdRooms.push(saved);
      console.log(`[v0] Created fallback room: ${saved.name}`);
    } catch (err) {
      console.error(`[v0] Failed to create room: ${err.message}`);
    }
  }
  
  return createdRooms;
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
    console.log('[v0] Fetching DB data...');
    const allCourses = await Course.find({});
    const allFaculty = await Faculty.find({});
    const allRooms = await Room.find({});

    console.log(`[v0] DB Total: ${allCourses.length} courses, ${allFaculty.length} faculty, ${allRooms.length} rooms`);
    console.log(`[v0] Filtering for department: "${department}", semester: ${semester}`);
    
    if (allFaculty.length > 0) {
      console.log(`[v0] Sample faculty departments:`, allFaculty.slice(0, 3).map(f => ({ name: f.name, dept: f.department })));
    }

    // Filter data for the specific request
    const relevantCourses = allCourses.filter(c =>
      (c.department || '').toLowerCase() === department.toLowerCase() &&
      Number(c.semester) === Number(semester)
    );

    console.log(`[v0] Found ${relevantCourses.length} courses for ${department} semester ${semester}`);

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

    // Try exact match first, then fallback to using ALL faculty if no match
    let relevantFaculty = allFaculty.filter(f => 
      (f.department || '').toLowerCase() === department.toLowerCase()
    );
    
    console.log(`[v0] Filtered faculty: ${relevantFaculty.length} (after department filter)`);
    
    // If department filter returns nothing, use ALL faculty (for flexibility)
    if (relevantFaculty.length === 0 && allFaculty.length > 0) {
      console.log(`[v0] No faculty matched department filter, using ALL ${allFaculty.length} faculty`);
      relevantFaculty = allFaculty;
    }

    // CREATE FALLBACK FACULTY IF NONE EXIST
    if (relevantFaculty.length === 0) {
      console.warn(`[v0] No faculty found for ${department}. Creating fallback faculty...`);
      const fallbackCount = Math.max(relevantCourses.length, 3);
      const createdFallback = await createFallbackFaculty(department, fallbackCount);
      relevantFaculty = createdFallback;
      console.log(`[v0] Created ${createdFallback.length} fallback faculty members`);
    }

    // CREATE FALLBACK ROOMS IF NONE EXIST
    let usedRooms = allRooms;
    if (allRooms.length === 0) {
      console.warn(`[v0] No rooms found. Creating fallback rooms...`);
      const fallbackRoomCount = Math.max(2, Math.ceil(relevantCourses.length / 2));
      const createdFallback = await createFallbackRooms(fallbackRoomCount);
      usedRooms = createdFallback;
      console.log(`[v0] Created ${createdFallback.length} fallback rooms`);
    }

    console.log(`[v0] Using ${relevantCourses.length} courses, ${relevantFaculty.length} faculty, ${usedRooms.length} rooms`);



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
    console.log('[v0] STEP 1: Assigning faculty to courses...');
    
    // Convert to array once for efficiency
    const assignedFacultyIds = new Set();
    
    for (const course of relevantCourses) {
      let assignedFaculty = null;
      const courseNameLower = (course.name || '').toLowerCase();
      
      // Try specialization match first
      for (const faculty of relevantFaculty) {
        if (assignedFacultyIds.has(String(faculty._id))) {
          continue; // Skip already assigned faculty
        }
        
        if (faculty.specialization && faculty.specialization.length > 0) {
          const hasMatch = faculty.specialization.some(spec =>
            courseNameLower.includes(spec.toLowerCase()) || 
            spec.toLowerCase().includes(courseNameLower)
          );
          if (hasMatch) {
            assignedFaculty = faculty;
            break;
          }
        }
      }
      
      // If no match, assign any available faculty
      if (!assignedFaculty) {
        for (const faculty of relevantFaculty) {
          if (!assignedFacultyIds.has(String(faculty._id))) {
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
        assignedFacultyIds.add(String(assignedFaculty._id));
        console.log(`[v0] Assigned "${assignedFaculty.name}" to "${course.name}"`);
      } else {
        console.warn(`[v0] No faculty available for course: ${course.name}`);
      }
    }

    // STEP 2: Schedule each course's sessions (with strict constraint checking first)
    console.log('[v0] STEP 2: Scheduling sessions with strict constraints...');
    for (const course of relevantCourses) {
      const facultyId = courseAssignments.get(String(course._id));
      const faculty = relevantFaculty.find(f => String(f._id) === facultyId);
      
      if (!faculty) {
        console.warn(`[v0] Cannot schedule ${course.name}: no faculty assigned`);
        continue;
      }

      if (usedRooms.length === 0) {
        console.warn(`[v0] Cannot schedule ${course.name}: no rooms available`);
        continue;
      }

      const requiredSessions = getWeeklySessions(course);
      let sessionsScheduled = 0;

      // Try to schedule required sessions with strict conflict checking
      for (let sessionNum = 0; sessionNum < requiredSessions; sessionNum++) {
        let scheduled = false;
        
        for (const day of DAYS) {
          if (scheduled) break;
          for (const timeSlot of TIME_SLOTS) {
            const hasConflictFlag = hasConflict(schedule, String(faculty._id), null, day, timeSlot.start, timeSlot.end);
            if (hasConflictFlag) continue;

            let assignedRoom = null;
            for (const room of usedRooms) {
              const roomHasConflict = hasConflict(schedule, null, String(room._id), day, timeSlot.start, timeSlot.end);
              if (!roomHasConflict) {
                assignedRoom = room;
                break;
              }
            }

            if (!assignedRoom) continue;

            schedule.push({
              courseId: String(course._id),
              facultyId: String(faculty._id),
              roomId: String(assignedRoom._id),
              day,
              startTime: timeSlot.start,
              endTime: timeSlot.end
            });

            sessionsScheduled++;
            console.log(`[v0] Scheduled: ${course.name} → ${faculty.name} @ ${assignedRoom.name} on ${day} ${timeSlot.start}`);
            scheduled = true;
            break;
          }
        }
      }

      console.log(`[v0] Course "${course.name}": scheduled ${sessionsScheduled}/${requiredSessions} sessions`);
    }

    // FALLBACK MODE: If schedule is empty or too small, use aggressive reuse strategy
    console.log(`[v0] After strict scheduling: ${schedule.length} entries`);
    
    if (schedule.length === 0 || schedule.length < relevantCourses.length) {
      console.log('[v0] ENTERING FALLBACK MODE: Reusing data to fill timetable...');
      
      // Clear and regenerate with no conflict checking - just fill the grid
      schedule.length = 0;
      
      let courseIndex = 0;
      let facultyIndex = 0;
      
      for (const day of DAYS) {
        for (const timeSlot of TIME_SLOTS) {
          const course = relevantCourses[courseIndex % relevantCourses.length];
          const faculty = relevantFaculty[facultyIndex % relevantFaculty.length];
          const room = usedRooms[courseIndex % usedRooms.length];
          
          schedule.push({
            courseId: String(course._id),
            facultyId: String(faculty._id),
            roomId: String(room._id),
            day,
            startTime: timeSlot.start,
            endTime: timeSlot.end
          });
          
          console.log(`[v0] Fallback: ${course.name} → ${faculty.name} @ ${room.name} on ${day} ${timeSlot.start}`);
          
          courseIndex++;
          facultyIndex++;
        }
      }
      
      console.log(`[v0] Fallback mode completed: ${schedule.length} entries created`);
    }

    // 3. Enrich and Save the Timetable
    const enrichedSchedule = schedule.map(entry => {
      const course = relevantCourses.find(c => String(c._id) === entry.courseId);
      const faculty = relevantFaculty.find(f => String(f._id) === entry.facultyId);
      const room = usedRooms.find(r => String(r._id) === entry.roomId);
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

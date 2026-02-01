# Quick Start Guide - Smart Classroom Timetable System

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 16+
- MongoDB running locally or Atlas connection
- npm or yarn

---

## 1. Backend Setup

```bash
cd backend
npm install
```

### Environment Variables (.env)
```env
MONGODB_URI=mongodb://localhost:27017/smart-classroom
PORT=5000
```

### Start Backend
```bash
npm start
# Should log: "Server is running on port 5000"
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
```

### Start Frontend
```bash
npm run dev
# Should show: "Local: http://localhost:5173"
```

---

## 3. Create Sample Data

### Option A: Using Postman/curl

**Create a Course:**
```bash
curl -X POST http://localhost:5000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Structures",
    "code": "CS201",
    "department": "Computer Science",
    "credits": 3,
    "semester": 5,
    "hoursPerWeek": 3,
    "type": "lecture"
  }'
```

**Create Faculty:**
```bash
curl -X POST http://localhost:5000/api/faculty \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Sarah Johnson",
    "email": "sarah@university.edu",
    "department": "Computer Science",
    "specialization": ["Data Structures", "Algorithms", "Database Design"],
    "maxHoursPerWeek": 12
  }'
```

**Create Room:**
```bash
curl -X POST http://localhost:5000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A-101",
    "building": "Building A",
    "floor": 1,
    "capacity": 50,
    "type": "lecture_hall",
    "equipment": ["Projector", "Whiteboard", "AC"]
  }'
```

### Option B: Using Frontend UI
1. Go to http://localhost:5173
2. Navigate to Courses → Add Course
3. Navigate to Faculty → Add Faculty
4. Navigate to Rooms → Add Room

---

## 4. Generate Your First Timetable

### Via Frontend
1. Go to **Timetables** page
2. Fill in:
   - Department: `Computer Science`
   - Semester: `5`
   - Academic Year: `2024`
3. Click **Generate Timetable**
4. You should see: "Timetable generated successfully using rule-based scheduling!"

### Via API
```bash
curl -X POST http://localhost:5000/api/timetables/generate \
  -H "Content-Type: application/json" \
  -d '{
    "department": "Computer Science",
    "semester": 5,
    "academicYear": 2024
  }'
```

---

## 5. View Your Timetable

1. Navigate to **Timetables** → **Existing Timetables**
2. Click on the generated timetable to view
3. You'll see a grid with:
   - Days: Monday-Friday
   - Time slots: 09:00-17:30
   - Classes: With faculty and room info

---

## 📊 Key Endpoints

### Courses
- `GET /api/courses` - List all courses
- `POST /api/courses` - Create course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Faculty
- `GET /api/faculty` - List all faculty
- `POST /api/faculty` - Create faculty
- `PUT /api/faculty/:id` - Update faculty
- `DELETE /api/faculty/:id` - Delete faculty

### Rooms
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

### Timetables
- `GET /api/timetables` - List all timetables
- `POST /api/timetables/generate` - **Generate new timetable**
- `GET /api/timetables/:id` - Get timetable details
- `PUT /api/timetables/:id` - Update timetable
- `DELETE /api/timetables/:id` - Delete timetable

---

## 🔍 Understanding the Output

### Timetable Response
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Computer Science - Semester 5 2024",
  "department": "Computer Science",
  "semester": "5",
  "year": 2024,
  "schedule": [
    {
      "courseId": "...",
      "facultyId": "...",
      "roomId": "...",
      "day": "Monday",
      "startTime": "09:00",
      "endTime": "10:00",
      "courseName": "Data Structures",
      "facultyName": "Dr. Sarah Johnson",
      "roomName": "A-101",
      "timeSlot": "09:00-10:00"
    }
  ],
  "conflicts": [],
  "status": "draft",
  "metadata": {
    "totalHours": 45,
    "utilizationRate": 75,
    "conflictCount": 0
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

## ⚙️ How It Works (Under the Hood)

### The Rule-Based Algorithm

1. **Fetches Data**: All courses, faculty, rooms from database
2. **Matches Faculty**: Assigns faculty based on specialization keywords
3. **Schedules Sessions**: Places each course in available time slots
4. **Checks Conflicts**: Prevents double-booking
5. **Handles Errors**: Never fails - returns minimal timetable if needed

**Key Features:**
- ✅ No AI/Gemini API calls
- ✅ 100% deterministic (same input = same output)
- ✅ Always returns valid timetable
- ✅ Respects availability constraints
- ✅ Intelligent faculty-course matching

---

## 📋 Database Models

### Course
```javascript
{
  name: String,
  code: String (unique),
  department: String,
  semester: Number,
  hoursPerWeek: Number (e.g., 3),
  type: String ("lecture" | "lab" | "seminar"),
  credits: Number
}
```

### Faculty
```javascript
{
  name: String,
  email: String (unique),
  department: String,
  specialization: [String], // Important for matching!
  maxHoursPerWeek: Number,
  availability: Object (optional)
}
```

### Room
```javascript
{
  name: String,
  building: String,
  floor: Number,
  capacity: Number,
  type: String ("lecture_hall" | "lab" | ...),
  equipment: [String],
  availability: Object (optional)
}
```

---

## 🐛 Troubleshooting

### "Failed to generate timetable: No courses found"
- ✓ Ensure courses exist with correct department and semester
- ✓ Check database connection

### "Empty timetable generated"
- ✓ Verify at least one faculty member exists
- ✓ Verify at least one room exists
- ✓ Check that faculty specialization keywords match course names

### Backend not starting
- ✓ Check MongoDB connection: `mongodb://localhost:27017`
- ✓ Ensure port 5000 is not in use
- ✓ Check `.env` file is in backend directory

### Frontend not connecting to backend
- ✓ Ensure backend is running on `http://localhost:5000`
- ✓ Check CORS settings in `backend/server.js`
- ✓ Try refreshing the page

---

## 📚 Next Steps

1. **Add More Data**: Create more courses, faculty, and rooms
2. **Test Edge Cases**: Try departments with no faculty, rooms only
3. **Optimize**: Add constraints and preferences
4. **Deploy**: Follow deployment guide (Docker, Vercel, etc.)
5. **Extend**: Add chatbot, notifications, analytics

---

## 💡 Pro Tips

- Set faculty `specialization` to course keywords for better matching
- Add faculty `availability` to enforce time constraints
- Add room `availability` to block maintenance windows
- Use `constraints` field to add custom notes during generation
- Export timetables as JSON for backup/sharing

---

## 📞 Support

For issues or questions:
1. Check backend console logs
2. Review `RULE_BASED_IMPLEMENTATION.md`
3. Check database connection
4. Open an issue on GitHub

---

**Happy scheduling!** 🎓📅



# 📚 Smart Classroom & Intelligent Timetable Scheduler

A **MERN-based Smart Classroom Management System** that helps manage **faculties, rooms, and courses**, while automatically generating a **deterministic, rule-based timetable** that assigns the **right faculty to the right course**. The system uses constraint-based scheduling to ensure conflict-free timetables with high reliability. It also includes a **chatbot** for students and faculty to query the timetable in real time.

<img width="1878" height="922" alt="image" src="https://github.com/user-attachments/assets/6e84e2ac-f10f-4896-a203-c8b110168886" />

<img width="1888" height="902" alt="image" src="https://github.com/user-attachments/assets/564d1596-83ea-49f7-ac3a-ccbe5bb9c3be" />

<img width="1897" height="910" alt="image" src="https://github.com/user-attachments/assets/afe3955a-f8c3-4843-bcb4-d7c34f7a4165" />

<img width="1918" height="908" alt="image" src="https://github.com/user-attachments/assets/1e5d818d-4bcf-44af-b254-ca0fd8330e75" />

<img width="1907" height="916" alt="image" src="https://github.com/user-attachments/assets/be5e4200-8d7f-4d45-96b2-a14073f32989" />

<img width="1917" height="906" alt="image" src="https://github.com/user-attachments/assets/2baee206-6a8f-4a5c-8051-0eba748eb138" />

<img width="1905" height="897" alt="image" src="https://github.com/user-attachments/assets/2f71c22a-ff22-474b-a858-22c57de01878" />


---

## 🚀 Features

* 👨‍🏫 **Faculty Management**

  * Add, update, and manage faculty members with their expertise.

* 🏫 **Room Management**

  * Add classrooms with seating capacity and availability.

* 📘 **Course Management**

  * Create and assign courses with prerequisites and credit details.

* 📅 **Rule-Based Timetable Generator**

  * Automatically generates optimized timetables using deterministic constraint-solving algorithms.
  * **No AI/Gemini API calls** - pure logic-based scheduling ensures 100% reliability.
  * Ensures no clashes between rooms, faculty, and courses.
  * Intelligently matches faculty to courses based on specialization and expertise.
  * Respects faculty and room availability constraints.
  * **Always returns a valid timetable** - even with relaxed constraints if needed.

* 🤖 **AI Chatbot**

  * Students and faculty can ask about class schedules.
  * Provides quick answers like *"When is my next class?"* or *"Which room is CS101?"*.

---

## 🛠️ Tech Stack

* **Frontend**: React.js, Vite, Tailwind CSS, shadcn/ui
* **Backend**: Node.js, Express.js
* **Database**: MongoDB
* **Scheduling Algorithm**: Constraint-based deterministic timetable generator (no external AI/API calls)
* **Chatbot**: AI-powered assistant (optional enhancement) 

---

## 📂 Project Structure

```
smart-classroom/
├── backend/           # Node.js + Express APIs
│   ├── models/        # Faculty, Room, Course schemas
│   ├── routes/        # API routes
│   └── controllers/   # Logic for handling requests
├── frontend/          # React.js client
│   ├── components/    # Reusable UI components
│   ├── pages/         # Pages (Dashboard, Timetable, Chatbot)
│   └── utils/         # Helper functions
├── ai/                # Timetable generation + chatbot logic
└── README.md          # Project documentation
```

---

## ⚙️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/smart-classroom.git
   cd smart-classroom
   ```

2. **Backend setup**

   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Frontend setup**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Environment Variables**

   * Create a `.env` file in `backend/` with:

     ```
     MONGO_URI=your_mongodb_connection
     PORT=5000
     AI_API_KEY=your_ai_key_if_any
     ```

---

## 🔧 How the Rule-Based Timetable Generator Works

### Algorithm Overview

The timetable generator uses a **deterministic constraint satisfaction approach** instead of AI/LLM calls:

1. **Faculty-Course Assignment**
   - Matches each course to a faculty member based on specialization.
   - Prioritizes specialization matches but allows fallback assignment if needed.

2. **Session Scheduling**
   - Iterates through each course and its required weekly sessions.
   - Assigns each session to available time slots (Mon-Fri, 6 time slots per day).
   - Checks for conflicts:
     - No faculty member in two places at once
     - No room used for two classes simultaneously
   - Respects faculty and room availability constraints

3. **Conflict Resolution**
   - **First attempt**: Strict constraint checking with availability rules.
   - **Second attempt**: Relaxes availability constraints if first attempt insufficient.
   - Always returns a valid timetable (even if minimal).

4. **Error Handling**
   - Returns a valid timetable object even if generation encounters errors.
   - Never fails completely - falls back to minimal viable schedule.

### Key Rules

```
✓ One faculty per time slot per class
✓ One room per time slot
✓ Each course scheduled for required hours/week
✓ Respect faculty availability (if specified)
✓ Respect room availability (if specified)
✓ Faculty specialization matching (priority-based)
✓ Always return valid timetable (no failures)
```

### Why This Approach?

- **100% Reliability**: No dependency on external APIs or LLM quotas.
- **Deterministic**: Same inputs always produce same outputs (no randomness).
- **Fast**: Completes in milliseconds, not seconds.
- **Transparent**: Clear rule-based logic, no black-box AI decisions.
- **Cost-Effective**: Zero API costs or subscription fees.

---

## 🎯 Future Enhancements

* 📊 Dashboard with analytics for faculty workload and room usage.
* 🔔 Notification system for class changes/cancellations.
* 🧑‍🎓 Student portal with personalized schedules.
* 🌐 Multi-language support for chatbot.

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork this repo and submit a pull request.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 💡 Acknowledgements

* MERN Stack community
* GeminiAI / Dialogflow for chatbot inspiration
* Constraint Satisfaction Problem (CSP) & Genetic Algorithms for timetable generation

---

👉 Would you like me to also **add some sample screenshots / usage GIF placeholders** in the README so it looks more professional on GitHub?

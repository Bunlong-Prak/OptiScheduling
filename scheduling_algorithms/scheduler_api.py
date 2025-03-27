import copy
import json
import requests
from collections import defaultdict

class Course:
    def __init__(self, id, name, section, major, instructor_id, classroom_id, hours_per_week, student_count, is_online=False):
        self.id = id
        self.name = name
        self.section = section
        self.major = major
        self.instructor_id = instructor_id
        self.classroom_id = classroom_id
        self.hours_per_week = hours_per_week
        self.student_count = student_count
        self.is_online = is_online
        self.assigned_slots = []  # Will store (day, start_hour, end_hour) tuples

class Instructor:
    def __init__(self, id, name, is_part_time=False):
        self.id = id
        self.name = name
        self.is_part_time = is_part_time
        self.unavailable_slots = []  # List of (day, start_hour, end_hour) tuples
        self.preferred_slots = []  # List of (day, start_hour, end_hour) tuples for part-time instructors
        self.assigned_courses = []  # Courses assigned to this instructor

class Classroom:
    def __init__(self, id, name, capacity, room_type):
        self.id = id
        self.name = name
        self.capacity = capacity
        self.room_type = room_type  # "lecture", "computer_lab", etc.

class Schedule:
    def __init__(self):
        self.courses = []
        self.instructors = []
        self.classrooms = []
        self.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        self.hours = list(range(8, 22))  # 8 AM to 10 PM
        # Schedule representation: day -> hour -> room_id -> (course, instructor)
        self.timetable = {day: {hour: {} for hour in self.hours} for day in self.days}
        
    def add_course(self, course):
        self.courses.append(course)
        
    def add_instructor(self, instructor):
        self.instructors.append(instructor)
        
    def add_classroom(self, classroom):
        self.classrooms.append(classroom)

    def is_instructor_available(self, instructor, day, start_hour, end_hour):
        """Check if instructor is available in the given time slot"""
        # Check if the slot is a preferred slot for this instructor
        is_preferred_slot = False
        if instructor.is_part_time and instructor.preferred_slots:
            for pref_day, pref_start, pref_end in instructor.preferred_slots:
                if day == pref_day and start_hour >= pref_start and end_hour <= pref_end:
                    is_preferred_slot = True
                    break
        
        # If not a preferred slot, apply restrictions
        if not is_preferred_slot:
            # Restrict to Monday-Friday (no weekends)
            if day in ["Saturday", "Sunday"]:
                return False
            
            # Restrict to 8am-5pm
            if start_hour < 8 or end_hour > 17:
                return False
        
        # Check instructor unavailability
        for unavail_day, unavail_start, unavail_end in instructor.unavailable_slots:
            if day == unavail_day:
                # Check if time ranges overlap
                if not (end_hour <= unavail_start or start_hour >= unavail_end):
                    return False
                    
        # Check if instructor is already assigned to another course at this time
        for hour in range(start_hour, end_hour):
            for room_id in self.timetable[day][hour]:
                if self.timetable[day][hour][room_id] is not None:
                    course_at_slot, instructor_at_slot = self.timetable[day][hour][room_id]
                    if instructor_at_slot.id == instructor.id:
                        return False
        
        return True

    def is_classroom_available(self, classroom, day, start_hour, end_hour):
        """Check if classroom is available in the given time slot"""
        for hour in range(start_hour, end_hour):
            if classroom.id in self.timetable[day][hour] and self.timetable[day][hour][classroom.id] is not None:
                return False
        return True

    def check_classroom_capacity(self, course, classroom):
        """Check if classroom has enough capacity for the course"""
        return classroom.capacity >= course.student_count

    def check_classroom_type(self, course, classroom):   
        """Check if classroom type is suitable for the course"""
        # Implement specific logic for classroom type requirements
        # This is a simplified example - you'd need to expand based on your requirements
        if course.name.lower().find("computer") >= 0 and classroom.room_type != "computer_lab":
            return False
        return True

    def get_course_hours_on_day(self, course, day):
        """Get total hours already scheduled for this course on the given day"""
        total_hours = 0
        for assigned_day, start_hour, end_hour in course.assigned_slots:
            if assigned_day == day:
                total_hours += (end_hour - start_hour)
        return total_hours

    def would_exceed_consecutive_hours(self, course, day, start_hour, hours_duration):
        """Check if adding this slot would exceed 4 consecutive hours on a day"""
        end_hour = start_hour + hours_duration
        
        # Get all existing slots for this course on this day
        day_slots = [(s, e) for d, s, e in course.assigned_slots if d == day]
        
        # If no existing slots, just check if current request is > 4 hours
        if not day_slots:
            return hours_duration > 4
            
        # Check if the new slot would create > 4 consecutive hours
        # with any existing slot
        for slot_start, slot_end in day_slots:
            # Check if slots are adjacent
            if slot_end == start_hour:  # Existing slot is right before new slot
                if (slot_end - slot_start) + hours_duration > 4:
                    return True
            elif end_hour == slot_start:  # New slot is right before existing slot
                if hours_duration + (slot_end - slot_start) > 4:
                    return True
        
        return False

    def assign_slot(self, course, instructor, classroom, day, start_hour, hours_duration):
        """Assign a course to a specific time slot"""
        end_hour = start_hour + hours_duration
        
        # Assign the slot in the timetable
        for hour in range(start_hour, end_hour):
            self.timetable[day][hour][classroom.id] = (course, instructor)
        
        # Update course's assigned slots
        course.assigned_slots.append((day, start_hour, end_hour))
        
        # Update instructor's assigned courses if not already assigned
        if course not in instructor.assigned_courses:
            instructor.assigned_courses.append(course)
            
        return True

    def calculate_slot_score(self, course, instructor, classroom, day, start_hour, hours_duration):
        """Calculate a score for a potential time slot (lower is better)"""
        score = 0
        day_index = self.days.index(day)
        
        # Base score based on day and time
        score += day_index * 10  # Earlier days are preferred
        score += (start_hour - 8)  # Earlier times are preferred
        
        # Penalty for not using instructor's preferred slots (for part-time)
        if instructor.is_part_time and instructor.preferred_slots:
            is_preferred = False
            for pref_day, pref_start, pref_end in instructor.preferred_slots:
                if day == pref_day and start_hour >= pref_start and (start_hour + hours_duration) <= pref_end:
                    is_preferred = True
                    break
            if not is_preferred:
                score += 100  # Heavy penalty for not using preferred slots
        
        # Check for online/offline proximity
        end_hour = start_hour + hours_duration
        for hour in range(start_hour, end_hour):
            # Check previous hour - if it exists and is a different mode (online/offline)
            if hour > 8:
                for room_id in self.timetable[day][hour-1]:
                    if self.timetable[day][hour-1][room_id] is not None:
                        prev_course, _ = self.timetable[day][hour-1][room_id]
                        if prev_course.is_online != course.is_online:
                            score += 50  # Penalty for switching between online/offline
                            
            # Check next hour - if it exists and is a different mode (online/offline)
            if hour < 17:
                for room_id in self.timetable[day][hour+1]:
                    if self.timetable[day][hour+1][room_id] is not None:
                        next_course, _ = self.timetable[day][hour+1][room_id]
                        if next_course.is_online != course.is_online:
                            score += 50  # Penalty for switching between online/offline
        
        # Add a high penalty for slots that would create more than 4 consecutive hours
        if self.would_exceed_consecutive_hours(course, day, start_hour, hours_duration):
            score += 1000
        
        return score

    def generate_schedule(self):
        """Generate an optimal schedule using a greedy algorithm"""
        # Sort courses by priority (more hours per week first, then by student count)
        sorted_courses = sorted(self.courses, key=lambda x: (x.hours_per_week, x.student_count), reverse=True)
        
        # For each course, find the best available slot
        for course in sorted_courses:
            # Get the instructor for this course
            instructor = next((i for i in self.instructors if i.id == course.instructor_id), None)
            if not instructor:
                print(f"Warning: No instructor found for course {course.name}")
                continue
                
            # Get the classroom for this course
            classroom = next((c for c in self.classrooms if c.id == course.classroom_id), None)
            if not classroom:
                print(f"Warning: No classroom found for course {course.name}")
                continue
                
            # Check if classroom is suitable
            if not self.check_classroom_capacity(course, classroom):
                print(f"Warning: Classroom {classroom.name} does not have enough capacity for course {course.name}")
                continue
                
            if not self.check_classroom_type(course, classroom):
                print(f"Warning: Classroom {classroom.name} type is not suitable for course {course.name}")
                continue
            
            # Schedule the course hours - dividing into multiple sessions if needed
            hours_left = course.hours_per_week
            
            # Limit single session to at most 4 hours (new constraint)
            max_hours_per_session = min(4, hours_left)
            hours_per_session = min(3, max_hours_per_session)  # Default remains 3 hours per session
            
            while hours_left > 0:
                best_slots = []  # List of (day, start_hour, score) tuples
                
                # Try to find available slots for this session
                for day in self.days:
                    # Get already scheduled hours for this course on this day
                    day_hours = self.get_course_hours_on_day(course, day)
                    
                    # Skip if adding more hours would exceed 4 hours on this day
                    remaining_hours = 4 - day_hours
                    if remaining_hours <= 0:
                        continue
                    
                    # Adjust hours_per_session if needed
                    this_session_hours = min(hours_per_session, remaining_hours)
                    
                    for start_hour in range(8, 18 - this_session_hours):
                        end_hour = start_hour + this_session_hours
                        
                        # Check if instructor is available
                        if not self.is_instructor_available(instructor, day, start_hour, end_hour):
                            continue
                            
                        # Check if classroom is available
                        if not self.is_classroom_available(classroom, day, start_hour, end_hour):
                            continue
                            
                        # Check if this would create > 4 consecutive hours
                        if self.would_exceed_consecutive_hours(course, day, start_hour, this_session_hours):
                            continue
                            
                        # Calculate score for this slot
                        score = self.calculate_slot_score(course, instructor, classroom, day, start_hour, this_session_hours)
                        best_slots.append((day, start_hour, this_session_hours, score))
                
                # Sort slots by score (lower is better)
                best_slots.sort(key=lambda x: x[3])
                
                # If we found a suitable slot, assign it
                if best_slots:
                    best_day, best_start, best_duration, _ = best_slots[0]
                    self.assign_slot(course, instructor, classroom, best_day, best_start, best_duration)
                    hours_left -= best_duration
                else:
                    # If no slots found, try with fewer hours per session
                    hours_per_session -= 1
                    if hours_per_session == 0:
                        print(f"Warning: Could not schedule all hours for course {course.name}. {hours_left} hours remaining.")
                        break

    def print_schedule(self):
        """Print the generated schedule"""
        print("\nSCHEDULE")
        print("========")
        
        for day in self.days:
            print(f"\n{day}:")
            for hour in self.hours:
                print(f"{hour}:00 - {hour+1}:00:")
                for room_id in self.timetable[day][hour]:
                    if self.timetable[day][hour][room_id] is not None:
                        course, instructor = self.timetable[day][hour][room_id]
                        classroom = next((c for c in self.classrooms if c.id == room_id), None)
                        course_type = "ONLINE" if course.is_online else "IN-PERSON"
                        print(f"  Room {classroom.name}: {course.name} (Section {course.section}) - {course_type} - Prof. {instructor.name}")

    def export_schedule_json(self):
        """Export the schedule as JSON for API purposes"""
        schedule_data = []
        
        for day in self.days:
            for hour in self.hours:
                for room_id in self.timetable[day][hour]:
                    if self.timetable[day][hour][room_id] is not None:
                        course, instructor = self.timetable[day][hour][room_id]
                        classroom = next((c for c in self.classrooms if c.id == room_id), None)
                        
                        schedule_entry = {
                            "day": day,
                            "hour": hour,
                            "course_id": course.id,
                            "course_name": course.name,
                            "section": course.section,
                            "instructor_id": instructor.id,
                            "instructor_name": instructor.name,
                            "room_id": classroom.id,
                            "room_name": classroom.name,
                            "is_online": course.is_online
                        }
                        
                        schedule_data.append(schedule_entry)
        
        return json.dumps(schedule_data, indent=2)

    def check_schedule_validity(self):
        """Check if the generated schedule is valid (no conflicts)"""
        # Check instructor conflicts
        for day in self.days:
            for hour in self.hours:
                instructors_at_hour = {}
                for room_id in self.timetable[day][hour]:
                    if self.timetable[day][hour][room_id] is not None:
                        _, instructor = self.timetable[day][hour][room_id]
                        if instructor.id in instructors_at_hour:
                            print(f"ERROR: Instructor {instructor.name} is scheduled in multiple rooms at {day} {hour}:00")
                            return False
                        instructors_at_hour[instructor.id] = True
        
        # Check classroom conflicts
        for day in self.days:
            for hour in self.hours:
                for room_id in self.timetable[day][hour]:
                    if room_id in self.timetable[day][hour]:
                        if len(self.timetable[day][hour][room_id]) > 1:
                            print(f"ERROR: Multiple courses scheduled in room {room_id} at {day} {hour}:00")
                            return False
        
        # Check course hour integrity
        for course in self.courses:
            total_hours = 0
            for day, start, end in course.assigned_slots:
                total_hours += (end - start)
            
            if total_hours != course.hours_per_week:
                print(f"ERROR: Course {course.name} is scheduled for {total_hours} hours, but requires {course.hours_per_week} hours")
                return False
        
        # Check online/offline proximity
        for day in self.days:
            for hour in range(8, 17):  # Check current and next hour
                online_courses_current = []
                offline_courses_current = []
                
                for room_id in self.timetable[day][hour]:
                    if self.timetable[day][hour][room_id] is not None:
                        course, _ = self.timetable[day][hour][room_id]
                        if course.is_online:
                            online_courses_current.append(course)
                        else:
                            offline_courses_current.append(course)
                
                online_courses_next = []
                offline_courses_next = []
                
                for room_id in self.timetable[day][hour+1]:
                    if self.timetable[day][hour+1][room_id] is not None:
                        course, _ = self.timetable[day][hour+1][room_id]
                        if course.is_online:
                            online_courses_next.append(course)
                        else:
                            offline_courses_next.append(course)
                
                # Warning if there's a mix of online and offline in adjacent hours
                if (online_courses_current and offline_courses_next) or (offline_courses_current and online_courses_next):
                    print(f"WARNING: Mix of online and offline classes scheduled near each other at {day} {hour}:00-{hour+1}:00")
        
        # Check for more than 4 consecutive hours on any day
        for course in self.courses:
            # Group slots by day
            day_slots = {}
            for day, start, end in course.assigned_slots:
                if day not in day_slots:
                    day_slots[day] = []
                day_slots[day].append((start, end))
            
            # Check consecutive hours on each day
            for day, slots in day_slots.items():
                # Sort slots by start time
                slots.sort()
                
                # Find consecutive slots
                consecutive_hours = 0
                last_end = None
                
                for start, end in slots:
                    if last_end is not None and start == last_end:
                        # Slots are consecutive
                        consecutive_hours += (end - start)
                        if consecutive_hours > 4:
                            print(f"ERROR: Course {course.name} has more than 4 consecutive hours on {day}")
                            return False
                    else:
                        # Reset consecutive counter
                        consecutive_hours = end - start
                    
                    last_end = end
        
        # Check instructor time and day restrictions for non-preferred slots
        for day in self.days:
            # Check weekend restrictions
            is_weekend = day in ["Saturday", "Sunday"]
            
            for hour in range(8, 22):
                is_outside_hours = hour < 8 or hour >= 17  # Outside of 8am-5pm
                
                # Check if either weekend or outside 8am-5pm
                if is_weekend or is_outside_hours:
                    for room_id in self.timetable[day][hour]:
                        if self.timetable[day][hour][room_id] is not None:
                            course, instructor = self.timetable[day][hour][room_id]
                            
                            # Check if this is a preferred slot for the instructor
                            is_preferred = False
                            if instructor.is_part_time and instructor.preferred_slots:
                                for pref_day, pref_start, pref_end in instructor.preferred_slots:
                                    if day == pref_day and hour >= pref_start and hour < pref_end:
                                        is_preferred = True
                                        break
                            
                            if not is_preferred:
                                if is_weekend:
                                    print(f"ERROR: Instructor {instructor.name} is scheduled on weekend {day} in a non-preferred slot at {hour}:00")
                                else:
                                    print(f"ERROR: Instructor {instructor.name} is scheduled outside 8am-5pm in a non-preferred slot at {day} {hour}:00")
                                return False
        
        return True


# API Integration for data import/export
class SchedulerAPI:
    def __init__(self, base_url=None):
        self.base_url = base_url or "https://api.university.example/scheduler"
        
    def fetch_courses(self, semester=None, department=None):
        """Fetch courses from the API"""
        url = f"{self.base_url}/courses"
        params = {}
        
        if semester:
            params["semester"] = semester
        if department:
            params["department"] = department
            
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()  # Raise exception for 4XX/5XX responses
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching courses: {e}")
            return []
    
    def fetch_instructors(self, department=None):
        """Fetch instructors from the API"""
        url = f"{self.base_url}/instructors"
        params = {}
        
        if department:
            params["department"] = department
            
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching instructors: {e}")
            return []
    
    def fetch_classrooms(self, building=None, room_type=None):
        """Fetch classrooms from the API"""
        url = f"{self.base_url}/classrooms"
        params = {}
        
        if building:
            params["building"] = building
        if room_type:
            params["type"] = room_type
            
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching classrooms: {e}")
            return []
    
    def post_schedule(self, schedule_data):
        """Send the generated schedule to the API"""
        url = f"{self.base_url}/schedules"
        
        try:
            response = requests.post(url, json=schedule_data)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error posting schedule: {e}")
            return None

    def get_instructor_unavailability(self, instructor_id):
        """Fetch instructor unavailability data"""
        url = f"{self.base_url}/instructors/{instructor_id}/unavailability"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching instructor unavailability: {e}")
            return []


# Function to build schedule from API data
def build_schedule_from_api(api, semester=None, department=None):
    """Build a schedule using data from the API"""
    schedule = Schedule()
    
    # Fetch classrooms
    classroom_data = api.fetch_classrooms()
    for room in classroom_data:
        schedule.add_classroom(Classroom(
            id=room["id"],
            name=room["name"],
            capacity=room["capacity"],
            room_type=room["type"]
        ))
    
    # Fetch instructors
    instructor_data = api.fetch_instructors(department)
    for instr in instructor_data:
        instructor = Instructor(
            id=instr["id"],
            name=instr["name"],
            is_part_time=instr.get("is_part_time", False)
        )
        
        # Get instructor unavailability
        unavail_data = api.get_instructor_unavailability(instr["id"])
        for slot in unavail_data:
            instructor.unavailable_slots.append((
                slot["day"],
                slot["start_hour"],
                slot["end_hour"]
            ))
        
        # Set preferred slots for part-time instructors
        if instructor.is_part_time and "preferred_slots" in instr:
            for slot in instr["preferred_slots"]:
                instructor.preferred_slots.append((
                    slot["day"],
                    slot["start_hour"],
                    slot["end_hour"]
                ))
        
        schedule.add_instructor(instructor)
    
    # Fetch courses
    course_data = api.fetch_courses(semester, department)
    for course in course_data:
        schedule.add_course(Course(
            id=course["id"],
            name=course["name"],
            section=course["section"],
            major=course["major"],
            instructor_id=course["instructor_id"],
            classroom_id=course["classroom_id"],
            hours_per_week=course["hours_per_week"],
            student_count=course["student_count"],
            is_online=course.get("is_online", False)
        ))
    
    return schedule


# Usage Example with API integration
def create_and_submit_schedule():
    # Initialize API client
    api = SchedulerAPI()
    
    # Build schedule from API data
    schedule = build_schedule_from_api(api, semester="Spring2025", department="CS")
    
    # Generate the schedule
    schedule.generate_schedule()
    
    # Print and validate the schedule
    schedule.print_schedule()
    is_valid = schedule.check_schedule_validity()
    print(f"\nSchedule is {'valid' if is_valid else 'invalid'}.")
    
    # If valid, export to JSON and submit to API
    if is_valid:
        schedule_json = schedule.export_schedule_json()
        result = api.post_schedule(json.loads(schedule_json))
        if result:
            print(f"Schedule successfully submitted to API. Schedule ID: {result.get('id')}")
        else:
            print("Failed to submit schedule to API")
    
    return schedule


# Demo usage with mocked API data
def create_sample_schedule_with_api():
    # Create a schedule instance
    schedule = Schedule()
    
    # Add classrooms
    schedule.add_classroom(Classroom(1, "L201", 40, "lecture"))
    schedule.add_classroom(Classroom(2, "L202", 30, "lecture"))
    schedule.add_classroom(Classroom(3, "CL101", 25, "computer_lab"))
    
    # Add instructors
    smith = Instructor(1, "Smith", False)  # Full-time
    johnson = Instructor(2, "Johnson", True)  # Part-time
    johnson.preferred_slots = [("Monday", 8, 12), ("Wednesday", 13, 17)]
    williams = Instructor(3, "Williams", True)  # Part-time
    williams.preferred_slots = [("Tuesday", 8, 12), ("Thursday", 13, 17)]
    
    schedule.add_instructor(smith)
    schedule.add_instructor(johnson)
    schedule.add_instructor(williams)
    
    # Add courses
    schedule.add_course(Course(1, "Data Structures", "A", "CS", 1, 1, 4, 35))
    schedule.add_course(Course(2, "Algorithms", "B", "CS", 2, 1, 3, 28))
    schedule.add_course(Course(3, "Database Systems", "A", "CS", 3, 2, 3, 20))
    schedule.add_course(Course(4, "Computer Programming", "C", "CS", 1, 3, 4, 22, False))
    schedule.add_course(Course(5, "Web Development", "A", "CS", 2, 3, 6, 18, True))  # 6 hour course to test the consecutive hour limit
    
    # Generate the schedule
    schedule.generate_schedule()
    
    # Print and validate the schedule
    schedule.print_schedule()
    is_valid = schedule.check_schedule_validity()
    print(f"\nSchedule is {'valid' if is_valid else 'invalid'}.")
    
    # Export schedule to JSON
    schedule_json = schedule.export_schedule_json()
    print("\nSchedule JSON:")
    print(schedule_json)
    
    return schedule


# Run the example
if __name__ == "__main__":
    # Uncomment below to use the API-integrated version
    # sample_schedule = create_and_submit_schedule()
    
    # Use the local sample data version
    sample_schedule = create_sample_schedule_with_api()
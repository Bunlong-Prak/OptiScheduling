// Define types = based on the ERD

export type Major = {
    id: number;
    name: string;
    shortTag: string;
    year?: number | null; // Allow both number and null
    scheduleId: number;
    // UI display fields (not stored in DB)
    numberOfYears?: number;
    years?: number[];
};

export type Classroom = {
    id: number;
    code: string;
    capacity: number;
    type: string;
    classroom_type_id: number;
};

export type ClassroomType = {
    id: number;
    name: string;
    description?: string;
};

export type Instructor = {
    id: number;
    first_name: string;
    last_name: string;
    gender: string;
    email: string;
    phone_number: string;
};

export type Section = {
    id: number;
    number: number;
};

export type TimeConstraint = {
    id: number;
    instructor_id: number;
    day_of_the_week: string;
    time_period: string[];
    firstName?: string;
    lastName?: string;
};

export type Course = {
    id: number;
    title: string;
    code: string;
    year: number;
    major: string;
    color: string;
    firstName?: string;
    lastName?: string;
    instructorId?: string;
    duration: number;
    separatedDuration: number; // Duration in minutes, used for scheduling
    capacity: number;
    sectionId: number;
    section: string;
    classroom: string;
    status: string; // "active" or "inactive"
};

// export type Schedule = {
//     id: number;
//     name: string;
//     academic_year: number;
//     time_period: string[]; // Array to represent time periods
// };

// Helper types for form handling
export type CourseFormData = {
    title: string;
    type: string;
    code: string;

    color: string;

    section_id: number;
    major_id: number;
    instructor_id: number;
    classroom_id: number;
};

export type InstructorFormData = {
    first_name: string;
    last_name: string;
    gender: string;
    email: string;
    phone_number: string;
};

export type ClassroomFormData = {
    code: string;
    type: string;
    capacity: string; // String for form input, will be converted to number
};

export type MajorFormData = {
    name: string;
    shortTag: string;
    // Number of years for this major
};

export type TimeConstraintFormData = {
    instructor_id: number;
    day: string;
    timeSlots: string[];
    scheduleId: number;
};
// export type ScheduleFormData = {
//     name: string;
//     academic_year: string; // String for form input, will be converted to number
//     time_period: string[];
// };

export type CourseHour = {
    display_slot: string;
    id: number;
    time_slot: string;
    startTime: string;
    endTime: string;
};

export type TimetableCourse = {
    [x: string]: any;
    capacity: number; // Total capacity of the course
    code: string;
    name: string;
    sectionId: number;
    color: string;
    originalColor?: string;
    duration: number;
    instructor: string;
    section: string;
    room?: string; // Physical room identifier or "Online"
    uniqueId?: string;
    majors?: string[];

    // Timetable positioning properties (optional - only present when assigned)
    day?: string;
    startTime?: string;
    endTime?: string;
    classroom?: string; // Classroom ID as string for UI purposes

    // UI-specific properties for rendering multi-hour courses
    isStart?: boolean;
    isMiddle?: boolean;
    isEnd?: boolean;
    colspan?: number;

    // Database reference
    courseHoursId?: number;

    // Online course flag
    isOnline?: boolean;
};
// If you need a more specific type for courses that are definitely assigned to the timetable
export type AssignedTimetableCourse = TimetableCourse & {
    day: string;
    startTime: string;
    endTime: string;
    classroom: string;
};

// Helper type guard to check if a course is assigned
export function isAssignedCourse(
    course: TimetableCourse
): course is AssignedTimetableCourse {
    return !!(
        course.day &&
        course.startTime &&
        course.endTime &&
        course.classroom
    );
}

export type Schedule = {
    id: string;
    name: string;
    academic_year: string;
    startDate: string;
    endDate: string;
};

export type TimetableGrid = Record<string, TimetableCourse>;

export type CellToDelete = {
    day: string;
    classroomId: string;
    timeSlot: string;
    timeSlotId: number;
};
// New types for the API response
export type ScheduleAssignment = {
    sectionId: number;
    courseCode: string;
    courseTitle: string;
    courseColor: string; // Add this field
    instructorName: string;
    day: string;
    startTime: string;
    endTime: string;
    classroomCode: string;
};

export type ScheduleResponse = {
    message: string;
    schedule: ScheduleAssignment[];
    stats: {
        totalCourses: number;
        totalSections: number;
        scheduledAssignments: number;
        constraintsApplied: number;
    };
};

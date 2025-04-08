// Define types = based on the ERD

export type Major = {
    id: number;
    name: string;
    short_tag: string;
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
    day_of_the_week: string;
    time_period: string[]; // Array to represent time periods
    instructor_id: number;
};

export type Course = {
    id: number;
    title: string;
    code: string;
    major: string;
    color: string;
    firstName?: string;
    lastName?: string;
    instructorId?: string;
    duration: number;
    capacity: number;
    sectionId: number;
    section: string;
    classroom: string;
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
    short_tag: string;
};

export type TimeConstraintFormData = {
    day: string;
    time_slots: string[];
    instructor_id: number;
};

// export type ScheduleFormData = {
//     name: string;
//     academic_year: string; // String for form input, will be converted to number
//     time_period: string[];
// };

export type CourseHour = {
    id: number;
    time_slot: string;
};

export type TimetableCourse = {
    uniqueId: any;
    code: string;
    name: string;
    sectionId: number;
    color: string;
    duration: number;
    instructor: string;
    room: string;
    isStart?: boolean;
    isMiddle?: boolean;
    isEnd?: boolean;
    colspan?: number;
    day?: string; // Day assigned in timetable
    startTime?: string; // Start time display value
    endTime?: string; // End time display value
    courseHoursId?: number; // ID from course_hours table
    classroom?: string;
    section: string; // Classroom assigned to
};

export type Schedule = Record<string, TimetableCourse>;

export type CellToDelete = {
    day: string;
    classroomId: string;
    timeSlot: string;
    timeSlotId: number;
};

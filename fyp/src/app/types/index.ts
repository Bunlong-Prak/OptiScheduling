// Define types = based on the ERD

export type Major = {
    id: number;
    name: string;
    short_tag: string;
};

export type Classroom = {
    id: number;
    name: string;
    type: string;
    capacity: number;
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
    type: string;
    code: string;
    color: string;
    // description: string;
    section_id: number;
    major_id: number;
    instructor_id: number;
    classroom_id: number;
};

export type Schedule = {
    id: number;
    name: string;
    academic_year: number;
    time_period: string[]; // Array to represent time periods
};

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
    name: string;
    type: string;
    capacity: string; // String for form input, will be converted to number
};

export type MajorFormData = {
    name: string;
    short_tag: string;
};

export type TimeConstraintFormData = {
    day_of_the_week: string;
    time_period: string[];
    instructor_id: number;
};

export type ScheduleFormData = {
    name: string;
    academic_year: string; // String for form input, will be converted to number
    time_period: string[];
};

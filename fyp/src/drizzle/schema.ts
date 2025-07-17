// drizzle/schema.ts
import { relations, sql } from "drizzle-orm";
import {
    datetime,
    float,
    int,
    mysqlTable,
    timestamp,
    varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
    id: varchar("id", {
        length: 100,
    })
        .primaryKey()
        .default(sql`(uuid())`),
    email: varchar("email", {
        length: 255,
    })
        .notNull()
        .unique(),
    firstName: varchar("first_name", {
        length: 50,
    }).notNull(),
    lastName: varchar("last_name", {
        length: 50,
    }).notNull(),
    avatarUrl: varchar("avatar_url", {
        length: 255,
    }),
});

export const userRelations = relations(users, ({ many }) => ({
    schedules: many(schedules),
    sessions: many(sessions),
}));

// Session Table
export const sessions = mysqlTable("sessions", {
    id: varchar("id", {
        length: 100,
    }).primaryKey(),
    expiresAt: datetime("expire_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
    userId: varchar("user_id", { length: 100 }).notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

// Schedule Table
export const schedules = mysqlTable("schedules", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    academicYear: varchar("academic_year", { length: 255 }).notNull(),
    numberOfTimeSlots: int("number_of_time_slots").notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
});

export const scheduleRelations = relations(schedules, ({ many }) => ({
    courses: many(courses),
    scheduleTimePeriods: many(scheduleTimeSlots),
}));

// Schedule Time Period Table
export const scheduleTimeSlots = mysqlTable("schedule_time_slots", {
    id: int("id").primaryKey().autoincrement(),
    startTime: varchar("start_time", { length: 50 }).notNull(),
    endTime: varchar("end_time", { length: 50 }).notNull(),
    scheduleId: int("schedule_id").notNull(),
});

export const courses = mysqlTable("courses", {
    id: int("id").primaryKey().autoincrement(),
    title: varchar("title", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    color: varchar("color", { length: 50 }),
    capacity: int("capacity").notNull(),
    duration: float("duration").notNull(),
    scheduleId: int("schedule_id").notNull(),
    majorId: int("major_id").notNull(),
});

export const courseRelations = relations(courses, ({ many, one }) => ({
    sections: many(sections),
    instructors: one(instructors),
    majors: many(majors),
}));

export const sections = mysqlTable("sections", {
    id: int("id").primaryKey().autoincrement(),
    number: varchar("number", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }),
    courseId: int("course_id").notNull(),
    instructorId: int("instructor_id"),
    preferClassRoomId: int("prefer_classroom_id"),
});

export const sectionRelations = relations(sections, ({ many, one }) => ({
    courseHours: many(courseHours),
    classrooms: many(classrooms),
    classroomTypes: one(classroomTypes, {
        fields: [sections.preferClassRoomId],
        references: [classroomTypes.id],
    }),
}));

export const courseHours = mysqlTable("course_hours", {
    id: int("id").primaryKey().autoincrement(),
    day: varchar("day", { length: 50 }),
    timeSlot: varchar("time_slot", { length: 50 }),
    separatedDuration: float("separated_duration"),
    classroomId: int("classroom_id"),
    sectionId: int("section_id").notNull(),
});

export const majors = mysqlTable("majors", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    shortTag: varchar("short_tag", { length: 50 }).notNull(),
    scheduleId: int("schedule_id").notNull(),
});

export const classrooms = mysqlTable("classrooms", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }),
    code: varchar("code", { length: 255 }).notNull(),
    capacity: int("capacity").notNull(),
    location: varchar("location", { length: 255 }),
    classroomTypeId: int("classroom_type_id").notNull(),
});

export const classroomTypes = mysqlTable("classroom_types", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 500 }),
    scheduleId: int("schedule_id").notNull(),
});

export const classroomTypeRelations = relations(classroomTypes, ({ many }) => ({
    classrooms: many(classrooms),
    sections: many(sections),
}));

export const classroomRelations = relations(classrooms, ({ one }) => ({
    classroomType: one(classroomTypes, {
        fields: [classrooms.classroomTypeId],
        references: [classroomTypes.id],
    }),
}));

export const instructors = mysqlTable("instructors", {
    id: int("id").primaryKey().autoincrement(),
    instructorId: varchar("instructor_id", { length: 100 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    scheduleId: int("schedule_id").notNull(),
});

export const instructorRelations = relations(instructors, ({ many }) => ({
    instructorUnavailableDays: many(instructorTimeConstraint),
    majors: many(majors),
}));

export const instructorTimeConstraint = mysqlTable(
    "instructor_time_constraints",
    {
        id: int("id").primaryKey().autoincrement(),
        instructorId: int("instructor_id").notNull(),
        scheduleId: int("schedule_id").notNull(),
    }
);

export const instructorTimeConstraintRelations = relations(
    instructorTimeConstraint,
    ({ many, one }) => ({
        instructor: one(instructors, {
            fields: [instructorTimeConstraint.instructorId],
            references: [instructors.id],
        }),
        schedule: one(schedules, {
            fields: [instructorTimeConstraint.scheduleId],
            references: [schedules.id],
        }),
        days: many(instructorTimeConstraintDay),
    })
);

// Schedule Time Period Table
export const instructorTimeConstraintDay = mysqlTable(
    "instructor_time_constraint_days",
    {
        id: int("id").primaryKey().autoincrement(),
        day: varchar("day", {
            length: 50,
        }).notNull(),
        instructorTimeConstraintId: int(
            "instructor_time_constraint_id"
        ).notNull(),
    }
);

export const instructorTimeConstraintDayRelations = relations(
    instructorTimeConstraintDay,
    ({ many, one }) => ({
        instructorTimeConstraint: one(instructorTimeConstraint, {
            fields: [instructorTimeConstraintDay.instructorTimeConstraintId],
            references: [instructorTimeConstraint.id],
        }),
        timeSlots: many(instructorTimeConstraintTimeSlot),
    })
);

export const instructorTimeConstraintTimeSlot = mysqlTable(
    "instructor_time_constraint_time_slots",
    {
        id: int("id").primaryKey().autoincrement(),
        timeSlot: varchar("time_slot", {
            length: 50,
        }).notNull(),
        instructorTimeConstraintDayId: int(
            "instructor_time_constraint_day_id"
        ).notNull(),
    }
);

export const instructorTimeConstraintTimeSlotRelations = relations(
    instructorTimeConstraintTimeSlot,
    ({ one }) => ({
        day: one(instructorTimeConstraintDay, {
            fields: [
                instructorTimeConstraintTimeSlot.instructorTimeConstraintDayId,
            ],
            references: [instructorTimeConstraintDay.id],
        }),
    })
);

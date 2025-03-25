// drizzle/schema.ts
import { relations, sql } from "drizzle-orm";
import {
    datetime,
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

export const userRelations = relations(users, ({ many, one }) => ({
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
    userId: varchar("user_id", { length: 100 })
        .notNull()
        .references(() => users.id, {
            onDelete: "cascade",
        }),
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
    userId: varchar("user_id", { length: 255 })
        .notNull()
        .references(() => users.id, {
            onDelete: "cascade",
        }),
});

export const scheduleRelations = relations(schedules, ({ many, one }) => ({
    courses: many(courses),
    scheduleDays: many(scheduleDays),
    scheduleTimePeriods: many(scheduleTimePeriods),
}));

// Schedule Days Table
export const scheduleDays = mysqlTable("schedule_days", {
    id: int("id").primaryKey().autoincrement(),
    daysOfWeek: varchar("days_of_week", { length: 50 }).notNull(),
    scheduleId: int("schedule_id")
        .notNull()
        .references(() => schedules.id, {
            onDelete: "cascade",
        }), // Foreign key to the Schedule table
});

// Schedule Time Period Table
export const scheduleTimePeriods = mysqlTable("schedule_time_periods", {
    id: int("id").primaryKey().autoincrement(),
    timePeriod: varchar("time_period", { length: 50 }).notNull(),
    scheduleId: int("schedule_id")
        .notNull()
        .references(() => schedules.id, {
            onDelete: "cascade",
        }), // Foreign key to the Schedule table
});

export const courses = mysqlTable("courses", {
    id: int("id").primaryKey().autoincrement(),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    color: varchar("color", { length: 50 }),
    capacity: int("capacity").notNull(),
    description: varchar("description", {
        length: 255,
    }), // Foreign key to Section
    scheduleId: int("schedule_id")
        .notNull()
        .references(() => schedules.id, {
            onDelete: "cascade",
        }), // Foreign key to Schedule
    majorId: int("major_id")
        .notNull()
        .references(() => majors.id), // Foreign key to Major
    instructorId: int("instructor_id")
        .notNull()
        .references(() => instructors.id), // Foreign key to Instructor
});

export const courseRelations = relations(courses, ({ many, one }) => ({
    sections: many(sections),
    instructors: one(instructors),
    majors: many(majors),
}));

export const sections = mysqlTable("sections", {
    id: int("id").primaryKey().autoincrement(),
    number: int("number").notNull(),
    courseHoursId: int("course_hours_id")
        .notNull()
        .references(() => courseHours.id), // Foreign key to Course Hours
    courseId: int("course_id")
        .notNull()
        .references(() => courses.id, { onDelete: "cascade" }), // Foreign key to Course
    classroomId: int("classroom_id")
        .notNull()
        .references(() => classrooms.id), // Foreign key to Classroom
});

export const sectionRelations = relations(sections, ({ many, one }) => ({
    courseHours: many(courseHours),
    classrooms: many(classrooms),
}));

export const courseHours = mysqlTable("course_hours", {
    id: int("id").primaryKey().autoincrement(),
    timePeriod: varchar("time_period", { length: 50 }).notNull(),
});

export const majors = mysqlTable("majors", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    shortTag: varchar("short_tag", { length: 50 }).notNull(),
});

export const classrooms = mysqlTable("classrooms", {
    id: int("id").primaryKey().autoincrement(),
    code: varchar("code", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    capacity: int("capacity").notNull(),
});

export const instructors = mysqlTable("instructors", {
    id: int("id").primaryKey().autoincrement(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
});

export const instructorRelations = relations(instructors, ({ many, one }) => ({
    instructorUnavailableDays: many(instructorUnavailableDays),
    majors: many(majors),
}));

export const instructorUnavailableDays = mysqlTable(
    "instructor_unavailable_days",
    {
        id: int("id").primaryKey().autoincrement(),
        daysOfWeek: varchar("days_of_the_week", { length: 50 }).notNull(),
        instructorId: int("instructor_id")
            .notNull()
            .references(() => instructors.id), // Foreign key to Instructor
    }
);

// Schedule Time Period Table
export const instructorUnavailableTimePeriods = mysqlTable(
    "instructor_unavailable_time_periods",
    {
        id: int("id").primaryKey().autoincrement(),
        timePeriod: varchar("time_period", {
            length: 50,
        }).notNull(),
        instructorUnavailableDayId: int("instructor_unavailable_day_id")
            .notNull()
            .references(() => instructors.id),
        instructorId: int("instructor_id")
            .notNull()
            .references(() => instructors.id), // Foreign key to Instructor
    }
);

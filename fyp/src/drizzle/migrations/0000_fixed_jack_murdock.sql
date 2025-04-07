CREATE TABLE `classroom_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `classroom_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(255) NOT NULL,
	`capacity` int NOT NULL,
	`classroom_type_id` int NOT NULL,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`time_slot` varchar(50) NOT NULL,
	CONSTRAINT `course_hours_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`color` varchar(50),
	`capacity` int NOT NULL,
	`duration` int NOT NULL,
	`schedule_id` int NOT NULL,
	`major_id` int NOT NULL,
	`instructor_id` int NOT NULL,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_time_constraints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` int NOT NULL,
	CONSTRAINT `instructor_time_constraints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_time_constraint_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(50) NOT NULL,
	`instructor_time_constraint_id` int NOT NULL,
	CONSTRAINT `instructor_time_constraint_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_time_constraint_time_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`time_slot` varchar(50) NOT NULL,
	`instructor_time_constraint_day_id` int NOT NULL,
	CONSTRAINT `instructor_time_constraint_time_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`first_name` varchar(255) NOT NULL,
	`last_name` varchar(255) NOT NULL,
	`gender` varchar(50) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone_number` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	CONSTRAINT `instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `majors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_tag` varchar(50) NOT NULL,
	CONSTRAINT `majors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`days_of_week` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	CONSTRAINT `schedule_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_time_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`time_period` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	CONSTRAINT `schedule_time_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`academic_year` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(50) NOT NULL,
	`course_hours_id` int NOT NULL,
	`course_id` int NOT NULL,
	`classroom_id` int NOT NULL,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(100) NOT NULL,
	`expire_at` datetime NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`user_id` varchar(100) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(100) NOT NULL DEFAULT (uuid()),
	`email` varchar(255) NOT NULL,
	`first_name` varchar(50) NOT NULL,
	`last_name` varchar(50) NOT NULL,
	`avatar_url` varchar(255),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_classroom_type_id_classroom_types_id_fk` FOREIGN KEY (`classroom_type_id`) REFERENCES `classroom_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_major_id_majors_id_fk` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_instructor_id_instructors_id_fk` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_time_constraints` ADD CONSTRAINT `instructor_time_constraints_instructor_id_instructors_id_fk` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_time_constraint_days` ADD CONSTRAINT `instructor_time_constraint_days_instructor_time_constraint_id_instructor_time_constraints_id_fk` FOREIGN KEY (`instructor_time_constraint_id`) REFERENCES `instructor_time_constraints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_time_constraint_time_slots` ADD CONSTRAINT `instructor_time_constraint_time_slots_instructor_time_constraint_day_id_instructor_time_constraint_days_id_fk` FOREIGN KEY (`instructor_time_constraint_day_id`) REFERENCES `instructor_time_constraint_days`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructors` ADD CONSTRAINT `instructors_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_days` ADD CONSTRAINT `schedule_days_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_time_periods` ADD CONSTRAINT `schedule_time_periods_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_course_hours_id_course_hours_id_fk` FOREIGN KEY (`course_hours_id`) REFERENCES `course_hours`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
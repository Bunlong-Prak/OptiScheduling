CREATE TABLE `classroom_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(500),
	`schedule_id` int NOT NULL,
	CONSTRAINT `classroom_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	`code` varchar(255) NOT NULL,
	`capacity` int NOT NULL,
	`location` varchar(255),
	`classroom_type_id` int NOT NULL,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(50),
	`time_slot` varchar(50),
	`separated_duration` float,
	`classroom_id` int,
	`section_id` int NOT NULL,
	CONSTRAINT `course_hours_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`color` varchar(50),
	`capacity` int NOT NULL,
	`duration` float NOT NULL,
	`schedule_id` int NOT NULL,
	`major_id` int NOT NULL,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_time_constraints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` int NOT NULL,
	`schedule_id` int NOT NULL,
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
	`instructor_id` varchar(100) NOT NULL,
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
	`schedule_id` int NOT NULL,
	CONSTRAINT `majors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_time_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`start_time` varchar(50) NOT NULL,
	`end_time` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	CONSTRAINT `schedule_time_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`academic_year` varchar(255) NOT NULL,
	`number_of_time_slots` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(50) NOT NULL,
	`status` varchar(50),
	`course_id` int NOT NULL,
	`instructor_id` int,
	`prefer_classroom_id` int,
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

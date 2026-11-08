-- OptiScheduling MySQL Initial Schema

CREATE TABLE IF NOT EXISTS `users` (
	`id` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`first_name` varchar(50) NOT NULL,
	`last_name` varchar(50) NOT NULL,
	`avatar_url` varchar(255),
	PRIMARY KEY (`id`),
	UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sessions` (
	`id` varchar(100) NOT NULL,
	`expire_at` datetime NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`user_id` varchar(100) NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_sessions_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`academic_year` varchar(255) NOT NULL,
	`number_of_time_slots` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_schedules_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_time_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`start_time` varchar(50) NOT NULL,
	`end_time` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_time_slots_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `classroom_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(500),
	`schedule_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_classroom_types_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	`code` varchar(255) NOT NULL,
	`capacity` int NOT NULL,
	`location` varchar(255),
	`classroom_type_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_classrooms_type_id` (`classroom_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` varchar(100) NOT NULL,
	`first_name` varchar(255) NOT NULL,
	`last_name` varchar(255) NOT NULL,
	`gender` varchar(50) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone_number` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_instructors_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `instructor_time_constraints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` int NOT NULL,
	`schedule_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_constraints_instructor_id` (`instructor_id`),
	KEY `idx_constraints_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `instructor_time_constraint_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(50) NOT NULL,
	`instructor_time_constraint_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_constraint_days_constraint_id` (`instructor_time_constraint_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `instructor_time_constraint_time_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`time_slot` varchar(50) NOT NULL,
	`instructor_time_constraint_day_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_constraint_slots_day_id` (`instructor_time_constraint_day_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `majors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_tag` varchar(50) NOT NULL,
	`schedule_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_majors_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`color` varchar(50),
	`capacity` int NOT NULL,
	`duration` float NOT NULL,
	`schedule_id` int NOT NULL,
	`major_id` int NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_courses_schedule_id` (`schedule_id`),
	KEY `idx_courses_major_id` (`major_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(50) NOT NULL,
	`status` varchar(50),
	`course_id` int NOT NULL,
	`instructor_id` int,
	PRIMARY KEY (`id`),
	KEY `idx_sections_course_id` (`course_id`),
	KEY `idx_sections_instructor_id` (`instructor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `course_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(50),
	`time_slot` varchar(50),
	`separated_duration` float,
	`classroom_id` int,
	`section_id` int NOT NULL,
	`prefer_classroom_id` int,
	PRIMARY KEY (`id`),
	KEY `idx_course_hours_section_id` (`section_id`),
	KEY `idx_course_hours_classroom_id` (`classroom_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- OptiScheduling: Paragon IU Fall 2025 Full-Scale Demo Seed
-- 7 Majors | 40 Instructors (75% part-time) | 18 Classrooms | 55 Courses
-- 70 Sections | 83 Course-Hour Blocks | 24 Instructor Time Constraints
-- =============================================================================

-- ─── User & Schedule ─────────────────────────────────────────────────────────

INSERT IGNORE INTO `users` (`id`, `email`, `first_name`, `last_name`, `avatar_url`)
VALUES ('demo-user-123', 'demo@paragoniu.edu.kh', 'Demo', 'Admin', NULL);

INSERT IGNORE INTO `schedules` (`id`, `name`, `academic_year`, `number_of_time_slots`, `user_id`)
VALUES (1, 'Paragon IU - Fall 2025', '2025-2026', 9, 'demo-user-123');

INSERT IGNORE INTO `schedule_time_slots` (`id`, `start_time`, `end_time`, `schedule_id`) VALUES
(1, '08:00', '09:00', 1),
(2, '09:00', '10:00', 1),
(3, '10:00', '11:00', 1),
(4, '11:00', '12:00', 1),
(5, '12:00', '13:00', 1),
(6, '13:00', '14:00', 1),
(7, '14:00', '15:00', 1),
(8, '15:00', '16:00', 1),
(9, '16:00', '17:00', 1);

-- ─── Classroom Types ─────────────────────────────────────────────────────────

INSERT IGNORE INTO `classroom_types` (`id`, `name`, `description`, `schedule_id`) VALUES
(1, 'Lecture Hall',     'Standard seating for general courses',                  1),
(2, 'Computer Lab',     'Workstations with dev environments and IDEs',           1),
(3, 'Seminar Room',     'Small-group discussion and presentation room',          1),
(4, 'Art Studio',       'Creative workspace with design tools and displays',     1),
(5, 'Conference Room',  'Small meeting and thesis defense room',                 1);

-- ─── Classrooms (18 rooms across Building A & B) ────────────────────────────

INSERT IGNORE INTO `classrooms` (`id`, `name`, `code`, `capacity`, `location`, `classroom_type_id`) VALUES
-- Building A: Lecture Halls (2nd floor)
( 1, 'Lecture 201',      'L201',  45, 'Building A', 1),
( 2, 'Lecture 202',      'L202',  40, 'Building A', 1),
( 3, 'Lecture 203',      'L203',  40, 'Building A', 1),
( 4, 'Lecture 204',      'L204',  45, 'Building A', 1),
( 5, 'Lecture 205',      'L205',  30, 'Building A', 1),
-- Building A: Lecture Halls (3rd floor)
( 6, 'Lecture 301',      'L301',  35, 'Building A', 1),
( 7, 'Lecture 302',      'L302',  35, 'Building A', 1),
( 8, 'Lecture 303',      'L303',  30, 'Building A', 1),
-- Building A: Large Lecture Hall (4th floor)
( 9, 'Lecture 401',      'L401',  50, 'Building A', 1),
-- Building A: Seminar & Conference
(10, 'Seminar 101',      'SR101', 25, 'Building A', 3),
(11, 'Seminar 102',      'SR102', 20, 'Building A', 3),
(12, 'Conference Room 1', 'CR01', 15, 'Building A', 5),
-- Building B: Computer Labs
(13, 'Computer Lab 101', 'CL101', 30, 'Building B', 2),
(14, 'Computer Lab 102', 'CL102', 30, 'Building B', 2),
(15, 'Computer Lab 103', 'CL103', 25, 'Building B', 2),
(16, 'Computer Lab 104', 'CL104', 25, 'Building B', 2),
-- Building B: Art Studios
(17, 'Art Studio 201',   'AS201', 20, 'Building B', 4),
(18, 'Art Studio 202',   'AS202', 20, 'Building B', 4);

-- ─── Majors (7 programs) ────────────────────────────────────────────────────

INSERT IGNORE INTO `majors` (`id`, `name`, `short_tag`, `schedule_id`) VALUES
(1, 'Computer Science',                  'CS',  1),
(2, 'Management Information Systems',    'MIS', 1),
(3, 'Digital Arts and Design',           'DAD', 1),
(4, 'Business Administration',           'BA',  1),
(5, 'International Relations',           'IR',  1),
(6, 'TESOL and English Studies',         'ENG', 1),
(7, 'Finance and Banking',              'FIN', 1);

-- ─── Instructors (40 total: 10 full-time, 30 part-time) ────────────────────
-- Full-time: IDs 1,2,3,5,9,14,19,25,30,35
-- Part-time: all others

INSERT IGNORE INTO `instructors` (`id`, `instructor_id`, `first_name`, `last_name`, `gender`, `email`, `phone_number`, `schedule_id`) VALUES
-- Computer Science Department (IDs 1-8)
( 1, 'INS001', 'Dara',      'Sok',       'Male',   'sok.dara@paragoniu.edu.kh',       '012-800-001', 1),
( 2, 'INS002', 'Virak',     'Chea',      'Male',   'chea.virak@paragoniu.edu.kh',     '012-800-002', 1),
( 3, 'INS003', 'Sopheak',   'Ly',        'Female', 'ly.sopheak@paragoniu.edu.kh',     '012-800-003', 1),
( 4, 'INS004', 'James',     'Mitchell',  'Male',   'mitchell.j@paragoniu.edu.kh',     '012-800-004', 1),
( 5, 'INS005', 'Ratanak',   'Keo',       'Male',   'keo.ratanak@paragoniu.edu.kh',    '012-800-005', 1),
( 6, 'INS006', 'Michael',   'Torres',    'Male',   'torres.m@paragoniu.edu.kh',       '012-800-006', 1),
( 7, 'INS007', 'Sreynich',  'Phan',      'Female', 'phan.sreynich@paragoniu.edu.kh',  '012-800-007', 1),
( 8, 'INS008', 'Bora',      'Kim',       'Male',   'kim.bora@paragoniu.edu.kh',       '012-800-008', 1),
-- MIS Department (IDs 9-13)
( 9, 'INS009', 'Chanthy',   'Meas',      'Female', 'meas.chanthy@paragoniu.edu.kh',   '012-800-009', 1),
(10, 'INS010', 'David',     'Park',      'Male',   'park.d@paragoniu.edu.kh',         '012-800-010', 1),
(11, 'INS011', 'Sokunthea', 'Nhem',      'Female', 'nhem.sokunthea@paragoniu.edu.kh', '012-800-011', 1),
(12, 'INS012', 'Ryan',      'Garcia',    'Male',   'garcia.r@paragoniu.edu.kh',       '012-800-012', 1),
(13, 'INS013', 'Vuthy',     'Tep',       'Male',   'tep.vuthy@paragoniu.edu.kh',      '012-800-013', 1),
-- Digital Arts & Design Department (IDs 14-18)
(14, 'INS014', 'Laurence',  'Cruz',      'Male',   'cruz.laurence@paragoniu.edu.kh',  '012-800-014', 1),
(15, 'INS015', 'Pisey',     'Sorn',      'Female', 'sorn.pisey@paragoniu.edu.kh',     '012-800-015', 1),
(16, 'INS016', 'Rotha',     'Chan',      'Male',   'chan.rotha@paragoniu.edu.kh',      '012-800-016', 1),
(17, 'INS017', 'Sarah',     'Williams',  'Female', 'williams.s@paragoniu.edu.kh',     '012-800-017', 1),
(18, 'INS018', 'Kunthea',   'Yem',       'Female', 'yem.kunthea@paragoniu.edu.kh',    '012-800-018', 1),
-- Business Administration Department (IDs 19-24)
(19, 'INS019', 'Bopha',     'Rath',      'Female', 'rath.bopha@paragoniu.edu.kh',     '012-800-019', 1),
(20, 'INS020', 'Marcus',    'Chen',      'Male',   'chen.marcus@paragoniu.edu.kh',    '012-800-020', 1),
(21, 'INS021', 'Sokha',     'Lim',       'Male',   'lim.sokha@paragoniu.edu.kh',      '012-800-021', 1),
(22, 'INS022', 'Emily',     'Johnson',   'Female', 'johnson.e@paragoniu.edu.kh',      '012-800-022', 1),
(23, 'INS023', 'Piseth',    'Ouk',       'Male',   'ouk.piseth@paragoniu.edu.kh',     '012-800-023', 1),
(24, 'INS024', 'Linda',     'Reyes',     'Female', 'reyes.l@paragoniu.edu.kh',        '012-800-024', 1),
-- International Relations Department (IDs 25-29)
(25, 'INS025', 'Kosal',     'Heng',      'Male',   'heng.kosal@paragoniu.edu.kh',     '012-800-025', 1),
(26, 'INS026', 'Narith',    'Chhum',     'Male',   'chhum.narith@paragoniu.edu.kh',   '012-800-026', 1),
(27, 'INS027', 'Maria',     'Santos',    'Female', 'santos.m@paragoniu.edu.kh',       '012-800-027', 1),
(28, 'INS028', 'Sophal',    'Vin',       'Male',   'vin.sophal@paragoniu.edu.kh',     '012-800-028', 1),
(29, 'INS029', 'Channary',  'Prak',      'Female', 'prak.channary@paragoniu.edu.kh',  '012-800-029', 1),
-- TESOL & English Department (IDs 30-34)
(30, 'INS030', 'Edward',    'Maningo',   'Male',   'maningo.e@paragoniu.edu.kh',      '012-800-030', 1),
(31, 'INS031', 'Sothea',    'Kong',      'Female', 'kong.sothea@paragoniu.edu.kh',    '012-800-031', 1),
(32, 'INS032', 'Patricia',  'Anderson',  'Female', 'anderson.p@paragoniu.edu.kh',     '012-800-032', 1),
(33, 'INS033', 'Mony',      'Hak',       'Female', 'hak.mony@paragoniu.edu.kh',       '012-800-033', 1),
(34, 'INS034', 'Robert',    'Hughes',    'Male',   'hughes.r@paragoniu.edu.kh',       '012-800-034', 1),
-- Finance & Banking Department (IDs 35-40)
(35, 'INS035', 'Phearun',   'Cheng',     'Male',   'cheng.phearun@paragoniu.edu.kh',  '012-800-035', 1),
(36, 'INS036', 'Samantha',  'Lee',       'Female', 'lee.s@paragoniu.edu.kh',          '012-800-036', 1),
(37, 'INS037', 'Sovann',    'Nou',       'Male',   'nou.sovann@paragoniu.edu.kh',     '012-800-037', 1),
(38, 'INS038', 'Andrew',    'Thompson',  'Male',   'thompson.a@paragoniu.edu.kh',     '012-800-038', 1),
(39, 'INS039', 'Sreymom',   'Touch',     'Female', 'touch.sreymom@paragoniu.edu.kh',  '012-800-039', 1),
(40, 'INS040', 'Daniel',    'Wilson',    'Male',   'wilson.d@paragoniu.edu.kh',       '012-800-040', 1);

-- ─── Part-Time Instructor Time Constraints (24 instructors) ─────────────────
-- Each part-time instructor is unavailable on certain days (full-day blackout)

INSERT IGNORE INTO `instructor_time_constraints` (`id`, `instructor_id`, `schedule_id`) VALUES
( 1,  4, 1),  -- James Mitchell
( 2,  6, 1),  -- Michael Torres
( 3,  7, 1),  -- Sreynich Phan
( 4,  8, 1),  -- Bora Kim
( 5, 10, 1),  -- David Park
( 6, 11, 1),  -- Sokunthea Nhem
( 7, 12, 1),  -- Ryan Garcia
( 8, 13, 1),  -- Vuthy Tep
( 9, 15, 1),  -- Pisey Sorn
(10, 16, 1),  -- Rotha Chan
(11, 17, 1),  -- Sarah Williams
(12, 18, 1),  -- Kunthea Yem
(13, 20, 1),  -- Marcus Chen
(14, 22, 1),  -- Emily Johnson
(15, 23, 1),  -- Piseth Ouk
(16, 24, 1),  -- Linda Reyes
(17, 27, 1),  -- Maria Santos
(18, 28, 1),  -- Sophal Vin
(19, 33, 1),  -- Mony Hak
(20, 34, 1),  -- Robert Hughes
(21, 37, 1),  -- Sovann Nou
(22, 38, 1),  -- Andrew Thompson
(23, 39, 1),  -- Sreymom Touch
(24, 40, 1);  -- Daniel Wilson

INSERT IGNORE INTO `instructor_time_constraint_days` (`id`, `day`, `instructor_time_constraint_id`) VALUES
-- Constraint 1: James Mitchell (unavailable Tue, Thu)
( 1, 'Tuesday',   1),
( 2, 'Thursday',  1),
-- Constraint 2: Michael Torres (unavailable Mon, Wed, Fri)
( 3, 'Monday',    2),
( 4, 'Wednesday', 2),
( 5, 'Friday',    2),
-- Constraint 3: Sreynich Phan (unavailable Mon, Thu)
( 6, 'Monday',    3),
( 7, 'Thursday',  3),
-- Constraint 4: Bora Kim (unavailable Wed, Fri)
( 8, 'Wednesday', 4),
( 9, 'Friday',    4),
-- Constraint 5: David Park (unavailable Tue, Thu, Fri)
(10, 'Tuesday',   5),
(11, 'Thursday',  5),
(12, 'Friday',    5),
-- Constraint 6: Sokunthea Nhem (unavailable Mon, Wed)
(13, 'Monday',    6),
(14, 'Wednesday', 6),
-- Constraint 7: Ryan Garcia (unavailable Mon, Tue, Thu)
(15, 'Monday',    7),
(16, 'Tuesday',   7),
(17, 'Thursday',  7),
-- Constraint 8: Vuthy Tep (unavailable Wed, Fri)
(18, 'Wednesday', 8),
(19, 'Friday',    8),
-- Constraint 9: Pisey Sorn (unavailable Tue, Thu)
(20, 'Tuesday',   9),
(21, 'Thursday',  9),
-- Constraint 10: Rotha Chan (unavailable Mon, Fri)
(22, 'Monday',   10),
(23, 'Friday',   10),
-- Constraint 11: Sarah Williams (unavailable Tue, Wed)
(24, 'Tuesday',  11),
(25, 'Wednesday',11),
-- Constraint 12: Kunthea Yem (unavailable Mon, Thu, Fri)
(26, 'Monday',   12),
(27, 'Thursday', 12),
(28, 'Friday',   12),
-- Constraint 13: Marcus Chen (unavailable Wed, Thu)
(29, 'Wednesday',13),
(30, 'Thursday', 13),
-- Constraint 14: Emily Johnson (unavailable Mon, Tue, Fri)
(31, 'Monday',   14),
(32, 'Tuesday',  14),
(33, 'Friday',   14),
-- Constraint 15: Piseth Ouk (unavailable Tue, Thu)
(34, 'Tuesday',  15),
(35, 'Thursday', 15),
-- Constraint 16: Linda Reyes (unavailable Mon, Wed)
(36, 'Monday',   16),
(37, 'Wednesday',16),
-- Constraint 17: Maria Santos (unavailable Tue, Fri)
(38, 'Tuesday',  17),
(39, 'Friday',   17),
-- Constraint 18: Sophal Vin (unavailable Mon, Wed, Thu)
(40, 'Monday',   18),
(41, 'Wednesday',18),
(42, 'Thursday', 18),
-- Constraint 19: Mony Hak (unavailable Tue, Thu)
(43, 'Tuesday',  19),
(44, 'Thursday', 19),
-- Constraint 20: Robert Hughes (unavailable Mon, Wed, Fri)
(45, 'Monday',   20),
(46, 'Wednesday',20),
(47, 'Friday',   20),
-- Constraint 21: Sovann Nou (unavailable Tue, Thu)
(48, 'Tuesday',  21),
(49, 'Thursday', 21),
-- Constraint 22: Andrew Thompson (unavailable Mon, Fri)
(50, 'Monday',   22),
(51, 'Friday',   22),
-- Constraint 23: Sreymom Touch (unavailable Wed, Thu)
(52, 'Wednesday',23),
(53, 'Thursday', 23),
-- Constraint 24: Daniel Wilson (unavailable Mon, Tue, Thu)
(54, 'Monday',   24),
(55, 'Tuesday',  24),
(56, 'Thursday', 24);

-- All blackout days are full-day (08:00 - 17:00)
INSERT IGNORE INTO `instructor_time_constraint_time_slots` (`id`, `time_slot`, `instructor_time_constraint_day_id`) VALUES
( 1, '08:00 - 17:00',  1), ( 2, '08:00 - 17:00',  2), ( 3, '08:00 - 17:00',  3),
( 4, '08:00 - 17:00',  4), ( 5, '08:00 - 17:00',  5), ( 6, '08:00 - 17:00',  6),
( 7, '08:00 - 17:00',  7), ( 8, '08:00 - 17:00',  8), ( 9, '08:00 - 17:00',  9),
(10, '08:00 - 17:00', 10), (11, '08:00 - 17:00', 11), (12, '08:00 - 17:00', 12),
(13, '08:00 - 17:00', 13), (14, '08:00 - 17:00', 14), (15, '08:00 - 17:00', 15),
(16, '08:00 - 17:00', 16), (17, '08:00 - 17:00', 17), (18, '08:00 - 17:00', 18),
(19, '08:00 - 17:00', 19), (20, '08:00 - 17:00', 20), (21, '08:00 - 17:00', 21),
(22, '08:00 - 17:00', 22), (23, '08:00 - 17:00', 23), (24, '08:00 - 17:00', 24),
(25, '08:00 - 17:00', 25), (26, '08:00 - 17:00', 26), (27, '08:00 - 17:00', 27),
(28, '08:00 - 17:00', 28), (29, '08:00 - 17:00', 29), (30, '08:00 - 17:00', 30),
(31, '08:00 - 17:00', 31), (32, '08:00 - 17:00', 32), (33, '08:00 - 17:00', 33),
(34, '08:00 - 17:00', 34), (35, '08:00 - 17:00', 35), (36, '08:00 - 17:00', 36),
(37, '08:00 - 17:00', 37), (38, '08:00 - 17:00', 38), (39, '08:00 - 17:00', 39),
(40, '08:00 - 17:00', 40), (41, '08:00 - 17:00', 41), (42, '08:00 - 17:00', 42),
(43, '08:00 - 17:00', 43), (44, '08:00 - 17:00', 44), (45, '08:00 - 17:00', 45),
(46, '08:00 - 17:00', 46), (47, '08:00 - 17:00', 47), (48, '08:00 - 17:00', 48),
(49, '08:00 - 17:00', 49), (50, '08:00 - 17:00', 50), (51, '08:00 - 17:00', 51),
(52, '08:00 - 17:00', 52), (53, '08:00 - 17:00', 53), (54, '08:00 - 17:00', 54),
(55, '08:00 - 17:00', 55), (56, '08:00 - 17:00', 56);

-- ─── Courses (55 courses across 7 majors) ───────────────────────────────────
-- Duration: total weekly hours. 4h courses split into 2h+2h blocks.

INSERT IGNORE INTO `courses` (`id`, `title`, `code`, `color`, `capacity`, `duration`, `schedule_id`, `major_id`) VALUES
-- ── Computer Science (major 1) ──
( 1, 'Computer Programming',          'CS101',  '#3B82F6', 40, 4.0, 1, 1),
( 2, 'Object-Oriented Programming',   'CS102',  '#2563EB', 35, 3.0, 1, 1),
( 3, 'Data Structures & Algorithms',  'CS201',  '#1D4ED8', 35, 4.0, 1, 1),
( 4, 'Database Systems',              'CS301',  '#60A5FA', 30, 3.0, 1, 1),
( 5, 'Web Development',               'CS302',  '#93C5FD', 25, 4.0, 1, 1),
( 6, 'Operating Systems',             'CS303',  '#0EA5E9', 30, 3.0, 1, 1),
( 7, 'Computer Networks',             'CS304',  '#0284C7', 30, 3.0, 1, 1),
( 8, 'Mobile App Development',        'CS305',  '#0369A1', 25, 4.0, 1, 1),
( 9, 'Software Engineering',          'CS401',  '#075985', 25, 3.0, 1, 1),
(10, 'Artificial Intelligence',       'CS402',  '#0C4A6E', 20, 3.0, 1, 1),
(11, 'Cybersecurity Fundamentals',    'CS403',  '#164E63', 20, 3.0, 1, 1),
(12, 'Machine Learning',              'CS404',  '#155E75', 20, 3.0, 1, 1),
-- ── Management Information Systems (major 2) ──
(13, 'Intro to Information Systems',  'MIS101', '#10B981', 40, 3.0, 1, 2),
(14, 'Systems Analysis & Design',     'MIS201', '#059669', 35, 3.0, 1, 2),
(15, 'E-Commerce Systems',            'MIS202', '#34D399', 30, 3.0, 1, 2),
(16, 'IT Infrastructure',             'MIS203', '#6EE7B7', 30, 3.0, 1, 2),
(17, 'Enterprise Resource Planning',  'MIS301', '#047857', 30, 3.0, 1, 2),
(18, 'IT Project Management',         'MIS302', '#065F46', 30, 3.0, 1, 2),
(19, 'Business Intelligence',         'MIS303', '#064E3B', 25, 3.0, 1, 2),
(20, 'Data Analytics',                'MIS304', '#022C22', 25, 3.0, 1, 2),
-- ── Digital Arts & Design (major 3) ──
(21, 'Digital Design Fundamentals',   'DAD101', '#8B5CF6', 25, 4.0, 1, 3),
(22, 'Digital Photography',           'DAD102', '#7C3AED', 25, 3.0, 1, 3),
(23, '2D Animation',                  'DAD201', '#A78BFA', 20, 4.0, 1, 3),
(24, '3D Modeling & Rendering',       'DAD202', '#C084FC', 20, 4.0, 1, 3),
(25, 'Video Production',              'DAD203', '#6D28D9', 20, 3.0, 1, 3),
(26, 'UI/UX Design',                  'DAD301', '#5B21B6', 20, 3.0, 1, 3),
(27, 'Game Design',                   'DAD302', '#4C1D95', 20, 4.0, 1, 3),
-- ── Business Administration (major 4) ──
(28, 'Principles of Management',      'BA101',  '#F59E0B', 40, 3.0, 1, 4),
(29, 'Marketing Fundamentals',        'BA102',  '#D97706', 40, 3.0, 1, 4),
(30, 'Financial Accounting',          'BA201',  '#FBBF24', 35, 3.0, 1, 4),
(31, 'Business Law',                  'BA202',  '#F97316', 35, 3.0, 1, 4),
(32, 'Organizational Behavior',       'BA301',  '#EA580C', 30, 3.0, 1, 4),
(33, 'Human Resource Management',     'BA302',  '#C2410C', 30, 3.0, 1, 4),
(34, 'Supply Chain Management',       'BA303',  '#9A3412', 25, 3.0, 1, 4),
(35, 'Strategic Management',          'BA401',  '#7C2D12', 25, 3.0, 1, 4),
-- ── International Relations (major 5) ──
(36, 'Intro to International Relations', 'IR101', '#EC4899', 35, 3.0, 1, 5),
(37, 'International Political Economy',  'IR201', '#DB2777', 30, 3.0, 1, 5),
(38, 'ASEAN Studies',                    'IR202', '#F472B6', 30, 3.0, 1, 5),
(39, 'International Law',               'IR203', '#BE185D', 30, 3.0, 1, 5),
(40, 'Diplomacy & Foreign Policy',      'IR301', '#9D174D', 25, 3.0, 1, 5),
(41, 'Conflict Resolution',             'IR302', '#831843', 25, 3.0, 1, 5),
(42, 'Global Security Studies',          'IR303', '#701A75', 25, 3.0, 1, 5),
-- ── TESOL & English (major 6) ──
(43, 'English Composition',          'ENG101', '#EF4444', 35, 3.0, 1, 6),
(44, 'Academic Writing',             'ENG201', '#DC2626', 30, 3.0, 1, 6),
(45, 'Cross-Cultural Communication', 'ENG202', '#F87171', 30, 3.0, 1, 6),
(46, 'Public Speaking',              'ENG103', '#B91C1C', 30, 3.0, 1, 6),
(47, 'Linguistics',                  'ENG301', '#991B1B', 25, 3.0, 1, 6),
(48, 'TESOL Methodology',           'ENG302', '#7F1D1D', 25, 3.0, 1, 6),
-- ── Finance & Banking (major 7) ──
(49, 'Principles of Finance',              'FIN101', '#14B8A6', 40, 3.0, 1, 7),
(50, 'Corporate Finance',                  'FIN201', '#0D9488', 30, 3.0, 1, 7),
(51, 'Financial Markets',                  'FIN202', '#2DD4BF', 30, 3.0, 1, 7),
(52, 'Investment Analysis',                'FIN301', '#0F766E', 25, 3.0, 1, 7),
(53, 'Banking & Financial Institutions',   'FIN302', '#115E59', 25, 3.0, 1, 7),
(54, 'Risk Management',                    'FIN303', '#134E4A', 25, 3.0, 1, 7),
(55, 'International Finance',              'FIN401', '#042F2E', 20, 3.0, 1, 7);

-- ─── Sections (70 sections with instructor assignments) ─────────────────────
-- Popular intro courses have 2-3 sections; upper-level courses have 1.
-- status: 'offline' = in-person, 'online' = virtual

INSERT IGNORE INTO `sections` (`id`, `number`, `status`, `course_id`, `instructor_id`) VALUES
-- ── CS sections (18) ──
( 1, 'CS101-A', 'offline',  1,  1),  -- Computer Programming § A — Dara Sok
( 2, 'CS101-B', 'offline',  1,  4),  -- Computer Programming § B — James Mitchell
( 3, 'CS101-C', 'offline',  1,  6),  -- Computer Programming § C — Michael Torres
( 4, 'CS102-A', 'offline',  2,  2),  -- OOP § A — Virak Chea
( 5, 'CS102-B', 'offline',  2,  7),  -- OOP § B — Sreynich Phan
( 6, 'CS201-A', 'offline',  3,  1),  -- Data Structures § A — Dara Sok
( 7, 'CS201-B', 'offline',  3,  3),  -- Data Structures § B — Sopheak Ly
( 8, 'CS301-A', 'offline',  4,  5),  -- Database Systems § A — Ratanak Keo
( 9, 'CS301-B', 'offline',  4,  8),  -- Database Systems § B — Bora Kim
(10, 'CS302-A', 'offline',  5,  2),  -- Web Dev § A — Virak Chea
(11, 'CS302-B', 'online',   5,  6),  -- Web Dev § B (online) — Michael Torres
(12, 'CS303-A', 'offline',  6,  3),  -- Operating Systems — Sopheak Ly
(13, 'CS304-A', 'offline',  7,  5),  -- Computer Networks — Ratanak Keo
(14, 'CS305-A', 'offline',  8,  4),  -- Mobile App Dev — James Mitchell
(15, 'CS401-A', 'offline',  9,  1),  -- Software Engineering — Dara Sok
(16, 'CS402-A', 'offline', 10,  7),  -- Artificial Intelligence — Sreynich Phan
(17, 'CS403-A', 'offline', 11,  8),  -- Cybersecurity — Bora Kim
(18, 'CS404-A', 'offline', 12,  3),  -- Machine Learning — Sopheak Ly
-- ── MIS sections (9) ──
(19, 'MIS101-A', 'offline', 13,  9),  -- Intro IS § A — Chanthy Meas
(20, 'MIS101-B', 'offline', 13, 11),  -- Intro IS § B — Sokunthea Nhem
(21, 'MIS201-A', 'offline', 14, 10),  -- Systems Analysis — David Park
(22, 'MIS202-A', 'online',  15, 12),  -- E-Commerce (online) — Ryan Garcia
(23, 'MIS203-A', 'offline', 16,  9),  -- IT Infrastructure — Chanthy Meas
(24, 'MIS301-A', 'offline', 17, 13),  -- ERP — Vuthy Tep
(25, 'MIS302-A', 'offline', 18, 10),  -- IT Project Mgmt — David Park
(26, 'MIS303-A', 'offline', 19, 11),  -- Business Intelligence — Sokunthea Nhem
(27, 'MIS304-A', 'offline', 20, 12),  -- Data Analytics — Ryan Garcia
-- ── DAD sections (8) ──
(28, 'DAD101-A', 'offline', 21, 14),  -- Digital Design § A — Laurence Cruz
(29, 'DAD101-B', 'offline', 21, 16),  -- Digital Design § B — Rotha Chan
(30, 'DAD102-A', 'offline', 22, 15),  -- Photography — Pisey Sorn
(31, 'DAD201-A', 'offline', 23, 17),  -- 2D Animation — Sarah Williams
(32, 'DAD202-A', 'offline', 24, 18),  -- 3D Modeling — Kunthea Yem
(33, 'DAD203-A', 'offline', 25, 15),  -- Video Production — Pisey Sorn
(34, 'DAD301-A', 'offline', 26, 14),  -- UI/UX Design — Laurence Cruz
(35, 'DAD302-A', 'offline', 27, 16),  -- Game Design — Rotha Chan
-- ── BA sections (10) ──
(36, 'BA101-A',  'offline', 28, 19),  -- Management § A — Bopha Rath
(37, 'BA101-B',  'offline', 28, 21),  -- Management § B — Sokha Lim
(38, 'BA102-A',  'offline', 29, 20),  -- Marketing § A — Marcus Chen
(39, 'BA102-B',  'online',  29, 22),  -- Marketing § B (online) — Emily Johnson
(40, 'BA201-A',  'offline', 30, 23),  -- Financial Accounting — Piseth Ouk
(41, 'BA202-A',  'offline', 31, 24),  -- Business Law — Linda Reyes
(42, 'BA301-A',  'offline', 32, 19),  -- Org Behavior — Bopha Rath
(43, 'BA302-A',  'offline', 33, 21),  -- HRM — Sokha Lim
(44, 'BA303-A',  'offline', 34, 22),  -- Supply Chain — Emily Johnson
(45, 'BA401-A',  'offline', 35, 20),  -- Strategic Mgmt — Marcus Chen
-- ── IR sections (8) ──
(46, 'IR101-A',  'offline', 36, 25),  -- Intro IR § A — Kosal Heng
(47, 'IR101-B',  'offline', 36, 27),  -- Intro IR § B — Maria Santos
(48, 'IR201-A',  'offline', 37, 26),  -- IPE — Narith Chhum
(49, 'IR202-A',  'offline', 38, 28),  -- ASEAN Studies — Sophal Vin
(50, 'IR203-A',  'offline', 39, 29),  -- International Law — Channary Prak
(51, 'IR301-A',  'offline', 40, 25),  -- Diplomacy — Kosal Heng
(52, 'IR302-A',  'offline', 41, 27),  -- Conflict Resolution — Maria Santos
(53, 'IR303-A',  'offline', 42, 26),  -- Global Security — Narith Chhum
-- ── ENG sections (9) ──
(54, 'ENG101-A', 'offline', 43, 30),  -- English Comp § A — Edward Maningo
(55, 'ENG101-B', 'offline', 43, 32),  -- English Comp § B — Patricia Anderson
(56, 'ENG101-C', 'offline', 43, 33),  -- English Comp § C — Mony Hak
(57, 'ENG201-A', 'offline', 44, 31),  -- Academic Writing § A — Sothea Kong
(58, 'ENG201-B', 'online',  44, 34),  -- Academic Writing § B (online) — Robert Hughes
(59, 'ENG202-A', 'offline', 45, 30),  -- Cross-Cultural Comm — Edward Maningo
(60, 'ENG103-A', 'offline', 46, 33),  -- Public Speaking — Mony Hak
(61, 'ENG301-A', 'offline', 47, 31),  -- Linguistics — Sothea Kong
(62, 'ENG302-A', 'offline', 48, 32),  -- TESOL Methodology — Patricia Anderson
-- ── FIN sections (8) ──
(63, 'FIN101-A', 'offline', 49, 35),  -- Principles Finance § A — Phearun Cheng
(64, 'FIN101-B', 'offline', 49, 37),  -- Principles Finance § B — Sovann Nou
(65, 'FIN201-A', 'offline', 50, 36),  -- Corporate Finance — Samantha Lee
(66, 'FIN202-A', 'offline', 51, 38),  -- Financial Markets — Andrew Thompson
(67, 'FIN301-A', 'offline', 52, 39),  -- Investment Analysis — Sreymom Touch
(68, 'FIN302-A', 'offline', 53, 40),  -- Banking & FI — Daniel Wilson
(69, 'FIN303-A', 'offline', 54, 35),  -- Risk Management — Phearun Cheng
(70, 'FIN401-A', 'online',  55, 36);  -- International Finance (online) — Samantha Lee

-- ─── Course Hours (83 blocks — all unscheduled, ready for auto-generation) ──
-- day=NULL, time_slot=NULL → the Rust solver will place them.
-- 4h courses: two 2h blocks (must land on different days)
-- 3h courses: one 3h block
-- prefer_classroom_id: suggested room (CS/MIS→Computer Lab, DAD→Art Studio, etc.)

INSERT IGNORE INTO `course_hours` (`id`, `day`, `time_slot`, `separated_duration`, `classroom_id`, `section_id`, `prefer_classroom_id`) VALUES
-- ── CS course hours ──
-- CS101 Computer Programming (4h = 2+2)
( 1, NULL, NULL, 2.0, NULL,  1, 13),  -- CS101-A block 1 → CL101
( 2, NULL, NULL, 2.0, NULL,  1, 13),  -- CS101-A block 2 → CL101
( 3, NULL, NULL, 2.0, NULL,  2, 14),  -- CS101-B block 1 → CL102
( 4, NULL, NULL, 2.0, NULL,  2, 14),  -- CS101-B block 2 → CL102
( 5, NULL, NULL, 2.0, NULL,  3, 15),  -- CS101-C block 1 → CL103
( 6, NULL, NULL, 2.0, NULL,  3, 15),  -- CS101-C block 2 → CL103
-- CS102 OOP (3h = 3)
( 7, NULL, NULL, 3.0, NULL,  4, 13),  -- CS102-A → CL101
( 8, NULL, NULL, 3.0, NULL,  5, 14),  -- CS102-B → CL102
-- CS201 Data Structures (4h = 2+2)
( 9, NULL, NULL, 2.0, NULL,  6, 13),  -- CS201-A block 1 → CL101
(10, NULL, NULL, 2.0, NULL,  6, 13),  -- CS201-A block 2 → CL101
(11, NULL, NULL, 2.0, NULL,  7, 14),  -- CS201-B block 1 → CL102
(12, NULL, NULL, 2.0, NULL,  7, 14),  -- CS201-B block 2 → CL102
-- CS301 Database Systems (3h = 3)
(13, NULL, NULL, 3.0, NULL,  8, 15),  -- CS301-A → CL103
(14, NULL, NULL, 3.0, NULL,  9, 16),  -- CS301-B → CL104
-- CS302 Web Development (4h = 2+2)
(15, NULL, NULL, 2.0, NULL, 10, 13),  -- CS302-A block 1 → CL101
(16, NULL, NULL, 2.0, NULL, 10, 13),  -- CS302-A block 2 → CL101
(17, NULL, NULL, 2.0, NULL, 11, NULL), -- CS302-B (online) block 1
(18, NULL, NULL, 2.0, NULL, 11, NULL), -- CS302-B (online) block 2
-- CS303 Operating Systems (3h = 3)
(19, NULL, NULL, 3.0, NULL, 12,  1),  -- CS303-A → L201
-- CS304 Computer Networks (3h = 3)
(20, NULL, NULL, 3.0, NULL, 13, 15),  -- CS304-A → CL103
-- CS305 Mobile App Dev (4h = 2+2)
(21, NULL, NULL, 2.0, NULL, 14, 14),  -- CS305-A block 1 → CL102
(22, NULL, NULL, 2.0, NULL, 14, 14),  -- CS305-A block 2 → CL102
-- CS401 Software Engineering (3h = 3)
(23, NULL, NULL, 3.0, NULL, 15,  1),  -- CS401-A → L201
-- CS402 Artificial Intelligence (3h = 3)
(24, NULL, NULL, 3.0, NULL, 16, 16),  -- CS402-A → CL104
-- CS403 Cybersecurity (3h = 3)
(25, NULL, NULL, 3.0, NULL, 17, 15),  -- CS403-A → CL103
-- CS404 Machine Learning (3h = 3)
(26, NULL, NULL, 3.0, NULL, 18, 16),  -- CS404-A → CL104

-- ── MIS course hours (all 3h = 3) ──
(27, NULL, NULL, 3.0, NULL, 19,  2),  -- MIS101-A → L202
(28, NULL, NULL, 3.0, NULL, 20,  3),  -- MIS101-B → L203
(29, NULL, NULL, 3.0, NULL, 21, 13),  -- MIS201-A → CL101
(30, NULL, NULL, 3.0, NULL, 22, NULL), -- MIS202-A (online)
(31, NULL, NULL, 3.0, NULL, 23, 15),  -- MIS203-A → CL103
(32, NULL, NULL, 3.0, NULL, 24,  6),  -- MIS301-A → L301
(33, NULL, NULL, 3.0, NULL, 25,  2),  -- MIS302-A → L202
(34, NULL, NULL, 3.0, NULL, 26, 14),  -- MIS303-A → CL102
(35, NULL, NULL, 3.0, NULL, 27, 16),  -- MIS304-A → CL104

-- ── DAD course hours ──
-- DAD101 Digital Design (4h = 2+2)
(36, NULL, NULL, 2.0, NULL, 28, 17),  -- DAD101-A block 1 → AS201
(37, NULL, NULL, 2.0, NULL, 28, 17),  -- DAD101-A block 2 → AS201
(38, NULL, NULL, 2.0, NULL, 29, 18),  -- DAD101-B block 1 → AS202
(39, NULL, NULL, 2.0, NULL, 29, 18),  -- DAD101-B block 2 → AS202
-- DAD102 Photography (3h = 3)
(40, NULL, NULL, 3.0, NULL, 30, 17),  -- DAD102-A → AS201
-- DAD201 2D Animation (4h = 2+2)
(41, NULL, NULL, 2.0, NULL, 31, 13),  -- DAD201-A block 1 → CL101
(42, NULL, NULL, 2.0, NULL, 31, 13),  -- DAD201-A block 2 → CL101
-- DAD202 3D Modeling (4h = 2+2)
(43, NULL, NULL, 2.0, NULL, 32, 14),  -- DAD202-A block 1 → CL102
(44, NULL, NULL, 2.0, NULL, 32, 14),  -- DAD202-A block 2 → CL102
-- DAD203 Video Production (3h = 3)
(45, NULL, NULL, 3.0, NULL, 33, 17),  -- DAD203-A → AS201
-- DAD301 UI/UX Design (3h = 3)
(46, NULL, NULL, 3.0, NULL, 34, 15),  -- DAD301-A → CL103
-- DAD302 Game Design (4h = 2+2)
(47, NULL, NULL, 2.0, NULL, 35, 16),  -- DAD302-A block 1 → CL104
(48, NULL, NULL, 2.0, NULL, 35, 16),  -- DAD302-A block 2 → CL104

-- ── BA course hours (all 3h = 3) ──
(49, NULL, NULL, 3.0, NULL, 36,  1),  -- BA101-A → L201
(50, NULL, NULL, 3.0, NULL, 37,  2),  -- BA101-B → L202
(51, NULL, NULL, 3.0, NULL, 38,  3),  -- BA102-A → L203
(52, NULL, NULL, 3.0, NULL, 39, NULL), -- BA102-B (online)
(53, NULL, NULL, 3.0, NULL, 40,  6),  -- BA201-A → L301
(54, NULL, NULL, 3.0, NULL, 41,  7),  -- BA202-A → L302
(55, NULL, NULL, 3.0, NULL, 42,  1),  -- BA301-A → L201
(56, NULL, NULL, 3.0, NULL, 43,  8),  -- BA302-A → L303
(57, NULL, NULL, 3.0, NULL, 44,  2),  -- BA303-A → L202
(58, NULL, NULL, 3.0, NULL, 45, 10),  -- BA401-A → SR101

-- ── IR course hours (all 3h = 3) ──
(59, NULL, NULL, 3.0, NULL, 46,  6),  -- IR101-A → L301
(60, NULL, NULL, 3.0, NULL, 47,  7),  -- IR101-B → L302
(61, NULL, NULL, 3.0, NULL, 48,  8),  -- IR201-A → L303
(62, NULL, NULL, 3.0, NULL, 49, 10),  -- IR202-A → SR101
(63, NULL, NULL, 3.0, NULL, 50,  1),  -- IR203-A → L201
(64, NULL, NULL, 3.0, NULL, 51, 11),  -- IR301-A → SR102
(65, NULL, NULL, 3.0, NULL, 52, 10),  -- IR302-A → SR101
(66, NULL, NULL, 3.0, NULL, 53,  7),  -- IR303-A → L302

-- ── ENG course hours (all 3h = 3) ──
(67, NULL, NULL, 3.0, NULL, 54,  1),  -- ENG101-A → L201
(68, NULL, NULL, 3.0, NULL, 55,  2),  -- ENG101-B → L202
(69, NULL, NULL, 3.0, NULL, 56,  3),  -- ENG101-C → L203
(70, NULL, NULL, 3.0, NULL, 57, 10),  -- ENG201-A → SR101
(71, NULL, NULL, 3.0, NULL, 58, NULL), -- ENG201-B (online)
(72, NULL, NULL, 3.0, NULL, 59,  8),  -- ENG202-A → L303
(73, NULL, NULL, 3.0, NULL, 60,  6),  -- ENG103-A → L301
(74, NULL, NULL, 3.0, NULL, 61, 11),  -- ENG301-A → SR102
(75, NULL, NULL, 3.0, NULL, 62,  7),  -- ENG302-A → L302

-- ── FIN course hours (all 3h = 3) ──
(76, NULL, NULL, 3.0, NULL, 63,  1),  -- FIN101-A → L201
(77, NULL, NULL, 3.0, NULL, 64,  2),  -- FIN101-B → L202
(78, NULL, NULL, 3.0, NULL, 65,  6),  -- FIN201-A → L301
(79, NULL, NULL, 3.0, NULL, 66,  8),  -- FIN202-A → L303
(80, NULL, NULL, 3.0, NULL, 67, 10),  -- FIN301-A → SR101
(81, NULL, NULL, 3.0, NULL, 68, 11),  -- FIN302-A → SR102
(82, NULL, NULL, 3.0, NULL, 69,  7),  -- FIN303-A → L302
(83, NULL, NULL, 3.0, NULL, 70, NULL); -- FIN401-A (online)

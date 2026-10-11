-- =============================================================================
-- Dwarkesh Motor Driving School / BookMyDrive — database schema
-- =============================================================================
--
-- Single source of truth for the database structure. Safe to run on an empty
-- database AND on the live one, as often as you like (deploy.yml runs it on
-- every push):
--
--   CREATE TABLE IF NOT EXISTS  → table is created only if it doesn't exist
--   CALL ensure_column(...)     → column is added to the EXISTING table only
--                                 if it doesn't exist (ADD COLUMN IF NOT EXISTS)
--   CALL ensure_index(...)      → same, for indexes / unique keys
--   CALL ensure_constraint(...) → same, for foreign keys / CHECKs
--
-- Nothing is ever dropped, renamed or modified, and existing data is untouched.
--
--   Add a column      → add one CALL ensure_column line under its table.
--                       e.g. CALL ensure_column('cars', 'fuel_type', "VARCHAR(20) NULL");
--   Add a table       → CREATE TABLE IF NOT EXISTS with its primary key, then
--                       one ensure_column per column.
--   Change / rename / drop a column, or backfill data → write a guarded
--                       statement in sql/upgrade.sql (this file only adds).
--
--   Fresh install:
--     mysql -u root -e "CREATE DATABASE drivingschool
--                       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--     mysql -u root drivingschool < sql/schema.sql
--     mysql -u root drivingschool < sql/upgrade.sql   # no-op on a fresh DB
--
-- Conventions:
--   * InnoDB, utf8mb4 / utf8mb4_unicode_ci on every table. One collation for
--     the whole database — mixing it with utf8mb4_0900_ai_ci causes
--     "Illegal mix of collations" errors in joins and comparisons.
--   * school_id   — tenant that owns the row (schools.id). 0 on lookup tables
--                   means "global default shared by all schools".
--   * *_by_id / *_by_type — who performed an action. type 'admin' points at
--                   admins.id; 'manager' / 'instructor' point at instructors.id.
--   * Several names (branch, car_name, instructor_name) are stored
--     denormalized as text rather than as foreign keys; that is how the
--     application queries them, so keep them in sync when renaming.
-- =============================================================================

SET NAMES utf8mb4;


-- =============================================================================
-- 0. HELPERS — "IF NOT EXISTS" for columns, indexes and constraints
-- =============================================================================
-- MySQL has no ADD COLUMN IF NOT EXISTS, so these check information_schema and
-- only run the ALTER when the item is missing. Dropped again at the end.

DROP PROCEDURE IF EXISTS ensure_column;
DROP PROCEDURE IF EXISTS ensure_index;
DROP PROCEDURE IF EXISTS ensure_constraint;

DELIMITER $$

CREATE PROCEDURE ensure_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = p_table AND column_name = p_column) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE ensure_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                   WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE ensure_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_schema = DATABASE() AND table_name = p_table AND constraint_name = p_constraint) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- =============================================================================
-- 1. TENANCY & ACCESS
-- =============================================================================

-- Multi-tenant anchor: one row per driving school.
CREATE TABLE IF NOT EXISTS schools (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('schools', 'name',        "VARCHAR(150) NOT NULL");
CALL ensure_column('schools', 'slug',        "VARCHAR(100) NOT NULL");
CALL ensure_column('schools', 'owner_email', "VARCHAR(150) NULL");
CALL ensure_column('schools', 'mobile_no',   "VARCHAR(20) NULL");
CALL ensure_column('schools', 'address',     "VARCHAR(255) NULL");
CALL ensure_column('schools', 'city',        "VARCHAR(100) NULL");
CALL ensure_column('schools', 'state',       "VARCHAR(100) NULL");
CALL ensure_column('schools', 'logo_url',    "VARCHAR(255) NULL");
CALL ensure_column('schools', 'is_active',   "TINYINT(1) NOT NULL DEFAULT 1");
CALL ensure_column('schools', 'created_at',  "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('schools', 'slug', "UNIQUE KEY slug (slug)");

-- Admin-panel accounts. Managers and instructors log in from the instructors
-- table instead.
CREATE TABLE IF NOT EXISTS admins (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('admins', 'school_id',  "INT NOT NULL DEFAULT 1");
CALL ensure_column('admins', 'username',   "VARCHAR(100) NOT NULL");
CALL ensure_column('admins', 'password',   "VARCHAR(255) NOT NULL");  -- bcrypt hash
CALL ensure_column('admins', 'role',       "ENUM('admin') NOT NULL DEFAULT 'admin'");
CALL ensure_column('admins', 'full_name',  "VARCHAR(150) NULL");
CALL ensure_column('admins', 'email',      "VARCHAR(150) NULL");
CALL ensure_column('admins', 'mobile_no',  "VARCHAR(20) NULL");
CALL ensure_column('admins', 'is_active',  "TINYINT(1) NOT NULL DEFAULT 1");
CALL ensure_column('admins', 'created_at', "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('admins', 'username', "UNIQUE KEY username (username)");

CREATE TABLE IF NOT EXISTS branches (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('branches', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('branches', 'branch_name',     "VARCHAR(100) NOT NULL");
CALL ensure_column('branches', 'address',         "VARCHAR(255) NULL");
CALL ensure_column('branches', 'city',            "VARCHAR(100) NULL");
CALL ensure_column('branches', 'state',           "VARCHAR(100) NULL");
CALL ensure_column('branches', 'postal_code',     "VARCHAR(20) NULL");
CALL ensure_column('branches', 'mobile_no',       "VARCHAR(20) NULL");
CALL ensure_column('branches', 'email',           "VARCHAR(100) NULL");
CALL ensure_column('branches', 'wifi_ssid',       "VARCHAR(255) NOT NULL DEFAULT ''");  -- network required for instructor clock-in/out
CALL ensure_column('branches', 'created_at',      "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('branches', 'created_by_id',   "INT NULL");
CALL ensure_column('branches', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('branches', 'updated_by_id',   "INT NULL");
CALL ensure_column('branches', 'updated_by_type', "VARCHAR(20) NULL");
CALL ensure_index('branches', 'idx_branches_school', "KEY idx_branches_school (school_id)");


-- =============================================================================
-- 2. CATALOGUE, CONTENT & SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS courses (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('courses', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('courses', 'course_name',     "VARCHAR(100) NOT NULL");
CALL ensure_column('courses', 'description',     "TEXT NULL");
CALL ensure_column('courses', 'status',          "ENUM('active','inactive') DEFAULT 'active'");
CALL ensure_column('courses', 'created_at',      "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('courses', 'created_by_id',   "INT NULL");
CALL ensure_column('courses', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('courses', 'updated_by_id',   "INT NULL");
CALL ensure_column('courses', 'updated_by_type', "VARCHAR(20) NULL");

-- Course lengths offered when creating a booking (e.g. 15, 21 days).
CREATE TABLE IF NOT EXISTS training_days (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('training_days', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('training_days', 'days',            "INT NOT NULL");
CALL ensure_column('training_days', 'is_active',       "TINYINT(1) DEFAULT 1");
CALL ensure_column('training_days', 'created_by_id',   "INT NULL");
CALL ensure_column('training_days', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('training_days', 'updated_by_id',   "INT NULL");
CALL ensure_column('training_days', 'updated_by_type', "VARCHAR(20) NULL");

-- Packages shown on the public website.
CREATE TABLE IF NOT EXISTS driving_packages (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('driving_packages', 'school_id',          "INT NOT NULL DEFAULT 1");
CALL ensure_column('driving_packages', 'badge',              "VARCHAR(100) NULL");
CALL ensure_column('driving_packages', 'title',              "VARCHAR(255) NOT NULL");
CALL ensure_column('driving_packages', 'description',        "TEXT NULL");
CALL ensure_column('driving_packages', 'practical_sessions', "INT NULL");
CALL ensure_column('driving_packages', 'session_duration',   "VARCHAR(50) NULL");
CALL ensure_column('driving_packages', 'daily_distance',     "VARCHAR(50) NULL");
CALL ensure_column('driving_packages', 'extra_features',     "JSON NULL");
CALL ensure_column('driving_packages', 'created_by_id',      "INT NULL");
CALL ensure_column('driving_packages', 'created_by_type',    "VARCHAR(20) NULL");
CALL ensure_column('driving_packages', 'updated_by_id',      "INT NULL");
CALL ensure_column('driving_packages', 'updated_by_type',    "VARCHAR(20) NULL");

-- CMS pages (privacy-policy, terms, faqs, support, ...), served by
-- cms.html?slug=<slug>. A slug is unique per school.
CREATE TABLE IF NOT EXISTS cms_pages (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('cms_pages', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('cms_pages', 'slug',            "VARCHAR(100) NOT NULL");
CALL ensure_column('cms_pages', 'title',           "VARCHAR(255) NULL");
CALL ensure_column('cms_pages', 'content',         "LONGTEXT NULL");
CALL ensure_column('cms_pages', 'status',          "TINYINT(1) DEFAULT 1");
CALL ensure_column('cms_pages', 'updated_at',      "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
CALL ensure_column('cms_pages', 'created_by_id',   "INT NULL");
CALL ensure_column('cms_pages', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('cms_pages', 'updated_by_id',   "INT NULL");
CALL ensure_column('cms_pages', 'updated_by_type', "VARCHAR(20) NULL");
CALL ensure_index('cms_pages', 'uq_cms_school_slug', "UNIQUE KEY uq_cms_school_slug (school_id, slug)");
CALL ensure_index('cms_pages', 'idx_cms_slug', "KEY idx_cms_slug (slug)");

-- Remote config / feature flags read by the mobile app.
CREATE TABLE IF NOT EXISTS app_settings (
    `key` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('app_settings', 'value',       "TEXT NOT NULL");
CALL ensure_column('app_settings', 'label',       "VARCHAR(200) NOT NULL DEFAULT ''");
CALL ensure_column('app_settings', 'description', "TEXT NULL");
CALL ensure_column('app_settings', 'updated_at',  "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

-- school_id = 0 → global default; > 0 → custom mode for that school.
CREATE TABLE IF NOT EXISTS payment_modes (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('payment_modes', 'name',      "VARCHAR(100) NOT NULL");
CALL ensure_column('payment_modes', 'is_custom', "TINYINT(1) NOT NULL DEFAULT 0");
CALL ensure_column('payment_modes', 'school_id', "INT NOT NULL DEFAULT 0");

-- school_id = 0 → global default; > 0 → category owned by that school.
-- (server.js converts any school_id = 0 rows to school 1 at startup.)
CREATE TABLE IF NOT EXISTS expense_categories (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('expense_categories', 'name',             "VARCHAR(100) NOT NULL");
CALL ensure_column('expense_categories', 'is_car_related',   "TINYINT(1) NOT NULL DEFAULT 0");
CALL ensure_column('expense_categories', 'extra_field',      "VARCHAR(20) NULL");  -- 'car' / 'employee': extra picker on the expense form
CALL ensure_column('expense_categories', 'is_custom',        "TINYINT(1) NOT NULL DEFAULT 0");
CALL ensure_column('expense_categories', 'school_id',        "INT NOT NULL DEFAULT 0");
CALL ensure_column('expense_categories', 'show_in_earnings', "TINYINT(1) NOT NULL DEFAULT 0");  -- shown in the instructor app's Earning tab


-- =============================================================================
-- 3. FLEET & STAFF
-- =============================================================================

CREATE TABLE IF NOT EXISTS cars (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('cars', 'school_id',             "INT NOT NULL DEFAULT 1");
CALL ensure_column('cars', 'car_name',              "VARCHAR(50) NOT NULL");
CALL ensure_column('cars', 'tag',                   "VARCHAR(30) NULL");
CALL ensure_column('cars', 'branch',                "VARCHAR(50) NULL");
CALL ensure_column('cars', 'car_registration_no',   "VARCHAR(50) NULL");
CALL ensure_column('cars', 'insurance_policy_no',   "VARCHAR(50) NULL");
CALL ensure_column('cars', 'insurance_company',     "VARCHAR(100) NULL");
CALL ensure_column('cars', 'insurance_issue_date',  "DATE NULL");
CALL ensure_column('cars', 'insurance_expiry_date', "DATE NULL");
CALL ensure_column('cars', 'puc_issue_date',        "DATE NULL");
CALL ensure_column('cars', 'puc_expiry_date',       "DATE NULL");
CALL ensure_column('cars', 'price_15_days',         "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
CALL ensure_column('cars', 'price_21_days',         "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
CALL ensure_column('cars', 'inactive',              "TINYINT(1) NOT NULL DEFAULT 0");
CALL ensure_column('cars', 'created_by_id',         "INT NULL");
CALL ensure_column('cars', 'created_by_type',       "VARCHAR(20) NULL");
CALL ensure_column('cars', 'updated_by_id',         "INT NULL");
CALL ensure_column('cars', 'updated_by_type',       "VARCHAR(20) NULL");
CALL ensure_index('cars', 'idx_cars_school', "KEY idx_cars_school (school_id)");

-- Admin "reset meter" log. A car's odometer floor is normally the highest
-- reading in driver_trips; a reset row sets a new baseline, and only readings
-- recorded after it count towards the floor.
CREATE TABLE IF NOT EXISTS car_meter_resets (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('car_meter_resets', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('car_meter_resets', 'car_name',        "VARCHAR(100) NOT NULL");
CALL ensure_column('car_meter_resets', 'reading',         "INT NOT NULL");
CALL ensure_column('car_meter_resets', 'note',            "VARCHAR(255) NULL");
CALL ensure_column('car_meter_resets', 'created_by_id',   "INT NULL");
CALL ensure_column('car_meter_resets', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('car_meter_resets', 'created_at',      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('car_meter_resets', 'idx_car_meter_resets_car', "KEY idx_car_meter_resets_car (school_id, car_name, created_at)");

-- Instructors and branch managers (role = 'Instructor' / 'manager').
-- branch2: optional second branch the person also covers. Every
-- "belongs to branch X" check must test branch OR branch2.
CREATE TABLE IF NOT EXISTS instructors (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('instructors', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('instructors', 'employee_no',     "VARCHAR(10) NULL");  -- e.g. EMP001
CALL ensure_column('instructors', 'instructor_name', "VARCHAR(100) NOT NULL");
CALL ensure_column('instructors', 'role',            "VARCHAR(50) NOT NULL DEFAULT 'Instructor'");
CALL ensure_column('instructors', 'email',           "VARCHAR(100) NULL");
CALL ensure_column('instructors', 'mobile_no',       "VARCHAR(20) NULL");
CALL ensure_column('instructors', 'branch',          "VARCHAR(50) NULL");
CALL ensure_column('instructors', 'branch2',         "VARCHAR(50) NULL");
CALL ensure_column('instructors', 'drivers_license', "VARCHAR(30) NULL");
CALL ensure_column('instructors', 'adhar_no',        "VARCHAR(20) NULL");
CALL ensure_column('instructors', 'address',         "TEXT NULL");
CALL ensure_column('instructors', 'is_active',       "TINYINT(1) DEFAULT 1");
CALL ensure_column('instructors', 'created_by_id',   "INT NULL");
CALL ensure_column('instructors', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('instructors', 'updated_by_id',   "INT NULL");
CALL ensure_column('instructors', 'updated_by_type', "VARCHAR(20) NULL");

-- Staff clock-in/out. Several rows per person per day are allowed (breaks).
-- person_type says which table instructor_id belongs to ('instructor' →
-- instructors, 'admin' → admins); ids are only unique within their table.
CREATE TABLE IF NOT EXISTS instructor_attendance (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('instructor_attendance', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('instructor_attendance', 'instructor_id',   "INT NOT NULL");
CALL ensure_column('instructor_attendance', 'instructor_name', "VARCHAR(100) NOT NULL DEFAULT ''");
CALL ensure_column('instructor_attendance', 'person_type',     "VARCHAR(20) NOT NULL DEFAULT 'instructor'");
CALL ensure_column('instructor_attendance', 'date',            "DATE NOT NULL");
CALL ensure_column('instructor_attendance', 'clock_in',        "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('instructor_attendance', 'clock_out',       "TIMESTAMP NULL DEFAULT NULL");
CALL ensure_index('instructor_attendance', 'idx_inst_date', "KEY idx_inst_date (instructor_id, date)");

CREATE TABLE IF NOT EXISTS leave_requests (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('leave_requests', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('leave_requests', 'instructor_id',   "INT NOT NULL");
CALL ensure_column('leave_requests', 'instructor_name', "VARCHAR(100) NULL");
CALL ensure_column('leave_requests', 'branch',          "VARCHAR(100) NULL");
CALL ensure_column('leave_requests', 'leave_from',      "DATE NOT NULL");
CALL ensure_column('leave_requests', 'leave_to',        "DATE NOT NULL");
CALL ensure_column('leave_requests', 'leave_type',      "ENUM('Full Day','Half Day') NOT NULL DEFAULT 'Full Day'");
CALL ensure_column('leave_requests', 'reason',          "TEXT NULL");
CALL ensure_column('leave_requests', 'status',          "ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'");
CALL ensure_column('leave_requests', 'created_at',      "DATETIME NOT NULL");
CALL ensure_column('leave_requests', 'updated_by_id',   "INT NULL");  -- who approved / rejected
CALL ensure_column('leave_requests', 'updated_by_type', "VARCHAR(20) NULL");
CALL ensure_index('leave_requests', 'idx_leave_requests_instructor', "KEY idx_leave_requests_instructor (instructor_id)");

-- Append-only points history. Balance = SUM(points); never a mutable counter.
CREATE TABLE IF NOT EXISTS instructor_rewards_ledger (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('instructor_rewards_ledger', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('instructor_rewards_ledger', 'instructor_id',   "INT NOT NULL");
CALL ensure_column('instructor_rewards_ledger', 'trip_id',         "INT NULL");
CALL ensure_column('instructor_rewards_ledger', 'type',            "ENUM('trip_earned','admin_withdraw') NOT NULL");
CALL ensure_column('instructor_rewards_ledger', 'points',          "INT NOT NULL");
CALL ensure_column('instructor_rewards_ledger', 'rupee_value',     "DECIMAL(10,2) NULL");
CALL ensure_column('instructor_rewards_ledger', 'note',            "VARCHAR(255) NULL");
CALL ensure_column('instructor_rewards_ledger', 'created_by_id',   "INT NULL");
CALL ensure_column('instructor_rewards_ledger', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('instructor_rewards_ledger', 'created_at',      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('instructor_rewards_ledger', 'idx_rewards_instructor', "KEY idx_rewards_instructor (instructor_id)");


-- =============================================================================
-- 4. ENQUIRIES, BOOKINGS & LESSONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS enquiries (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('enquiries', 'school_id',      "INT NOT NULL DEFAULT 1");
CALL ensure_column('enquiries', 'full_name',      "VARCHAR(150) NOT NULL");
CALL ensure_column('enquiries', 'email',          "VARCHAR(150) NOT NULL");
CALL ensure_column('enquiries', 'phone',          "VARCHAR(50) NOT NULL");
CALL ensure_column('enquiries', 'branch_id',      "INT NULL");
CALL ensure_column('enquiries', 'course_id',      "INT NULL");
CALL ensure_column('enquiries', 'has_licence',    "ENUM('Yes','No') NOT NULL DEFAULT 'No'");
CALL ensure_column('enquiries', 'message',        "TEXT NULL");
CALL ensure_column('enquiries', 'heard_from',     "VARCHAR(50) NULL");
CALL ensure_column('enquiries', 'hear_about',     "VARCHAR(50) NULL");
CALL ensure_column('enquiries', 'training_slots', "INT NULL");
CALL ensure_column('enquiries', 'slots',          "INT NULL");
CALL ensure_column('enquiries', 'preferred_car',  "VARCHAR(100) NULL");
CALL ensure_column('enquiries', 'status',         "ENUM('New','Called','Interested','Not Interested','Converted','Follow Up') DEFAULT 'New'");
CALL ensure_column('enquiries', 'created_at',     "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('enquiries', 'idx_enquiries_school', "KEY idx_enquiries_school (school_id)");

-- Follow-up log for an enquiry (calls, notes, WhatsApp, ...).
CREATE TABLE IF NOT EXISTS enquiry_actions (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('enquiry_actions', 'school_id',   "INT NOT NULL DEFAULT 1");
CALL ensure_column('enquiry_actions', 'enquiry_id',  "INT NOT NULL");
CALL ensure_column('enquiry_actions', 'action_type', "ENUM('Call','Note','Email','Meeting','WhatsApp','Other') DEFAULT 'Call'");
CALL ensure_column('enquiry_actions', 'note',        "TEXT NOT NULL");
CALL ensure_column('enquiry_actions', 'action_by',   "VARCHAR(100) NOT NULL");
CALL ensure_column('enquiry_actions', 'actor_id',    "INT NULL");
CALL ensure_column('enquiry_actions', 'actor_type',  "VARCHAR(20) NULL");
CALL ensure_column('enquiry_actions', 'action_date', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('enquiry_actions', 'created_at',  "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('enquiry_actions', 'idx_enquiry_actions_enquiry', "KEY idx_enquiry_actions_enquiry (enquiry_id)");
CALL ensure_constraint('enquiry_actions', 'fk_enquiry_actions_enquiry', "CONSTRAINT fk_enquiry_actions_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries (id) ON DELETE CASCADE");

-- A student's course enrolment. allotted_time .. allotted_time4 are the daily
-- lesson slots; attendance rows are keyed by (booking_id, date, time).
CREATE TABLE IF NOT EXISTS bookings (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('bookings', 'school_id',         "INT NOT NULL DEFAULT 1");
CALL ensure_column('bookings', 'branch',            "VARCHAR(100) NOT NULL");

-- student
CALL ensure_column('bookings', 'customer_name',     "VARCHAR(100) NULL");
CALL ensure_column('bookings', 'sex',               "ENUM('Male','Female','Other') NULL");
CALL ensure_column('bookings', 'birth_date',        "DATE NULL");
CALL ensure_column('bookings', 'mobile_no',         "VARCHAR(20) NULL");
CALL ensure_column('bookings', 'whatsapp_no',       "VARCHAR(20) NULL");
CALL ensure_column('bookings', 'email',             "VARCHAR(100) NULL");
CALL ensure_column('bookings', 'occupation',        "VARCHAR(100) NULL");
CALL ensure_column('bookings', 'address',           "VARCHAR(255) NULL");
CALL ensure_column('bookings', 'pincode',           "VARCHAR(10) NULL");
CALL ensure_column('bookings', 'ref',               "VARCHAR(100) NULL");

-- licence
CALL ensure_column('bookings', 'has_licence',       "ENUM('Yes','No') DEFAULT 'No'");
CALL ensure_column('bookings', 'cov_lmv',           "TINYINT(1) DEFAULT 0");
CALL ensure_column('bookings', 'cov_mc',            "TINYINT(1) DEFAULT 0");
CALL ensure_column('bookings', 'dl_no',             "VARCHAR(50) NULL");
CALL ensure_column('bookings', 'dl_from',           "VARCHAR(50) NULL");
CALL ensure_column('bookings', 'dl_to',             "VARCHAR(50) NULL");
CALL ensure_column('bookings', 'apply_licence',     "ENUM('Yes','No') DEFAULT 'No'");
CALL ensure_column('bookings', 'licence_types',     "VARCHAR(50) NULL");
CALL ensure_column('bookings', 'licence_fee',       "DECIMAL(10,2) DEFAULT 0.00");

-- course & schedule
CALL ensure_column('bookings', 'training_days',     "INT NOT NULL DEFAULT 0");
CALL ensure_column('bookings', 'duration_minutes',  "INT NOT NULL DEFAULT 30");
CALL ensure_column('bookings', 'car_name',          "VARCHAR(50) NULL");
CALL ensure_column('bookings', 'instructor_name',   "VARCHAR(100) NULL");
CALL ensure_column('bookings', 'ac_facility',       "TINYINT(1) DEFAULT 0");
CALL ensure_column('bookings', 'pickup_drop',       "TINYINT(1) DEFAULT 0");
CALL ensure_column('bookings', 'starting_from',     "DATE NULL");
CALL ensure_column('bookings', 'allotted_time',     "TIME NULL");
CALL ensure_column('bookings', 'allotted_time2',    "TIME NULL");
CALL ensure_column('bookings', 'allotted_time3',    "TIME NULL");
CALL ensure_column('bookings', 'allotted_time4',    "TIME NULL");

-- fees
CALL ensure_column('bookings', 'total_fees',        "DECIMAL(10,2) NULL");
CALL ensure_column('bookings', 'advance',           "DECIMAL(10,2) NULL");

-- progress
CALL ensure_column('bookings', 'attendance_status', "ENUM('Pending','Active','Completed','Expired','Hold') DEFAULT 'Pending'");
CALL ensure_column('bookings', 'present_days',      "INT DEFAULT 0");
CALL ensure_column('bookings', 'extended_days',     "INT DEFAULT 0");
CALL ensure_column('bookings', 'hold_status',       "TINYINT DEFAULT 0");
CALL ensure_column('bookings', 'hold_from',         "DATE NULL");
CALL ensure_column('bookings', 'resume_from',       "DATE NULL");
CALL ensure_column('bookings', 'expiry_reason',     "TEXT NULL");
CALL ensure_column('bookings', 'expiry_reason_at',  "DATETIME NULL");
CALL ensure_column('bookings', 'certificate_url',   "VARCHAR(255) NULL");

CALL ensure_column('bookings', 'created_at',        "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('bookings', 'created_by_id',     "INT NULL");
CALL ensure_column('bookings', 'created_by_type',   "VARCHAR(20) NULL");
CALL ensure_column('bookings', 'updated_by_id',     "INT NULL");
CALL ensure_column('bookings', 'updated_by_type',   "VARCHAR(20) NULL");
CALL ensure_index('bookings', 'idx_bookings_school', "KEY idx_bookings_school (school_id)");

-- One row per booking per lesson slot.
--   time            'HH:MM' slot key ('' on legacy rows)
--   change_source   'manual', or set by an approved student cancel/replacement
--                   so the instructor app shows "Cancelled"/"Rescheduled"
CREATE TABLE IF NOT EXISTS attendance (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('attendance', 'school_id',         "INT NOT NULL DEFAULT 1");
CALL ensure_column('attendance', 'booking_id',        "INT NOT NULL");
CALL ensure_column('attendance', 'date',              "DATE NOT NULL");
CALL ensure_column('attendance', 'time',              "VARCHAR(10) NOT NULL DEFAULT ''");
CALL ensure_column('attendance', 'present',           "TINYINT(1) NOT NULL DEFAULT 0");
CALL ensure_column('attendance', 'marked_at',         "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
CALL ensure_column('attendance', 'marked_by_id',      "INT NULL");
CALL ensure_column('attendance', 'marked_by_type',    "VARCHAR(20) NULL");
CALL ensure_column('attendance', 'approval_status',   "ENUM('pending','approved') NOT NULL DEFAULT 'approved'");
CALL ensure_column('attendance', 'approved_by_id',    "INT NULL");
CALL ensure_column('attendance', 'approved_by_type',  "VARCHAR(20) NULL");
CALL ensure_column('attendance', 'approved_at',       "DATETIME NULL");
CALL ensure_column('attendance', 'change_source',     "ENUM('manual','student_cancel','student_replacement') NOT NULL DEFAULT 'manual'");
CALL ensure_column('attendance', 'change_request_id', "INT NULL");
CALL ensure_index('attendance', 'unique_record', "UNIQUE KEY unique_record (booking_id, date, time)");
CALL ensure_index('attendance', 'idx_attendance_school', "KEY idx_attendance_school (school_id)");

-- Ad-hoc / make-up lessons outside a booking's regular allotted times, and
-- slots created by an approved student replacement request.
CREATE TABLE IF NOT EXISTS schedule_slots (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('schedule_slots', 'school_id',           "INT NOT NULL DEFAULT 1");
CALL ensure_column('schedule_slots', 'booking_id',          "INT NOT NULL");
CALL ensure_column('schedule_slots', 'date',                "DATE NOT NULL");
CALL ensure_column('schedule_slots', 'time',                "VARCHAR(10) NOT NULL");
CALL ensure_column('schedule_slots', 'car_name',            "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots', 'instructor_name',     "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots', 'present',             "TINYINT(1) DEFAULT 1");
CALL ensure_column('schedule_slots', 'source',              "ENUM('adhoc','student_replacement') NOT NULL DEFAULT 'adhoc'");
CALL ensure_column('schedule_slots', 'change_request_id',   "INT NULL");
CALL ensure_column('schedule_slots', 'replaced_from_time',  "VARCHAR(10) NULL");
CALL ensure_column('schedule_slots', 'created_by_admin_id', "INT NULL");  -- session account id of the creator
CALL ensure_column('schedule_slots', 'created_by_name',     "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots', 'created_by_role',     "VARCHAR(20) NULL");  -- 'instructor' or 'admin'
CALL ensure_column('schedule_slots', 'created_at',          "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('schedule_slots', 'fk_schedule_slots_booking', "KEY fk_schedule_slots_booking (booking_id)");
CALL ensure_constraint('schedule_slots', 'fk_schedule_slots_booking', "CONSTRAINT fk_schedule_slots_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE");

CREATE TABLE IF NOT EXISTS schedule_slots_deletions (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('schedule_slots_deletions', 'original_slot_id',    "INT NOT NULL");
CALL ensure_column('schedule_slots_deletions', 'booking_id',          "INT NOT NULL");
CALL ensure_column('schedule_slots_deletions', 'date',                "DATE NOT NULL");
CALL ensure_column('schedule_slots_deletions', 'time',                "VARCHAR(10) NOT NULL");
CALL ensure_column('schedule_slots_deletions', 'car_name',            "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots_deletions', 'instructor_name',     "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots_deletions', 'present',             "TINYINT(1) NULL");
CALL ensure_column('schedule_slots_deletions', 'source',              "VARCHAR(30) NULL");
CALL ensure_column('schedule_slots_deletions', 'created_by_admin_id', "INT NULL");
CALL ensure_column('schedule_slots_deletions', 'created_by_name',     "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots_deletions', 'created_by_role',     "VARCHAR(20) NULL");
CALL ensure_column('schedule_slots_deletions', 'created_at',          "TIMESTAMP NULL DEFAULT NULL");
CALL ensure_column('schedule_slots_deletions', 'deleted_by_admin_id', "INT NULL");
CALL ensure_column('schedule_slots_deletions', 'deleted_by_name',     "VARCHAR(100) NULL");
CALL ensure_column('schedule_slots_deletions', 'deleted_by_role',     "VARCHAR(20) NULL");
CALL ensure_column('schedule_slots_deletions', 'deleted_at',          "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('schedule_slots_deletions', 'school_id',           "INT NOT NULL DEFAULT 1");

-- Student-initiated cancel / replacement of a single lesson occurrence.
-- 'Reverted' = an admin undid an approved request.
CREATE TABLE IF NOT EXISTS schedule_change_requests (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('schedule_change_requests', 'school_id',                  "INT NOT NULL DEFAULT 1");
CALL ensure_column('schedule_change_requests', 'booking_id',                 "INT NOT NULL");
CALL ensure_column('schedule_change_requests', 'student_email',              "VARCHAR(255) NOT NULL");
CALL ensure_column('schedule_change_requests', 'request_type',               "ENUM('Cancel','Replacement') NOT NULL");
CALL ensure_column('schedule_change_requests', 'occurrence_date',            "DATE NOT NULL");
CALL ensure_column('schedule_change_requests', 'original_time',              "VARCHAR(10) NOT NULL");
CALL ensure_column('schedule_change_requests', 'new_time',                   "VARCHAR(10) NULL");
CALL ensure_column('schedule_change_requests', 'reason',                     "TEXT NULL");
CALL ensure_column('schedule_change_requests', 'status',                     "ENUM('Pending','Approved','Rejected','Reverted') NOT NULL DEFAULT 'Pending'");
CALL ensure_column('schedule_change_requests', 'admin_note',                 "TEXT NULL");
CALL ensure_column('schedule_change_requests', 'resulting_attendance_id',    "INT NULL");
CALL ensure_column('schedule_change_requests', 'resulting_schedule_slot_id', "INT NULL");
CALL ensure_column('schedule_change_requests', 'created_at',                 "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('schedule_change_requests', 'updated_by_id',              "INT NULL");
CALL ensure_column('schedule_change_requests', 'updated_by_type',            "VARCHAR(20) NULL");
CALL ensure_column('schedule_change_requests', 'reverted_by_id',             "INT NULL");
CALL ensure_column('schedule_change_requests', 'reverted_by_type',           "VARCHAR(20) NULL");
CALL ensure_column('schedule_change_requests', 'reverted_at',                "DATETIME NULL");
CALL ensure_index('schedule_change_requests', 'idx_scr_booking_date', "KEY idx_scr_booking_date (booking_id, occurrence_date)");
CALL ensure_constraint('schedule_change_requests', 'fk_scr_booking', "CONSTRAINT fk_scr_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE");

-- A lesson as actually driven, started/ended from the instructor app.
-- Manager approval marks the student present ('rejected' marks absent).
CREATE TABLE IF NOT EXISTS driver_trips (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('driver_trips', 'school_id',             "INT NOT NULL DEFAULT 1");
CALL ensure_column('driver_trips', 'instructor_id',         "INT NOT NULL");
CALL ensure_column('driver_trips', 'instructor_name',       "VARCHAR(100) NULL");
CALL ensure_column('driver_trips', 'booking_id',            "INT NOT NULL");
CALL ensure_column('driver_trips', 'student_name',          "VARCHAR(100) NULL");
CALL ensure_column('driver_trips', 'car_name',              "VARCHAR(100) NULL");  -- copied from the booking at trip start
CALL ensure_column('driver_trips', 'schedule_slot_id',      "INT NULL");  -- set when the trip is for an ad-hoc/replacement slot
CALL ensure_column('driver_trips', 'started_at',            "DATETIME NOT NULL");
CALL ensure_column('driver_trips', 'ended_at',              "DATETIME NULL");
CALL ensure_column('driver_trips', 'duration_mins',         "INT NOT NULL DEFAULT 30");
CALL ensure_column('driver_trips', 'status',                "ENUM('active','paused','completed') NOT NULL DEFAULT 'active'");
CALL ensure_column('driver_trips', 'paused_at',             "DATETIME NULL");
CALL ensure_column('driver_trips', 'paused_secs',           "INT NOT NULL DEFAULT 0");
CALL ensure_column('driver_trips', 'start_odometer',        "INT NULL");
CALL ensure_column('driver_trips', 'end_odometer',          "INT NULL");
CALL ensure_column('driver_trips', 'approval_status',       "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
CALL ensure_column('driver_trips', 'approved_by_id',        "INT NULL");
CALL ensure_column('driver_trips', 'approved_by_type',      "VARCHAR(20) NULL");
CALL ensure_column('driver_trips', 'approved_at',           "DATETIME NULL");
CALL ensure_column('driver_trips', 'reward_points_awarded', "TINYINT(1) NOT NULL DEFAULT 0");  -- guards against double-awarding
CALL ensure_column('driver_trips', 'created_at',            "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('driver_trips', 'idx_driver_trips_instructor', "KEY idx_driver_trips_instructor (instructor_id, status)");

-- Last known GPS position per instructor (one row each). Legacy: exists in
-- production but no longer read or written by the current code.
CREATE TABLE IF NOT EXISTS driver_locations (
    instructor_id INT NOT NULL,
    PRIMARY KEY (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('driver_locations', 'lat',        "DECIMAL(10,7) NOT NULL");
CALL ensure_column('driver_locations', 'lng',        "DECIMAL(10,7) NOT NULL");
CALL ensure_column('driver_locations', 'accuracy',   "FLOAT NULL");
CALL ensure_column('driver_locations', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

-- Student's 1–5 rating of a single lesson.
CREATE TABLE IF NOT EXISTS session_ratings (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('session_ratings', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('session_ratings', 'exam_user_id',    "INT NOT NULL");
CALL ensure_column('session_ratings', 'attendance_id',   "INT NOT NULL");
CALL ensure_column('session_ratings', 'booking_id',      "INT NULL");
CALL ensure_column('session_ratings', 'instructor_name', "VARCHAR(255) NULL");
CALL ensure_column('session_ratings', 'rating',          "TINYINT NOT NULL");
CALL ensure_column('session_ratings', 'comment',         "TEXT NULL");
CALL ensure_column('session_ratings', 'rated_at',        "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('session_ratings', 'uniq_user_session', "UNIQUE KEY uniq_user_session (exam_user_id, attendance_id)");
CALL ensure_constraint('session_ratings', 'session_ratings_chk_1', "CONSTRAINT session_ratings_chk_1 CHECK (rating BETWEEN 1 AND 5)");

CREATE TABLE IF NOT EXISTS student_complaints (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('student_complaints', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('student_complaints', 'student_email',   "VARCHAR(255) NOT NULL");
CALL ensure_column('student_complaints', 'student_name',    "VARCHAR(255) NULL");
CALL ensure_column('student_complaints', 'booking_id',      "INT NULL");
CALL ensure_column('student_complaints', 'subject',         "VARCHAR(255) NOT NULL");
CALL ensure_column('student_complaints', 'message',         "TEXT NOT NULL");
CALL ensure_column('student_complaints', 'category',        "ENUM('Instructor','Schedule','Payment','Car','App','Other') NOT NULL DEFAULT 'Other'");
CALL ensure_column('student_complaints', 'status',          "ENUM('Open','In Review','Resolved','Closed') NOT NULL DEFAULT 'Open'");
CALL ensure_column('student_complaints', 'admin_note',      "TEXT NULL");
CALL ensure_column('student_complaints', 'created_at',      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('student_complaints', 'updated_at',      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
CALL ensure_column('student_complaints', 'updated_by_id',   "INT NULL");
CALL ensure_column('student_complaints', 'updated_by_type', "VARCHAR(20) NULL");
CALL ensure_index('student_complaints', 'idx_student_complaints_email', "KEY idx_student_complaints_email (student_email)");

-- "Find Your Driver": a customer asks for a driver for their OWN car for a day
-- or two; an admin assigns an instructor and quotes a price.
CREATE TABLE IF NOT EXISTS driver_hire_requests (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('driver_hire_requests', 'school_id',                "INT NOT NULL DEFAULT 1");
CALL ensure_column('driver_hire_requests', 'student_email',            "VARCHAR(255) NOT NULL");
CALL ensure_column('driver_hire_requests', 'student_name',             "VARCHAR(255) NULL");
CALL ensure_column('driver_hire_requests', 'contact_phone',            "VARCHAR(30) NOT NULL");
CALL ensure_column('driver_hire_requests', 'service_date',             "DATE NOT NULL");
CALL ensure_column('driver_hire_requests', 'num_days',                 "TINYINT NOT NULL DEFAULT 1");
CALL ensure_column('driver_hire_requests', 'car_model',                "VARCHAR(100) NULL");
CALL ensure_column('driver_hire_requests', 'transmission',             "ENUM('Manual','Automatic') NULL");
CALL ensure_column('driver_hire_requests', 'pickup_address',           "TEXT NOT NULL");
CALL ensure_column('driver_hire_requests', 'area',                     "VARCHAR(120) NULL");
CALL ensure_column('driver_hire_requests', 'notes',                    "TEXT NULL");
CALL ensure_column('driver_hire_requests', 'status',                   "ENUM('Requested','Assigned','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Requested'");
CALL ensure_column('driver_hire_requests', 'assigned_instructor_id',   "INT NULL");
CALL ensure_column('driver_hire_requests', 'assigned_instructor_name', "VARCHAR(100) NULL");
CALL ensure_column('driver_hire_requests', 'quoted_price',             "DECIMAL(10,2) NULL");
CALL ensure_column('driver_hire_requests', 'admin_note',               "TEXT NULL");
CALL ensure_column('driver_hire_requests', 'created_at',               "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('driver_hire_requests', 'updated_at',               "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
CALL ensure_column('driver_hire_requests', 'updated_by_id',            "INT NULL");
CALL ensure_column('driver_hire_requests', 'updated_by_type',          "VARCHAR(20) NULL");
CALL ensure_index('driver_hire_requests', 'idx_driver_hire_school_status', "KEY idx_driver_hire_school_status (school_id, status)");
CALL ensure_index('driver_hire_requests', 'idx_driver_hire_student', "KEY idx_driver_hire_student (student_email)");


-- =============================================================================
-- 5. STUDENT ACCOUNTS & ONLINE LEARNER'S-LICENCE EXAM
-- =============================================================================

-- Email-OTP verified users (students / exam takers).
CREATE TABLE IF NOT EXISTS exam_users (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('exam_users', 'school_id',         "INT NOT NULL DEFAULT 1");
CALL ensure_column('exam_users', 'email',             "VARCHAR(255) NOT NULL");
CALL ensure_column('exam_users', 'full_name',         "VARCHAR(150) NULL");
CALL ensure_column('exam_users', 'mobile_no',         "VARCHAR(20) NULL");
CALL ensure_column('exam_users', 'first_verified_at', "DATETIME NULL");
CALL ensure_column('exam_users', 'last_seen_at',      "DATETIME NULL");
CALL ensure_column('exam_users', 'total_attempts',    "INT DEFAULT 0");
CALL ensure_column('exam_users', 'best_score',        "DECIMAL(4,1) DEFAULT 0.0");
CALL ensure_column('exam_users', 'last_score',        "DECIMAL(4,1) DEFAULT 0.0");
CALL ensure_column('exam_users', 'last_result',       "ENUM('PASS','FAIL') NULL");
CALL ensure_column('exam_users', 'ip_address',        "VARCHAR(45) NULL");
CALL ensure_column('exam_users', 'user_agent',        "TEXT NULL");
CALL ensure_index('exam_users', 'email', "UNIQUE KEY email (email)");
CALL ensure_index('exam_users', 'idx_exam_users_email', "KEY idx_exam_users_email (email)");

CREATE TABLE IF NOT EXISTS exam_attempts (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('exam_attempts', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('exam_attempts', 'user_id',         "INT NOT NULL");
CALL ensure_column('exam_attempts', 'mode',            "ENUM('mock','practice') NULL");
CALL ensure_column('exam_attempts', 'status',          "ENUM('started','completed') DEFAULT 'started'");
CALL ensure_column('exam_attempts', 'score',           "DECIMAL(4,1) NULL");
CALL ensure_column('exam_attempts', 'total_questions', "INT NULL");
CALL ensure_column('exam_attempts', 'correct_answers', "INT NULL");
CALL ensure_column('exam_attempts', 'result',          "ENUM('PASS','FAIL') NULL");
CALL ensure_column('exam_attempts', 'answers',         "JSON NULL");
CALL ensure_column('exam_attempts', 'started_at',      "DATETIME NULL");
CALL ensure_column('exam_attempts', 'finished_at',     "DATETIME NULL");
CALL ensure_column('exam_attempts', 'ip_address',      "VARCHAR(45) NULL");  -- captured at attempt start
CALL ensure_column('exam_attempts', 'user_agent',      "TEXT NULL");
CALL ensure_index('exam_attempts', 'idx_exam_attempts_user', "KEY idx_exam_attempts_user (user_id)");
CALL ensure_constraint('exam_attempts', 'fk_exam_attempts_user', "CONSTRAINT fk_exam_attempts_user FOREIGN KEY (user_id) REFERENCES exam_users (id)");

CREATE TABLE IF NOT EXISTS practice_progress (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('practice_progress', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('practice_progress', 'user_id',         "INT NOT NULL");
CALL ensure_column('practice_progress', 'question_number', "VARCHAR(10) NOT NULL");
CALL ensure_column('practice_progress', 'category',        "VARCHAR(100) NOT NULL");
CALL ensure_column('practice_progress', 'language',        "VARCHAR(5) DEFAULT 'en'");
CALL ensure_column('practice_progress', 'selected_answer', "INT NOT NULL");
CALL ensure_column('practice_progress', 'is_correct',      "TINYINT(1) DEFAULT 0");
CALL ensure_column('practice_progress', 'answered_at',     "DATETIME DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('practice_progress', 'unique_user_question_lang', "UNIQUE KEY unique_user_question_lang (user_id, question_number, language)");
CALL ensure_index('practice_progress', 'idx_practice_progress_user', "KEY idx_practice_progress_user (user_id)");
CALL ensure_index('practice_progress', 'idx_practice_progress_category', "KEY idx_practice_progress_category (user_id, category, language)");
CALL ensure_constraint('practice_progress', 'fk_practice_progress_user', "CONSTRAINT fk_practice_progress_user FOREIGN KEY (user_id) REFERENCES exam_users (id) ON DELETE CASCADE");

CREATE TABLE IF NOT EXISTS email_otps (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('email_otps', 'school_id',    "INT NOT NULL DEFAULT 1");
CALL ensure_column('email_otps', 'email',        "VARCHAR(255) NOT NULL");
CALL ensure_column('email_otps', 'otp',          "VARCHAR(6) NOT NULL");
CALL ensure_column('email_otps', 'attempts',     "INT DEFAULT 0");
CALL ensure_column('email_otps', 'resend_count', "INT DEFAULT 0");
CALL ensure_column('email_otps', 'last_sent_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('email_otps', 'ip_address',   "VARCHAR(45) NULL");
CALL ensure_column('email_otps', 'expires_at',   "DATETIME NOT NULL");
CALL ensure_column('email_otps', 'verified',     "TINYINT(1) DEFAULT 0");
CALL ensure_column('email_otps', 'created_at',   "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('email_otps', 'idx_email', "KEY idx_email (email)");
CALL ensure_index('email_otps', 'idx_email_created', "KEY idx_email_created (email, created_at)");


-- =============================================================================
-- 6. FINANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('expenses', 'school_id',       "INT NOT NULL DEFAULT 1");
CALL ensure_column('expenses', 'branch',          "VARCHAR(100) NOT NULL");
CALL ensure_column('expenses', 'debitor',         "VARCHAR(150) NOT NULL");
CALL ensure_column('expenses', 'employee_name',   "VARCHAR(150) NULL");
CALL ensure_column('expenses', 'category_id',     "INT NOT NULL");
CALL ensure_column('expenses', 'car_id',          "INT NULL");
CALL ensure_column('expenses', 'amount',          "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
CALL ensure_column('expenses', 'payment_mode_id', "INT NOT NULL");
CALL ensure_column('expenses', 'note',            "TEXT NULL");
CALL ensure_column('expenses', 'expense_date',    "DATE NOT NULL");
CALL ensure_column('expenses', 'created_at',      "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('expenses', 'created_by_id',   "INT NULL");
CALL ensure_column('expenses', 'created_by_type', "VARCHAR(20) NULL");
CALL ensure_column('expenses', 'updated_by_id',   "INT NULL");
CALL ensure_column('expenses', 'updated_by_type', "VARCHAR(20) NULL");
CALL ensure_index('expenses', 'category_id', "KEY category_id (category_id)");
CALL ensure_index('expenses', 'payment_mode_id', "KEY payment_mode_id (payment_mode_id)");
CALL ensure_constraint('expenses', 'expenses_ibfk_1', "CONSTRAINT expenses_ibfk_1 FOREIGN KEY (category_id) REFERENCES expense_categories (id)");
CALL ensure_constraint('expenses', 'expenses_ibfk_2', "CONSTRAINT expenses_ibfk_2 FOREIGN KEY (payment_mode_id) REFERENCES payment_modes (id)");


-- =============================================================================
-- 7. PLATFORM: AUDIT, ACTIVITY, PUSH, SESSIONS
-- =============================================================================

-- "Who did what, when" for accountability-sensitive app actions (attendance,
-- clock in/out, trips, meter resets, slots, leave). actor_name is a snapshot so
-- the log stays readable after renames; details is free-form JSON. Written by
-- logAudit() in server.js, which never lets a logging failure break a request.
CREATE TABLE IF NOT EXISTS audit_log (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('audit_log', 'school_id',   "INT NOT NULL DEFAULT 1");
CALL ensure_column('audit_log', 'actor_id',    "INT NULL");
CALL ensure_column('audit_log', 'actor_type',  "VARCHAR(20) NULL");
CALL ensure_column('audit_log', 'actor_name',  "VARCHAR(100) NULL");
CALL ensure_column('audit_log', 'action',      "VARCHAR(60) NOT NULL");
CALL ensure_column('audit_log', 'entity_type', "VARCHAR(40) NULL");
CALL ensure_column('audit_log', 'entity_id',   "INT NULL");
CALL ensure_column('audit_log', 'details',     "TEXT NULL");
CALL ensure_column('audit_log', 'platform',    "VARCHAR(20) NULL");
CALL ensure_column('audit_log', 'created_at',  "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('audit_log', 'idx_audit_log_actor', "KEY idx_audit_log_actor (school_id, actor_id, created_at)");
CALL ensure_index('audit_log', 'idx_audit_log_entity', "KEY idx_audit_log_entity (school_id, entity_type, entity_id)");

-- Daily mobile-app usage heartbeat, one row per booking per day.
-- (server.js also creates this on demand.)
CREATE TABLE IF NOT EXISTS app_activity (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('app_activity', 'school_id',     "INT NOT NULL DEFAULT 1");
CALL ensure_column('app_activity', 'booking_id',    "INT NOT NULL");
CALL ensure_column('app_activity', 'email',         "VARCHAR(255) NULL");
CALL ensure_column('app_activity', 'activity_date', "DATE NOT NULL");
CALL ensure_column('app_activity', 'request_count', "INT NOT NULL DEFAULT 1");
CALL ensure_column('app_activity', 'first_seen_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_column('app_activity', 'last_seen_at',  "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('app_activity', 'uniq_booking_day', "UNIQUE KEY uniq_booking_day (booking_id, activity_date)");
CALL ensure_index('app_activity', 'activity_date', "KEY activity_date (activity_date)");

-- FCM/APNs push tokens. person_type 'instructor' → instructors.id,
-- 'student' → bookings. (server.js also creates this on demand.)
CREATE TABLE IF NOT EXISTS device_push_tokens (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('device_push_tokens', 'school_id',   "INT NOT NULL DEFAULT 1");
CALL ensure_column('device_push_tokens', 'person_id',   "INT NOT NULL");
CALL ensure_column('device_push_tokens', 'person_type', "VARCHAR(20) NOT NULL");
CALL ensure_column('device_push_tokens', 'platform',    "VARCHAR(10) NOT NULL");
CALL ensure_column('device_push_tokens', 'token',       "VARCHAR(255) NOT NULL");
CALL ensure_column('device_push_tokens', 'updated_at',  "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
CALL ensure_index('device_push_tokens', 'uniq_token', "UNIQUE KEY uniq_token (token)");

-- Dedupe log for cron push reminders: a ref_key (e.g. per lesson slot) is
-- claimed once, so overlapping cron ticks never send the same reminder twice.
-- (server.js also creates this on demand.)
CREATE TABLE IF NOT EXISTS notification_log (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('notification_log', 'ref_key', "VARCHAR(150) NOT NULL");
CALL ensure_column('notification_log', 'sent_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
CALL ensure_index('notification_log', 'uniq_ref', "UNIQUE KEY uniq_ref (ref_key)");

-- express-mysql-session store (its own definition; it also creates this itself).
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL ensure_column('sessions', 'expires', "INT UNSIGNED NOT NULL");
CALL ensure_column('sessions', 'data',    "MEDIUMTEXT COLLATE utf8mb4_bin");


-- =============================================================================
-- 8. SEED DATA (INSERT IGNORE / upsert — never overwrites edited values)
-- =============================================================================

INSERT INTO schools (id, name, slug, is_active) VALUES
    (1, 'Dwarkesh Motor Driving School', 'dwarkesh', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO payment_modes (id, name, is_custom, school_id) VALUES
    (1, 'Cash',          0, 0),
    (2, 'UPI',           0, 0),
    (3, 'Bank Transfer', 0, 0),
    (4, 'Cheque',        0, 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Empty min_version_* = no forced update. Kept per platform so raising the
-- Android minimum can't lock iOS reviewers behind a force-update screen.
INSERT IGNORE INTO app_settings (`key`, value, label, description) VALUES
    ('maintenance_mode',      'false', 'Maintenance Mode',
        'When ON, all app users see a maintenance screen. Admin panel stays accessible.'),
    ('maintenance_message',   'We are currently performing maintenance. Please check back soon.', 'Maintenance Message',
        'Text shown to users during maintenance'),
    ('feature_leave_request', 'true',  'Leave Request',
        'Drivers can submit leave requests from the app'),
    ('feature_find_driver',   'false', 'Find a Driver',
        'Customers can request a hired driver for their own car from the app. Off by default — turn on when ready to launch.'),
    ('wifi_ssid',            '',      'School WiFi SSID',
        'SSID of the school WiFi network; instructors must be connected to this network to clock in/out'),
    ('min_version_android',   '',      'Minimum App Version (Android)',
        'Minimum Android app version required. Users on older versions see a forced-update screen. Leave empty to disable. Format: 1.0.13'),
    ('min_version_ios',       '',      'Minimum App Version (iOS)',
        'Minimum iOS app version required. Users on older versions see a forced-update screen. Leave empty to disable. Format: 1.0.13');

-- Support page: the App Store Connect Support URL
-- (dwarkeshdrivingschool.com/cms.html?slug=support).
INSERT IGNORE INTO cms_pages (school_id, slug, title, content, status) VALUES (
  1,
  'support',
  'Support',
  '<p>Need help with the BookMyDrive app or your driving lessons? We are here for you.</p>

<h2>Contact Us</h2>
<p><strong>Email:</strong> <a href="mailto:info@dwarkeshdrivingschool.com">info@dwarkeshdrivingschool.com</a></p>
<p>We aim to respond to all support requests within 24-48 hours.</p>

<h2>App Issues</h2>
<p>If you are experiencing a technical issue with the BookMyDrive app (login problems, clock-in/out issues, trip tracking, bookings, etc.), please email us with:</p>
<ul>
  <li>Your registered mobile number, employee ID, or student ID</li>
  <li>A description of the issue</li>
  <li>A screenshot, if possible</li>
</ul>

<h2>Other Questions</h2>
<p>For general questions about lessons, fees, or enrollment, see our <a href="/cms.html?slug=faqs">FAQs</a> or contact us using the email above.</p>',
  1
);


-- =============================================================================
-- Clean up helpers
-- =============================================================================
DROP PROCEDURE IF EXISTS ensure_column;
DROP PROCEDURE IF EXISTS ensure_index;
DROP PROCEDURE IF EXISTS ensure_constraint;

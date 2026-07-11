USE drivingschool;

-- =====================================
-- EXPENSE CATEGORIES TABLE
-- school_id = 0 → global defaults (shared across all schools)
-- school_id > 0 → custom category belonging to that school
-- =====================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_car_related TINYINT(1) NOT NULL DEFAULT 0,
    extra_field VARCHAR(20) DEFAULT NULL,
    is_custom TINYINT(1) NOT NULL DEFAULT 0,
    school_id INT NOT NULL DEFAULT 0
);


-- =====================================
-- PAYMENT MODES TABLE
-- school_id = 0 → global defaults
-- school_id > 0 → custom mode for that school
-- =====================================
CREATE TABLE IF NOT EXISTS payment_modes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_custom TINYINT(1) NOT NULL DEFAULT 0,
    school_id INT NOT NULL DEFAULT 0
);

INSERT INTO payment_modes (id, name, is_custom, school_id) VALUES
(1, 'Cash',            0, 0),
(2, 'UPI',             0, 0),
(3, 'Bank Transfer',   0, 0),
(4, 'Cheque',          0, 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- =====================================
-- EXPENSES TABLE
-- school_id → which driving school owns this record
-- =====================================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1,
    branch VARCHAR(100) NOT NULL,
    debitor VARCHAR(150) NOT NULL,
    employee_name VARCHAR(150) NULL,
    category_id INT NOT NULL,
    car_id INT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_mode_id INT NOT NULL,
    note TEXT NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (payment_mode_id) REFERENCES payment_modes(id)
);

-- Ensure employee_name column exists (for existing databases)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE table_schema='drivingschool'
                      AND table_name='expenses'
                      AND column_name='employee_name');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE expenses ADD COLUMN employee_name VARCHAR(150) NULL AFTER debitor;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- CARS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS cars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- =====================================
-- Ensure car_name
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='car_name'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN car_name VARCHAR(50) NOT NULL;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure branch
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='branch'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN branch VARCHAR(50);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure car_registration_no
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='car_registration_no'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN car_registration_no VARCHAR(50);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure insurance fields
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='insurance_policy_no'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN insurance_policy_no VARCHAR(50);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='insurance_company'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN insurance_company VARCHAR(100);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='insurance_issue_date'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN insurance_issue_date DATE;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='insurance_expiry_date'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN insurance_expiry_date DATE;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure PUC fields
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='puc_issue_date'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN puc_issue_date DATE;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='puc_expiry_date'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN puc_expiry_date DATE;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure price_15_days
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='price_15_days'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN price_15_days DECIMAL(10,2) NOT NULL DEFAULT 0.00;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure price_21_days
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='price_21_days'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN price_21_days DECIMAL(10,2) NOT NULL DEFAULT 0.00;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- Ensure inactive
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='inactive'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN inactive TINYINT(1) NOT NULL DEFAULT 0;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
--  tag
-- =====================================
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cars'
      AND column_name='tag'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cars ADD COLUMN tag VARCHAR(30) NULL AFTER car_name;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='cars' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE cars ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='cars' AND index_name='idx_cars_school');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_cars_school ON cars (school_id);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- INSTRUCTORS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS instructors (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    employee_no   VARCHAR(10),
    instructor_name VARCHAR(100) NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'Instructor',
    email         VARCHAR(100),
    mobile_no     VARCHAR(20),
    branch        VARCHAR(50),
    drivers_license VARCHAR(30),
    adhar_no      VARCHAR(20),
    address       TEXT,
    is_active     TINYINT(1) DEFAULT 1,
    school_id     INT NOT NULL DEFAULT 1
);

-- Ensure role column exists (for existing databases where table was already created)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE table_schema='drivingschool'
                      AND table_name='instructors'
                      AND column_name='role');
SET @sql := IF(@col_exists=0,
               "ALTER TABLE instructors ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'Instructor';",
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill employee_no for any existing rows that have none
UPDATE instructors SET employee_no = CONCAT('EMP', LPAD(id, 3, '0')) WHERE employee_no IS NULL OR employee_no = '';

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BOOKINGS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- branch
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='branch');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN branch VARCHAR(100) NOT NULL;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_days
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='training_days');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN training_days INT NOT NULL DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- customer_name
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='customer_name');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN customer_name VARCHAR(100);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- duration_minutes
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='duration_minutes');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN duration_minutes INT NOT NULL DEFAULT 30;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- address
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='address');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN address VARCHAR(255);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pincode
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='pincode');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN pincode VARCHAR(10);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mobile_no
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN mobile_no VARCHAR(20);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_no
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='whatsapp_no');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN whatsapp_no VARCHAR(20);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sex
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='sex');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN sex ENUM("Male","Female","Other");',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- birth_date
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='birth_date');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN birth_date DATE;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cov_lmv
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='cov_lmv');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN cov_lmv TINYINT(1) DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cov_mc
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='cov_mc');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN cov_mc TINYINT(1) DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- dl_no / dl_from / dl_to
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='dl_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN dl_no VARCHAR(50);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='dl_from');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN dl_from VARCHAR(50);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='dl_to');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN dl_to VARCHAR(50);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='email');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN email VARCHAR(100);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- occupation
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='occupation');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN occupation VARCHAR(100);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ref
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='ref');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN ref VARCHAR(100);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- allotted_time
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='allotted_time');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN allotted_time TIME;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- starting_from
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='starting_from');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN starting_from DATE;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- hold_from
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='hold_from');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN hold_from DATE;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- resume_from
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='resume_from');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN resume_from DATE;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_fees
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='total_fees');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN total_fees DECIMAL(10,2);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- advance
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='advance');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN advance DECIMAL(10,2);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='created_at');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- car_name
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='car_name');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN car_name VARCHAR(50);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instructor_name
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='instructor_name');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN instructor_name VARCHAR(100);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- hold_status
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='hold_status');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN hold_status TINYINT DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- present_days
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='present_days');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN present_days INT DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attendance_status
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='attendance_status');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN attendance_status ENUM("Pending","Active","Completed","Expired","Hold") DEFAULT "Pending";',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- extended_days
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='extended_days');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN extended_days INT DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- certificate_url
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='certificate_url');
SET @sql := IF(@col_exists=0,
    'ALTER TABLE bookings ADD COLUMN certificate_url VARCHAR(255);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ac_facility
SET @col_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='ac_facility'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN ac_facility TINYINT(1) DEFAULT 0;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- pickup_drop
SET @col_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='pickup_drop'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN pickup_drop TINYINT(1) DEFAULT 0;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- has_licence
SET @col_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='has_licence'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN has_licence ENUM("Yes","No") DEFAULT "No";',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- allotted_time2
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='allotted_time2'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN allotted_time2 TIME;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- allotted_time3
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='allotted_time3'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN allotted_time3 TIME;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- allotted_time4
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='allotted_time4'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN allotted_time4 TIME;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apply_licence
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='apply_licence'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN apply_licence ENUM("Yes","No") DEFAULT "No";',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- licence_types
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='licence_types'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN licence_types VARCHAR(50);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- licence_fee
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='bookings'
      AND column_name='licence_fee'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE bookings ADD COLUMN licence_fee DECIMAL(10,2) DEFAULT 0.00;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='bookings' AND index_name='idx_bookings_school');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_bookings_school ON bookings (school_id);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- ATTENDANCE TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='booking_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN booking_id INT NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='date');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN date DATE NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='present');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN present TINYINT(1) NOT NULL DEFAULT 0;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- time: per-slot key (HH:MM); empty string for legacy records
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='time');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN time VARCHAR(10) NOT NULL DEFAULT \'\' AFTER date;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 1: add new 3-column key under a temp name so the FK has something to hold on to
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='uq_att_slot');
SET @sql := IF(@idx_exists=0,'ALTER TABLE attendance ADD UNIQUE KEY uq_att_slot (booking_id, date, time);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: now safe to drop old keys (uq_att_slot satisfies any FK)
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='unique_attendance');
SET @sql := IF(@idx_exists>0,'ALTER TABLE attendance DROP INDEX unique_attendance;','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='unique_record');
SET @col_count := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='unique_record');
SET @sql := IF(@col_count=2,'ALTER TABLE attendance DROP INDEX unique_record;','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 3: add the final key with the canonical name
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='unique_record');
SET @sql := IF(@idx_exists=0,'ALTER TABLE attendance ADD UNIQUE KEY unique_record (booking_id, date, time);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: drop the temp key now that unique_record exists
SET @r_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='unique_record');
SET @t_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='uq_att_slot');
SET @sql := IF(@r_exists>0 AND @t_exists>0,'ALTER TABLE attendance DROP INDEX uq_att_slot;','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- marked_at: tracks when attendance was last set/changed
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='marked_at');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER present;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='attendance' AND index_name='idx_attendance_school');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_attendance_school ON attendance (school_id);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- marked_by_id / marked_by_type: who marked this record and from which table
-- marked_by_type 'admin' -> admins table; 'manager' or 'instructor' -> instructors table
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='marked_by_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN marked_by_id INT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='marked_by_type');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN marked_by_type VARCHAR(20) NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- SCHOOLS TABLE (multi-tenant anchor)
-- =====================================
CREATE TABLE IF NOT EXISTS schools (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    owner_email VARCHAR(150),
    mobile_no   VARCHAR(20),
    address     VARCHAR(255),
    city        VARCHAR(100),
    state       VARCHAR(100),
    logo_url    VARCHAR(255),
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schools (id, name, slug, is_active)
VALUES (1, 'Dwarkesh Motor Driving School', 'dwarkesh', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- =====================================
-- ADMINS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='username');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN username VARCHAR(100) UNIQUE NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='password');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN password VARCHAR(255) NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='created_at');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='role');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN role ENUM("superadmin","admin") NOT NULL DEFAULT "admin";','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='is_active');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='full_name');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN full_name VARCHAR(150) DEFAULT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='email');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN email VARCHAR(150) DEFAULT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN mobile_no VARCHAR(20) DEFAULT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BRANCHES TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- Add branch_name
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='branch_name');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN branch_name VARCHAR(100) NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add address
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='address');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN address VARCHAR(255);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add city
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='city');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN city VARCHAR(100);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add state
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='state');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN state VARCHAR(100);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add postal_code
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='postal_code');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN postal_code VARCHAR(20);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add mobile_no
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN mobile_no VARCHAR(20);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add email
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='branches' 
                      AND column_name='email');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN email VARCHAR(100);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add created_at
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE table_schema='drivingschool'
                      AND table_name='branches'
                      AND column_name='created_at');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE branches ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='branches' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE branches ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='branches' AND index_name='idx_branches_school');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_branches_school ON branches (school_id);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- TRAINING DAYS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS training_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- Add 'days' column
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='training_days'
      AND column_name='days'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE training_days ADD COLUMN days INT NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add 'is_active'
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='training_days'
      AND column_name='is_active'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE training_days ADD COLUMN is_active TINYINT(1) DEFAULT 1;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='training_days' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE training_days ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- ENQUIRIES TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS enquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- full_name
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='full_name'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN full_name VARCHAR(150) NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='email'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN email VARCHAR(150) NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='phone'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN phone VARCHAR(50) NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- branch_id
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='branch_id'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN branch_id INT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- course_id
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='course_id'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN course_id INT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- has_licence
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='has_licence'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN has_licence ENUM("Yes","No") NOT NULL DEFAULT "No";',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- message
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='message'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN message TEXT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='created_at'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- heard_from
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='heard_from'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN heard_from VARCHAR(50);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- hear_about
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='hear_about'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN hear_about VARCHAR(50);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_slots
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='training_slots'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN training_slots INT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- slots
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='slots'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN slots INT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- preferred_car
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='preferred_car'
);
SET @sql := IF(@col_exists = 0,
               'ALTER TABLE enquiries ADD COLUMN preferred_car VARCHAR(100);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='enquiries' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE enquiries ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='enquiries' AND index_name='idx_enquiries_school');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_enquiries_school ON enquiries (school_id);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- COURSES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- course_name
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool' AND table_name='courses' AND column_name='course_name'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE courses ADD COLUMN course_name VARCHAR(100) NOT NULL;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- description
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool' AND table_name='courses' AND column_name='description'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE courses ADD COLUMN description TEXT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- status
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool' AND table_name='courses' AND column_name='status'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE courses ADD COLUMN status ENUM("active","inactive") DEFAULT "active";',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool' AND table_name='courses' AND column_name='created_at'
);
SET @sql := IF(@col_exists=0,
               'ALTER TABLE courses ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='courses' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE courses ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- EMAIL OTPS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS email_otps (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- email
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='email'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN email VARCHAR(255) NOT NULL;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- otp
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='otp'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN otp VARCHAR(6) NOT NULL;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attempts
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='attempts'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN attempts INT DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- resend_count
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='resend_count'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN resend_count INT DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_sent_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='last_sent_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ip_address
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='ip_address'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN ip_address VARCHAR(45);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expires_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='expires_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN expires_at DATETIME NOT NULL;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- verified
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='verified'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN verified TINYINT(1) DEFAULT 0;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND column_name='created_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE email_otps ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- INDEXES
-- =====================================

-- email index
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND index_name='idx_email'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_email ON email_otps (email);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email + created_at composite index
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='email_otps'
      AND index_name='idx_email_created'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_email_created ON email_otps (email, created_at);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- EXAM USERS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS exam_users (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- email
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='email'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- first_verified_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='first_verified_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN first_verified_at DATETIME;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_seen_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='last_seen_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN last_seen_at DATETIME;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_attempts
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='total_attempts'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN total_attempts INT DEFAULT 0;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- best_score
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='best_score'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN best_score DECIMAL(4,1) DEFAULT 0.0;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_score
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='last_score'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN last_score DECIMAL(4,1) DEFAULT 0.0;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_result
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='last_result'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN last_result ENUM("PASS","FAIL");',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ip_address
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='ip_address'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN ip_address VARCHAR(45);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_agent
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND column_name='user_agent'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_users ADD COLUMN user_agent TEXT;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- full_name
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='exam_users' AND column_name='full_name');
SET @sql := IF(@col_exists=0,'ALTER TABLE exam_users ADD COLUMN full_name VARCHAR(150) DEFAULT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mobile_no
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='exam_users' AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE exam_users ADD COLUMN mobile_no VARCHAR(20) DEFAULT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- EXAM ATTEMPTS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS exam_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- user_id
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='user_id'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN user_id INT NOT NULL;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mode
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='mode'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN mode ENUM("mock","practice");',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- score
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='score'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN score DECIMAL(4,1);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_questions
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='total_questions'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN total_questions INT;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- correct_answers
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='correct_answers'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN correct_answers INT;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- result
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='result'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN result ENUM("PASS","FAIL");',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- started_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='started_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN started_at DATETIME;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- finished_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='finished_at'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN finished_at DATETIME;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- answers
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='answers'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN answers JSON;',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- status
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND column_name='status'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE exam_attempts ADD COLUMN status ENUM("started","completed") DEFAULT "started";',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- FOREIGN KEY (SAFE CHECK)
-- =====================================
SET @fk_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND constraint_name='fk_exam_attempts_user'
);
SET @sql := IF(@fk_exists=0,
    'ALTER TABLE exam_attempts ADD CONSTRAINT fk_exam_attempts_user FOREIGN KEY (user_id) REFERENCES exam_users(id);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- INDEXES
-- =====================================

-- exam_users email index
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='exam_users'
      AND index_name='idx_exam_users_email'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_exam_users_email ON exam_users (email);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- exam_attempts user_id index
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='exam_attempts'
      AND index_name='idx_exam_attempts_user'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_exam_attempts_user ON exam_attempts (user_id);',
    'SELECT "exists";'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- CMS PAGES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS cms_pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- slug
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND column_name='slug'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cms_pages ADD COLUMN slug VARCHAR(100) NOT NULL UNIQUE;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- title
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND column_name='title'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cms_pages ADD COLUMN title VARCHAR(255);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- content
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND column_name='content'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cms_pages ADD COLUMN content LONGTEXT;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- status
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND column_name='status'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cms_pages ADD COLUMN status TINYINT(1) DEFAULT 1;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- updated_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND column_name='updated_at'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE cms_pages ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================
-- CMS INDEXES
-- =====================================

-- slug index (fast public fetch)
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='cms_pages'
      AND index_name='idx_cms_slug'
);

SET @sql := IF(
    @idx_exists = 0,
    'CREATE INDEX idx_cms_slug ON cms_pages (slug);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- school_id for cms_pages
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='cms_pages' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE cms_pages ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Migrate slug unique from global to (school_id, slug) for multi-tenancy
-- Drop old global unique on slug (if it still exists as a standalone constraint/index)
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='cms_pages' AND index_name='slug');
SET @sql := IF(@idx_exists>0,'ALTER TABLE cms_pages DROP INDEX slug;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add composite unique (school_id, slug)
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='cms_pages' AND index_name='uq_cms_school_slug');
SET @sql := IF(@idx_exists=0,'ALTER TABLE cms_pages ADD UNIQUE KEY uq_cms_school_slug (school_id, slug);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- DRIVING PACKAGES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS driving_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL DEFAULT 1
);

-- badge
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='badge'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN badge VARCHAR(100);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- title
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='title'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN title VARCHAR(255) NOT NULL;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- description
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='description'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN description TEXT;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- practical_sessions
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='practical_sessions'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN practical_sessions INT;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- session_duration
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='session_duration'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN session_duration VARCHAR(50);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- daily_distance
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='daily_distance'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN daily_distance VARCHAR(50);',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- extra_features
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='driving_packages'
      AND column_name='extra_features'
);

SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE driving_packages ADD COLUMN extra_features JSON;',
    'SELECT "exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='driving_packages' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE driving_packages ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- PRACTICE PROGRESS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS practice_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question_number VARCHAR(10) NOT NULL,
    category VARCHAR(100) NOT NULL,
    language VARCHAR(5) DEFAULT 'en',
    selected_answer INT NOT NULL,
    is_correct TINYINT(1) DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_question_lang (user_id, question_number, language),
    CONSTRAINT fk_practice_progress_user FOREIGN KEY (user_id) REFERENCES exam_users(id) ON DELETE CASCADE
);

-- practice_progress indexes
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='practice_progress'
      AND index_name='idx_practice_progress_user'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_practice_progress_user ON practice_progress (user_id);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='practice_progress'
      AND index_name='idx_practice_progress_category'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_practice_progress_category ON practice_progress (user_id, category, language);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- SCHEDULE AD-HOC SLOTS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS schedule_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    car_name VARCHAR(100),
    instructor_name VARCHAR(100),
    present TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    school_id INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_schedule_slots_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='schedule_slots' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE schedule_slots ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- ENQUIRY STATUS COLUMN
-- =====================================
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema='drivingschool'
      AND table_name='enquiries'
      AND column_name='status'
);
SET @sql := IF(@col_exists=0,
    'ALTER TABLE enquiries ADD COLUMN status ENUM("New","Called","Interested","Not Interested","Converted","Follow Up") DEFAULT "New";',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- ENQUIRY ACTIONS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS enquiry_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enquiry_id INT NOT NULL,
    action_type ENUM('Call','Note','Email','Meeting','WhatsApp','Other') DEFAULT 'Call',
    note TEXT NOT NULL,
    action_by VARCHAR(100) NOT NULL,
    action_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    school_id INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_enquiry_actions_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
);

-- Index for fast lookup by enquiry
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE table_schema='drivingschool'
      AND table_name='enquiry_actions'
      AND index_name='idx_enquiry_actions_enquiry'
);
SET @sql := IF(@idx_exists=0,
    'CREATE INDEX idx_enquiry_actions_enquiry ON enquiry_actions (enquiry_id);',
    'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='enquiry_actions' AND column_name='school_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE enquiry_actions ADD COLUMN school_id INT NOT NULL DEFAULT 1;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- LEAVE REQUESTS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id   INT NOT NULL,
    instructor_name VARCHAR(100),
    branch          VARCHAR(100),
    leave_from      DATE NOT NULL,
    leave_to        DATE NOT NULL,
    leave_type      ENUM('Full Day','Half Day') NOT NULL DEFAULT 'Full Day',
    reason          TEXT,
    status          ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    created_at      DATETIME NOT NULL
);

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='leave_requests' AND index_name='idx_leave_requests_instructor');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_leave_requests_instructor ON leave_requests (instructor_id);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- DRIVER TRIPS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS driver_trips (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id   INT NOT NULL,
    instructor_name VARCHAR(100),
    booking_id      INT NOT NULL,
    student_name    VARCHAR(100),
    started_at      DATETIME NOT NULL,
    ended_at        DATETIME NULL,
    duration_mins   INT NOT NULL DEFAULT 30,
    status          ENUM('active','completed') NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_schema='drivingschool' AND table_name='driver_trips' AND index_name='idx_driver_trips_instructor');
SET @sql := IF(@idx_exists=0,'CREATE INDEX idx_driver_trips_instructor ON driver_trips (instructor_id, status);','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- DRIVER LOCATIONS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS driver_locations (
    instructor_id INT PRIMARY KEY,
    lat           DECIMAL(10,7) NOT NULL,
    lng           DECIMAL(10,7) NOT NULL,
    accuracy      FLOAT,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================
-- APP SETTINGS (Remote Config / Feature Flags)
-- =====================================
CREATE TABLE IF NOT EXISTS app_settings (
    `key`       VARCHAR(100) NOT NULL,
    value       TEXT         NOT NULL,
    label       VARCHAR(200) NOT NULL DEFAULT '',
    description TEXT,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
);

-- Seed default settings (INSERT IGNORE preserves any existing values)
INSERT IGNORE INTO app_settings (`key`, value, label, description) VALUES
    ('maintenance_mode',      'false', 'Maintenance Mode',  'When ON, all app users see a maintenance screen. Admin panel stays accessible.'),
    ('maintenance_message',   'We are currently performing maintenance. Please check back soon.', 'Maintenance Message', 'Text shown to users during maintenance'),
    ('feature_leave_request', 'true',  'Leave Request',     'Drivers can submit leave requests from the app');

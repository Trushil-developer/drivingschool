USE drivingschool;

-- =====================================
-- CARS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS cars (
    id INT AUTO_INCREMENT PRIMARY KEY
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
-- INSTRUCTORS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS instructors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(100) NOT NULL
);

-- Ensure employee_no exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='employee_no');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN employee_no VARCHAR(10);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure drivers_license exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='drivers_license');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN drivers_license VARCHAR(30);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure adhar_no exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='adhar_no');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN adhar_no VARCHAR(20);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure address exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='address');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN address TEXT;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure branch exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='branch');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN branch VARCHAR(50);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure email exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='email');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN email VARCHAR(100);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure mobile_no exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN mobile_no VARCHAR(20);',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure is_active exists
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='instructors' 
                      AND column_name='is_active');
SET @sql := IF(@col_exists=0,
               'ALTER TABLE instructors ADD COLUMN is_active TINYINT(1) DEFAULT 1;',
               'SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BOOKINGS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY
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


-- =====================================
-- ATTENDANCE TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY
);

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='booking_id');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN booking_id INT NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='date');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN date DATE NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='attendance' AND column_name='present');
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN present TINYINT(1) NOT NULL DEFAULT 0;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- ADMINS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY
);

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='username');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN username VARCHAR(100) UNIQUE NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='password');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN password VARCHAR(255) NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='created_at');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BRANCHES TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY
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



-- =====================================
-- TRAINING DAYS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS training_days (
    id INT AUTO_INCREMENT PRIMARY KEY
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


-- =====================================
-- ENQUIRIES TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS enquiries (
    id INT AUTO_INCREMENT PRIMARY KEY
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

-- =====================================
-- COURSES TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY
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
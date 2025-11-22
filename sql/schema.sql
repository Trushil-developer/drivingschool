USE drivingschool;

-- =====================================
-- CARS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS cars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    car_name VARCHAR(50) NOT NULL
);

-- Add missing columns safely
SET @col_exists := (SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' 
                      AND table_name='cars' 
                      AND column_name='car_name');
SET @sql := IF(@col_exists=0,'ALTER TABLE cars ADD COLUMN car_name VARCHAR(50) NOT NULL;','SELECT "Column exists";');
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

-- List of columns to ensure exist
SET @columns = 'employee_no VARCHAR(10), email VARCHAR(100), mobile_no VARCHAR(20), drivers_license VARCHAR(30), adhar_no VARCHAR(20), address TEXT, branch VARCHAR(50)';

-- Loop for adding columns dynamically
-- Note: MySQL does not have loops in plain SQL, so we add columns one by one:
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='employee_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN employee_no VARCHAR(10);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='email');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN email VARCHAR(100);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN mobile_no VARCHAR(20);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='drivers_license');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN drivers_license VARCHAR(30);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='adhar_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN adhar_no VARCHAR(20);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='address');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN address TEXT;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='branch');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN branch VARCHAR(50);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BOOKINGS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- Add missing columns for bookings
SET @columns = 'branch ENUM("Vandematram","Malabar","South Bopal") NOT NULL, training_days ENUM("21","15") NOT NULL, car_name VARCHAR(50), customer_name VARCHAR(100), address VARCHAR(255), pincode VARCHAR(10), mobile_no VARCHAR(20), whatsapp_no VARCHAR(20), sex ENUM("Male","Female","Other"), birth_date DATE, cov_lmv BOOLEAN DEFAULT FALSE, cov_mc BOOLEAN DEFAULT FALSE, dl_no VARCHAR(50), dl_from VARCHAR(50), dl_to VARCHAR(50), email VARCHAR(100), occupation VARCHAR(100), ref VARCHAR(100), allotted_time TIME, starting_from DATE, total_fees DECIMAL(10,2), advance DECIMAL(10,2), instructor_name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, present_days INT DEFAULT 0';

-- Repeat the same method as instructors to check and add each column individually

-- =====================================
-- ATTENDANCE TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- Add columns and constraints using same dynamic SQL method as above

-- =====================================
-- ADMINS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- Add missing columns for admins
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='username');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN username VARCHAR(100) UNIQUE NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='password');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN password VARCHAR(255) NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='admins' AND column_name='created_at');
SET @sql := IF(@col_exists=0,'ALTER TABLE admins ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

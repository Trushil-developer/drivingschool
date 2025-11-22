USE drivingschool;

-- =====================================
-- CARS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS cars (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- Ensure car_name exists
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema='drivingschool' AND table_name='cars' AND column_name='car_name');
SET @sql := IF(@col_exists=0,'ALTER TABLE cars ADD COLUMN car_name VARCHAR(50) NOT NULL;','SELECT "exists";');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- INSTRUCTORS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS instructors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(100) NOT NULL
);

-- Columns to ensure exist
SET @columns = 'employee_no VARCHAR(10), email VARCHAR(100), mobile_no VARCHAR(20), drivers_license VARCHAR(30), adhar_no VARCHAR(20), address TEXT, branch VARCHAR(50)';

-- Add each column if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='employee_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN employee_no VARCHAR(10);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='email');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN email VARCHAR(100);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='mobile_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN mobile_no VARCHAR(20);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='drivers_license');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN drivers_license VARCHAR(30);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='adhar_no');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN adhar_no VARCHAR(20);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='address');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN address TEXT;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='instructors' AND column_name='branch');
SET @sql := IF(@col_exists=0,'ALTER TABLE instructors ADD COLUMN branch VARCHAR(50);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================
-- BOOKINGS TABLE
-- =====================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY
);

-- Add bookings columns if missing
SET @columns_list = 'branch ENUM("Vandematram","Malabar","South Bopal") NOT NULL, training_days ENUM("21","15") NOT NULL, car_name VARCHAR(50), customer_name VARCHAR(100), address VARCHAR(255), pincode VARCHAR(10), mobile_no VARCHAR(20), whatsapp_no VARCHAR(20), sex ENUM("Male","Female","Other"), birth_date DATE, cov_lmv BOOLEAN DEFAULT FALSE, cov_mc BOOLEAN DEFAULT FALSE, dl_no VARCHAR(50), dl_from DATE, dl_to DATE, email VARCHAR(100), occupation VARCHAR(100), ref VARCHAR(100), allotted_time TIME, starting_from DATE, total_fees DECIMAL(10,2), advance DECIMAL(10,2), instructor_name VARCHAR(100), present_days INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';

-- Loop manually (or just repeat same method for each column)
-- Example:
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='branch');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN branch ENUM("Vandematram","Malabar","South Bopal") NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='training_days');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN training_days ENUM("21","15") NOT NULL;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema='drivingschool' AND table_name='bookings' AND column_name='car_name');
SET @sql := IF(@col_exists=0,'ALTER TABLE bookings ADD COLUMN car_name VARCHAR(50);','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Repeat the above for **all remaining bookings columns** (customer_name, address, pincode, mobile_no, whatsapp_no, sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email, occupation, ref, allotted_time, starting_from, total_fees, advance, instructor_name, present_days, created_at)

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
SET @sql := IF(@col_exists=0,'ALTER TABLE attendance ADD COLUMN present TINYINT(1) DEFAULT 0;','SELECT "exists";'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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

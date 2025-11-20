-- ================================
-- Create database
-- ================================
CREATE DATABASE IF NOT EXISTS drivingschool
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE drivingschool;

-- ================================
-- Drop tables if exist (optional)
-- ================================
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS admins;

-- ================================
-- Cars table
-- ================================
CREATE TABLE cars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    car_name VARCHAR(50) NOT NULL
);

-- Pre-populate some cars (optional)
INSERT INTO cars (car_name) VALUES ('Aura'), ('Wagon R'), ('i10 / Sentro');

-- ================================
-- Instructors table
-- ================================
CREATE TABLE instructors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(100) NOT NULL
);

-- Pre-populate some instructors (optional)
INSERT INTO instructors (instructor_name) VALUES ('John Doe'), ('Jane Smith');

-- ================================
-- Bookings table
-- ================================
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch ENUM('Vandematram', 'Malabar', 'South Bopal') NOT NULL,
    training_days ENUM('21', '15') NOT NULL,
    car_name VARCHAR(50),
    customer_name VARCHAR(100),
    address VARCHAR(255),
    pincode VARCHAR(10), 
    mobile_no VARCHAR(20),
    whatsapp_no VARCHAR(20),
    sex ENUM('Male','Female','Other'),
    birth_date DATE,
    cov_lmv BOOLEAN DEFAULT FALSE,
    cov_mc BOOLEAN DEFAULT FALSE,
    dl_no VARCHAR(50),
    dl_from VARCHAR(50),
    dl_to VARCHAR(50),
    email VARCHAR(100),
    occupation VARCHAR(100),
    ref VARCHAR(100),
    allotted_time TIME,
    starting_from DATE,
    total_fees DECIMAL(10,2),
    advance DECIMAL(10,2),
    instructor_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    present_days INT DEFAULT 0
);

-- ================================
-- Attendance table
-- ================================
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    date DATE NOT NULL,
    present TINYINT(1) DEFAULT 0,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    UNIQUE KEY unique_attendance (booking_id, date)
);

-- ================================
-- admins table
-- ================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

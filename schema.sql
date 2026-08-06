-- VeriPesa Database Schema

-- Drop tables if they exist to allow clean migrations/initialization
DROP TABLE IF EXISTS reconciliation_reports;
DROP TABLE IF EXISTS fraud_flags;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS vendors;

-- Table: vendors
CREATE TABLE vendors (
  vendor_id INT AUTO_INCREMENT PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  till_number VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: sales
CREATE TABLE sales (
  sale_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  expected_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','verified','failed','flagged') DEFAULT 'pending',
  checkout_request_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
);

-- Table: transactions
CREATE TABLE transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NULL,
  mpesa_ref VARCHAR(100) UNIQUE NOT NULL,
  received_amount DECIMAL(10,2) NOT NULL,
  sender_phone VARCHAR(20),
  sender_name VARCHAR(255),
  transaction_type ENUM('stk_push','c2b') DEFAULT 'stk_push',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  matched BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE SET NULL
);

-- Table: fraud_flags
CREATE TABLE fraud_flags (
  flag_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  flag_reason VARCHAR(255) NOT NULL,
  risk_level ENUM('low','medium','high') DEFAULT 'medium',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(255),
  resolution_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

-- Table: reconciliation_reports
CREATE TABLE reconciliation_reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  report_date DATE NOT NULL,
  total_expected DECIMAL(10,2) DEFAULT 0,
  total_received DECIMAL(10,2) DEFAULT 0,
  verified_count INT DEFAULT 0,
  pending_count INT DEFAULT 0,
  flagged_count INT DEFAULT 0,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
);

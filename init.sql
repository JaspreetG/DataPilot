-- Reset: remove existing tables to prepare a clean schema
DROP TABLE IF EXISTS performance_reviews;
DROP TABLE IF EXISTS employee_projects;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS employees;

-- Schema: consolidated employees table used by the application
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    role VARCHAR(50),
    salary INTEGER,
    performance_score INTEGER, -- range: 1-10
    location VARCHAR(50),      -- examples: 'Remote', 'New York'
    join_date DATE,
    manager_name VARCHAR(100)  -- manager stored as name for simple lookups
);

-- Seed: example employee records for development and testing
INSERT INTO employees (name, department, role, salary, performance_score, location, join_date, manager_name) VALUES 
-- Engineering
('Alice Wright', 'Engineering', 'VP of Engineering', 210000, 9, 'New York', '2015-06-01', 'CEO'),
('Bob Smith', 'Engineering', 'Senior Developer', 145000, 8, 'Remote', '2018-03-15', 'Alice Wright'),
('Charlie Kim', 'Engineering', 'DevOps Engineer', 130000, 7, 'San Francisco', '2020-11-20', 'Alice Wright'),
('Dave Miller', 'Engineering', 'Junior Developer', 95000, 6, 'Remote', '2023-01-10', 'Bob Smith'),

-- Sales
('Eve Foster', 'Sales', 'Head of Sales', 180000, 9, 'Chicago', '2016-08-22', 'CEO'),
('Frank Chen', 'Sales', 'Sales Representative', 85000, 10, 'Chicago', '2021-05-12', 'Eve Foster'),
('Grace Lee', 'Sales', 'Sales Representative', 82000, 5, 'Remote', '2022-02-01', 'Eve Foster'),

-- HR
('Heidi Klum', 'HR', 'HR Manager', 110000, 8, 'New York', '2019-09-30', 'CEO'),
('Ivan Drago', 'HR', 'Recruiter', 75000, 7, 'New York', '2021-07-15', 'Heidi Klum');
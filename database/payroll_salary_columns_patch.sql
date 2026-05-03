ALTER TABLE employees
  ADD COLUMN salary_type VARCHAR(20) NOT NULL DEFAULT 'hourly' AFTER hourly_rate,
  ADD COLUMN monthly_salary DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER salary_type,
  ADD COLUMN expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monthly_salary,
  ADD COLUMN paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER expected_work_days,
  ADD COLUMN attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_leave_days,
  ADD COLUMN attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_enabled,
  ADD COLUMN attendance_bonus_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_days,
  ADD COLUMN standard_hours DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER attendance_bonus_amount;

UPDATE employees
SET salary_type = CASE
  WHEN salary_type = 'fixed' THEN 'monthly'
  WHEN TRIM(COALESCE(salary_type, '')) <> '' THEN salary_type
  WHEN COALESCE(monthly_salary, 0) > 0
    OR COALESCE(expected_work_days, 0) > 0
    OR COALESCE(standard_hours, 0) > 0
  THEN 'monthly'
  ELSE 'hourly'
END;

ALTER TABLE payroll_entries
  MODIFY COLUMN salary_type VARCHAR(20) NOT NULL DEFAULT 'hourly',
  ADD COLUMN hourly_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1 AFTER hourly_rate,
  ADD COLUMN monthly_salary DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER salary_type,
  ADD COLUMN expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monthly_salary,
  ADD COLUMN paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER expected_work_days,
  ADD COLUMN attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_leave_days,
  ADD COLUMN attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_enabled,
  ADD COLUMN attendance_bonus_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER attendance_bonus_days,
  ADD COLUMN standard_hours DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER fixed_salary,
  ADD COLUMN shifts_json LONGTEXT NULL AFTER standard_hours;

UPDATE payroll_entries
SET salary_type = CASE
  WHEN salary_type = 'fixed' THEN 'monthly'
  WHEN TRIM(COALESCE(salary_type, '')) <> '' THEN salary_type
  WHEN COALESCE(monthly_salary, 0) > 0
    OR COALESCE(fixed_salary, 0) > 0
    OR COALESCE(expected_work_days, 0) > 0
    OR COALESCE(standard_hours, 0) > 0
  THEN 'monthly'
  ELSE 'hourly'
END,
monthly_salary = CASE
  WHEN COALESCE(monthly_salary, 0) > 0 THEN monthly_salary
  ELSE COALESCE(fixed_salary, 0)
END;

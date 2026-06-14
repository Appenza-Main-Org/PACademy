# Police Academy Admissions Platform
# Detailed BRD & Scope Document

> Strictly extracted and organized from the official Police Academy RFP / Technical Specifications document.
>
> Scope excludes all hardware, infrastructure, biometric devices, barcode printers/scanners, servers, and networking.

---

# 1. Internet Applications

The Internet Applications consist of:

1. Site Administrator Application
2. Site Applicant Application

Source:
- Technical Specifications Document — Internet Applications Section

---

# 1.1 Site Administrator Application
## (Site Administrator)

## Purpose
Administrative management of the admissions system and applicant workflows.

---

# 1.1.1 Permissions

## System Administrator Permissions
(Police Academy Officers)

The system shall integrate with the National Verification Platform API to retrieve:

- National ID
- Officer Code
- Full Arabic Name
- Mobile Number

---

# 1.1.2 Insert Screens

---

## A. System Administrators Management

### Features
- Create system administrators
- Update administrator data
- Synchronize with National Verification Platform
- Activate/Deactivate administrator accounts

---

## B. Admission Rules Management

The system shall support configuring:

### Admission Categories
- General Section
- Special Section
- Law Graduates
- Sports Section
- Female Applicants
- Specialized Officers
- Masters
- PhD

### Per Category Configuration
- Academic year
- Admission period start/end
- Application status
  - Active
  - Suspended
  - Closed

### Age Requirements
- Minimum age
- Maximum age

### Gender Rules

### Graduation Year Rules

### Payment Fees

### Required Examinations

### Allowed Colleges & Specializations

### Minimum Grade / GPA

### Maximum Number of Applicants

### Available Exam Dates

### Daily Exam Capacity

### Instructions for Applicants

### Electronic Payment Details

### Required Documents per Applicant Category

---

## C. Reference Data Management

The system shall support management of:

- Governorates
- Districts
- Exam Types
- Exam Results
- Specializations
- Universities
- Colleges
- Applicant Categories
- Grades
- Nationalities
- Occupations
- Social Statuses
- Educational Degrees
- General Instructions
- Admission Statuses
- Review Statuses

---

## D. Advanced Control Screens

The system shall support:

### Exam Control
- Define exam responsible for family data stage
- Define exam responsible for acquaintance document stage

### Acquaintance Document Control
- Enable/Disable:
  - Insert
  - Edit
  - Delete

### Educational Data Override
Ability to manually edit imported educational records from:
- Ministry of Education
- Al-Azhar

### Payment Attempts Monitoring

---

# 1.1.3 Inquiry Screens

The system shall support searching by:

- Applicant Name
- National ID
- Barcode

The system shall support inquiry for:
- Educational data
- Payment status
- Acquaintance document status
- Audit trail logs

---

# 1.1.4 Reports & Statistics

The system shall provide:

## Statistical Reports
- Total applicants
- Applicants by category
- Applicants by governorate
- Applicants by specialization
- Paid applicants
- Rejected applicants
- Passed applicants

## Detailed Reports
Based on:
- Gender
- Category
- College
- Specialization
- Payment status

## Reports Export
Formats:
- PDF
- Excel
- Word

---

# 1.1.5 Data Exchange Mechanisms

The system shall support importing/exporting:

## Export
- Applicants
- Exams
- Family data
- Acquaintance documents
- Colleges
- Admission categories
- System codes

## Import
- Exam results
- Committees
- Educational records from:
  - Ministry of Education
  - Al-Azhar

---

# 1.2 Applicant System
## (Site Applicant)

---

# 1.2.1 Applicant Permissions

Applicant authentication consists of:

## First Authentication
Using:
- National ID
- Mobile Number

Retrieved from National Verification Platform API.

## Second Authentication
Using:
- National ID
- Mobile Number already registered

---

# 1.2.2 Initial Workflow
## (Stages 1 → 5)

---

## Stage 1 — Verify Admission Window

The system shall:
- Verify if admission is open
- Display admission opening message
- Prevent continuation if admission is closed

---

## Stage 2 — Verify Previous Application

The system shall:
- Check if applicant already applied in same academic year
- Redirect applicant to previous application if exists
- Prevent duplicate applications

---

## Stage 3 — Educational Data Verification
(General Secondary / Azhar)

The system shall:
- Verify National ID exists in imported education records
- Retrieve:
  - Birth date
  - Age
  - GPA
  - Educational type

The system shall validate:
- Age eligibility
- GPA eligibility

The system shall prevent continuation if conditions fail.

---

## Stage 4 — Other Categories Validation

For:
- Special Section
- Law Graduates
- Sports
- Masters
- PhD

The system shall:
- Validate age
- Validate graduation year
- Validate category conditions

---

## Stage 5 — Personal & Educational Data Entry

Applicant enters:

### Personal Data
- Religion
- Address
- Mobile Numbers
- Social Media Accounts
- Social Status

### Educational Data
Based on applicant category.

---

# 1.2.3 Advanced Workflow
## (Stages 6 → 11)

---

## Stage 6 — Electronic Payment

The system shall support:
- Fawry payment
- Credit card payment

The system shall:
- Create payment transaction
- Generate payment reference
- Validate payment completion
- Validate payment code expiry

---

## Stage 7 — Basic Family Data

The applicant shall enter:

- Grandfather
- Grandmother
- Grandfather spouses if exist
- Grandmother spouses if exist
- Father
- Mother
- Father spouses if exist
- Mother spouses if exist

The system shall support:
- Insert
- Edit
- Delete before approval

---

## Stage 8 — Initial Relatives Data

The system shall:
- Allow entering relatives after specific exam stage configured by admin
- Store relatives data
- Support insert/edit/delete before approval

---

## Stage 9 — First Exam Appointment

The system shall:
- Display available committees
- Display available dates
- Display available slots
- Allow selecting exam date

---

## Stage 10 — Admission Card

The system shall generate:
- Printable admission card
- Barcode
- Required documents list
- Exam instructions

---

## Stage 11 — Exams & Results Follow-up

Applicant shall be able to view:
- Exam schedules
- Exam results
- Instructions
- Notifications

---

# 1.2.4 Acquaintance Document Workflow
## (Stage 12)

The applicant shall enter:

### Relatives up to Fourth Degree

### Family Income Data

### Housing Data

### Relatives Working in Foreign Entities

### Relatives with Foreign Nationalities

### Previous Employment History

### Cases Related to Applicant or Relatives

The system shall support:
- Insert
- Edit
- Delete before approval

The system shall generate:
- Printable acquaintance document

---

# 2. Internal Network Applications

Applications:
1. Admissions Committees
2. Board & Secretariat
3. Investigations
4. Medical Commission
5. Barcode
6. Biometric
7. Question Bank & Electronic Exams

---

# 2.1 Admissions Committees Application

## Permissions

### System Manager
Capabilities:
- User management
- Insert screens
- Advanced control
- Reports
- Data exchange

---

### Student Committee Manager
Capabilities:
- Applicant management
- Applicant inquiry
- Reports

---

### Student Data Entry
Capabilities:
- Insert applicant results
- Inquiry

---

### Exam Committee Manager
Capabilities:
- User management
- Exam result management
- Inquiry

---

### Exam Results Entry
Capabilities:
- Insert results
- Inquiry

---

### Security Gate
Capabilities:
- Applicant attendance
- Barcode verification
- Reports

---

### Refund Permissions
Capabilities:
- Refund inquiry
- Refund reports

---

# 2.2 Board & Secretariat Application

## Capabilities
- Board sessions management
- Applicant presentation
- Session decisions
- Secretariat workflows

## Roles
- System Manager
- Secretariat Manager
- Session Member
- Session Chairman

---

# 2.3 Investigations Application

## Capabilities
- Incoming/outgoing investigations
- Investigation assignment
- Investigation results
- Reports

## Roles
- Investigation Committee A Manager
- Investigation Data Entry
- Criminal Investigation Manager
- Criminal Investigation Data Entry

---

# 2.4 Medical Commission Application

## Capabilities
- Clinics management
- Medical exams
- Height/weight/BMI
- Psychological tests
- Medical results
- Reports

## Roles
- System Manager
- Clinic User
- Medical Committee Manager
- Medical Results Entry

---

# 2.5 Barcode Application

## Capabilities
- Barcode generation
- Barcode printing
- Barcode lookup
- Barcode-based result entry

## Roles
- College System Managers
- Student Committee Users
- Exam Committee Users
- Medical Committee Users

---

# 2.6 Biometric Application

## Capabilities
- Fingerprint registration
- Facial recognition
- Identity verification
- Attendance verification

## Roles
- Student Committee Heads
- Exam Committee Heads
- Security Gate Users
- Medical Managers

---

# 2.7 Question Bank & Electronic Exams Application

## Capabilities
- Question bank management
- Electronic exams
- Difficulty levels
- Exam execution
- Auto result generation
- Reports

## Roles
- System Managers
- Exam Managers
- Applicants/Exam Users

---

# 3. General Functional Requirements

The system shall support:

- Audit Trail for all operations
- Import/Export using Excel
- Printing support
- PDF export
- Word export
- Arabic language support
- Role-based permissions
- Workflow approvals
- Applicant status tracking
- Data exchange between applications
- API integrations
- Payment gateway integrations
- Dynamic configuration without code changes

---

# 4. Explicitly Out of Scope

The following are excluded from this software scope:

- Servers
- Storage hardware
- Barcode devices
- Biometric devices
- Fingerprint readers
- Facial recognition cameras
- Networking hardware
- Data center setup
- Operating systems licensing
- Physical infrastructure
- Security appliances

---

# 5. Source References

Based on:
- Police Academy Technical Specifications Document
- Police Academy Technical Proposal
- Compliance Matrix
- Applicant Workflow Screens


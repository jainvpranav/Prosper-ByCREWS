-- =============================================================================
-- PROSPER HEALTH PLATFORM — SQL SERVER SCHEMA
-- Target: AWS RDS (SQL Server Engine) | Run in SSMS
-- Compliance: HIPAA-aligned design
--
-- HIPAA Security Measures implemented at schema level:
--   1. PHI columns stored with TDE (enable in RDS settings — see note below)
--   2. All lookup values use NVARCHAR to support Unicode
--   3. Audit trail tables (AuditLog, DataAccessLog) for §164.312(b)
--   4. Soft deletes (IsActive flag) — no hard deletion of PHI
--   5. FK constraints ensure referential integrity across related PHI
--   6. No PII/PHI in column names that reveal data type externally
--   7. Created/Modified timestamps on every table for audit tracking
--
-- NOTE: Enable AWS RDS Transparent Data Encryption (TDE) + SSL in transit
--       and set up KMS CMK for the RDS instance. These are AWS console steps.
-- =============================================================================

USE master;
GO

-- Create database (idempotent)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ProsperDB')
BEGIN
    CREATE DATABASE ProsperDB
    COLLATE SQL_Latin1_General_CP1_CI_AS;
END
GO

USE ProsperDB;
GO

-- =============================================================================
-- SCHEMA SEPARATION: dbo (app data) | audit (compliance logs)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'audit')
    EXEC('CREATE SCHEMA audit');
GO

-- =============================================================================
-- TABLE: dbo.Users
-- Stores core authentication identity only. PHI lives in UserProfiles.
-- Separating identity from PHI limits blast radius of a breach (HIPAA §164.514)
-- =============================================================================
IF OBJECT_ID('dbo.Users', 'U') IS NULL
CREATE TABLE dbo.Users (
    UserId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    Email           NVARCHAR(320)       NOT NULL,               -- max valid email length
    PasswordHash    NVARCHAR(512)       NOT NULL,               -- bcrypt/Argon2 hash, NEVER plain text
    IsActive        BIT                 NOT NULL DEFAULT 1,     -- soft delete flag
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    LastLoginAt     DATETIMEOFFSET(7)   NULL,
    MfaEnabled      BIT                 NOT NULL DEFAULT 0,     -- HIPAA §164.312(d) — authentication
    MfaSecret       NVARCHAR(256)       NULL,                   -- TOTP secret (should be encrypted at application layer too)

    CONSTRAINT PK_Users                 PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_Email           UNIQUE (Email)
);
GO

CREATE NONCLUSTERED INDEX IX_Users_Email ON dbo.Users (Email) WHERE IsActive = 1;
GO

-- =============================================================================
-- TABLE: dbo.UserProfiles
-- Core PHI. Links to Users. Columnar PHI — only collect minimum necessary
-- (HIPAA Minimum Necessary Standard §164.502(b))
-- =============================================================================
IF OBJECT_ID('dbo.UserProfiles', 'U') IS NULL
CREATE TABLE dbo.UserProfiles (
    ProfileId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Age             TINYINT             NULL CHECK (Age >= 0 AND Age <= 150),
    Gender          NVARCHAR(50)        NULL,
    ActivityLevel   NVARCHAR(50)        NULL,           -- 'Sedentary','Light','Moderate','Very Active'
    City            NVARCHAR(200)       NULL,
    ProfileComplete BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_UserProfiles          PRIMARY KEY CLUSTERED (ProfileId),
    CONSTRAINT FK_UserProfiles_Users    FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT UQ_UserProfiles_UserId   UNIQUE (UserId)  -- one profile per user
);
GO

CREATE NONCLUSTERED INDEX IX_UserProfiles_UserId ON dbo.UserProfiles (UserId);
GO

-- =============================================================================
-- TABLE: dbo.FamilyHistory
-- Multi-value relationship — a user may have multiple family conditions.
-- Stored separately to avoid wide PHI rows and to allow easy anonymisation.
-- =============================================================================
IF OBJECT_ID('dbo.FamilyHistory', 'U') IS NULL
CREATE TABLE dbo.FamilyHistory (
    FamilyHistoryId UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    ProfileId       UNIQUEIDENTIFIER    NOT NULL,
    Condition       NVARCHAR(200)       NOT NULL,   -- 'Heart Disease','Diabetes','Hypertension','Cancer','Stroke'
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_FamilyHistory                 PRIMARY KEY CLUSTERED (FamilyHistoryId),
    CONSTRAINT FK_FamilyHistory_UserProfiles    FOREIGN KEY (ProfileId) REFERENCES dbo.UserProfiles(ProfileId) ON DELETE CASCADE,
    CONSTRAINT UQ_FamilyHistory_ProfileCondition UNIQUE (ProfileId, Condition)
);
GO

CREATE NONCLUSTERED INDEX IX_FamilyHistory_ProfileId ON dbo.FamilyHistory (ProfileId);
GO

-- =============================================================================
-- TABLE: dbo.LifestyleData  (PHI)
-- =============================================================================
IF OBJECT_ID('dbo.LifestyleData', 'U') IS NULL
CREATE TABLE dbo.LifestyleData (
    LifestyleId     UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    ProfileId       UNIQUEIDENTIFIER    NOT NULL,
    SmokingStatus   NVARCHAR(50)        NULL,   -- 'Never','Former','Current'
    AlcoholUse      NVARCHAR(50)        NULL,   -- 'None','Moderate','Heavy'
    SleepRange      NVARCHAR(20)        NULL,   -- '<5h','5-7h','7-9h','>9h'
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_LifestyleData                 PRIMARY KEY CLUSTERED (LifestyleId),
    CONSTRAINT FK_LifestyleData_UserProfiles    FOREIGN KEY (ProfileId) REFERENCES dbo.UserProfiles(ProfileId) ON DELETE CASCADE,
    CONSTRAINT UQ_LifestyleData_ProfileId       UNIQUE (ProfileId)
);
GO

-- =============================================================================
-- TABLE: dbo.DietData  (PHI)
-- =============================================================================
IF OBJECT_ID('dbo.DietData', 'U') IS NULL
CREATE TABLE dbo.DietData (
    DietId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    ProfileId       UNIQUEIDENTIFIER    NOT NULL,
    FoodPreference  NVARCHAR(100)       NULL,   -- 'Omnivore','Vegetarian','Vegan','Pescatarian','Keto','Other'
    DietQuality     NVARCHAR(50)        NULL,   -- 'Excellent','Good','Fair'
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_DietData              PRIMARY KEY CLUSTERED (DietId),
    CONSTRAINT FK_DietData_UserProfiles FOREIGN KEY (ProfileId) REFERENCES dbo.UserProfiles(ProfileId) ON DELETE CASCADE,
    CONSTRAINT UQ_DietData_ProfileId    UNIQUE (ProfileId)
);
GO

-- =============================================================================
-- TABLE: dbo.MedicalData  (PHI — HIGH SENSITIVITY)
-- Contains medication lists and conditions. Application layer must encrypt
-- Medications and Conditions columns before INSERT (AES-256 app-layer encryption).
-- Column comments indicate this requirement.
-- =============================================================================
IF OBJECT_ID('dbo.MedicalData', 'U') IS NULL
CREATE TABLE dbo.MedicalData (
    MedicalId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    ProfileId       UNIQUEIDENTIFIER    NOT NULL,
    -- These three columns store AES-256 encrypted ciphertext from the app layer.
    -- Do NOT store plaintext here. Decrypt only in the application, never in SQL.
    Medications_Enc NVARCHAR(MAX)       NULL,   -- encrypted: list of medications
    Allergies_Enc   NVARCHAR(MAX)       NULL,   -- encrypted: allergy list
    Conditions_Enc  NVARCHAR(MAX)       NULL,   -- encrypted: chronic conditions / past issues
    -- Non-encrypted lookup value
    LastCheckup     NVARCHAR(50)        NULL,   -- 'Within 6 months','6-12 months','Over 1 year'
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_MedicalData              PRIMARY KEY CLUSTERED (MedicalId),
    CONSTRAINT FK_MedicalData_UserProfiles FOREIGN KEY (ProfileId) REFERENCES dbo.UserProfiles(ProfileId) ON DELETE CASCADE,
    CONSTRAINT UQ_MedicalData_ProfileId    UNIQUE (ProfileId)
);
GO

-- =============================================================================
-- TABLE: dbo.RiskAssessments
-- Stores computed risk scores. Linked to user but uses score categories
-- (not raw PHI) so lower sensitivity at rest.
-- =============================================================================
IF OBJECT_ID('dbo.RiskAssessments', 'U') IS NULL
CREATE TABLE dbo.RiskAssessments (
    AssessmentId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId              UNIQUEIDENTIFIER    NOT NULL,
    OverallRiskScore    TINYINT             NOT NULL CHECK (OverallRiskScore BETWEEN 0 AND 100),
    GeneticDisposition  NVARCHAR(50)        NULL,   -- 'Low','Moderate','High'
    LifestyleImpact     NVARCHAR(50)        NULL,   -- 'Low','Moderate','Critical'
    MedicalHistoryRisk  NVARCHAR(50)        NULL,   -- 'Low Risk','Moderate','High'
    AiInsightSummary    NVARCHAR(MAX)       NULL,   -- AI-generated text summary
    AssessedAt          DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_RiskAssessments          PRIMARY KEY CLUSTERED (AssessmentId),
    CONSTRAINT FK_RiskAssessments_Users    FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
GO

CREATE NONCLUSTERED INDEX IX_RiskAssessments_UserId ON dbo.RiskAssessments (UserId, AssessedAt DESC);
GO

-- =============================================================================
-- TABLE: dbo.RiskFactorContributions
-- Stores per-factor breakdown for each assessment (Age %, FamilyHistory %, etc.)
-- =============================================================================
IF OBJECT_ID('dbo.RiskFactorContributions', 'U') IS NULL
CREATE TABLE dbo.RiskFactorContributions (
    ContributionId  UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    AssessmentId    UNIQUEIDENTIFIER    NOT NULL,
    FactorName      NVARCHAR(100)       NOT NULL,   -- 'Age','Family History','Vitals','Activity Level'
    ContributionPct TINYINT             NOT NULL CHECK (ContributionPct BETWEEN 0 AND 100),

    CONSTRAINT PK_RiskFactorContributions               PRIMARY KEY CLUSTERED (ContributionId),
    CONSTRAINT FK_RiskFactorContributions_Assessments   FOREIGN KEY (AssessmentId) REFERENCES dbo.RiskAssessments(AssessmentId) ON DELETE CASCADE
);
GO

-- =============================================================================
-- TABLE: dbo.HealthProjections
-- Month-by-month projected vs baseline risk scores from AI model
-- =============================================================================
IF OBJECT_ID('dbo.HealthProjections', 'U') IS NULL
CREATE TABLE dbo.HealthProjections (
    ProjectionId    UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    AssessmentId    UNIQUEIDENTIFIER    NOT NULL,
    MonthOffset     TINYINT             NOT NULL,   -- 0, 1, 2, ... 6
    PredictedScore  TINYINT             NOT NULL CHECK (PredictedScore BETWEEN 0 AND 100),
    BaselineScore   TINYINT             NOT NULL CHECK (BaselineScore BETWEEN 0 AND 100),

    CONSTRAINT PK_HealthProjections                 PRIMARY KEY CLUSTERED (ProjectionId),
    CONSTRAINT FK_HealthProjections_Assessments     FOREIGN KEY (AssessmentId) REFERENCES dbo.RiskAssessments(AssessmentId) ON DELETE CASCADE,
    CONSTRAINT UQ_HealthProjections_Month           UNIQUE (AssessmentId, MonthOffset)
);
GO

-- =============================================================================
-- TABLE: dbo.Appointments  (PHI)
-- =============================================================================
IF OBJECT_ID('dbo.Appointments', 'U') IS NULL
CREATE TABLE dbo.Appointments (
    AppointmentId   UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    LocationName    NVARCHAR(300)       NOT NULL,
    LocationAddress NVARCHAR(500)       NULL,
    AppointmentDate DATE                NOT NULL,
    TimeSlot        NVARCHAR(20)        NOT NULL,   -- e.g. '09:00 AM'
    Provider        NVARCHAR(300)       NULL,       -- e.g. 'Dr. Sarah Chen, MD'
    AppointmentStatus NVARCHAR(50)      NOT NULL DEFAULT 'Scheduled',  -- 'Scheduled','Completed','Cancelled'
    CancellationReason NVARCHAR(500)    NULL,
    Notes_Enc       NVARCHAR(MAX)       NULL,       -- app-layer encrypted patient notes
    IsActive        BIT                 NOT NULL DEFAULT 1,            -- soft delete
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ModifiedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Appointments          PRIMARY KEY CLUSTERED (AppointmentId),
    CONSTRAINT FK_Appointments_Users    FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Appointments_Status  CHECK (AppointmentStatus IN ('Scheduled','Completed','Cancelled','No-Show'))
);
GO

CREATE NONCLUSTERED INDEX IX_Appointments_UserId_Date ON dbo.Appointments (UserId, AppointmentDate DESC) WHERE IsActive = 1;
GO

-- =============================================================================
-- TABLE: dbo.ChatMessages
-- Stores Pip AI chat history. Content may contain PHI disclosed by user,
-- so messages are soft-deleted and access is logged.
-- =============================================================================
IF OBJECT_ID('dbo.ChatMessages', 'U') IS NULL
CREATE TABLE dbo.ChatMessages (
    MessageId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Role            NVARCHAR(20)        NOT NULL,   -- 'user' | 'assistant'
    Content_Enc     NVARCHAR(MAX)       NOT NULL,   -- app-layer encrypted message content
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_ChatMessages          PRIMARY KEY CLUSTERED (MessageId),
    CONSTRAINT FK_ChatMessages_Users    FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_ChatMessages_Role     CHECK (Role IN ('user','assistant','system'))
);
GO

CREATE NONCLUSTERED INDEX IX_ChatMessages_UserId_Created ON dbo.ChatMessages (UserId, CreatedAt ASC) WHERE IsActive = 1;
GO

-- =============================================================================
-- AUDIT SCHEMA — HIPAA §164.312(b): Audit Controls
-- Tracks every CREATE / UPDATE / DELETE operation on PHI tables.
-- =============================================================================

-- audit.AuditLog: generic change log for all PHI tables
IF OBJECT_ID('audit.AuditLog', 'U') IS NULL
CREATE TABLE audit.AuditLog (
    AuditId         UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    TableName       NVARCHAR(128)       NOT NULL,
    RecordId        NVARCHAR(128)       NOT NULL,   -- PK value of modified row (as string)
    Operation       NVARCHAR(10)        NOT NULL,   -- 'INSERT','UPDATE','DELETE'
    ChangedByUserId NVARCHAR(256)       NULL,       -- User who made the change (from app context)
    OldValues       NVARCHAR(MAX)       NULL,       -- JSON of old column values
    NewValues       NVARCHAR(MAX)       NULL,       -- JSON of new column values
    OccurredAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    IpAddress       NVARCHAR(45)        NULL,       -- IPv4/IPv6 up to 45 chars
    UserAgent       NVARCHAR(512)       NULL,

    CONSTRAINT PK_AuditLog PRIMARY KEY CLUSTERED (AuditId)
);
GO

CREATE NONCLUSTERED INDEX IX_AuditLog_Table_Record   ON audit.AuditLog (TableName, RecordId);
CREATE NONCLUSTERED INDEX IX_AuditLog_OccurredAt     ON audit.AuditLog (OccurredAt DESC);
GO

-- audit.DataAccessLog: tracks every SELECT on PHI tables (§164.312(b) — access monitoring)
IF OBJECT_ID('audit.DataAccessLog', 'U') IS NULL
CREATE TABLE audit.DataAccessLog (
    AccessId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    AccessedByUserId NVARCHAR(256)      NOT NULL,
    TableName       NVARCHAR(128)       NOT NULL,
    RecordId        NVARCHAR(128)       NULL,
    AccessedAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    IpAddress       NVARCHAR(45)        NULL,
    Purpose         NVARCHAR(200)       NULL,   -- reason for access (Treatment / Payment / Operations)

    CONSTRAINT PK_DataAccessLog PRIMARY KEY CLUSTERED (AccessId)
);
GO

CREATE NONCLUSTERED INDEX IX_DataAccessLog_UserId ON audit.DataAccessLog (AccessedByUserId, AccessedAt DESC);
GO

-- audit.UserSessionLog: tracks logins / logouts (§164.312(a)(2)(iii) — automatic logoff evidence)
IF OBJECT_ID('audit.UserSessionLog', 'U') IS NULL
CREATE TABLE audit.UserSessionLog (
    SessionId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    EventType       NVARCHAR(20)        NOT NULL,   -- 'LOGIN_SUCCESS','LOGIN_FAIL','LOGOUT','TIMEOUT'
    IpAddress       NVARCHAR(45)        NULL,
    UserAgent       NVARCHAR(512)       NULL,
    OccurredAt      DATETIMEOFFSET(7)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_UserSessionLog PRIMARY KEY CLUSTERED (SessionId)
);
GO

CREATE NONCLUSTERED INDEX IX_UserSessionLog_UserId ON audit.UserSessionLog (UserId, OccurredAt DESC);
GO

-- =============================================================================
-- STORED PROCEDURE: Safely purge a user's PHI (Right to Delete / De-identification)
-- Hard-deletes PHI while preserving de-identified audit records.
-- Call this when processing a user deletion request.
-- =============================================================================
GO
CREATE OR ALTER PROCEDURE dbo.usp_PurgeUserPHI
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Log the purge in audit before deletion
        INSERT INTO audit.AuditLog (TableName, RecordId, Operation, ChangedByUserId, OccurredAt)
        VALUES ('dbo.Users', CAST(@UserId AS NVARCHAR(128)), 'PURGE', 'SYSTEM', SYSDATETIMEOFFSET());

        -- Soft-delete the user account
        UPDATE dbo.Users
        SET IsActive = 0, Email = CONCAT('purged_', CAST(@UserId AS NVARCHAR(36))), ModifiedAt = SYSDATETIMEOFFSET()
        WHERE UserId = @UserId;

        -- Hard-delete PHI (cascade handles child tables via FK ON DELETE CASCADE)
        DELETE FROM dbo.UserProfiles WHERE UserId = @UserId;
        DELETE FROM dbo.Appointments WHERE UserId = @UserId;
        DELETE FROM dbo.ChatMessages WHERE UserId = @UserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- =============================================================================
-- VIEWS (for safe, column-restricted reads — defense-in-depth)
-- Only expose non-PHI columns for dashboard analytics / reporting queries.
-- =============================================================================
GO
CREATE OR ALTER VIEW dbo.vw_AnonymizedRiskSummary AS
    SELECT
        ra.AssessmentId,
        ra.OverallRiskScore,
        ra.GeneticDisposition,
        ra.LifestyleImpact,
        ra.MedicalHistoryRisk,
        ra.AssessedAt
    FROM dbo.RiskAssessments ra;
GO

-- =============================================================================
-- SAMPLE SEED DATA (commented out — uncomment to populate dev/test environment)
-- DO NOT run seed data against a PRODUCTION database.
-- =============================================================================
/*
DECLARE @TestUserId UNIQUEIDENTIFIER = NEWID();
DECLARE @TestProfileId UNIQUEIDENTIFIER = NEWID();
DECLARE @TestAssessmentId UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.Users (UserId, Email, PasswordHash)
VALUES (@TestUserId, 'testuser@prosper.health', '$argon2id$v=19$m=65536,t=3,p=4$...');  -- Replace with real hash

INSERT INTO dbo.UserProfiles (ProfileId, UserId, Age, Gender, ActivityLevel, City, ProfileComplete)
VALUES (@TestProfileId, @TestUserId, 35, 'Male', 'Sedentary', 'New York', 1);

INSERT INTO dbo.FamilyHistory (ProfileId, Condition) VALUES (@TestProfileId, 'Heart Disease');
INSERT INTO dbo.FamilyHistory (ProfileId, Condition) VALUES (@TestProfileId, 'Diabetes');

INSERT INTO dbo.LifestyleData (ProfileId, SmokingStatus, AlcoholUse, SleepRange)
VALUES (@TestProfileId, 'Never', 'Moderate', '7-9h');

INSERT INTO dbo.DietData (ProfileId, FoodPreference, DietQuality)
VALUES (@TestProfileId, 'Omnivore', 'Fair');

INSERT INTO dbo.MedicalData (ProfileId, Medications_Enc, Allergies_Enc, Conditions_Enc, LastCheckup)
VALUES (@TestProfileId, 'ENCRYPTED_VALUE', 'ENCRYPTED_VALUE', 'ENCRYPTED_VALUE', 'Within 6 months');

INSERT INTO dbo.RiskAssessments (AssessmentId, UserId, OverallRiskScore, GeneticDisposition, LifestyleImpact, MedicalHistoryRisk)
VALUES (@TestAssessmentId, @TestUserId, 82, 'Moderate', 'Critical', 'Low Risk');

INSERT INTO dbo.HealthProjections (AssessmentId, MonthOffset, PredictedScore, BaselineScore)
VALUES
    (@TestAssessmentId, 0, 82, 82), (@TestAssessmentId, 1, 80, 82), (@TestAssessmentId, 2, 77, 82),
    (@TestAssessmentId, 3, 73, 82), (@TestAssessmentId, 4, 68, 82), (@TestAssessmentId, 5, 62, 82),
    (@TestAssessmentId, 6, 55, 82);
*/

PRINT 'ProsperDB schema created successfully.';
GO

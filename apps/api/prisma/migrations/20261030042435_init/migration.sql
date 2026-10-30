-- CreateTable
CREATE TABLE "Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Office" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 100,
    "address" TEXT
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "face_embedding" TEXT,
    "join_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "role_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "office_id" INTEGER,
    CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "Office" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "check_type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "distance_meters" REAL,
    "mode" TEXT NOT NULL,
    "photo_url" TEXT,
    "face_match_score" REAL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "reason" TEXT,
    "approved_by" INTEGER,
    "approved_at" DATETIME,
    CONSTRAINT "Attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "default_annual_quota" INTEGER NOT NULL,
    "carry_over_allowed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "LeaveQuota" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "quota_days" INTEGER NOT NULL,
    "used_days" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LeaveQuota_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveQuota_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "total_days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" INTEGER,
    "approved_at" DATETIME,
    CONSTRAINT "LeaveRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actor_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "meta" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employee_code_key" ON "User"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_hash_key" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveQuota_user_id_leave_type_id_year_key" ON "LeaveQuota"("user_id", "leave_type_id", "year");

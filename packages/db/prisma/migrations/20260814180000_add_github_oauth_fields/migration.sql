-- AlterTable: Add GitHub OAuth fields to users
ALTER TABLE "users" ADD COLUMN "github_id" TEXT,
ADD COLUMN "github_username" TEXT,
ADD COLUMN "avatar_url" TEXT;

-- Make passwordHash optional (nullable)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Unique constraint on github_id
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

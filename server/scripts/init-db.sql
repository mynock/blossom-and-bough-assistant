-- Database initialization script for PostgreSQL
-- This runs when the PostgreSQL container starts for the first time

-- The database and user are already created by the environment variables
-- This script can be used for additional setup if needed

-- Grant all privileges to the user (already done by default, but explicit)
GRANT ALL PRIVILEGES ON DATABASE blossom_and_bough TO blossom_user;

-- Enable the uuid-ossp extension if needed in the future
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Database is ready for migrations 
@echo off
REM ================================
REM Local MySQL config (session-only)
REM ================================

set PPI_MYSQL_USER=central30_pro_ro
set PPI_MYSQL_PASSWORD=gF4hrE30
set PPI_MYSQL_HOST=10.33.10.101
set PPI_MYSQL_PORT=3306

REM Optional (if your code expects it later)
set PPI_PROJECT_ID=ppi-gcp-pj001

echo.
echo ===== MySQL ENV VARS =====
echo USER=%PPI_MYSQL_USER%
echo HOST=%PPI_MYSQL_HOST%
echo PORT=%PPI_MYSQL_PORT%
echo =========================
echo.

REM ================================
REM Run Go application
REM ================================
go run main.go

pause

run-local.bat

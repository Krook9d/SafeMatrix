@echo off
echo === SafeMatrix Workflow System Restart ===

echo.
echo 1. Stopping workflow containers...
docker-compose stop workflow-scheduler celery-worker celery-flower

echo.
echo 2. Removing workflow containers...
docker-compose rm -f workflow-scheduler celery-worker celery-flower

echo.
echo 3. Rebuilding images...
docker-compose build workflow-scheduler celery-worker celery-flower

echo.
echo 4. Restarting containers...
docker-compose up -d workflow-scheduler celery-worker celery-flower

echo.
echo 5. Checking logs...
timeout 5 > nul
docker-compose logs --tail=20 workflow-scheduler
echo.
echo === Restart completed ===
echo.
echo To view real-time logs:
echo docker-compose logs -f workflow-scheduler celery-worker

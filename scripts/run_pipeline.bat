@echo off
REM ============================================
REM Orbital Junkyard - 자동 데이터 수집 파이프라인
REM Windows Task Scheduler에서 8시간마다 실행
REM ============================================

cd /d C:\databricks_project
set PYTHONIOENCODING=utf-8

REM 가상환경 활성화 후 실행
call .venv\Scripts\activate.bat
python scripts\run_pipeline.py >> logs\pipeline_%date:~0,4%%date:~5,2%%date:~8,2%.log 2>&1

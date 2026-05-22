@echo off
set "SCRIPT_DIR=%~dp0"
set "MAVEN_HOME=%SCRIPT_DIR%apache-maven-3.9.9"
set "PATH=%MAVEN_HOME%\bin;%PATH%"

echo Building and running DynamicPriorityScheduler...
echo.

mvn compile exec:java -Dexec.mainClass=org.cloudbus.cloudsim.examples.DynamicPriorityScheduler

pause

========================================================================
                      INTELLI IPS -- GETTING STARTED
========================================================================

Intelli IPS is an AI-driven Intrusion Prevention System for IoT networks, 
featuring hybrid signature-based and Isolation Forest machine learning anomaly 
detection, visual mesh network animations, scenario demos, and security auditing.

Follow the instructions below to run the application on your computer.

------------------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------------------
Before getting started, make sure you have the following installed:
1. Node.js (v16.0 or higher) - https://nodejs.org/
2. Python (v3.9 or higher)  - https://www.python.org/

------------------------------------------------------------------------
OPTION A: RUNNING IN DEVELOPMENT MODE (RECOMMENDED FOR CODE INSPECTION)
------------------------------------------------------------------------
1. Install Frontend Dependencies:
   Open your terminal/command prompt in the root project directory and run:
   > npm install

2. Set up the Python Backend:
   In the same terminal, set up the virtual environment:
   > cd backend
   > python -m venv venv
   > venv\Scripts\activate
   > pip install -r requirements.txt
   > cd ..

3. Set up the Groq AI Key (Optional):
   The app includes AI-powered Telemetry Audits. To activate them:
   - Create a file named ".env.local" in the project root directory.
   - Add the following line:
     GROQ_API_KEY=your_real_groq_api_key
   - You can get a free key from: https://console.groq.com/keys

4. Run the Application:
   In the root directory, launch the concurrent developer pipeline:
   > npm start

   This will automatically start:
   - The FastAPI backend server on http://localhost:8000
   - The Vite development server on http://localhost:5173
   - The Electron desktop app shell

------------------------------------------------------------------------
OPTION B: INSTALLING THE PACKAGED APP (NSIS INSTALLER)
------------------------------------------------------------------------
If you or your examiners just want to run the fully packaged app:
1. Open the "release\" folder.
2. Double-click the installer: "Intelli IPS Setup 1.0.0.exe"
3. Follow the installation prompts.
4. Launch "Intelli IPS" from your Start Menu or Desktop.
   *Note: The backend starts and operates automatically in the background.*

------------------------------------------------------------------------
HOW TO DEMO THE APP (PROJECT DEFENSE GUIDE)
------------------------------------------------------------------------
1. LOGIN: 
   - Use the credentials (Username: admin, Password: admin).
2. START TRAFFIC: 
   - Click "Start Simulation" in the Overview dashboard or the Network Map.
   - Green particles will start flowing from IoT nodes to the central hub.
3. RETRAIN ML ENGINE:
   - Navigate to the "ML Evaluation" tab in the sidebar.
   - Adjust the contamination rate and tree count sliders.
   - Click "Retrain Isolation Forest" to run backend model updates.
4. LAUNCH SCENARIO:
   - Go to "Network & Sim" -> open "Simulation Lab" on the right.
   - Select a security preset scenario (e.g., "DDoS Attack on Hub") and click "Run".
   - Watch lines turn red and packets flood the gateway until mitigated.
5. INSPECT AI LOGS:
   - Navigate to the "Actions Log" tab.
   - Click on the flagged threat to view explainable AI feature breakdowns.
6. EXPORT PLAYBOOKS & CSV:
   - Click "PowerShell" or "Linux Bash" in the alert diagnostic modal to 
     download operational host firewall blocking scripts.
   - Go to the "Analytics" tab and click "Export CSV" to download the complete 
     security audit spreadsheet.
========================================================================

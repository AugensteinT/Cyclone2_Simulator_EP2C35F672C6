# Web-Based Verilog Simulator

This project provides a lightweight web-based interface for simulating Verilog code.  
It uses **Icarus Verilog (iverilog)** as the backend simulator and a **FastAPI** server to handle simulation requests.  
The frontend (HTML/JS) provides a simple interface to load Verilog modules and interact with inputs/outputs visually.

---

## 🚀 Installation

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install iverilog python3-venv python3-pip
```

### macOS (Homebrew)

`brew install icarus-verilog python3`
### Windows

Download and install Icarus Verilog from:
👉 [https://bleyer.org/icarus/](https://bleyer.org/icarus/)

Also ensure **Python 3.8+** is installed (from [python.org](https://www.python.org/downloads/)).

---

## 🐍 Python Environment Setup

1. Create a virtual environment named `venv`:

   `python3 -m venv venv`

2. Activate the virtual environment:

   * Linux/macOS:

     ```bash
     source venv/bin/activate
     ```
   * Windows (PowerShell):

     ```powershell
     .\venv\Scripts\Activate
     ```

3. Install required Python dependencies:

   ```bash
   pip install fastapi uvicorn python-multipart
   ```

---

## ▶️ Running the Server

Start the FastAPI backend with:

```bash
uvicorn server:app --reload
```

This will launch the server on [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

## 💻 Using the Frontend

Simply open `index.html` in your browser.
The frontend connects to the backend server and allows you to:

* Paste or upload Verilog code
* Run simulations with predefined inputs
* View outputs mapped to LEDs and 7-seg displays

---

## 📂 Project Structure

```
.
├── server.py       # FastAPI backend for simulation
├── index.html      # Frontend interface
├── style.css       # Makes webpage look pretty
├── verilog_sim.js  # Connects to FastAPI backend
├── venv/           # Virtual environment (ignored in Git)
└── README.md       # This file
```

---

## ✅ Notes

* Ensure `iverilog` is installed and accessible in your system `PATH`.
* On Windows, you may need to restart your terminal after installing Icarus Verilog.
* Tested with **Icarus Verilog 12.0** and **Python 3.11**.

---
# Servo Controller Web App

This Flask app sends all four servo angles to the Arduino over USB serial at
9600 baud.

## Run on Windows

From the project root, run:

```powershell
cd web
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

The app tries to detect the Arduino automatically. If detection does not work,
edit `SERIAL_PORT` near the top of `app.py`, for example:

```python
SERIAL_PORT = "COM3"
```

Close PlatformIO Serial Monitor before starting the Python app. Only one
program can use the Arduino COM port at a time.

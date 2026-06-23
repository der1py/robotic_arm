import threading
import time

import serial
from flask import Flask, jsonify, render_template, request
from serial.tools import list_ports


# Set this to a port such as "COM3" to override automatic detection.
SERIAL_PORT = None
BAUD_RATE = 9600
MIN_ANGLE = 0
MAX_ANGLE = 180

app = Flask(__name__)


class ArduinoSerial:
    def __init__(self):
        self.connection = None
        self.port = None
        self.lock = threading.Lock()
        self.last_error = None

    def _detect_port(self):
        if SERIAL_PORT:
            return SERIAL_PORT

        ports = list(list_ports.comports())
        keywords = ("arduino", "ch340", "wch", "cp210", "usb serial")
        for port in ports:
            description = f"{port.description} {port.manufacturer or ''}".lower()
            if any(keyword in description for keyword in keywords):
                return port.device
        return ports[0].device if len(ports) == 1 else None

    def _connect(self):
        if self.connection and self.connection.is_open:
            return

        port = self._detect_port()
        if not port:
            raise serial.SerialException(
                "Arduino serial port was not found. Set SERIAL_PORT in web/app.py."
            )

        self.connection = serial.Serial(port, BAUD_RATE, timeout=1)
        self.port = port
        time.sleep(2)
        self.last_error = None

    def write_angles(self, angles):
        command = ",".join(str(angle) for angle in angles) + "\n"
        with self.lock:
            try:
                self._connect()
                self.connection.write(command.encode("ascii"))
                self.connection.flush()
                self.last_error = None
                return self.port
            except (OSError, serial.SerialException) as error:
                self.last_error = str(error)
                if self.connection:
                    try:
                        self.connection.close()
                    except (OSError, serial.SerialException):
                        pass
                self.connection = None
                self.port = None
                raise

    def status(self):
        with self.lock:
            connected = bool(self.connection and self.connection.is_open)
            return {
                "connected": connected,
                "port": self.port if connected else None,
                "error": self.last_error,
            }


arduino = ArduinoSerial()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/status")
def serial_status():
    return jsonify(arduino.status())


@app.post("/api/servos")
def set_servos():
    data = request.get_json(silent=True)
    values = data.get("values") if isinstance(data, dict) else None

    if not isinstance(values, list) or len(values) != 4:
        return jsonify(error="Exactly four servo values are required."), 400
    if any(isinstance(value, bool) or not isinstance(value, int) for value in values):
        return jsonify(error="All servo values must be integers."), 400
    if any(value < MIN_ANGLE or value > MAX_ANGLE for value in values):
        return jsonify(error="Servo values must be between 0 and 180."), 400

    try:
        port = arduino.write_angles(values)
        return jsonify(ok=True, port=port, values=values)
    except (OSError, serial.SerialException) as error:
        return jsonify(error=f"Arduino connection failed: {error}"), 503


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)

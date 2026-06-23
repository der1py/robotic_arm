#include <Arduino.h>
#include <Servo.h>

Servo servo1;
Servo servo2;
Servo servo3;
Servo servo4;

const int MIN_ANGLE = 0;
const int MAX_ANGLE = 180;

void setup() {
  Serial.begin(9600);

  servo1.attach(3);
  servo2.attach(5);
  servo3.attach(6);
  servo4.attach(9);

  servo1.write(0);
  servo2.write(0);
  servo3.write(0);
  servo4.write(0);
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    int angle1;
    int angle2;
    int angle3;
    int angle4;

    if (sscanf(command.c_str(), "%d,%d,%d,%d", &angle1, &angle2, &angle3,
               &angle4) == 4) {
      angle1 = constrain(angle1, MIN_ANGLE, MAX_ANGLE);
      angle2 = constrain(angle2, MIN_ANGLE, MAX_ANGLE);
      angle3 = constrain(angle3, MIN_ANGLE, MAX_ANGLE);
      angle4 = constrain(angle4, MIN_ANGLE, MAX_ANGLE);

      servo1.write(angle1);
      servo2.write(angle2);
      servo3.write(angle3);
      servo4.write(angle4);
    }
  }
}

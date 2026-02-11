/**
 * LED API for controlling remainder box indicator lights
 * 
 * Box 0 (LED 0): Contains spare parts with length >= 10cm and < 30cm (100mm - 299mm)
 * Box 1 (LED 1): Contains spare parts with length >= 30cm (300mm+)
 */

const LED_API_BASE = 'http://localhost:8081/api/led';

/**
 * Determine which LED/box to use based on the remainder length
 * @param lengthMm Length in millimeters
 * @returns LED ID (0 or 1) or null if length doesn't qualify for either box
 */
export function getLedIdForLength(lengthMm: number): number | null {
  // Box 0: 10cm to <30cm (100mm to 299mm)
  if (lengthMm >= 100 && lengthMm < 300) {
    return 0;
  }
  // Box 1: >=30cm (300mm+)
  if (lengthMm >= 300) {
    return 1;
  }
  // Too small for remainder boxes (< 100mm is waste)
  return null;
}

/**
 * Get the box description for a given length
 * @param lengthMm Length in millimeters
 * @returns Description of which box to use
 */
export function getBoxDescription(lengthMm: number): string {
  const ledId = getLedIdForLength(lengthMm);
  if (ledId === 0) {
    return 'Small Remainder Box (10-30cm)';
  }
  if (ledId === 1) {
    return 'Large Remainder Box (≥30cm)';
  }
  return 'N/A';
}

/**
 * Control an LED state
 * @param ledId The LED identifier (1 or 2)
 * @param state true = ON, false = OFF
 */
export async function setLedState(ledId: number, state: boolean): Promise<void> {
  try {
    const response = await fetch(`${LED_API_BASE}/${ledId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state }),
    });
    
    if (!response.ok) {
      console.warn(`LED API returned status ${response.status} for LED ${ledId}`);
    }
  } catch (error) {
    // Log but don't throw - LED control is non-critical
    console.warn(`Failed to set LED ${ledId} state to ${state}:`, error);
  }
}

/**
 * Turn on the LED for a specific remainder box based on length
 * @param lengthMm Length in millimeters
 */
export async function turnOnLedForLength(lengthMm: number): Promise<void> {
  const ledId = getLedIdForLength(lengthMm);
  if (ledId !== null) {
    await setLedState(ledId, true);
  }
}

/**
 * Turn off the LED for a specific remainder box based on length
 * @param lengthMm Length in millimeters
 */
export async function turnOffLedForLength(lengthMm: number): Promise<void> {
  const ledId = getLedIdForLength(lengthMm);
  if (ledId !== null) {
    await setLedState(ledId, false);
  }
}

/**
 * Turn off all LEDs
 */
export async function turnOffAllLeds(): Promise<void> {
  await Promise.all([
    setLedState(1, false),
    setLedState(2, false),
  ]);
}
